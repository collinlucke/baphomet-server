import db from '../db/connection.js';
import { ObjectId } from 'mongodb';

const resolvers = {
  Movie: {
    id: (parent) => parent.id ?? parent._id,
  },
  Query: {
    async movie(_, { id }) {
      console.log(id);
      let collection = db.collection('movies');
      let query = { _id: new ObjectId(id.toString()) };
      console.log(query);

      return await collection.findOne(query);
    },
    async movies(_, __, context) {
      let collection = db.collection('movies');
      const movies = await collection.find({}).toArray();
      return movies;
    },
  },
  Mutation: {
    async addMovie(_, { title, year, rated }, context) {
      let collection = db.collection('movies');
      const insert = await collection.insertOne({ title, year, rated });
      if (insert.acknowledged)
        return { title, year, rated, id: insert.insertedId };
      return null;
    },
    async updateMovie(_, args, context) {
      const id = new ObjectId(args.id);
      let query = { _id: new ObjectId(id) };
      let collection = db.collection('movies');
      const update = await collection.updateOne(query, { $set: { ...args } });

      if (update.acknowledged) return await collection.findOne(query);

      return null;
    },
    async deleteMovie(_, { id }, context) {
      let collection = db.collection('movies');
      const dbDelete = await collection.deleteOne({ _id: new ObjectId(id) });
      return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
    },
  },
};

export default resolvers;
