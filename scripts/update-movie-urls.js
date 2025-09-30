#!/usr/bin/env node

/**
 * Simple script to update movie poster and backdrop URLs in MongoDB
 * Changes poster URLs to use w780 and backdrop URLs to use w1280
 *
 * Usage:
 *   node scripts/update-movie-urls.js           # Run the update
 *   node scripts/update-movie-urls.js --dry-run # Preview changes only
 */

// It's served it's current purpose
// Keeping it around in case of future needs
import { db, client } from '../src/dBConnection.js';

async function updateMovieUrls() {
  const isDryRun = process.argv.includes('--dry-run');

  try {
    console.log('🔄 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected successfully!');

    const moviesCollection = db.collection('movies');

    console.log('🔍 Finding movies with TMDB URLs...');

    const movies = await moviesCollection
      .find({
        $or: [
          { posterPath: { $regex: /^https:\/\/image\.tmdb\.org\/t\/p\// } }
          // { backdropPath: { $regex: /^https:\/\/image\.tmdb\.org\/t\/p\// } }
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
      if (
        movie.posterPath &&
        movie.posterPath.includes('image.tmdb.org/t/p/')
      ) {
        const newposterPath = movie.posterPath.replace(
          'https://image.tmdb.org/t/p/w780/',
          'https://image.tmdb.org/t/p/w300/'
        );
        if (newposterPath !== movie.posterPath) {
          updateDoc.posterPath = newposterPath;
          hasChanges = true;
        }
      }

      // Update backdrop URL to use w1280
      // if (
      //   movie.backdropPath &&
      //   movie.backdropPath.includes('image.tmdb.org/t/p/')
      // ) {
      //   const newbackdropPath = movie.backdropPath.replace(
      //     'https://image.tmdb.org/t/p/original/',
      //     'https://image.tmdb.org/t/p/w1280/'
      //   );
      //   if (newbackdropPath !== movie.backdropPath) {
      //     updateDoc.backdropPath = newbackdropPath;
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

    console.log('\n📋 Example changes:');
    updates.slice(0, 3).forEach((update, index) => {
      console.log(`\n${index + 1}. "${update.movie.title}"`);
      if (update.updateDoc.posterPath) {
        console.log(`   📸 Poster:   ${update.movie.posterPath}`);
        console.log(`   📸 → New:    ${update.updateDoc.posterPath}`);
      }
      if (update.updateDoc.backdropPath) {
        console.log(`   🖼️  Backdrop: ${update.movie.backdropPath}`);
        console.log(`   🖼️  → New:    ${update.updateDoc.backdropPath}`);
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

updateMovieUrls()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
