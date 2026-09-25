import { processMovieImagesHelper } from './processMovieImagesHelper';

export async function batchProcessMovieImagesHelper(movies, db = null) {
  const results = [];

  for (const movie of movies) {
    try {
      const result = await processMovieImagesHelper(movie, true, db);
      results.push({
        movieId: movie._id || movie.tmdbId,
        title: movie.title,
        success: result.errors.length === 0,
        posterImages: result.posterImages,
        backdropImages: result.backdropImages,
        castImages: result.processedPeople,
        crewImages: result.processedPeople,
        errors: result.errors
      });
    } catch (error) {
      results.push({
        movieId: movie._id || movie.tmdbId,
        title: movie.title,
        success: false,
        errors: [error.message]
      });
    }
  }

  return results;
}
