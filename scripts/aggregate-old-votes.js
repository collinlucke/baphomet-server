// MongoDB aggregation script to clean up old votes
// Run this monthly to aggregate votes older than 90 days
// Or aggregate matches once there are more than 300 votes

// Not sure what I'm do here yet, but this is a start

const aggregateOldVotes = async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  const oldVoteStats = await db.votes
    .aggregate([
      { $match: { timestamp: { $lt: cutoffDate } } },
      {
        $group: {
          _id: {
            comparisonId: '$comparisonId',
            winnerId: '$winnerId'
          },
          voteCount: { $sum: 1 },
          oldestVote: { $min: '$timestamp' },
          newestVote: { $max: '$timestamp' }
        }
      }
    ])
    .toArray();

  if (oldVoteStats.length > 0) {
    await db.archivedVotes.insertMany(
      oldVoteStats.map(stat => ({
        comparisonId: stat._id.comparisonId,
        winnerId: stat._id.winnerId,
        aggregatedVoteCount: stat.voteCount,
        periodStart: stat.oldestVote,
        periodEnd: stat.newestVote,
        archivedAt: new Date()
      }))
    );

    await db.votes.deleteMany({ timestamp: { $lt: cutoffDate } });
  }
};
