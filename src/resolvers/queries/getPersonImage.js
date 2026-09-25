import { ObjectId } from 'mongodb';
import { getOptimizedProfileImageUrl } from '../helpers/index.js';

export const getPersonImage = async (
  parent,
  { movieId, personId, size },
  context
) => {
  try {
    const { db } = await import('../../dBConnection.js');
    const movie = await db
      .collection('movies')
      .findOne({ _id: new ObjectId(movieId) });

    if (!movie) {
      throw new Error('Movie not found');
    }

    // Check both cast and crew images
    let personData = null;
    if (movie.castImages && movie.castImages[personId]) {
      personData = movie.castImages[personId];
    } else if (movie.crewImages && movie.crewImages[personId]) {
      personData = movie.crewImages[personId];
    }

    if (!personData) {
      throw new Error('Person not found in movie cast or crew');
    }

    return getOptimizedProfileImageUrl(personData.profileImages, size);
  } catch (error) {
    throw new Error(`Failed to get person image: ${error.message}`);
  }
};
