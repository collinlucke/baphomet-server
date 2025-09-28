import { userQueries } from './queries/userQueries.js';
import { movieQueries } from './queries/movieQueries.js';
import { userMutations } from './mutations/userMutations.js';
import { movieMutations } from './mutations/movieMutations.js';
import { votingMutations } from './mutations/votingMutations.js';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';

export const resolvers = {
  Query: {
    ...userQueries,
    ...movieQueries,
    async checkAuth(_, args) {
      const token = args.token;
      try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        return { isValid: true, message: 'Token is valid' };
      } catch (error) {
        return { isValid: false, message: error.message };
      }
    },
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
    }
  },
  Mutation: {
    ...movieMutations,
    ...userMutations,
    ...votingMutations,
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
