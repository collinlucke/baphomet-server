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
      let collection = db.collection('movies');
      let query = { _id: new ObjectId(id.toString()) };
      return await collection.findOne(query);
    },
    async getAllMovies(_, { limit, searchTerm }) {
      let collection = db.collection('movies');
      const movies = await collection
        .find({ title: new RegExp(searchTerm, 'i') })
        .sort({ title: 1 })
        .limit(limit ? limit : 0)
        .toArray();
      return await movies;
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
