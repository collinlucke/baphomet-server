import db from './dBConnection.js';
import { ObjectId } from 'mongodb';
import { generateToken } from './generateToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Helper function for TMDB ID search

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
    async getMovieByTmdbId(tmdbId) {
      const collection = db.collection('movies');
      const searchConditions = [{ tmdbId: tmdbId }];

      const baseQuery = { $and: queryConditions };
      const countQuery = { $or: searchConditions };

      const theMovie = await collection.findOne({
        tmdbId: tmdbId
      });

      if (!theMovie) {
        return new Error('No movies found with the provided TMDB ID');
      }

      return theMovie;
    },

    async getMoviesByTitle(_, { title, limit, cursor }) {
      const collection = db.collection('movies');
      const parsedLimit = Number(limit) || 20;
      const trimmedTitle = title?.trim();

      // Build query conditions
      const queryConditions = [];

      // Add title search condition if title is provided
      if (trimmedTitle) {
        queryConditions.push({
          title: { $regex: trimmedTitle, $options: 'i' }
        });
      }

      // Add cursor condition for pagination using title
      if (cursor) {
        queryConditions.push({ title: { $gt: cursor } });
      }

      // Build final query
      const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

      // Count query - only for title search, not cursor
      const countQuery = trimmedTitle
        ? { title: { $regex: trimmedTitle, $options: 'i' } }
        : {};

      const [searchResults, newTotalMovieCount] = await Promise.all([
        collection.find(query).sort({ title: 1 }).limit(parsedLimit).toArray(),
        collection.countDocuments(countQuery)
      ]);

      const endOfResults = searchResults.length < parsedLimit;
      const newCursor = searchResults.at(-1)?.title || '';

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

      // Get total count of movies
      const totalMovies = await collection.countDocuments();

      if (totalMovies < 2) {
        throw new Error(
          'Not enough movies available for matchup. Need at least 2 movies.'
        );
      }

      // Get two random movies using aggregation pipeline
      const randomMovies = await collection
        .aggregate([{ $sample: { size: 2 } }])
        .toArray();

      if (randomMovies.length < 2) {
        throw new Error('Could not retrieve two movies for matchup.');
      }

      const [movie1, movie2] = randomMovies;

      // Check if comparison already exists between these movies
      const comparisonsCollection = db.collection('comparisons');
      let comparison = await comparisonsCollection.findOne({
        $or: [
          { movie1Id: movie1._id, movie2Id: movie2._id },
          { movie1Id: movie2._id, movie2Id: movie1._id }
        ]
      });

      // If no comparison exists, create one
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
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to add movies');
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
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to update movies');
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
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to delete movies');
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
      // Public operation - no authentication required
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

      // Update last login
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
      // Public operation - no authentication required
      let collection = db.collection('users');

      // Check if user already exists
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

      // Hash password
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create new user
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

      // Return token and user info
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
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to submit votes');
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

      // Validate that winnerId is one of the two movies
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

      // Find or create comparison
      let comparison = await comparisonsCollection.findOne({
        $or: [
          { movie1Id: movie1ObjectId, movie2Id: movie2ObjectId },
          { movie1Id: movie2ObjectId, movie2Id: movie1ObjectId }
        ]
      });

      if (!comparison) {
        // Create new comparison
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

      // Check if user has already voted on this comparison
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

      // Create vote record
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

      // Update comparison statistics
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

      // Update movie statistics
      const moviesCollection = db.collection('movies');
      const winner = winnerObjectId;
      const loser = winnerObjectId.equals(movie1ObjectId)
        ? movie2ObjectId
        : movie1ObjectId;

      // Update winner stats
      await moviesCollection.updateOne(
        { _id: winner },
        {
          $inc: {
            totalWins: 1,
            totalComparisons: 1
          }
        }
      );

      // Update loser stats
      await moviesCollection.updateOne(
        { _id: loser },
        {
          $inc: {
            totalLosses: 1,
            totalComparisons: 1
          }
        }
      );

      // Update winning percentages for both movies
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

      // Update user's total vote count
      const usersCollection = db.collection('users');
      await usersCollection.updateOne(
        { _id: userId },
        {
          $inc: { totalVotes: 1 },
          $set: { lastLogin: new Date(), updatedAt: new Date() }
        }
      );

      // Get updated comparison
      const updatedComparison = await comparisonsCollection.findOne({
        _id: comparison._id
      });
      console.log(updatedComparison);

      return {
        success: true,
        message: 'Vote submitted successfully',
        comparison: updatedComparison
      };
    },

    async cleanupVotes(_, { userId, movieId, resetAll }, context) {
      // This operation requires admin authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required for vote cleanup');
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

      // Check if user is admin
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
          // Complete reset
          const voteCount = await votesCollection.countDocuments();
          const comparisonCount = await comparisonsCollection.countDocuments();
          const movieCount = await moviesCollection.countDocuments();
          const userCount = await usersCollection.countDocuments();

          // Delete all votes and comparisons
          await votesCollection.deleteMany({});
          await comparisonsCollection.deleteMany({});

          // Reset all movie statistics
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

          // Reset all user vote counts
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
          // Remove votes for specific user-movie combination
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
          // Remove all votes for specific user
          const userObjectId = new ObjectId(userId);
          const deleteResult = await votesCollection.deleteMany({
            userId: userObjectId
          });

          // Reset user's vote count
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
          // Remove all votes for specific movie
          const movieObjectId = new ObjectId(movieId);

          const deleteResult = await votesCollection.deleteMany({
            $or: [
              { winnerId: movieObjectId },
              { movie1Id: movieObjectId },
              { movie2Id: movieObjectId }
            ]
          });

          // Reset movie's statistics
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
    }
  }
};

export default resolvers;
