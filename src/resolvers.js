import db from '../server/db/connection.js';
import { ObjectId } from 'mongodb';

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
    async getAllMovies(_, { limit, searchTerm }, context) {
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
    async addMovie(_, { title, year, rated, poster, fullplot }, context) {
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
      const dbDelete = await collection.deleteOne({
        _id: new ObjectId(id)
      });
      return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
    }
  }
};

export default resolvers;
