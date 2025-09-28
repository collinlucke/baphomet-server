import { db } from './dBConnection.js';
import { ObjectId } from 'mongodb';
import { generateToken } from './generateToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const resolvers = {
  Movie: {
    id: parent => parent.id ?? parent._id
  },

  Comparison: {
    id: parent => parent.id ?? parent._id
  },

  Vote: {
    id: parent => parent.id ?? parent._id
  },

  // <<<<<<<<<< ----------- QUERIES ----------- >>>>>>>>>>>>>>> //
  Query: {
    // ----- CHECK AUTH ----- //
    async checkAuth(_, args) {
      const token = args.token;
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return { isValid: true, message: 'Token is valid' };
      } catch (error) {
        return { isValid: false, message: error.message };
      }
    },

    // ----- GET MOVIES ----- //
    async getMovies(
      _,
      { title, limit, cursor, sortBy = 'title', sortOrder = 'asc' }
    ) {
      const collection = db.collection('movies');
      const parsedLimit = Number(limit) || 20;
      const trimmedTitle = title?.trim();

      const queryConditions = [];

      if (trimmedTitle) {
        queryConditions.push({
          title: { $regex: trimmedTitle, $options: 'i' }
        });
      }
      if (cursor) {
        queryConditions.push({ [sortBy]: { $gt: cursor } });
      }

      const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

      const countQuery = trimmedTitle
        ? { title: { $regex: trimmedTitle, $options: 'i' } }
        : {};

      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const validSortFields = ['title', 'releaseDate', 'winningPercentage'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'title';

      const [searchResults, newTotalMovieCount] = await Promise.all([
        collection
          .find(query)
          .sort({ [sortField]: sortDirection, title: 1 })
          .limit(parsedLimit)
          .toArray(),
        collection.countDocuments(countQuery)
      ]);

      const endOfResults = searchResults.length < parsedLimit;
      const newCursor = searchResults.at(-1)?.[sortField] || '';
      return {
        searchResults,
        newTotalMovieCount,
        newCursor,
        endOfResults
      };
    },

    // ----- GET MOVIE BY TMDB ID ----- //
    async getMovieByTmdbId(_, { tmdbId }) {
      const collection = db.collection('movies');

      try {
        const theMovie = await collection.findOne({
          tmdbId
        });

        if (!theMovie) {
          return {
            found: false,
            movie: null,
            errorMessage: null
          };
        }
        return {
          found: true,
          movie: theMovie,
          errorMessage: null
        };
      } catch (error) {
        console.error(
          'Error getting movie from the database by TMDB ID:',
          error
        );
        return {
          found: false,
          movie: null,
          errorMessage: `Error getting movie from the database by TMDB ID: ${error.message}`
        };
      }
    },

    async fetchMovieFromTmdb(_, { tmdbId }) {
      const newMovie = {};
      const responses = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${process.env.TMDB_API_KEY}`
        ),
        fetch(
          `https://api.themoviedb.org/3/movie/${tmdbId}/credits?api_key=${process.env.TMDB_API_KEY}`
        )
      ]);
      const [response, creditsResponse] = responses;

      if (!response.ok) {
        throw new Error('Failed to fetch movie from TMDB');
      }
      if (!creditsResponse.ok) {
        throw new Error('Failed to fetch movie credits from TMDB');
      }

      const movieData = await response.json();
      const creditsData = await creditsResponse.json();

      const genres = movieData.genres.map(genre => genre.name);

      const topBilledCast = creditsData.cast.slice(0, 10).map(member => ({
        id: member.id,
        name: member.name,
        role: member.character,
        profilePath: member.profile_path,
        order: member.order
      }));

      const directors = creditsData.crew
        .filter(member => member.job === 'Director')
        .map(director => ({
          id: director.id,
          name: director.name,
          profilePath: director.profile_path,
          role: 'Director'
        }));

      newMovie.title = movieData.title || 'Unknown Title';
      newMovie.releaseDate = movieData.release_date || '';
      newMovie.genres = genres || [];
      newMovie.revenue = movieData.revenue || '';
      newMovie.posterPath = movieData.poster_path || '';
      newMovie.backdropPath = movieData.backdrop_path || '';
      newMovie.tmdbId = movieData.id || '';
      newMovie.overview = movieData.overview || '';
      newMovie.tagline = movieData.tagline || '';
      newMovie.topBilledCast = topBilledCast || [];
      newMovie.directors = directors || [];

      return newMovie;
    },

    async fetchPossibleMovieMatches(_, { title }) {
      const response = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${title}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch possible movies from TMDB');
      }
      const possibleMovieData = await response.json();

      const normalizedMovieResults = possibleMovieData.results.map(movie => ({
        id: movie.id,
        title: movie.title,
        releaseDate: movie.release_date,
        overview: movie.overview,
        posterPath: movie.poster_path,
        backdropPath: movie.backdrop_path,
        revenue: movie.revenue,
        tagline: movie.tagline,
        topBilledCast: movie.cast,
        directors: movie.directors
      }));

      return { ...possibleMovieData, results: normalizedMovieResults };
    },

    // ----- GET MOVIE DETAILS ----- //
    async getMovieDetails(_, { id }) {
      const collection = db.collection('movies');
      let movie;

      if (!isNaN(parseInt(id))) {
        movie = await collection.findOne({ _id: parseInt(id) });
      }

      if (!movie) {
        throw new Error('Movie not found');
      }

      return movie;
    },

    // ----- GET RANDOM MOVIE MATCHUP ----- //
    async getRandomMovieMatchup(_, args, context) {
      const collection = db.collection('movies');

      const totalMovies = await collection.countDocuments();

      if (totalMovies < 2) {
        throw new Error(
          'Not enough movies available for matchup. Need at least 2 movies.'
        );
      }

      const randomMovies = await collection
        .aggregate([{ $sample: { size: 2 } }])
        .toArray();

      if (randomMovies.length < 2) {
        throw new Error('Could not retrieve two movies for matchup.');
      }

      const [movie1, movie2] = randomMovies;

      const comparisonsCollection = db.collection('comparisons');
      let comparison = await comparisonsCollection.findOne({
        $or: [
          { movie1Id: movie1._id, movie2Id: movie2._id },
          { movie1Id: movie2._id, movie2Id: movie1._id }
        ]
      });

      if (!comparison) {
        const newComparison = {
          movie1Id: movie1._id,
          movie2Id: movie2._id,
          movie1Wins: 0,
          movie2Wins: 0,
          totalVotes: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await comparisonsCollection.insertOne(newComparison);
        comparison = { ...newComparison, _id: result.insertedId };
      }

      return {
        movie1,
        movie2,
        comparisonId: comparison._id
      };
    },

    // ----- GET RANDOM BACKDROP IMAGE ----- //
    async getRandomBackdropImage(_, {}) {
      const collection = db.collection('movies');
      const getMovie = async () =>
        await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
      const movie = await getMovie();

      if (!movie) {
        throw new Error('Movie not found');
      }

      if (!movie[0].backdropPath) {
        getMovie();
      }

      return { backdropPath: movie[0].backdropPath };
    },

    // ----- GET USER DETAILS ----- //
    async getUserDetails(_, { userId }, context) {
      const usersCollection = db.collection('users');
      const votesCollection = db.collection('votes');
      const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
      if (!user) return null;

      const totalVotes = await votesCollection.countDocuments({
        userId: userId
      });

      return {
        id: user._id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        totalVotes,
        joinDate: user.joinDate,
        role: user.role,
        avatarUrl: user.avatarUrl,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified
      };
    },

    // ----- GET USER LEADERBOARD ----- //
    async getUserLeaderboard(_, { cursor = '' }, context) {
      const usersCollection = db.collection('users');
      const queryConditions = [];

      if (cursor) {
        try {
          const cursorData = JSON.parse(cursor);
          queryConditions.push({
            $or: [
              { totalVotes: { $lt: cursorData.totalVotes } },
              {
                totalVotes: cursorData.totalVotes,
                joinDate: { $gt: new Date(cursorData.joinDate) }
              }
            ]
          });
        } catch (error) {
          console.warn(
            'Invalid cursor provided to getUserLeaderboard:',
            cursor
          );
        }
      }

      const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

      const users = await usersCollection
        .find(query)
        .sort({ totalVotes: -1, joinDate: 1 })
        .limit(25)
        .toArray();
      const endOfResults = users.length < 25;

      let newCursor = '';
      if (users.length > 0 && !endOfResults) {
        const lastUser = users[users.length - 1];
        newCursor = JSON.stringify({
          totalVotes: lastUser.totalVotes,
          joinDate: lastUser.joinDate.toISOString()
        });
      }

      return {
        users: users.map(user => ({
          ...user,
          id: user._id
        })),
        newCursor,
        endOfResults
      };
    }
  },

  // <<<<<<<<<< ----------- MUTATIONS ----------- >>>>>>>>>>>>>>> //
  Mutation: {
    async addMovie(
      _,
      {
        title,
        releaseDate,
        overview,
        genres,
        revenue,
        posterPath,
        backdropPath,
        tmdbId,
        addedBy,
        lastUpdated,
        createdAt,
        totalWins,
        totalLosses,
        winningPercentage,
        totalComparisons
      },
      context
    ) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to add movies');
      }

      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');

      // Generate a 5-digit numeric ID (10000-99999)
      const generateNumericId = () => Math.floor(10000 + Math.random() * 90000);

      // Make sure the generated ID doesn't already exist
      let numericId;
      let idExists = true;

      while (idExists) {
        numericId = generateNumericId();
        const existingMovie = await collection.findOne({ _id: numericId });
        idExists = !!existingMovie;
      }

      const movieData = {
        _id: numericId, // Use the numeric ID as primary key
        title,
        releaseDate,
        overview,
        genres,
        revenue,
        posterPath,
        backdropPath,
        tmdbId,
        addedBy,
        lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        totalWins: totalWins || 0,
        totalLosses: totalLosses || 0,
        winningPercentage: winningPercentage || 0.0,
        totalComparisons: totalComparisons || 0
      };

      const insert = await collection.insertOne(movieData);

      if (insert.acknowledged) {
        return {
          ...movieData,
          id: numericId // Return the numeric ID directly
        };
      }
      return null;
    },

    async updateMovie(_, args, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to update movies');
      }

      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');
      const { id, ...updateFields } = args;
      const numericId = parseInt(id);

      const movieInDb = await collection.findOne({ _id: numericId });

      const update = await collection.updateOne(
        { _id: numericId },
        { $set: { ...movieInDb, ...updateFields } }
      );

      if (update.acknowledged)
        return await collection.findOne({ _id: numericId });

      return null;
    },

    async deleteMovie(_, { id }, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to delete movies');
      }

      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');
      const dbDelete = await collection.deleteOne({
        _id: new ObjectId(id)
      });
      return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
    },
    async login(_, { emailOrUsername, password }) {
      let collection = db.collection('users');
      const user = await collection.findOne({
        $or: [{ email: emailOrUsername }, { username: emailOrUsername }]
      });

      if (!user) {
        throw new Error(
          "This username/email and password combination doesn't exist."
        );
      }

      const valid = await bcrypt.compare(
        password,
        user.passwordHash || user.password
      );

      if (!valid) {
        throw new Error(
          "This username/email and password combination doesn't exist."
        );
      }

      await collection.updateOne(
        { _id: user._id },
        {
          $set: {
            lastLogin: new Date(),
            updatedAt: new Date()
          }
        }
      );

      return {
        token: generateToken(
          { id: user._id, email: user.email },
          process.env.ACCESS_TOKEN_SECRET,
          '7d'
        ),
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          avatarUrl: user.avatarUrl,
          birthday: user.birthday,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          totalVotes: user.totalVotes || 0,
          joinDate: (user.joinDate || user.createdAt).toISOString(),
          role: user.role || 'user',
          emailVerified: user.emailVerified || false
        }
      };
    },
    async signup(
      _,
      { username, email, password, displayName, firstName, lastName, birthday }
    ) {
      let collection = db.collection('users');

      const invalidValues = [
        null,
        undefined,
        'null',
        'undefined',
        '',
        'NULL',
        'UNDEFINED'
      ];
      const trimmedUsername = username?.trim();
      const trimmedDisplayName = displayName?.trim();

      if (
        !trimmedUsername ||
        invalidValues.includes(username) ||
        invalidValues.includes(trimmedUsername)
      ) {
        throw new Error("You're a stupid idiot.");
      }

      if (
        displayName !== undefined &&
        (!trimmedDisplayName ||
          invalidValues.includes(displayName) ||
          invalidValues.includes(trimmedDisplayName))
      ) {
        throw new Error("You're a stupid idiot.");
      }

      const existingUser = await collection.findOne({
        $or: [{ email }, { username }]
      });

      if (existingUser) {
        if (existingUser.email === email) {
          throw new Error('An account with this email already exists.');
        }
        if (existingUser.username === username) {
          throw new Error('This username is already taken.');
        }
      }

      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const newUser = {
        username,
        email,
        passwordHash,
        role: 'user',
        totalVotes: 0,
        joinDate: new Date(),
        lastLogin: new Date(),
        isActive: true,
        displayName: displayName || username,
        firstName,
        lastName,
        birthday,
        emailVerified: false,
        verificationToken: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await collection.insertOne(newUser);

      if (!result.acknowledged) {
        throw new Error('Failed to create user account.');
      }

      return {
        token: generateToken(
          { id: result.insertedId, email },
          process.env.ACCESS_TOKEN_SECRET,
          '6h'
        ),
        user: {
          id: result.insertedId,
          username,
          email,
          displayName: displayName || username,
          firstName,
          lastName,
          birthday,
          totalVotes: 0,
          joinDate: newUser.joinDate.toISOString(),
          role: 'user',
          emailVerified: false
        }
      };
    },

    async submitVote(_, { movie1Id, movie2Id, winnerId }, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to submit votes');
      }

      let decoded;
      try {
        decoded = jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      const userId = new ObjectId(decoded.id);
      const movie1ObjectId = new ObjectId(movie1Id);
      const movie2ObjectId = new ObjectId(movie2Id);
      const winnerObjectId = new ObjectId(winnerId);

      if (
        !winnerObjectId.equals(movie1ObjectId) &&
        !winnerObjectId.equals(movie2ObjectId)
      ) {
        throw new Error(
          'Winner must be one of the two movies in the comparison'
        );
      }

      const comparisonsCollection = db.collection('comparisons');
      const votesCollection = db.collection('votes');

      let comparison = await comparisonsCollection.findOne({
        $or: [
          { movie1Id: movie1ObjectId, movie2Id: movie2ObjectId },
          { movie1Id: movie2ObjectId, movie2Id: movie1ObjectId }
        ]
      });

      if (!comparison) {
        const newComparison = {
          movie1Id: movie1ObjectId,
          movie2Id: movie2ObjectId,
          movie1Wins: 0,
          movie2Wins: 0,
          totalVotes: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await comparisonsCollection.insertOne(newComparison);
        comparison = { ...newComparison, _id: result.insertedId };
      }

      const existingVote = await votesCollection.findOne({
        userId: userId,
        comparisonId: comparison._id
      });

      if (existingVote) {
        return {
          success: false,
          message: 'You have already voted on this matchup',
          comparison
        };
      }

      const voteRecord = {
        userId: userId,
        comparisonId: comparison._id,
        movie1Id: movie1ObjectId,
        movie2Id: movie2ObjectId,
        winnerId: winnerObjectId,
        timestamp: new Date(),
        sessionId: context.sessionId || null,
        userAgent: context.userAgent || null
      };

      await votesCollection.insertOne(voteRecord);

      const isMovie1Winner = winnerObjectId.equals(comparison.movie1Id);
      const updateFields = {
        totalVotes: comparison.totalVotes + 1,
        updatedAt: new Date()
      };

      if (isMovie1Winner) {
        updateFields.movie1Wins = comparison.movie1Wins + 1;
      } else {
        updateFields.movie2Wins = comparison.movie2Wins + 1;
      }

      await comparisonsCollection.updateOne(
        { _id: comparison._id },
        { $set: updateFields }
      );

      const moviesCollection = db.collection('movies');
      const winner = winnerObjectId;
      const loser = winnerObjectId.equals(movie1ObjectId)
        ? movie2ObjectId
        : movie1ObjectId;

      await moviesCollection.updateOne(
        { _id: winner },
        {
          $inc: {
            totalWins: 1,
            totalComparisons: 1
          }
        }
      );

      await moviesCollection.updateOne(
        { _id: loser },
        {
          $inc: {
            totalLosses: 1,
            totalComparisons: 1
          }
        }
      );

      const [winnerMovie, loserMovie] = await Promise.all([
        moviesCollection.findOne({ _id: winner }),
        moviesCollection.findOne({ _id: loser })
      ]);

      if (winnerMovie) {
        const winnerPercentage =
          (winnerMovie.totalWins / winnerMovie.totalComparisons) * 100;
        await moviesCollection.updateOne(
          { _id: winner },
          {
            $set: {
              winningPercentage: Math.round(winnerPercentage * 100) / 100
            }
          }
        );
      }

      if (loserMovie) {
        const loserPercentage =
          (loserMovie.totalWins / loserMovie.totalComparisons) * 100;
        await moviesCollection.updateOne(
          { _id: loser },
          {
            $set: { winningPercentage: Math.round(loserPercentage * 100) / 100 }
          }
        );
      }

      const usersCollection = db.collection('users');
      await usersCollection.updateOne(
        { _id: userId },
        {
          $inc: { totalVotes: 1 },
          $set: { lastLogin: new Date(), updatedAt: new Date() }
        }
      );

      const updatedComparison = await comparisonsCollection.findOne({
        _id: comparison._id
      });

      return {
        success: true,
        message: 'Vote submitted successfully',
        comparison: updatedComparison
      };
    },

    async cleanupVotes(_, { userId, movieId, resetAll }, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in for vote cleanup');
      }

      let decoded;
      try {
        decoded = jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      const usersCollection = db.collection('users');
      const user = await usersCollection.findOne({
        _id: new ObjectId(decoded.id)
      });

      if (!user || user.role !== 'admin') {
        throw new Error('Admin privileges required for vote cleanup');
      }

      const votesCollection = db.collection('votes');
      const comparisonsCollection = db.collection('comparisons');
      const moviesCollection = db.collection('movies');

      try {
        let deletedVotes = 0;
        let affectedUsers = 0;
        let affectedMovies = 0;

        if (resetAll) {
          const voteCount = await votesCollection.countDocuments();
          const comparisonCount = await comparisonsCollection.countDocuments();
          const movieCount = await moviesCollection.countDocuments();
          const userCount = await usersCollection.countDocuments();

          await votesCollection.deleteMany({});
          await comparisonsCollection.deleteMany({});

          await moviesCollection.updateMany(
            {},
            {
              $set: {
                totalWins: 0,
                totalLosses: 0,
                totalComparisons: 0,
                winningPercentage: 0.0,
                lastUpdated: new Date()
              }
            }
          );

          await usersCollection.updateMany(
            {},
            {
              $set: {
                totalVotes: 0,
                updatedAt: new Date()
              }
            }
          );

          return {
            success: true,
            message: `Complete reset: Deleted ${voteCount} votes, ${comparisonCount} comparisons. Reset ${movieCount} movies and ${userCount} users.`,
            deletedVotes: voteCount,
            affectedUsers: userCount,
            affectedMovies: movieCount
          };
        } else if (userId && movieId) {
          const userObjectId = new ObjectId(userId);
          const movieObjectId = new ObjectId(movieId);

          const deleteResult = await votesCollection.deleteMany({
            userId: userObjectId,
            $or: [
              { winnerId: movieObjectId },
              { movie1Id: movieObjectId },
              { movie2Id: movieObjectId }
            ]
          });

          return {
            success: true,
            message: `Removed ${deleteResult.deletedCount} votes for user-movie combination`,
            deletedVotes: deleteResult.deletedCount,
            affectedUsers: 1,
            affectedMovies: 1
          };
        } else if (userId) {
          const userObjectId = new ObjectId(userId);
          const deleteResult = await votesCollection.deleteMany({
            userId: userObjectId
          });

          await usersCollection.updateOne(
            { _id: userObjectId },
            { $set: { totalVotes: 0, updatedAt: new Date() } }
          );

          return {
            success: true,
            message: `Removed ${deleteResult.deletedCount} votes for user`,
            deletedVotes: deleteResult.deletedCount,
            affectedUsers: 1,
            affectedMovies: 0
          };
        } else if (movieId) {
          const movieObjectId = new ObjectId(movieId);

          const deleteResult = await votesCollection.deleteMany({
            $or: [
              { winnerId: movieObjectId },
              { movie1Id: movieObjectId },
              { movie2Id: movieObjectId }
            ]
          });

          await moviesCollection.updateOne(
            { _id: movieObjectId },
            {
              $set: {
                totalWins: 0,
                totalLosses: 0,
                totalComparisons: 0,
                winningPercentage: 0.0,
                lastUpdated: new Date()
              }
            }
          );

          return {
            success: true,
            message: `Removed ${deleteResult.deletedCount} votes for movie`,
            deletedVotes: deleteResult.deletedCount,
            affectedUsers: 0,
            affectedMovies: 1
          };
        } else {
          throw new Error('Must specify userId, movieId, or resetAll=true');
        }
      } catch (error) {
        return {
          success: false,
          message: `Cleanup failed: ${error.message}`,
          deletedVotes: 0,
          affectedUsers: 0,
          affectedMovies: 0
        };
      }
    },
    async updateProfile(
      _,
      {
        id,
        displayName,
        firstName,
        lastName,
        birthday,
        email,
        username,
        avatarUrl
      },
      context
    ) {
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to update profile');
      }

      let decoded;
      try {
        decoded = jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      // Verify that the user is updating their own profile or is an admin
      if (decoded.id !== id && decoded.role !== 'admin') {
        throw new Error('You can only update your own profile');
      }

      const usersCollection = db.collection('users');
      const userId = new ObjectId(id);

      // If email is being changed, check for duplicates
      if (email) {
        const existingUser = await usersCollection.findOne({
          email,
          _id: { $ne: userId }
        });

        if (existingUser) {
          throw new Error('This email address is already in use');
        }
      }

      const updateData = {};

      if (displayName) updateData.displayName = displayName;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (birthday !== undefined) updateData.birthday = birthday;
      if (email) updateData.email = email;
      if (username) updateData.username = username;
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;

      updateData.updatedAt = new Date();

      const result = await usersCollection.updateOne(
        { _id: userId },
        { $set: updateData }
      );

      if (!result.acknowledged) {
        throw new Error('Failed to update profile');
      }

      const updatedUser = await usersCollection.findOne({ _id: userId });

      if (!updatedUser) {
        throw new Error('User not found');
      }

      return {
        id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        displayName: updatedUser.displayName,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        birthday: updatedUser.birthday,
        totalVotes: updatedUser.totalVotes || 0,
        joinDate: (updatedUser.joinDate || updatedUser.createdAt).toISOString(),
        role: updatedUser.role || 'user',
        emailVerified: updatedUser.emailVerified || false
      };
    },

    async changePassword(_, { id, currentPassword, newPassword }, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to change password');
      }

      let decoded;
      try {
        decoded = jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      // Verify that the user is changing their own password or is an admin
      if (decoded.id !== id && decoded.role !== 'admin') {
        throw new Error('You can only change your own password');
      }

      const usersCollection = db.collection('users');
      const userId = new ObjectId(id);

      const user = await usersCollection.findOne({ _id: userId });

      if (!user) {
        throw new Error('User not found');
      }

      const valid = await bcrypt.compare(
        currentPassword,
        user.passwordHash || user.password
      );

      if (!valid) {
        throw new Error('Current password is incorrect');
      }

      const saltRounds = 10;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      const result = await usersCollection.updateOne(
        { _id: userId },
        {
          $set: {
            passwordHash: newPasswordHash,
            updatedAt: new Date()
          }
        }
      );

      if (!result.acknowledged) {
        throw new Error('Failed to update password');
      }

      return {
        token: generateToken(
          { id: user._id, email: user.email },
          process.env.ACCESS_TOKEN_SECRET,
          '7d'
        ),
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          firstName: user.firstName,
          lastName: user.lastName,
          birthday: user.birthday,
          totalVotes: user.totalVotes || 0,
          joinDate: (user.joinDate || user.createdAt).toISOString(),
          role: user.role || 'user',
          emailVerified: user.emailVerified || false
        }
      };
    },

    submitFeedback: async (_, { email, comments, timestamp }) => {
      const feedbackCollection = db.collection('feedback');
      try {
        const feedback = {
          email,
          comments,
          timestamp
        };
        const result = await feedbackCollection.insertOne(feedback);
        return {
          success: true,
          message: 'Feedback submitted successfully',
          feedback: {
            id: result.insertedId,
            ...feedback
          }
        };
      } catch (error) {
        return {
          success: false,
          message: `Feedback submission failed: ${error.message}`
        };
      }
    }
  }
};

export default resolvers;
