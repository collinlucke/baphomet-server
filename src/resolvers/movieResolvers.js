import { processMovieImages } from './enhancedImageResolvers.js';
import { db } from '../dBConnection.js';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import Fuse from 'fuse.js';
import { mapTmdbMovie, creditPersonStubs } from '../services/mapTmdbMovie.js';
import { tmdbFetch, tmdbMovieUrl } from '../services/tmdbClient.js';
import { selectBackdropPaths, selectPosterPaths } from '../services/tmdbImages.js';
import { upsertMoviePeople } from '../services/upsertMoviePeople.js';

const tmdbIdQuery = tmdbId => {
  const values = [];
  const numeric = Number(tmdbId);
  const text = tmdbId == null ? '' : String(tmdbId);

  if (tmdbId != null && tmdbId !== '') values.push(tmdbId);
  if (Number.isFinite(numeric)) values.push(numeric);
  if (text) values.push(text);
  return { tmdbId: { $in: values } };
};

const numericOrNull = value => {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const resolveGenres = async tmdbGenres => {
  const genresCollection = db.collection('genres');
  const genres = [];

  for (const tmdbGenre of tmdbGenres || []) {
    let existingGenre = await genresCollection.findOne({
      genre: tmdbGenre.name
    });

    if (!existingGenre) {
      const genreCount = await genresCollection.countDocuments();
      const newGenre = {
        id: (genreCount + 1).toString(),
        genre: tmdbGenre.name
      };
      await genresCollection.insertOne(newGenre);
      existingGenre = newGenre;
    }

    genres.push({
      id: existingGenre.id,
      genre: existingGenre.genre
    });
  }

  return genres;
};

const movieFieldsFromArgs = args => ({
  title: args.title,
  originalTitle: args.originalTitle || '',
  originalLanguage: args.originalLanguage || '',
  releaseDate: args.releaseDate || '',
  overview: args.overview || '',
  tagline: args.tagline || '',
  homepage: args.homepage || '',
  status: args.status || '',
  mpaRating: args.mpaRating || '',
  genres: args.genres || [],
  revenue: numericOrNull(args.revenue),
  budget: numericOrNull(args.budget),
  runtime: args.runtime ?? null,
  popularity: numericOrNull(args.popularity),
  voteAverage: numericOrNull(args.voteAverage),
  voteCount: args.voteCount ?? null,
  adult: Boolean(args.adult),
  posterPath: args.posterPath || '',
  backdropPath: args.backdropPath || '',
  logoPath: args.logoPath || '',
  posterPaths: args.posterPaths || [],
  backdropPaths: args.backdropPaths || [],
  tmdbId: numericOrNull(args.tmdbId) ?? args.tmdbId,
  imdbId: args.imdbId || '',
  spokenLanguages: args.spokenLanguages || [],
  productionCompanies: args.productionCompanies || [],
  productionCountries: args.productionCountries || [],
  originCountries: args.originCountries || [],
  keywords: args.keywords || [],
  certifications: args.certifications || [],
  videos: args.videos || [],
  cast: args.cast || [],
  crew: args.crew || []
});

export const movieResolvers = {
  Query: {
    // ----- GET MOVIES ----- //
    async getMovies(
      _,
      { title, limit, cursor, sortBy = 'title', sortOrder = 'asc' }
    ) {
      const collection = db.collection('movies');
      const parsedLimit = Number(limit) || 20;
      const trimmedTitle = title?.trim();

      const queryConditions = [];

      if (trimmedTitle) {
        queryConditions.push({
          title: { $regex: trimmedTitle, $options: 'i' }
        });
      }
      if (cursor) {
        queryConditions.push({ [sortBy]: { $gt: cursor } });
      }

      const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

      const countQuery = trimmedTitle
        ? { title: { $regex: trimmedTitle, $options: 'i' } }
        : {};

      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      const validSortFields = ['title', 'releaseDate', 'winningPercentage'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'title';

      const [searchResults, newTotalMovieCount] = await Promise.all([
        collection
          .find(query)
          .sort({ [sortField]: sortDirection, title: 1 })
          .limit(parsedLimit)
          .toArray(),
        collection.countDocuments(countQuery)
      ]);

      const endOfResults = searchResults.length < parsedLimit;
      const newCursor = searchResults.at(-1)?.[sortField] || '';
      return {
        searchResults,
        newTotalMovieCount,
        newCursor,
        endOfResults
      };
    },

    // ----- GET MOVIE BY TMDB ID ----- //
    async getMovieByTmdbId(_, { tmdbId }) {
      const collection = db.collection('movies');

      try {
        const theMovie = await collection.findOne(tmdbIdQuery(tmdbId));

        if (!theMovie) {
          return {
            found: false,
            movie: null,
            errorMessage: null
          };
        }
        return {
          found: true,
          movie: theMovie,
          errorMessage: null
        };
      } catch (error) {
        console.error(
          'Error getting movie from the database by TMDB ID:',
          error
        );
        return {
          found: false,
          movie: null,
          errorMessage: `Error getting movie from the database by TMDB ID: ${error.message}`
        };
      }
    },

    async fetchMovieFromTmdb(_, { tmdbId }) {
      const response = await tmdbFetch(tmdbMovieUrl(tmdbId));
      if (!response.ok) {
        throw new Error('Failed to fetch movie from TMDB');
      }

      const payload = await response.json();
      const genres = await resolveGenres(payload.genres);
      await upsertMoviePeople(db, creditPersonStubs(payload));
      return mapTmdbMovie(payload, genres);
    },

    async tmdbMovieImages(_, { tmdbId }) {
      const response = await tmdbFetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}/images?api_key=${process.env.TMDB_API_KEY}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch images from TMDB');
      }

      const payload = await response.json();

      return {
        posters: selectPosterPaths(payload.posters),
        backdrops: selectBackdropPaths(payload.backdrops)
      };
    },

    async fetchPossibleMovieMatches(_, { title }) {
      try {
        // First get broad results from TMDB
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&query=${encodeURIComponent(title)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch movies from TMDB');
        }

        const tmdbData = await response.json();

        // Configure fuzzy search options
        const fuseOptions = {
          keys: ['title', 'original_title'], // Search both title and original title
          threshold: 0.4, // 0.0 = exact match, 1.0 = match anything
          distance: 100,
          minMatchCharLength: 2,
          includeScore: true
        };

        // Create Fuse instance and perform fuzzy search
        const fuse = new Fuse(tmdbData.results, fuseOptions);
        const fuzzyResults = fuse.search(title);

        const normalizedResults = fuzzyResults.map(result => ({
          id: result.item.id,
          tmdbId: result.item.id,
          title: result.item.title,
          releaseDate: result.item.release_date,
          overview: result.item.overview,
          posterPath: result.item.poster_path,
          backdropPath: result.item.backdrop_path,
          revenue: result.item.revenue,
          tagline: result.item.tagline,
          cast: result.item.cast,
          crew: result.item.crew,
          fuzzyScore: result.score // Include relevance score
        }));

        return {
          results: normalizedResults,
          page: tmdbData.page || 1,
          totalPages: Math.ceil(normalizedResults.length / 20),
          totalResults: normalizedResults.length
        };
      } catch (error) {
        console.error('Error in fuzzy search:', error);
        throw new Error('Failed to fetch possible movies from TMDB');
      }
    },

    // ----- GET MOVIE DETAILS ----- //
    async getMovieDetails(_, { id }) {
      const collection = db.collection('movies');
      let movie;

      // Try to find by ObjectId first
      if (ObjectId.isValid(id)) {
        movie = await collection.findOne({ _id: new ObjectId(id) });
      }

      // If not found and it's numeric, try by tmdbId
      if (!movie && !isNaN(parseInt(id))) {
        movie = await collection.findOne({ tmdbId: parseInt(id) });
      }

      if (!movie) {
        throw new Error('Movie not found');
      }

      return movie;
    },

    // ----- GET RANDOM MOVIE MATCHUP ----- //
    async getRandomMovieMatchup(_, args, context) {
      const collection = db.collection('movies');

      const totalMovies = await collection.countDocuments();

      if (totalMovies < 2) {
        throw new Error(
          'Not enough movies available for matchup. Need at least 2 movies.'
        );
      }

      const randomMovies = await collection
        .aggregate([{ $sample: { size: 2 } }])
        .toArray();
      if (randomMovies.length < 2) {
        throw new Error('Could not retrieve two movies for matchup.');
      }

      const [movie1, movie2] = randomMovies;

      const comparisonsCollection = db.collection('comparisons');
      let comparison = await comparisonsCollection.findOne({
        $or: [
          { movie1Id: movie1._id, movie2Id: movie2._id },
          { movie1Id: movie2._id, movie2Id: movie1._id }
        ]
      });

      if (!comparison) {
        const newComparison = {
          movie1Id: movie1._id,
          movie2Id: movie2._id,
          movie1Wins: 0,
          movie2Wins: 0,
          totalVotes: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const result = await comparisonsCollection.insertOne(newComparison);
        comparison = { ...newComparison, _id: result.insertedId };
      }

      return {
        movie1,
        movie2,
        comparisonId: comparison._id
      };
    },

    // ----- GET RANDOM BACKDROP IMAGE ----- //
    async getRandomBackdropImage(_, {}) {
      const collection = db.collection('movies');
      const getMovie = async () =>
        await collection.aggregate([{ $sample: { size: 1 } }]).toArray();
      const movie = await getMovie();

      if (!movie) {
        throw new Error('Movie not found');
      }

      if (!movie[0].backdropPath && !movie[0].backdropImages?.w1920) {
        getMovie();
      }

      return {
        backdropPath: movie[0].backdropImages?.w1920 || movie[0].backdropPath
      };
    }
  },

  Mutation: {
    async addMovie(_, args, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to add movies');
      }

      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');

      const {
        addedBy,
        lastUpdated,
        createdAt,
        totalWins,
        totalLosses,
        winningPercentage,
        totalComparisons
      } = args;
      const movieData = {
        ...movieFieldsFromArgs(args),
        addedBy,
        lastUpdated: lastUpdated ? new Date(lastUpdated) : new Date(),
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        totalWins: totalWins || 0,
        totalLosses: totalLosses || 0,
        winningPercentage: winningPercentage || 0.0,
        totalComparisons: totalComparisons || 0
      };

      const insert = await collection.insertOne(movieData);

      if (insert.acknowledged) {
        const newMovie = {
          ...movieData,
          _id: insert.insertedId,
          id: insert.insertedId.toString() // Return the ObjectId as string for GraphQL
        };

        // Process images in the background after successful insert
        if (
          movieData.posterPath ||
          movieData.backdropPath ||
          movieData.cast?.length > 0 ||
          movieData.crew?.length > 0
        ) {
          setImmediate(async () => {
            try {
              console.log(
                `🔄 Processing images for new movie: ${movieData.title}`
              );
              await processMovieImages(newMovie, true, db);
              console.log(
                `✅ Background image processing completed for: ${movieData.title}`
              );
            } catch (error) {
              console.error(
                `❌ Background image processing failed for movie ${movieData.title}:`,
                error.message
              );
            }
          });
        }

        return newMovie;
      }
      return null;
    },

    async updateMovie(_, args, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to update movies');
      }
      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');
      const { id, ...updateFields } = args;

      let movieInDb;
      let queryId;

      // Try to find by ObjectId first
      if (ObjectId.isValid(id)) {
        queryId = new ObjectId(id);
        movieInDb = await collection.findOne({ _id: queryId });
      }

      // If not found and it's numeric, try by tmdbId
      if (!movieInDb && id != null && id !== '') {
        movieInDb = await collection.findOne(tmdbIdQuery(id));
        if (movieInDb) {
          queryId = movieInDb._id;
        }
      }

      if (!movieInDb) {
        throw new Error('Movie not found');
      }

      // Check if image-related fields are being updated
      const imageFieldsUpdated = Boolean(
        updateFields.posterPath ||
        updateFields.backdropPath ||
        updateFields.cast ||
        updateFields.crew
      );

      const update = await collection.updateOne(
        { _id: queryId },
        { $set: { ...movieInDb, ...updateFields } }
      );

      if (update.acknowledged) {
        const updatedMovie = await collection.findOne({ _id: queryId });

        // Process images in the background if image-related fields were updated
        if (imageFieldsUpdated) {
          setImmediate(async () => {
            try {
              console.log(
                `🔄 Processing images for updated movie: ${updatedMovie.title}`
              );
              await processMovieImages(updatedMovie, true, db);
              console.log(
                `✅ Background image processing completed for: ${updatedMovie.title}`
              );
            } catch (error) {
              console.error(
                `❌ Background image processing failed for updated movie ${updatedMovie.title}:`,
                error.message
              );
            }
          });
        }

        return updatedMovie;
      }

      return null;
    },

    async deleteMovie(_, { id }, context) {
      const token = context.token;
      if (!token) {
        throw new Error('Must be logged in to delete movies');
      }

      try {
        jwt.verify(
          token.replace('Bearer ', ''),
          process.env.ACCESS_TOKEN_SECRET
        );
      } catch (error) {
        throw new Error('Invalid authentication token');
      }

      let collection = db.collection('movies');
      const dbDelete = await collection.deleteOne({
        _id: new ObjectId(id)
      });
      return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
    }
  }
};
