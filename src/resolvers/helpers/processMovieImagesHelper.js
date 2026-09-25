import ImageService from '../../services/ImageService.js';
import { processMoviePeople } from './processMoviePeople.js';

export const processMovieImagesHelper = async (
  movie,
  updateInDb = false,
  db = null
) => {
  const results = {
    posterImages: null,
    backdropImages: null,
    processedPeople: [],
    errors: []
  };

  try {
    // Process poster images
    if (movie.posterPath) {
      const tmdbPosterUrl = `https://image.tmdb.org/t/p/original${movie.posterPath}`;
      try {
        results.posterImages = await ImageService.processImage(
          tmdbPosterUrl,
          'poster'
        );
        console.log(
          `✅ Processed poster for movie: ${movie.title || movie.tmdbId}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process poster for ${movie.title}:`,
          error.message
        );
        results.errors.push(`Poster: ${error.message}`);
      }
    }

    // Process backdrop images
    if (movie.backdropPath) {
      const tmdbBackdropUrl = `https://image.tmdb.org/t/p/original${movie.backdropPath}`;
      try {
        results.backdropImages = await ImageService.processImage(
          tmdbBackdropUrl,
          'backdrop'
        );
        console.log(
          `✅ Processed backdrop for movie: ${movie.title || movie.tmdbId}`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process backdrop for ${movie.title}:`,
          error.message
        );
        results.errors.push(`Backdrop: ${error.message}`);
      }
    }

    // Process cast member images
    if (movie.topBilledCast && movie.topBilledCast.length > 0) {
      try {
        const castResults = await processMoviePeople(
          movie.topBilledCast,
          'cast',
          db
        );
        results.processedPeople.push(...castResults);
        console.log(
          `✅ Processed ${castResults.length} cast members for movie: ${
            movie.title || movie.tmdbId
          }`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process cast for ${movie.title}:`,
          error.message
        );
        results.errors.push(`Cast: ${error.message}`);
      }
    }

    // Process director images
    if (movie.directors && movie.directors.length > 0) {
      try {
        const directorResults = await processMoviePeople(
          movie.directors,
          'crew',
          db
        );
        results.processedPeople.push(...directorResults);
        console.log(
          `✅ Processed ${directorResults.length} directors for movie: ${
            movie.title || movie.tmdbId
          }`
        );
      } catch (error) {
        console.error(
          `❌ Failed to process directors for ${movie.title}:`,
          error.message
        );
        results.errors.push(`Directors: ${error.message}`);
      }
    }

    // Update movie with poster/backdrop images only
    if (updateInDb && db && movie._id) {
      const updateData = {
        posterImages: null,
        backdropImages: null,
        lastUpdated: new Date()
      };
      if (results.posterImages) updateData.posterImages = results.posterImages;
      if (results.backdropImages)
        updateData.backdropImages = results.backdropImages;

      if (Object.keys(updateData).length > 0) {
        updateData.lastUpdated = new Date();
        await db
          .collection('movies')
          .updateOne({ _id: movie._id }, { $set: updateData });
        console.log(`✅ Updated movie ${movie.title} with processed images`);
      }
    }
  } catch (error) {
    console.error('❌ Error in processMovieImages:', error.message);
    results.errors.push(`General: ${error.message}`);
  }

  return results;
};
