import { ObjectId } from 'mongodb';
import { getOptimizedImageUrl } from '../helpers';

export const getMovieImage = async (parent, { movieId, imageType, size }) => {
  try {
    const { db } = await import('../../dBConnection');
    const movie = await db
      .collection('movies')
      .findOne({ _id: new ObjectId(movieId) });

    if (!movie) {
      throw new Error('Movie not found');
    }

    const imageVariants =
      imageType === 'poster' ? movie.posterImages : movie.backdropImages;
    return getOptimizedImageUrl(imageVariants, size);
  } catch (error) {
    throw new Error(`Failed to get movie image: ${error.message}`);
  }
};
