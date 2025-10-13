#!/usr/bin/env node

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const ATLAS_CLUSTER = process.env.ATLAS_CLUSTER;
const ATLAS_DB_USERNAME = process.env.ATLAS_DB_USERNAME;
const ATLAS_DB_PASSWORD = process.env.ATLAS_DB_PASSWORD;
const ATLAS_DEV_DB = process.env.ATLAS_DEV_DB || 'baphy';

if (!ATLAS_CLUSTER || !ATLAS_DB_USERNAME || !ATLAS_DB_PASSWORD) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const uri = `mongodb+srv://${ATLAS_DB_USERNAME}:${ATLAS_DB_PASSWORD}@${ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;

// Helper function to convert any R2 URL to public custom domain URL
function convertToPublicUrl(originalUrl) {
  if (!originalUrl || typeof originalUrl !== 'string') {
    return originalUrl;
  }

  // If it's already in the new format, return as-is
  if (originalUrl.startsWith('https://images.collinlucke.com/')) {
    return originalUrl;
  }

  try {
    // Parse the URL to extract just the pathname
    const url = new URL(originalUrl);

    // Check if it's an R2 URL
    if (url.hostname.includes('r2.cloudflarestorage.com')) {
      // Extract the path (everything after the domain, removing leading slash)
      const path = url.pathname.startsWith('/')
        ? url.pathname.slice(1)
        : url.pathname;

      // Return the new public URL
      const newUrl = `https://images.collinlucke.com/${path}`;
      console.log(`🔄 Converting: ${originalUrl} → ${newUrl}`);
      return newUrl;
    }

    // If it's not an R2 URL, return unchanged
    return originalUrl;
  } catch (error) {
    console.warn(`⚠️  Could not parse URL: ${originalUrl}`, error.message);
    return originalUrl;
  }
}

async function updateImageUrls(dryRun = false) {
  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();

    const db = client.db(ATLAS_DEV_DB);
    const collection = db.collection('movies');

    console.log(`📊 Analyzing movie documents...`);

    // Find all movies with R2 URLs in backdropImages or posterImages
    const movies = await collection
      .find({
        $or: [
          {
            'backdropImages.original': {
              $regex: 'r2\\.cloudflarestorage\\.com'
            }
          },
          { 'backdropImages.w300': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'backdropImages.w780': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          {
            'backdropImages.w1280': { $regex: 'r2\\.cloudflarestorage\\.com' }
          },
          {
            'posterImages.original': { $regex: 'r2\\.cloudflarestorage\\.com' }
          },
          { 'posterImages.w92': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'posterImages.w154': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'posterImages.w185': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'posterImages.w342': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'posterImages.w500': { $regex: 'r2\\.cloudflarestorage\\.com' } },
          { 'posterImages.w780': { $regex: 'r2\\.cloudflarestorage\\.com' } }
        ]
      })
      .toArray();

    console.log(`📋 Found ${movies.length} movies with R2 URLs to update`);

    if (movies.length === 0) {
      console.log('✅ No movies need updating!');
      return;
    }

    let updatedCount = 0;
    const bulkOps = [];

    for (const movie of movies) {
      const updates = {};
      let hasUpdates = false;

      // Update backdropImages if they contain R2 URLs
      if (movie.backdropImages && typeof movie.backdropImages === 'object') {
        const backdropSizes = ['w300', 'w780', 'w1280', 'original'];
        for (const size of backdropSizes) {
          if (
            movie.backdropImages[size] &&
            movie.backdropImages[size].includes('r2.cloudflarestorage.com')
          ) {
            const newUrl = convertToPublicUrl(movie.backdropImages[size]);
            if (newUrl !== movie.backdropImages[size]) {
              updates[`backdropImages.${size}`] = newUrl;
              hasUpdates = true;
              console.log(`🖼️  ${movie.title}: backdrop ${size} → ${newUrl}`);
            }
          }
        }
      }

      // Update posterImages if they contain R2 URLs
      if (movie.posterImages && typeof movie.posterImages === 'object') {
        const posterSizes = [
          'w92',
          'w154',
          'w185',
          'w342',
          'w500',
          'w780',
          'original'
        ];
        for (const size of posterSizes) {
          if (
            movie.posterImages[size] &&
            movie.posterImages[size].includes('r2.cloudflarestorage.com')
          ) {
            const newUrl = convertToPublicUrl(movie.posterImages[size]);
            if (newUrl !== movie.posterImages[size]) {
              updates[`posterImages.${size}`] = newUrl;
              hasUpdates = true;
              console.log(`🎬 ${movie.title}: poster ${size} → ${newUrl}`);
            }
          }
        }
      }

      if (hasUpdates) {
        bulkOps.push({
          updateOne: {
            filter: { _id: movie._id },
            update: { $set: updates }
          }
        });
        updatedCount++;
      }
    }

    if (dryRun) {
      console.log(`\n🔍 DRY RUN: Would update ${updatedCount} movies`);
      console.log('💡 Run without --dry-run to apply changes');
    } else {
      if (bulkOps.length > 0) {
        console.log(`\n💾 Updating ${updatedCount} movies...`);
        const result = await collection.bulkWrite(bulkOps);
        console.log(`✅ Successfully updated ${result.modifiedCount} movies`);
      } else {
        console.log('✅ No movies needed updating!');
      }
    }
  } catch (error) {
    console.error('❌ Error updating image URLs:', error);
    throw error;
  } finally {
    await client.close();
    console.log('🔌 Database connection closed');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

console.log('🚀 Starting image URL update script...');
console.log(`📋 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE UPDATE'}`);

updateImageUrls(isDryRun)
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
