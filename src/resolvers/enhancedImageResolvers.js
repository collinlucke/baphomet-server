import ImageService from '../services/ImageService.js';

export async function processPersonImages(
  person,
  updateInDb = false,
  db = null
) {
  const results = {
    profileImages: null,
    errors: []
  };

  try {
    if (person.profilePath) {
      const tmdbProfileUrl = `https://image.tmdb.org/t/p/original${person.profilePath}`;
      try {
        results.profileImages = await ImageService.processImage(
          tmdbProfileUrl,
          'profile'
        );
        console.log(`✅ Processed profile images for: ${person.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to process profile images for ${person.name}:`,
          error.message
        );
        results.errors.push(`Profile: ${error.message}`);
      }
    }

    if (updateInDb && db && person.tmdbId) {
      // Check if person already exists by tmdbId
      const existingPerson = await db
        .collection('people')
        .findOne({ tmdbId: person.tmdbId });

      const updateData = {
        tmdbId: person.tmdbId,
        name: person.name,
        profilePath: person.profilePath,
        knownFor: person.knownFor,
        profileImages: results.profileImages,
        lastUpdated: new Date(),
        processedAt: new Date()
      };

      if (existingPerson) {
        // Update existing person
        await db
          .collection('people')
          .updateOne({ _id: existingPerson._id }, { $set: updateData });
      } else {
        // Create new person with auto-incrementing _id
        await db.collection('people').insertOne(updateData);
      }
      console.log(`✅ Updated person ${person.name} with processed images`);
    }
  } catch (error) {
    console.error('❌ Error in processPersonImages:', error.message);
    results.errors.push(`General: ${error.message}`);
  }

  return results;
}

export async function processMovieImages(movie, updateInDb = false, db = null) {
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
      const updateData = {};
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
}

export async function processMoviePeople(people, type, db) {
  const processedPeople = [];

  for (const person of people) {
    if (person.profilePath && person.id) {
      try {
        // Check if person already exists and has processed images
        const existingPerson = await db.collection('people').findOne({
          tmdbId: parseInt(person.id)
        });
        let shouldProcess = true;

        if (
          existingPerson?.profileImages &&
          existingPerson?.profilePath === person.profilePath
        ) {
          // Person exists with same profile path and processed images
          shouldProcess = false;
          console.log(`⏭️ Skipping ${person.name} - already processed`);
        }

        if (shouldProcess) {
          const personData = {
            tmdbId: parseInt(person.id),
            name: person.name,
            profilePath: person.profilePath,
            knownFor: type === 'cast' ? 'Acting' : 'Directing'
          };

          const result = await processPersonImages(personData, true, db);

          if (result.errors.length === 0) {
            processedPeople.push({
              personId: person.id,
              name: person.name,
              success: true
            });
          } else {
            processedPeople.push({
              personId: person.id,
              name: person.name,
              success: false,
              errors: result.errors
            });
          }
        } else {
          processedPeople.push({
            personId: person.id,
            name: person.name,
            success: true,
            skipped: true
          });
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to process person ${person.name}:`,
          error.message
        );
        processedPeople.push({
          personId: person.id,
          name: person.name,
          success: false,
          errors: [error.message]
        });
      }
    }
  }

  return processedPeople;
}

export async function batchProcessMovieImages(movies, db = null) {
  const results = [];

  for (const movie of movies) {
    try {
      const result = await processMovieImages(movie, true, db);
      results.push({
        movieId: movie._id || movie.tmdbId,
        title: movie.title,
        success: result.errors.length === 0,
        posterImages: result.posterImages,
        backdropImages: result.backdropImages,
        castImages: result.castImages,
        crewImages: result.crewImages,
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

export function getOptimizedImageUrl(imageVariants, preferredSize = 'w342') {
  if (!imageVariants) return null;

  // Try preferred size first, fallback to available sizes
  const fallbackOrder = ['w342', 'w500', 'w185', 'w780', 'original'];

  if (imageVariants[preferredSize]) {
    return imageVariants[preferredSize];
  }

  for (const size of fallbackOrder) {
    if (imageVariants[size]) {
      return imageVariants[size];
    }
  }

  return null;
}

export function getOptimizedProfileImageUrl(
  imageVariants,
  preferredSize = 'w185'
) {
  if (!imageVariants) return null;

  // Try preferred size first, fallback to available sizes for profiles
  const fallbackOrder = ['w185', 'h632', 'w45', 'original'];

  if (imageVariants[preferredSize]) {
    return imageVariants[preferredSize];
  }

  for (const size of fallbackOrder) {
    if (imageVariants[size]) {
      return imageVariants[size];
    }
  }

  return null;
}

export const enhancedImageResolvers = {
  Query: {
    // Get optimized image URL for a movie
    async getMovieImage(parent, { movieId, imageType, size }, context) {
      try {
        const { db } = await import('../dBConnection.js');
        const movie = await db
          .collection('movies')
          .findOne({ _id: parseInt(movieId) });

        if (!movie) {
          throw new Error('Movie not found');
        }

        const imageVariants =
          imageType === 'poster' ? movie.posterImages : movie.backdropImages;
        return getOptimizedImageUrl(imageVariants, size);
      } catch (error) {
        throw new Error(`Failed to get movie image: ${error.message}`);
      }
    },

    // Get optimized profile image URL for cast/crew member
    async getPersonImage(parent, { movieId, personId, size }, context) {
      try {
        const { db } = await import('../dBConnection.js');
        const movie = await db
          .collection('movies')
          .findOne({ _id: parseInt(movieId) });

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
    }
  },

  Mutation: {
    // Process and save images for a specific movie
    async processMovieImages(parent, { movieId }, context) {
      try {
        const { db } = await import('../dBConnection.js');
        const movie = await db
          .collection('movies')
          .findOne({ _id: parseInt(movieId) });

        if (!movie) {
          throw new Error('Movie not found');
        }

        const result = await processMovieImages(movie, true, db);

        return {
          success: result.errors.length === 0,
          posterImages: result.posterImages,
          backdropImages: result.backdropImages,
          castImages: result.castImages,
          crewImages: result.crewImages,
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
    },

    // Batch process images for all movies missing processed images
    async batchProcessMovieImages(parent, { limit = 10 }, context) {
      try {
        const { db } = await import('../dBConnection.js');

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
                $or: [
                  { posterPath: { $ne: '' } },
                  { backdropPath: { $ne: '' } }
                ]
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

        const results = await batchProcessMovieImages(movies, db);
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
    }
  }
};
