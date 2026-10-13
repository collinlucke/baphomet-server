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
          'poster',
          movie.tmdbId
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
          'backdrop',
          movie.tmdbId
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

    const creditIds = [
      ...(movie.cast || []).map(credit => credit.personId),
      ...(movie.crew || []).map(credit => credit.personId)
    ];
    const peopleById = new Map();
    if (db && creditIds.length > 0) {
      const people = await db
        .collection('people')
        .find({ tmdbId: { $in: creditIds } })
        .toArray();
      for (const person of people) peopleById.set(person.tmdbId, person);
    }

    const peopleForImages = credits =>
      (credits || [])
        .map(credit => {
          const person = peopleById.get(credit.personId);
          return {
            id: credit.personId,
            name: person?.name || '',
            profilePath: person?.profilePath || ''
          };
        })
        .filter(person => person.id && person.profilePath);

    // Process cast member images
    if (movie.cast?.length > 0) {
      try {
        const castResults = await processMoviePeople(
          peopleForImages(movie.cast),
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

    // Process crew images
    if (movie.crew?.length > 0) {
      try {
        const directorResults = await processMoviePeople(
          peopleForImages(movie.crew),
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
