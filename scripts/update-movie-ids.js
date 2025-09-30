#!/usr/bin/env node

/**
 * Script to update all movie IDs to use 5-digit numeric IDs
 *
 * Usage:
 *   node scripts/update-movie-ids.js           # Run the update
 *   node scripts/update-movie-ids.js --dry-run # Preview changes only
 */

import { db, client } from '../src/dBConnection.js';
import { ObjectId } from 'mongodb';

// Command line arguments
const isDryRun = process.argv.includes('--dry-run');
const verbose = process.argv.includes('--verbose');

// Generate a 5-digit numeric ID (10000-99999)
function generateNumericId() {
  // Generate a number between 10000 and 99999 (5 digits)
  return Math.floor(10000 + Math.random() * 90000);
}

// Main function
async function updateMovieIds() {
  try {
    console.log('🔄 Connecting to MongoDB...');

    console.log(
      isDryRun
        ? '🧪 DRY RUN MODE - No changes will be made to the database'
        : '⚠️  LIVE MODE - Changes will be applied to the database'
    );

    // Collections we need to update
    const moviesCollection = db.collection('movies');
    const votesCollection = db.collection('votes');
    const comparisonsCollection = db.collection('comparisons');

    console.log('🔍 Finding all movies...');

    // Get all movies
    const movies = await moviesCollection.find({}).toArray();
    console.log(`📊 Found ${movies.length} movies`);

    if (movies.length === 0) {
      console.log('✅ No movies to update');
      await client.close();
      return;
    }

    // Map to track old IDs to new numeric IDs
    const idMap = new Map();
    // Set to keep track of used numeric IDs to prevent duplicates
    const usedIds = new Set();

    // First pass: Generate new numeric IDs for all movies
    for (const movie of movies) {
      const oldId = movie._id.toString();

      // Generate a unique numeric ID
      let numericId;
      do {
        numericId = generateNumericId();
      } while (usedIds.has(numericId));

      // Mark this ID as used
      usedIds.add(numericId);
      // Store the mapping
      idMap.set(oldId, numericId);

      if (verbose) {
        console.log(`🎬 "${movie.title}": ${oldId} -> ${numericId}`);
      }
    }

    console.log(`📝 Generated ${idMap.size} unique short IDs`);

    if (!isDryRun) {
      // Create new movies with numeric IDs
      console.log('\n🔄 Creating new movie documents with numeric IDs...');
      let movieUpdateCount = 0;

      for (const movie of movies) {
        const oldId = movie._id.toString();
        const numericId = idMap.get(oldId);

        if (!numericId) continue;

        // Copy the movie object without the _id field
        const { _id, ...movieWithoutId } = movie;

        // Create a new movie document with numeric ID
        const result = await moviesCollection.insertOne({
          _id: numericId, // Use numeric ID as the primary key
          ...movieWithoutId
        });

        if (result.insertedId) {
          movieUpdateCount++;
          if (verbose) {
            console.log(
              `✅ Created new movie with ID: ${numericId} (was ${oldId})`
            );
          }
        }
      }

      console.log(`✅ Created ${movieUpdateCount} movies with numeric IDs`);

      // Update votes collection
      console.log('\n🔄 Updating votes...');
      let voteUpdateCount = 0;

      const votes = await votesCollection.find({}).toArray();
      console.log(`📊 Found ${votes.length} votes to update`);

      for (const vote of votes) {
        const movie1NumericId = idMap.get(vote.movie1Id.toString());
        const movie2NumericId = idMap.get(vote.movie2Id.toString());
        const winnerNumericId = idMap.get(vote.winnerId.toString());

        if (movie1NumericId && movie2NumericId && winnerNumericId) {
          const result = await votesCollection.updateOne(
            { _id: vote._id },
            {
              $set: {
                movie1Id: movie1NumericId,
                movie2Id: movie2NumericId,
                winnerId: winnerNumericId
              }
            }
          );

          if (result.modifiedCount > 0) {
            voteUpdateCount++;
          }
        }
      }

      console.log(`✅ Updated ${voteUpdateCount} votes with numeric IDs`);

      // Update comparisons collection
      console.log('\n🔄 Updating comparisons...');
      let comparisonUpdateCount = 0;

      const comparisons = await comparisonsCollection.find({}).toArray();
      console.log(`📊 Found ${comparisons.length} comparisons to update`);

      for (const comparison of comparisons) {
        const movie1NumericId = idMap.get(comparison.movie1Id.toString());
        const movie2NumericId = idMap.get(comparison.movie2Id.toString());

        if (movie1NumericId && movie2NumericId) {
          const result = await comparisonsCollection.updateOne(
            { _id: comparison._id },
            {
              $set: {
                movie1Id: movie1NumericId,
                movie2Id: movie2NumericId
              }
            }
          );

          if (result.modifiedCount > 0) {
            comparisonUpdateCount++;
          }
        }
      }

      console.log(
        `✅ Updated ${comparisonUpdateCount} comparisons with numeric IDs`
      );

      // Delete old movie documents with ObjectIDs
      console.log('\n🔄 Removing old movie documents...');
      let deleteCount = 0;

      for (const movie of movies) {
        const oldId = movie._id;

        const result = await moviesCollection.deleteOne({ _id: oldId });

        if (result.deletedCount > 0) {
          deleteCount++;
        }
      }

      console.log(`✅ Removed ${deleteCount} old movie documents`);

      console.log('\n🎉 Database update completed successfully!');
      console.log(`✅ Created ${movieUpdateCount} movies with numeric IDs`);
      console.log(`✅ Updated ${voteUpdateCount} votes with numeric IDs`);
      console.log(
        `✅ Updated ${comparisonUpdateCount} comparisons with numeric IDs`
      );
      console.log(`✅ Removed ${deleteCount} old movie documents`);
    } else {
      console.log('\n🧪 DRY RUN SUMMARY:');
      console.log(`Would replace ${movies.length} movies with new numeric IDs`);

      // Show sample of ID mappings
      console.log('\n📋 Sample of ID mappings:');
      let count = 0;
      for (const [oldId, newId] of idMap.entries()) {
        const movie = movies.find(m => m._id.toString() === oldId);
        console.log(`${movie.title}: ${oldId} -> ${newId}`);
        count++;
        if (count >= 10) break; // Show only first 10
      }

      if (idMap.size > 10) {
        console.log(`...and ${idMap.size - 10} more`);
      }
    }
  } catch (error) {
    console.error('❌ Error updating movie IDs:', error);
  } finally {
    console.log('👋 Closing database connection');
    await client.close();
  }
}

// Run the script
updateMovieIds();
