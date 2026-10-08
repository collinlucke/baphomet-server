import { db } from './dBConnection.js';
import { ObjectId } from 'mongodb';
import { generateToken } from './generateToken.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { imageResolvers } from './resolvers/imageResolvers.js';
import { movieResolvers } from './resolvers/movieResolvers.js';
import { userResolvers } from './resolvers/userResolvers.js';
import { votingResolvers } from './resolvers/votingResolvers.js';
import { enhancedImageResolvers } from './resolvers/enhancedImageResolvers.js';

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

  // <<<<<<<<<< ----------- QUERIES ----------- >>>>>>>>>>>>>>> //
  Query: {
    ...userResolvers.Query,
    ...movieResolvers.Query,
    ...imageResolvers.Query,
    ...enhancedImageResolvers.Query
  },

  // <<<<<<<<<< ----------- MUTATIONS ----------- >>>>>>>>>>>>>>> //
  Mutation: {
    ...movieResolvers.Mutation,
    ...userResolvers.Mutation,
    ...imageResolvers.Mutation,
    ...enhancedImageResolvers.Mutation,
    ...votingResolvers.Mutation,

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
