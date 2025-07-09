import db from './dBConnection.js';
import { ObjectId } from 'mongodb';
import { generateToken } from './generateToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const resolvers = {
  Movie: {
    id: parent => parent.id ?? parent._id
  },
  Query: {
    async getMovie(_, { id }) {
      let collection = db.collection('devMovies');
      let query = { _id: new ObjectId(id.toString()) };
      return await collection.findOne(query);
    },
    async getAllMovies(
      _,
      { limit = 20, searchTerm = '', cursor = '', loadAction = 'scroll' }
    ) {
      let collection = db.collection('devMovies');
      collection.createIndex({ title: 1 });

      const baseQuery = {
        $and: [
          { title: new RegExp(searchTerm, 'i') },
          { title: { $gt: cursor } }
        ]
      };

      const newTotalMovieCount = await collection.countDocuments({
        title: new RegExp(searchTerm, 'i')
      });

      const newMovies = await collection
        .aggregate([
          { $match: baseQuery },
          { $sort: { title: 1 } },
          { $limit: limit }
        ])
        .toArray();

      const endOfResults = newMovies.length < limit;

      if (!newMovies.length) {
        return {
          newMovies: [],
          newTotalMovieCount: 0,
          newCursor: '',
          loadAction,
          endOfResults
        };
      }

      return {
        newMovies,
        newTotalMovieCount,
        newCursor: newMovies[newMovies.length - 1].title || '',
        loadAction,
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
    async addMovie(_, { title, releaseDate, rated, poster, fullplot }, context) {
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to add movies');
      }

      try {
        jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('devMovies');
      const insert = await collection.insertOne({
        title,
        releaseDate,
        rated,
        poster,
        fullplot
      });
      if (insert.acknowledged)
        return { title, releaseDate, rated, poster, fullplot, id: insert.insertedId };
      return null;
    },
    async updateMovie(_, args, context) {
      // This operation requires authentication
      const token = context.token;
      if (!token) {
        throw new Error('Authentication required to update movies');
      }

      try {
        jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      const id = new ObjectId(args.id);
      let query = { _id: new ObjectId(id) };
      let collection = db.collection('devMovies');
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
        jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('devMovies');
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
        throw new Error('User does not exist.');
      }

      const valid = await bcrypt.compare(password, user.password);

      if (!valid) {
        throw new Error('Invalid password.');
      }
      return {
        token: generateToken({ id: user._id, email: user.email }, process.env.ACCESS_TOKEN_SECRET, '1h')
      };
    }
  }
};

export default resolvers;
