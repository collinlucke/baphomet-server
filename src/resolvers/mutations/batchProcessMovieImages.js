import { batchProcessMovieImagesHelper } from '../helpers/batchProcessMovieImagesHelper.js';

export const batchProcessMovieImages = async (
  parent,
  { limit = 10 },
  context
) => {
  try {
    const { db } = await import('../../dBConnection.js');

    // Find movies that don't have processed images yet
    const movies = await db
      .collection('movies')
      .find({
        $or: [
          { posterImages: { $exists: false } },
          { backdropImages: { $exists: false } }
        ],
        $and: [
          {
            $or: [{ posterPath: { $ne: '' } }, { backdropPath: { $ne: '' } }]
          }
        ]
      })
      .limit(limit)
      .toArray();

    if (movies.length === 0) {
      return {
        success: true,
        processed: 0,
        message: 'No movies found that need image processing'
      };
    }

    const results = await batchProcessMovieImagesHelper(movies, db);
    const successCount = results.filter(r => r.success).length;

    return {
      success: true,
      processed: successCount,
      total: movies.length,
      message: `Processed ${successCount}/${movies.length} movies successfully`
    };
  } catch (error) {
    return {
      success: false,
      processed: 0,
      total: 0,
      message: error.message
    };
  }
};
