#!/usr/bin/env node

/**
 * Simple script to update movie poster and backdrop URLs in MongoDB
 * Changes poster URLs to use w780 and backdrop URLs to use w1280
 *
 * Usage:
 *   node scripts/update-movie-urls.js           # Run the update
 *   node scripts/update-movie-urls.js --dry-run # Preview changes only
 */

import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

// MongoDB connection (same as your dBConnection.js)
const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseName = 'baphy';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

async function updateMovieUrls() {
  const isDryRun = process.argv.includes('--dry-run');

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const db = client.db(databaseName);
    const moviesCollection = db.collection('movies');

    console.log('🔍 Finding movies with TMDB URLs...');

    const movies = await moviesCollection
      .find({
        $or: [
          { posterUrl: { $regex: /^https:\/\/image\.tmdb\.org\/t\/p\// } }
          // { backdropUrl: { $regex: /^https:\/\/image\.tmdb\.org\/t\/p\// } }
        ]
      })
      .toArray();

    console.log(`📊 Found ${movies.length} movies with TMDB URLs`);

    if (movies.length === 0) {
      console.log('✅ No movies found with TMDB URLs to update');
      return;
    }

    let updatedCount = 0;
    const updates = [];

    for (const movie of movies) {
      const updateDoc = {};
      let hasChanges = false;

      // Update poster URL to use w300
      if (movie.posterUrl && movie.posterUrl.includes('image.tmdb.org/t/p/')) {
        const newPosterUrl = movie.posterUrl.replace(
          'https://image.tmdb.org/t/p/w780/',
          'https://image.tmdb.org/t/p/w300/'
        );
        if (newPosterUrl !== movie.posterUrl) {
          updateDoc.posterUrl = newPosterUrl;
          hasChanges = true;
        }
      }

      // Update backdrop URL to use w1280
      // if (
      //   movie.backdropUrl &&
      //   movie.backdropUrl.includes('image.tmdb.org/t/p/')
      // ) {
      //   const newBackdropUrl = movie.backdropUrl.replace(
      //     'https://image.tmdb.org/t/p/original/',
      //     'https://image.tmdb.org/t/p/w1280/'
      //   );
      //   if (newBackdropUrl !== movie.backdropUrl) {
      //     updateDoc.backdropUrl = newBackdropUrl;
      //     hasChanges = true;
      //   }
      // }

      if (hasChanges) {
        updates.push({
          movie: movie,
          updateDoc: updateDoc
        });
      }
    }

    console.log(`🔄 ${updates.length} movies need URL updates`);

    if (updates.length === 0) {
      console.log('✅ All movie URLs are already using the correct sizes!');
      return;
    }

    // Show first few examples
    console.log('\n📋 Example changes:');
    updates.slice(0, 3).forEach((update, index) => {
      console.log(`\n${index + 1}. "${update.movie.title}"`);
      if (update.updateDoc.posterUrl) {
        console.log(`   📸 Poster:   ${update.movie.posterUrl}`);
        console.log(`   📸 → New:    ${update.updateDoc.posterUrl}`);
      }
      if (update.updateDoc.backdropUrl) {
        console.log(`   🖼️  Backdrop: ${update.movie.backdropUrl}`);
        console.log(`   🖼️  → New:    ${update.updateDoc.backdropUrl}`);
      }
    });

    if (isDryRun) {
      console.log('\n🧪 DRY RUN - No changes made');
      console.log(`Would update ${updates.length} movies`);
      return;
    }

    console.log(`\n🔄 Updating ${updates.length} movies...`);

    for (const update of updates) {
      try {
        await moviesCollection.updateOne(
          { _id: update.movie._id },
          { $set: update.updateDoc }
        );
        updatedCount++;

        if (updatedCount % 10 === 0) {
          console.log(
            `   ✅ Updated ${updatedCount}/${updates.length} movies...`
          );
        }
      } catch (error) {
        console.error(
          `❌ Error updating "${update.movie.title}":`,
          error.message
        );
      }
    }

    console.log(`\n✅ Successfully updated ${updatedCount} movies!`);
  } catch (error) {
    console.error('❌ Script failed:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
updateMovieUrls()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
