import { ObjectId } from 'mongodb';
import { processMovieImagesHelper } from '../helpers/index.js';

export const processMovieImages = async (parent, { movieId }, context) => {
  try {
    const { db } = await import('../../dBConnection.js');
    const movie = await db
      .collection('movies')
      .findOne({ _id: new ObjectId(movieId) });

    if (!movie) {
      throw new Error('Movie not found');
    }

    const result = await processMovieImagesHelper(movie, true, db);

    return {
      success: result.errors.length === 0,
      posterImages: result.posterImages,
      backdropImages: result.backdropImages,
      castImages: result.processedPeople,
      crewImages: result.processedPeople,
      message:
        result.errors.length === 0
          ? 'Images processed successfully'
          : `Completed with errors: ${result.errors.join(', ')}`
    };
  } catch (error) {
    return {
      success: false,
      posterImages: null,
      backdropImages: null,
      castImages: null,
      crewImages: null,
      message: error.message
    };
  }
};
