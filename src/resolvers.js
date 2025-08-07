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

      console.log('getMoviesByTitle called with:', {
        title: trimmedTitle,
        limit: parsedLimit,
        cursor
      });

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
    }
  }
};

export default resolvers;
