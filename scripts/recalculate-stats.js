#!/usr/bin/env node

/**
 * Recalculate Movie Statistics Script
 *
 * This script recalculates all movie statistics based on current voting data.
 * Useful after partial vote cleanup or data inconsistencies.
 *
 * Usage:
 *   node scripts/recalculate-stats.js
 *   node scripts/recalculate-stats.js --movie-id="MOVIE_ID"
 *   node scripts/recalculate-stats.js --dry-run
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

const movieId = getArg('movie-id');
const isDryRun = hasFlag('dry-run');

async function recalculateMovieStats(specificMovieId = null) {
  const db = client.db(databaseName);
  const moviesCollection = db.collection('movies');
  const votesCollection = db.collection('votes');
  const comparisonsCollection = db.collection('comparisons');

  console.log(
    isDryRun
      ? '🧪 DRY RUN MODE - No changes will be made'
      : '🔄 Recalculating movie statistics...'
  );

  try {
    // Get movies to process
    const movieQuery = specificMovieId
      ? { _id: new ObjectId(specificMovieId) }
      : {};
    const movies = await moviesCollection.find(movieQuery).toArray();

    if (movies.length === 0) {
      console.log('❌ No movies found to process');
      return;
    }

    console.log(`📊 Processing ${movies.length} movie(s)...`);

    for (const movie of movies) {
      console.log(`\n🎬 Processing: "${movie.title}"`);

      // Count total wins (when this movie was chosen as winner)
      const totalWins = await votesCollection.countDocuments({
        winnerId: movie._id
      });

      // Count total losses (when this movie was an option but not chosen)
      const totalAppearances = await votesCollection.countDocuments({
        $or: [{ movie1Id: movie._id }, { movie2Id: movie._id }]
      });

      const totalLosses = totalAppearances - totalWins;
      const totalComparisons = totalAppearances;
      const winningPercentage =
        totalComparisons > 0 ? (totalWins / totalComparisons) * 100 : 0;

      console.log(
        `   Current stats: Wins: ${movie.totalWins || 0}, Losses: ${
          movie.totalLosses || 0
        }, Comparisons: ${movie.totalComparisons || 0}, Win%: ${
          movie.winningPercentage || 0
        }%`
      );
      console.log(
        `   Calculated:    Wins: ${totalWins}, Losses: ${totalLosses}, Comparisons: ${totalComparisons}, Win%: ${winningPercentage.toFixed(
          2
        )}%`
      );

      const hasChanges =
        totalWins !== (movie.totalWins || 0) ||
        totalLosses !== (movie.totalLosses || 0) ||
        totalComparisons !== (movie.totalComparisons || 0) ||
        Math.abs(winningPercentage - (movie.winningPercentage || 0)) > 0.01;

      if (hasChanges) {
        console.log(`   📝 Statistics need updating`);

        if (!isDryRun) {
          await moviesCollection.updateOne(
            { _id: movie._id },
            {
              $set: {
                totalWins,
                totalLosses,
                totalComparisons,
                winningPercentage: Math.round(winningPercentage * 100) / 100,
                lastUpdated: new Date()
              }
            }
          );
          console.log(`   ✅ Updated successfully`);
        }
      } else {
        console.log(`   ✅ Statistics are already correct`);
      }
    }

    // Recalculate comparison statistics
    console.log('\n🔄 Recalculating comparison statistics...');
    const comparisons = await comparisonsCollection.find({}).toArray();

    for (const comparison of comparisons) {
      // Count votes for movie1 vs movie2
      const movie1Wins = await votesCollection.countDocuments({
        comparisonId: comparison._id,
        winnerId: comparison.movie1Id
      });

      const movie2Wins = await votesCollection.countDocuments({
        comparisonId: comparison._id,
        winnerId: comparison.movie2Id
      });

      const totalVotes = movie1Wins + movie2Wins;

      const hasChanges =
        movie1Wins !== (comparison.movie1Wins || 0) ||
        movie2Wins !== (comparison.movie2Wins || 0) ||
        totalVotes !== (comparison.totalVotes || 0);

      if (hasChanges) {
        console.log(
          `   📝 Comparison needs updating: ${movie1Wins} vs ${movie2Wins} (${totalVotes} total votes)`
        );

        if (!isDryRun) {
          await comparisonsCollection.updateOne(
            { _id: comparison._id },
            {
              $set: {
                movie1Wins,
                movie2Wins,
                totalVotes,
                updatedAt: new Date()
              }
            }
          );
        }
      }
    }

    // Recalculate user vote counts
    console.log('\n🔄 Recalculating user vote counts...');
    const usersCollection = db.collection('users');
    const users = await usersCollection.find({}).toArray();

    for (const user of users) {
      const actualVoteCount = await votesCollection.countDocuments({
        userId: user._id
      });

      if (actualVoteCount !== (user.totalVotes || 0)) {
        console.log(
          `   📝 User "${user.username}" vote count: ${
            user.totalVotes || 0
          } → ${actualVoteCount}`
        );

        if (!isDryRun) {
          await usersCollection.updateOne(
            { _id: user._id },
            {
              $set: {
                totalVotes: actualVoteCount,
                updatedAt: new Date()
              }
            }
          );
        }
      }
    }

    if (isDryRun) {
      console.log('\n🧪 Dry run completed - no changes were made');
      console.log('   Remove --dry-run flag to apply changes');
    } else {
      console.log('\n✅ Statistics recalculation completed!');
    }
  } catch (error) {
    console.error('❌ Error recalculating statistics:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');

    await recalculateMovieStats(movieId);
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
