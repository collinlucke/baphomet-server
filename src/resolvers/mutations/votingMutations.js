export const votingMutations = {
  async submitVote(_, { movie1Id, movie2Id, winnerId }, context) {
    const token = context.token;
    if (!token) {
      throw new Error('Must be logged in to submit votes');
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token.replace('Bearer ', ''),
        process.env.ACCESS_TOKEN_SECRET
      );
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    const userId = new ObjectId(decoded.id);
    const movie1ObjectId = new ObjectId(movie1Id);
    const movie2ObjectId = new ObjectId(movie2Id);
    const winnerObjectId = new ObjectId(winnerId);

    if (
      !winnerObjectId.equals(movie1ObjectId) &&
      !winnerObjectId.equals(movie2ObjectId)
    ) {
      throw new Error('Winner must be one of the two movies in the comparison');
    }

    const comparisonsCollection = db.collection('comparisons');
    const votesCollection = db.collection('votes');

    let comparison = await comparisonsCollection.findOne({
      $or: [
        { movie1Id: movie1ObjectId, movie2Id: movie2ObjectId },
        { movie1Id: movie2ObjectId, movie2Id: movie1ObjectId }
      ]
    });

    if (!comparison) {
      const newComparison = {
        movie1Id: movie1ObjectId,
        movie2Id: movie2ObjectId,
        movie1Wins: 0,
        movie2Wins: 0,
        totalVotes: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await comparisonsCollection.insertOne(newComparison);
      comparison = { ...newComparison, _id: result.insertedId };
    }

    const existingVote = await votesCollection.findOne({
      userId: userId,
      comparisonId: comparison._id
    });

    if (existingVote) {
      return {
        success: false,
        message: 'You have already voted on this matchup',
        comparison
      };
    }

    const voteRecord = {
      userId: userId,
      comparisonId: comparison._id,
      movie1Id: movie1ObjectId,
      movie2Id: movie2ObjectId,
      winnerId: winnerObjectId,
      timestamp: new Date(),
      sessionId: context.sessionId || null,
      userAgent: context.userAgent || null
    };

    await votesCollection.insertOne(voteRecord);

    const isMovie1Winner = winnerObjectId.equals(comparison.movie1Id);
    const updateFields = {
      totalVotes: comparison.totalVotes + 1,
      updatedAt: new Date()
    };

    if (isMovie1Winner) {
      updateFields.movie1Wins = comparison.movie1Wins + 1;
    } else {
      updateFields.movie2Wins = comparison.movie2Wins + 1;
    }

    await comparisonsCollection.updateOne(
      { _id: comparison._id },
      { $set: updateFields }
    );

    const moviesCollection = db.collection('movies');
    const winner = winnerObjectId;
    const loser = winnerObjectId.equals(movie1ObjectId)
      ? movie2ObjectId
      : movie1ObjectId;

    await moviesCollection.updateOne(
      { _id: winner },
      {
        $inc: {
          totalWins: 1,
          totalComparisons: 1
        }
      }
    );

    await moviesCollection.updateOne(
      { _id: loser },
      {
        $inc: {
          totalLosses: 1,
          totalComparisons: 1
        }
      }
    );

    const [winnerMovie, loserMovie] = await Promise.all([
      moviesCollection.findOne({ _id: winner }),
      moviesCollection.findOne({ _id: loser })
    ]);

    if (winnerMovie) {
      const winnerPercentage =
        (winnerMovie.totalWins / winnerMovie.totalComparisons) * 100;
      await moviesCollection.updateOne(
        { _id: winner },
        {
          $set: {
            winningPercentage: Math.round(winnerPercentage * 100) / 100
          }
        }
      );
    }

    if (loserMovie) {
      const loserPercentage =
        (loserMovie.totalWins / loserMovie.totalComparisons) * 100;
      await moviesCollection.updateOne(
        { _id: loser },
        {
          $set: { winningPercentage: Math.round(loserPercentage * 100) / 100 }
        }
      );
    }

    const usersCollection = db.collection('users');
    await usersCollection.updateOne(
      { _id: userId },
      {
        $inc: { totalVotes: 1 },
        $set: { lastLogin: new Date(), updatedAt: new Date() }
      }
    );

    const updatedComparison = await comparisonsCollection.findOne({
      _id: comparison._id
    });

    return {
      success: true,
      message: 'Vote submitted successfully',
      comparison: updatedComparison
    };
  },

  async cleanupVotes(_, { userId, movieId, resetAll }, context) {
    const token = context.token;
    if (!token) {
      throw new Error('Must be logged in for vote cleanup');
    }

    let decoded;
    try {
      decoded = jwt.verify(
        token.replace('Bearer ', ''),
        process.env.ACCESS_TOKEN_SECRET
      );
    } catch (error) {
      throw new Error('Invalid authentication token');
    }

    const usersCollection = db.collection('users');
    const user = await usersCollection.findOne({
      _id: new ObjectId(decoded.id)
    });

    if (!user || user.role !== 'admin') {
      throw new Error('Admin privileges required for vote cleanup');
    }

    const votesCollection = db.collection('votes');
    const comparisonsCollection = db.collection('comparisons');
    const moviesCollection = db.collection('movies');

    try {
      let deletedVotes = 0;
      let affectedUsers = 0;
      let affectedMovies = 0;

      if (resetAll) {
        const voteCount = await votesCollection.countDocuments();
        const comparisonCount = await comparisonsCollection.countDocuments();
        const movieCount = await moviesCollection.countDocuments();
        const userCount = await usersCollection.countDocuments();

        await votesCollection.deleteMany({});
        await comparisonsCollection.deleteMany({});

        await moviesCollection.updateMany(
          {},
          {
            $set: {
              totalWins: 0,
              totalLosses: 0,
              totalComparisons: 0,
              winningPercentage: 0.0,
              lastUpdated: new Date()
            }
          }
        );

        await usersCollection.updateMany(
          {},
          {
            $set: {
              totalVotes: 0,
              updatedAt: new Date()
            }
          }
        );

        return {
          success: true,
          message: `Complete reset: Deleted ${voteCount} votes, ${comparisonCount} comparisons. Reset ${movieCount} movies and ${userCount} users.`,
          deletedVotes: voteCount,
          affectedUsers: userCount,
          affectedMovies: movieCount
        };
      } else if (userId && movieId) {
        const userObjectId = new ObjectId(userId);
        const movieObjectId = new ObjectId(movieId);

        const deleteResult = await votesCollection.deleteMany({
          userId: userObjectId,
          $or: [
            { winnerId: movieObjectId },
            { movie1Id: movieObjectId },
            { movie2Id: movieObjectId }
          ]
        });

        return {
          success: true,
          message: `Removed ${deleteResult.deletedCount} votes for user-movie combination`,
          deletedVotes: deleteResult.deletedCount,
          affectedUsers: 1,
          affectedMovies: 1
        };
      } else if (userId) {
        const userObjectId = new ObjectId(userId);
        const deleteResult = await votesCollection.deleteMany({
          userId: userObjectId
        });

        await usersCollection.updateOne(
          { _id: userObjectId },
          { $set: { totalVotes: 0, updatedAt: new Date() } }
        );

        return {
          success: true,
          message: `Removed ${deleteResult.deletedCount} votes for user`,
          deletedVotes: deleteResult.deletedCount,
          affectedUsers: 1,
          affectedMovies: 0
        };
      } else if (movieId) {
        const movieObjectId = new ObjectId(movieId);

        const deleteResult = await votesCollection.deleteMany({
          $or: [
            { winnerId: movieObjectId },
            { movie1Id: movieObjectId },
            { movie2Id: movieObjectId }
          ]
        });

        await moviesCollection.updateOne(
          { _id: movieObjectId },
          {
            $set: {
              totalWins: 0,
              totalLosses: 0,
              totalComparisons: 0,
              winningPercentage: 0.0,
              lastUpdated: new Date()
            }
          }
        );

        return {
          success: true,
          message: `Removed ${deleteResult.deletedCount} votes for movie`,
          deletedVotes: deleteResult.deletedCount,
          affectedUsers: 0,
          affectedMovies: 1
        };
      } else {
        throw new Error('Must specify userId, movieId, or resetAll=true');
      }
    } catch (error) {
      return {
        success: false,
        message: `Cleanup failed: ${error.message}`,
        deletedVotes: 0,
        affectedUsers: 0,
        affectedMovies: 0
      };
    }
  }
};
