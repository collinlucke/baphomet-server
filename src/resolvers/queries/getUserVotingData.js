const getUserVotingData = async (parent, args, context) => {
  const { userId } = context;

  if (!userId) {
    throw new Error('No user ID provided in context');
  }
};
