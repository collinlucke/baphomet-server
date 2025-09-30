export const movieMutations = {
  async addMovie(
    _,
    {
      title,
      releaseDate,
      overview,
      genres,
      revenue,
      posterPath,
      backdropPath,
      tmdbId,
      addedBy,
      lastUpdated,
      createdAt,
      totalWins,
      totalLosses,
      winningPercentage,
      totalComparisons
    },
    context
  ) {
    const token = context.token;
    if (!token) {
      throw new Error('Must be logged in to add movies');
    }

    try {
      jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    let collection = db.collection('movies');
    const movieData = {
      title,
      releaseDate,
      overview,
      genres,
      revenue,
      posterPath,
      backdropPath,
      tmdbId,
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
      return {
        ...movieData,
        id: insert.insertedId
      };
    }
    return null;
  },
  async updateMovie(_, args, context) {
    const token = context.token;
    if (!token) {
      throw new Error('Must be logged in to update movies');
    }

    try {
      jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    const id = new ObjectId(args.id);
    let query = { _id: new ObjectId(id) };
    let collection = db.collection('movies');
    const update = await collection.updateOne(query, { $set: { ...args } });

    if (update.acknowledged) return await collection.findOne(query);

    return null;
  },
  async deleteMovie(_, { id }, context) {
    const token = context.token;
    if (!token) {
      throw new Error('Must be logged in to delete movies');
    }

    try {
      jwt.verify(token.replace('Bearer ', ''), process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    let collection = db.collection('movies');
    const dbDelete = await collection.deleteOne({
      _id: new ObjectId(id)
    });
    return dbDelete.acknowledged && dbDelete.deletedCount == 1 ? true : false;
  }
};
