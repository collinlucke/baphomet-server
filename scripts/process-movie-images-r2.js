#!/usr/bin/env node

/**
 * Movie Image Processing Script for R2 Storage
 *
 * This script processes movies from the database and:
 * 1. Downloads images from TMDB
 * 2. Generates multiple size variants using Sharp
 * 3. Uploads all variants to Cloudflare R2
 * 4. Updates the database with R2 URLs
 *
 * Usage:
 *   node scripts/process-movie-images-r2.js [options]
 *
 * Options:
 *   --limit <number>     Limit number of movies to process (default: 10)
 *   --offset <number>    Skip first N movies (default: 0)
 *   --force             Process movies even if they already have R2 images
 *   --dry-run           Show what would be processed without actually doing it
 *   --movie-id <id>     Process only a specific movie by MongoDB ObjectId or TMDB ID
 *   --help              Show this help message
 */

import 'dotenv/config';
import { db } from '../src/dBConnection.js';
import { processMovieImages } from '../src/resolvers/enhancedImageResolvers.js';
import { ObjectId } from 'mongodb';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: 10,
    offset: 0,
    force: false,
    dryRun: false,
    movieId: null,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // Skip the double dash separator that pnpm adds
    if (arg === '--') continue;

    switch (arg) {
      case '--limit':
        options.limit = parseInt(args[++i]) || 10;
        break;
      case '--offset':
        options.offset = parseInt(args[++i]) || 0;
        break;
      case '--force':
        options.force = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--movie-id':
        options.movieId = args[++i];
        break;
      case '--help':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          // Skip non-option arguments
          continue;
        }
        console.log(`Unknown option: ${arg}`);
        options.help = true;
        break;
    }
  }

  return options;
}

// Show help message
function showHelp() {
  console.log(`
Movie Image Processing Script for R2 Storage

This script processes movies from the database and:
1. Downloads images from TMDB
2. Generates multiple size variants using Sharp
3. Uploads all variants to Cloudflare R2
4. Updates the database with R2 URLs

Usage:
  node scripts/process-movie-images-r2.js [options]

Options:
  --limit <number>     Limit number of movies to process (default: 10)
  --offset <number>    Skip first N movies (default: 0)
  --force             Process movies even if they already have R2 images
  --dry-run           Show what would be processed without actually doing it
  --movie-id <id>     Process only a specific movie by ID
  --help              Show this help message

Examples:
  # Process 5 movies
  node scripts/process-movie-images-r2.js --limit 5

  # Process movies 10-20
  node scripts/process-movie-images-r2.js --limit 10 --offset 10

  # Process a specific movie
  node scripts/process-movie-images-r2.js --movie-id 68e0289bf724827a47396035

  # See what would be processed without doing it
  node scripts/process-movie-images-r2.js --dry-run --limit 20

  # Force reprocess movies that already have R2 images
  node scripts/process-movie-images-r2.js --force --limit 5
  `);
}

// Build query based on options
function buildQuery(options) {
  const query = {};

  if (options.movieId) {
    // Try to determine if it's an ObjectId or TMDB ID
    if (ObjectId.isValid(options.movieId)) {
      // It's a valid ObjectId
      query._id = new ObjectId(options.movieId);
    } else {
      // Assume it's a TMDB ID (numeric)
      const numericId = parseInt(options.movieId);
      if (!isNaN(numericId)) {
        query.tmdbId = numericId;
      } else {
        // Try as string tmdbId
        query.tmdbId = options.movieId;
      }
    }
  } else if (!options.force) {
    // Only process movies that don't have R2 images yet
    query.$or = [
      { posterImages: { $exists: false } },
      { backdropImages: { $exists: false } }
    ];

    // And have TMDB image paths
    query.$and = [
      {
        $or: [
          { posterPath: { $ne: null, $ne: '' } },
          { backdropPath: { $ne: null, $ne: '' } }
        ]
      }
    ];
  } else {
    // Force mode: process movies that have TMDB paths
    query.$or = [
      { posterPath: { $ne: null, $ne: '' } },
      { backdropPath: { $ne: null, $ne: '' } }
    ];
  }

  return query;
}

