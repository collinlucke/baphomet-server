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

  Query: {
    async getMovieByTmdbId(_, { tmdbId }) {
      const collection = db.collection('movies');
      const theMovie = await collection.findOne({
        tmdbId
      });

      if (!theMovie) {
        return new Error('No movies found with the provided TMDB ID');
      }

      return theMovie;
    },

    async getMoviesByTitle(
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

    async checkAuth(_, args) {
      const token = args.token;
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return { isValid: true, message: 'Token is valid' };
      } catch (error) {
        return { isValid: false, message: error.message };
      }
    },

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

    async getRandomBackdropImage(_, {}) {
      const collection = db.collection('movies');
      const getMovie = async () =>
        await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
      const movie = await getMovie();

      if (!movie) {
        throw new Error('Movie not found');
      }

      if (!movie[0].backdropUrl) {
        getMovie();
      }

      return { backdropUrl: movie[0].backdropUrl };
    },

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
        emailVerified: user.emailVerified
      };
    },

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

  Mutation: {
    async addMovie(
      _,
      {
        title,
        releaseDate,
        overview,
        genres,
        revenue,
        posterUrl,
        backdropUrl,
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
      const movieData = {
        title,
        releaseDate,
        overview,
        genres,
        revenue,
        posterUrl,
        backdropUrl,
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
          id: insert.insertedId
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

      const id = new ObjectId(args.id);
      let query = { _id: new ObjectId(id) };
      let collection = db.collection('movies');
      const update = await collection.updateOne(query, { $set: { ...args } });

      if (update.acknowledged) return await collection.findOne(query);

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
    async login(_, { email, password }) {
      let collection = db.collection('users');
      const user = await collection.findOne({
        email
      });

      if (!user) {
        throw new Error(
          "This email address and password combination doesn't exist."
        );
      }

      const valid = await bcrypt.compare(
        password,
        user.passwordHash || user.password
      );

      if (!valid) {
        throw new Error(
          "This email address and password combination doesn't exist."
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

      const expiration = user.role === 'admin' ? '8h' : '2h';

      return {
        token: generateToken(
          { id: user._id, email: user.email },
          process.env.ACCESS_TOKEN_SECRET,
          expiration
        ),
        user: {
          id: user._id,
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
    async signup(_, { username, email, password, displayName }) {
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
