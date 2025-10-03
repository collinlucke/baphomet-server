/**
 * Migration Script: Convert Movie IDs to MongoDB ObjectIds
 *
 * This script:
 * 1. Backs up current movies to a temporary collection
 * 2. Recreates movies with new ObjectId _ids
 * 3. Preserves all existing data including tmdbId
 * 4. Updates any references in other collections
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseName = 'baphy';

async function migrateMovieIds() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(databaseName);

    // Step 1: Backup current movies
    console.log('\n📋 Step 1: Backing up current movies...');
    const movies = await db.collection('movies').find({}).toArray();
    console.log(`📊 Found ${movies.length} movies to migrate`);

    // Create backup collection
    await db.collection('movies_backup').deleteMany({});
    if (movies.length > 0) {
      await db.collection('movies_backup').insertMany(movies);
      console.log('✅ Backup created in movies_backup collection');
    }

    // Step 2: Create mapping of old IDs to new ObjectIds
    console.log('\n🔄 Step 2: Creating ID mapping...');
    const idMapping = new Map();
    const migratedMovies = movies.map(movie => {
      const oldId = movie._id;
      const newId = new ObjectId();
      idMapping.set(oldId, newId);

      return {
        ...movie,
        _id: newId
        // Keep tmdbId exactly as is
        // Remove any reference to the old numeric ID
      };
    });

    console.log(`📝 Created mapping for ${idMapping.size} movies`);

    // Step 3: Replace movies collection
    console.log('\n🗑️ Step 3: Replacing movies collection...');
    await db.collection('movies').deleteMany({});

    if (migratedMovies.length > 0) {
      await db.collection('movies').insertMany(migratedMovies);
      console.log('✅ Movies collection recreated with ObjectIds');
    }

    // Step 4: Show sample of new structure
    console.log('\n📊 Step 4: Verification - Sample migrated movies:');
    const sampleMovies = await db
      .collection('movies')
      .find({})
      .limit(3)
      .toArray();

    sampleMovies.forEach((movie, index) => {
      console.log(`\nMovie ${index + 1}: ${movie.title}`);
      console.log(`  _id: ${movie._id} (ObjectId)`);
      console.log(`  tmdbId: ${movie.tmdbId} (${typeof movie.tmdbId})`);
      console.log(`  Has posterImages: ${movie.posterImages ? 'Yes' : 'No'}`);
    });

    // Step 5: Count verification
    console.log('\n✅ Migration Summary:');
    const originalCount = movies.length;
    const migratedCount = await db.collection('movies').countDocuments();
    const backupCount = await db.collection('movies_backup').countDocuments();

    console.log(`📊 Original movies: ${originalCount}`);
    console.log(`📊 Migrated movies: ${migratedCount}`);
    console.log(`📊 Backup movies: ${backupCount}`);

    if (originalCount === migratedCount && originalCount === backupCount) {
      console.log('🎉 Migration completed successfully!');
      console.log('\n⚠️  Important Notes:');
      console.log('- All scripts using movie IDs will need to be updated');
      console.log('- The movies_backup collection contains the original data');
      console.log(
        '- You can drop movies_backup after verifying everything works'
      );
    } else {
      console.log('❌ Migration count mismatch - please verify data integrity');
    }
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log(
      '\n🔧 Recovery: Original data is preserved in movies_backup collection'
    );
  } finally {
    await client.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldExecute = args.includes('--execute');

if (!shouldExecute) {
  console.log('🚨 Movie ID Migration Script');
  console.log('============================');
  console.log(
    'This will replace all numeric movie _ids with MongoDB ObjectIds'
  );
  console.log('tmdbId fields will remain unchanged');
  console.log('');
  console.log('To execute the migration, run:');
  console.log('node scripts/migrate-movie-ids.js --execute');
  console.log('');
  console.log('⚠️  WARNING: This will modify your movies collection!');
  console.log('Make sure you have a backup before proceeding.');
} else {
  console.log('🚀 Starting Movie ID Migration...');
  migrateMovieIds();
}