// Get movies to process
async function getMoviesToProcess(options) {
  const query = buildQuery(options);

  console.log('🔍 Query criteria:', JSON.stringify(query, null, 2));

  try {
    let cursor = db.collection('movies').find(query);

    if (!options.movieId) {
      cursor = cursor.skip(options.offset).limit(options.limit);
    }

    const movies = await cursor.toArray();
    console.log(`📋 Query returned ${movies.length} movies`);

    return movies;
  } catch (error) {
    console.error('❌ Error querying database:', error.message);
    throw error;
  }
}

// Process a single movie
async function processSingleMovie(movie, options) {
  const movieId = movie._id || movie.id;
  const movieTitle = movie.title || `Movie ${movieId}`;

  console.log(`\n📽️  Processing: ${movieTitle} (ID: ${movieId})`);
  console.log(`   Poster: ${movie.posterPath || 'None'}`);
  console.log(`   Backdrop: ${movie.backdropPath || 'None'}`);

  if (options.dryRun) {
    console.log(`   🔍 DRY RUN: Would process this movie`);
    return {
      movieId,
      title: movieTitle,
      success: true,
      dryRun: true,
      errors: []
    };
  }

  try {
    const startTime = Date.now();

    // Process the movie images using the existing function
    const result = await processMovieImages(movie, true, db);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    const success = result.errors.length === 0;

    if (success) {
      console.log(`   ✅ Successfully processed in ${duration}s`);
      if (result.posterImages) {
        console.log(
          `      📸 Poster variants: ${Object.keys(result.posterImages).join(
            ', '
          )}`
        );
      }
      if (result.backdropImages) {
        console.log(
          `      🖼️  Backdrop variants: ${Object.keys(
            result.backdropImages
          ).join(', ')}`
        );
      }
    } else {
      console.log(`   ❌ Failed after ${duration}s`);
      result.errors.forEach(error => {
        console.log(`      Error: ${error}`);
      });
    }

    return {
      movieId,
      title: movieTitle,
      success,
      posterImages: result.posterImages,
      backdropImages: result.backdropImages,
      errors: result.errors,
      duration
    };
  } catch (error) {
    console.log(`   ❌ Processing failed: ${error.message}`);
    return {
      movieId,
      title: movieTitle,
      success: false,
      errors: [error.message]
    };
  }
}

// Main processing function
async function processMovies() {
  const options = parseArgs();

  console.log('🔧 Parsed arguments:', JSON.stringify(options, null, 2));

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  console.log('🚀 Starting Movie Image Processing for R2 Storage');
  console.log('================================================');
  console.log(`Options:`, {
    limit: options.limit,
    offset: options.offset,
    force: options.force,
    dryRun: options.dryRun,
    movieId: options.movieId
  });

  try {
    // Wait a moment for database connection to be fully established
    console.log('⏳ Waiting for database connection...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test database connection
    console.log('🔗 Testing database connection...');
    const testResult = await db.collection('movies').countDocuments();
    console.log(
      `📊 Database test successful: Found ${testResult} total movies in database`
    );

    // Get movies to process
    console.log('\n🔍 Finding movies to process...');
    const movies = await getMoviesToProcess(options);

    if (movies.length === 0) {
      console.log('📭 No movies found matching the criteria');
      process.exit(0);
    }

    console.log(`📊 Found ${movies.length} movie(s) to process`);

    // Process each movie
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < movies.length; i++) {
      const movie = movies[i];
      console.log(`\n--- Movie ${i + 1}/${movies.length} ---`);

      const result = await processSingleMovie(movie, options);
      results.push(result);

      if (result.success) {
        successCount++;
      } else {
        errorCount++;
      }

      // Add a small delay to avoid overwhelming the system
      if (i < movies.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Summary
    console.log('\n📈 Processing Summary');
    console.log('====================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📊 Total: ${movies.length}`);

    if (options.dryRun) {
      console.log(
        '\n🔍 This was a dry run - no actual processing was performed'
      );
    }

    // Show errors if any
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
      console.log('\n❌ Failed Movies:');
      failedResults.forEach(result => {
        console.log(
          `   ${result.title} (${result.movieId}): ${result.errors.join(', ')}`
        );
      });
    }
  } catch (error) {
    console.error('💥 Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Interrupted by user');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️  Terminated');
  process.exit(0);
});

// Run if called directly
processMovies()
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
