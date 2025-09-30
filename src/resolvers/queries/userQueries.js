export const userQueries = {
  async getUserDetails(_, { userId }, context) {
    const usersCollection = db.collection('users');
    const votesCollection = db.collection('votes');
    const user = await usersCollection.findOne({ _id: new ObjectId(userId) });
    if (!user) return null;

    const totalVotes = await votesCollection.countDocuments({
      userId: userId
    });

    return {
      id: user._id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      totalVotes,
      joinDate: user.joinDate,
      role: user.role,
      avatarUrl: user.avatarUrl,
      firstName: user.firstName,
      lastName: user.lastName,
      emailVerified: user.emailVerified
    };
  },
  async getUserLeaderboard(_, { cursor = '' }, context) {
    const usersCollection = db.collection('users');
    const queryConditions = [];

    if (cursor) {
      try {
        const cursorData = JSON.parse(cursor);
        queryConditions.push({
          $or: [
            { totalVotes: { $lt: cursorData.totalVotes } },
            {
              totalVotes: cursorData.totalVotes,
              joinDate: { $gt: new Date(cursorData.joinDate) }
            }
          ]
        });
      } catch (error) {
        console.warn('Invalid cursor provided to getUserLeaderboard:', cursor);
      }
    }

    const query = queryConditions.length > 0 ? { $and: queryConditions } : {};

    const users = await usersCollection
      .find(query)
      .sort({ totalVotes: -1, joinDate: 1 })
      .limit(25)
      .toArray();
    const endOfResults = users.length < 25;

    let newCursor = '';
    if (users.length > 0 && !endOfResults) {
      const lastUser = users[users.length - 1];
      newCursor = JSON.stringify({
        totalVotes: lastUser.totalVotes,
        joinDate: lastUser.joinDate.toISOString()
      });
    }

    return {
      users: users.map(user => ({
        ...user,
        id: user._id
      })),
      newCursor,
      endOfResults
    };
  }
};
