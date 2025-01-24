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
        jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return { isValid: true };
      } catch (error) {
        return { isValid: false, error };
      }
    }
  },

  Mutation: {
    async addMovie(_, { title, releaseDate, rated, poster, fullplot }) {
      let collection = db.collection('movies');
      const insert = await collection.insertOne({
        title,
        releaseDate,
        rated,
        poster,
        fullplot
      });
      if (insert.acknowledged)
        return { title, releaseDate, rated, poster, id: insert.insertedId };
      return null;
    },
    async updateMovie(_, args) {
      const id = new ObjectId(args.id);
      let query = { _id: new ObjectId(id) };
      let collection = db.collection('movies');
      const update = await collection.updateOne(query, { $set: { ...args } });

      if (update.acknowledged) return await collection.findOne(query);

      return null;
    },
    async deleteMovie(_, { id }) {
      let collection = db.collection('movies');
      const dbDelete = await collection.deleteOne({
        _id: new ObjectId(id)
      });
      return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
    },
    async signUp(_, { email, password }) {
      const saltRounds = 10;
      const collection = db.collection('users');
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const user = await collection.insertOne({
        email,
        password: hashedPassword
      });

      return {
        token: generateToken(user, process.env.ACCESS_TOKEN_SECRET, '1h')
      };
    },
    async login(_, { email, password }) {
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
        token: generateToken(user, process.env.ACCESS_TOKEN_SECRET, '1h')
      };
    }
  }
};

export default resolvers;
