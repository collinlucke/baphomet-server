#!/usr/bin/env node

/**
 * Voting Data Management Scripts
 *
 * This script provides various options for cleaning up voting data:
 * 1. Remove all votes for a specific user
 * 2. Remove all votes for a specific movie
 * 3. Complete reset of all voting data
 * 4. Remove votes for a specific user-movie combination
 *
 * Usage:
 *   node scripts/cleanup-votes.js --help
 *   node scripts/cleanup-votes.js --user-id="USER_ID"
 *   node scripts/cleanup-votes.js --movie-id="MOVIE_ID"
 *   node scripts/cleanup-votes.js --user-id="USER_ID" --movie-id="MOVIE_ID"
 *   node scripts/cleanup-votes.js --reset-all
 *   node scripts/cleanup-votes.js --reset-all --confirm
 */

import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import 'dotenv/config';

// MongoDB connection
const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseName = 'baphy';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

// Parse command line arguments
const args = process.argv.slice(2);
const getArg = name => {
  const arg = args.find(arg => arg.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : null;
};
const hasFlag = name => args.includes(`--${name}`);

const userId = getArg('user-id');
const movieId = getArg('movie-id');
const resetAll = hasFlag('reset-all');
const confirm = hasFlag('confirm');
const help = hasFlag('help');

function showHelp() {
  console.log(`
🗳️  Voting Data Cleanup Script

Usage:
  node scripts/cleanup-votes.js [OPTIONS]

Options:
  --user-id=USER_ID          Remove all votes for a specific user
  --movie-id=MOVIE_ID        Remove all votes for a specific movie
  --user-id=X --movie-id=Y   Remove votes for specific user-movie combination
  --reset-all                Remove ALL voting data (requires --confirm)
  --confirm                  Confirm destructive operations
  --help                     Show this help message

Examples:
  # Remove all votes by user "64a7b8c9d1e2f3g4h5i6j7k8"
  node scripts/cleanup-votes.js --user-id="64a7b8c9d1e2f3g4h5i6j7k8"

  # Remove all votes for movie "The Matrix"
  node scripts/cleanup-votes.js --movie-id="64a7b8c9d1e2f3g4h5i6j7k9"

  # Remove specific user's votes for specific movie
  node scripts/cleanup-votes.js --user-id="64a7b8c9d1e2f3g4h5i6j7k8" --movie-id="64a7b8c9d1e2f3g4h5i6j7k9"

  # DANGER: Complete reset (removes all votes, comparisons, resets movie stats)
  node scripts/cleanup-votes.js --reset-all --confirm

Note: Always backup your database before running destructive operations!
`);
}

async function removeUserVotes(userId) {
  console.log(`🔍 Removing all votes for user: ${userId}`);

  const db = client.db(databaseName);
  const votesCollection = db.collection('votes');
  const usersCollection = db.collection('users');

  try {
    const userObjectId = new ObjectId(userId);

    // Get vote count before deletion
    const voteCount = await votesCollection.countDocuments({
      userId: userObjectId
    });

    if (voteCount === 0) {
      console.log('✅ No votes found for this user');
      return;
    }

    console.log(`📊 Found ${voteCount} votes to remove`);

    // Remove all votes for this user
    const deleteResult = await votesCollection.deleteMany({
      userId: userObjectId
    });

    // Reset user's vote count
    await usersCollection.updateOne(
      { _id: userObjectId },
      { $set: { totalVotes: 0, updatedAt: new Date() } }
    );

    console.log(`✅ Removed ${deleteResult.deletedCount} votes`);
    console.log(`✅ Reset user's vote count to 0`);

    // Note: This doesn't recalculate movie/comparison stats
    console.log('⚠️  Note: Movie and comparison statistics not recalculated');
    console.log('   Run --reset-all to fully recalculate all statistics');
  } catch (error) {
    console.error('❌ Error removing user votes:', error.message);
  }
}

async function removeMovieVotes(movieId) {
  console.log(`🔍 Removing all votes for movie: ${movieId}`);

  const db = client.db(databaseName);
  const votesCollection = db.collection('votes');
  const moviesCollection = db.collection('movies');

  try {
    const movieObjectId = new ObjectId(movieId);

    // Get the movie info
    const movie = await moviesCollection.findOne({ _id: movieObjectId });
    if (!movie) {
      console.log('❌ Movie not found');
      return;
    }

    console.log(`🎬 Movie: "${movie.title}"`);

    // Count votes involving this movie (as winner or as one of the options)
    const voteCount = await votesCollection.countDocuments({
      $or: [
        { winnerId: movieObjectId },
        { movie1Id: movieObjectId },
        { movie2Id: movieObjectId }
      ]
    });

    if (voteCount === 0) {
      console.log('✅ No votes found for this movie');
      return;
    }

    console.log(`📊 Found ${voteCount} votes involving this movie`);

    // Remove all votes involving this movie
    const deleteResult = await votesCollection.deleteMany({
      $or: [
        { winnerId: movieObjectId },
        { movie1Id: movieObjectId },
        { movie2Id: movieObjectId }
      ]
    });

    // Reset movie's statistics
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

    console.log(`✅ Removed ${deleteResult.deletedCount} votes`);
    console.log(`✅ Reset movie statistics`);
  } catch (error) {
    console.error('❌ Error removing movie votes:', error.message);
  }
}

async function removeUserMovieVotes(userId, movieId) {
  console.log(
    `🔍 Removing votes for user ${userId} involving movie ${movieId}`
  );

  const db = client.db(databaseName);
  const votesCollection = db.collection('votes');

  try {
    const userObjectId = new ObjectId(userId);
    const movieObjectId = new ObjectId(movieId);

    // Find votes by this user involving this movie
    const voteCount = await votesCollection.countDocuments({
      userId: userObjectId,
      $or: [
        { winnerId: movieObjectId },
        { movie1Id: movieObjectId },
        { movie2Id: movieObjectId }
      ]
    });

    if (voteCount === 0) {
      console.log('✅ No votes found for this user-movie combination');
      return;
    }

    console.log(`📊 Found ${voteCount} votes to remove`);

    // Remove the votes
    const deleteResult = await votesCollection.deleteMany({
      userId: userObjectId,
      $or: [
        { winnerId: movieObjectId },
        { movie1Id: movieObjectId },
        { movie2Id: movieObjectId }
      ]
    });

    console.log(`✅ Removed ${deleteResult.deletedCount} votes`);
  } catch (error) {
    console.error('❌ Error removing user-movie votes:', error.message);
  }
}

async function resetAllVotingData() {
  if (!confirm) {
    console.log('❌ DANGER: This will delete ALL voting data!');
    console.log('Add --confirm flag to proceed with complete reset');
    return;
  }

  console.log('🚨 PERFORMING COMPLETE VOTING DATA RESET...');

  const db = client.db(databaseName);
  const votesCollection = db.collection('votes');
  const comparisonsCollection = db.collection('comparisons');
  const moviesCollection = db.collection('movies');
  const usersCollection = db.collection('users');

  try {
    // Get counts before deletion
    const [voteCount, comparisonCount, movieCount, userCount] =
      await Promise.all([
        votesCollection.countDocuments(),
        comparisonsCollection.countDocuments(),
        moviesCollection.countDocuments(),
        usersCollection.countDocuments()
      ]);

    console.log(`📊 Current data:`);
    console.log(`   Votes: ${voteCount}`);
    console.log(`   Comparisons: ${comparisonCount}`);
    console.log(`   Movies: ${movieCount}`);
    console.log(`   Users: ${userCount}`);

    // Delete all votes
    console.log('🗑️  Deleting all votes...');
    const votesDeleted = await votesCollection.deleteMany({});
    console.log(`✅ Deleted ${votesDeleted.deletedCount} votes`);

    // Delete all comparisons
    console.log('🗑️  Deleting all comparisons...');
    const comparisonsDeleted = await comparisonsCollection.deleteMany({});
    console.log(`✅ Deleted ${comparisonsDeleted.deletedCount} comparisons`);

    // Reset all movie statistics
    console.log('🔄 Resetting movie statistics...');
    const moviesReset = await moviesCollection.updateMany(
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
    console.log(`✅ Reset statistics for ${moviesReset.matchedCount} movies`);

    // Reset all user vote counts
    console.log('🔄 Resetting user vote counts...');
    const usersReset = await usersCollection.updateMany(
      {},
      {
        $set: {
          totalVotes: 0,
          updatedAt: new Date()
        }
      }
    );
    console.log(`✅ Reset vote counts for ${usersReset.matchedCount} users`);

    console.log('🎉 Complete reset finished successfully!');
    console.log(
      '📊 Final state: All voting data cleared, statistics reset to zero'
    );
  } catch (error) {
    console.error('❌ Error during reset:', error.message);
  }
}

async function main() {
  if (help) {
    showHelp();
    return;
  }

  if (!userId && !movieId && !resetAll) {
    console.log('❌ No operation specified. Use --help for usage information.');
    return;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');

    if (resetAll) {
      await resetAllVotingData();
    } else if (userId && movieId) {
      await removeUserMovieVotes(userId, movieId);
    } else if (userId) {
      await removeUserVotes(userId);
    } else if (movieId) {
      await removeMovieVotes(movieId);
    }
  } catch (error) {
    console.error('❌ Script failed:', error.message);
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
