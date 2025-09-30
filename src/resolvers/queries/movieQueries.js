export const movieQueries = {
  async getMovieByTmdbId(_, { tmdbId }) {
    const collection = db.collection('movies');
    const theMovie = await collection.findOne({
      tmdbId
    });

    if (!theMovie) {
      return new Error('No movies found with the provided TMDB ID');
    }

    return theMovie;
  },

  async getMoviesByTitle(
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
  }
};
