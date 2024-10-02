import db from '../server/db/connection.js';
import { ObjectId } from 'mongodb';
import { generateToken } from './generateToken.js';
import bcrypt from 'bcryptjs';

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
    }
  },
  Mutation: {
    async addMovie(_, { title, year, rated, poster, fullplot }) {
      let collection = db.collection('movies');
      const insert = await collection.insertOne({
        title,
        year,
        rated,
        poster,
        fullplot
      });
      if (insert.acknowledged)
        return { title, year, rated, poster, id: insert.insertedId };
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
    async signup(_, { email, password }, { models, secret }) {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const user = await collection.insertOne({
        email,
        password: hashedPassword
      });

      return { token: generateToken(user, secret, '1h') };
    },
    async login(_, { email, password }) {
      let collection = db.collection('baphyUsers');
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
