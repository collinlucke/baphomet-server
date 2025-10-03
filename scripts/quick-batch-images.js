#!/usr/bin/env node

/**
 * Quick Batch Image Processing Script
 *
 * A simplified script for common batch processing tasks
 */

import { db } from '../src/dBConnection.js';
import { batchProcessMovieImages } from '../src/resolvers/enhancedImageResolvers.js';

async function quickBatchProcess() {
  console.log('🚀 Quick Batch Image Processing');
  console.log('================================');

  try {
    // Find movies that need image processing
    const movies = await db
      .collection('movies')
      .find({
        $or: [
          { posterImages: { $exists: false } },
          { backdropImages: { $exists: false } }
        ],
        $and: [
          {
            $or: [
              { posterPath: { $ne: null, $ne: '' } },
              { backdropPath: { $ne: null, $ne: '' } }
            ]
          }
        ]
      })
      .limit(10)
      .toArray();

    if (movies.length === 0) {
      console.log('📭 No movies found that need image processing');
      return;
    }

    console.log(`📊 Found ${movies.length} movies to process`);

    // Process them using the batch function
    const results = await batchProcessMovieImages(movies, db);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log('\n📈 Results:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${failureCount}`);

    // Show failed movies
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ Failed Movies:');
      failed.forEach(result => {
        console.log(
          `   ${result.title}: ${result.errors?.join(', ') || 'Unknown error'}`
        );
      });
    }

    console.log('\n🎉 Batch processing completed');
  } catch (error) {
    console.error('💥 Batch processing failed:', error.message);
    throw error;
  }
}

// Run if called directly
quickBatchProcess()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });

export default quickBatchProcess;
