/**
 * Comprehensive Cast & Crew Processing Script
 *
 * This script:
 * 1. Goes through all movies in the database
 * 2. Fetches cast and crew data from TMDB API
 * 3. Updates movies with cast/crew information
 * 4. Processes profile images for all people
 * 5. Adds people to the normalized people collection
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import fetch from 'node-fetch';
import { processPersonImages } from '../src/resolvers/enhancedImageResolvers.js';

const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
const databaseName = 'baphy';

// TMDB API configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

class CastCrewProcessor {
  constructor() {
    this.client = null;
    this.db = null;
    this.processedPeople = new Set();
    this.stats = {
      moviesProcessed: 0,
      castMembersAdded: 0,
      directorsAdded: 0,
      peopleProcessed: 0,
      imagesProcessed: 0,
      errors: []
    };
  }

  async connect() {
    this.client = new MongoClient(uri);
    await this.client.connect();
    this.db = this.client.db(databaseName);
    console.log('✅ Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }

  async fetchMovieCredits(tmdbId) {
    try {
      const response = await fetch(
        `${TMDB_BASE_URL}/movie/${tmdbId}/credits?api_key=${TMDB_API_KEY}`
      );

      if (!response.ok) {
        throw new Error(
          `TMDB API error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(
        `❌ Failed to fetch credits for TMDB ID ${tmdbId}:`,
        error.message
      );
      return null;
    }
  }

  formatCastMember(castMember) {
    return {
      id: castMember.id,
      name: castMember.name,
      character: castMember.character,
      order: castMember.order,
      profilePath: castMember.profile_path,
      gender: castMember.gender,
      knownForDepartment: castMember.known_for_department
    };
  }

  formatCrewMember(crewMember) {
    return {
      id: crewMember.id,
      name: crewMember.name,
      job: crewMember.job,
      department: crewMember.department,
      profilePath: crewMember.profile_path,
      gender: crewMember.gender,
      knownForDepartment: crewMember.known_for_department
    };
  }

  async processPersonImages(person, type, updateInDb = true) {
    try {
      if (!person.profilePath) {
        return { success: true, skipped: true, reason: 'No profile image' };
      }

      // Check if person already processed in this session
      const personKey = `${person.id}_${person.profilePath}`;
      if (this.processedPeople.has(personKey)) {
        return {
          success: true,
          skipped: true,
          reason: 'Already processed in session'
        };
      }

      const personData = {
        tmdbId: parseInt(person.id),
        name: person.name,
        profilePath: person.profilePath,
        knownFor: type === 'cast' ? 'Acting' : 'Directing'
      };

      const result = await processPersonImages(personData, updateInDb, this.db);

      if (result.errors.length === 0) {
        this.processedPeople.add(personKey);
        this.stats.peopleProcessed++;
        this.stats.imagesProcessed += 4; // w45, w185, h632, original
        return { success: true, processed: true };
      } else {
        return { success: false, errors: result.errors };
      }
    } catch (error) {
      console.error(
        `❌ Error processing person ${person.name}:`,
        error.message
      );
      return { success: false, errors: [error.message] };
    }
  }

  async processMovieCastCrew(movie) {
    try {
      console.log(`\n🎬 Processing: ${movie.title} (TMDB ID: ${movie.tmdbId})`);

      // Skip if movie already has cast and directors
      if (movie.topBilledCast?.length > 0 && movie.directors?.length > 0) {
        console.log('   ⏭️ Already has cast and crew data');
        return { success: true, skipped: true };
      }

      // Fetch credits from TMDB
      const credits = await this.fetchMovieCredits(movie.tmdbId);
      if (!credits) {
        this.stats.errors.push(`Failed to fetch credits: ${movie.title}`);
        return { success: false, error: 'Failed to fetch credits' };
      }

      // Process cast (top 10)
      const topCast = credits.cast
        .slice(0, 10)
        .map(member => this.formatCastMember(member));

      // Process directors
      const directors = credits.crew
        .filter(member => member.job === 'Director')
        .map(member => this.formatCrewMember(member));

      // Update movie in database
      const updateData = {
        topBilledCast: topCast,
        directors: directors,
        lastUpdated: new Date()
      };

      await this.db
        .collection('movies')
        .updateOne({ _id: movie._id }, { $set: updateData });

      console.log(
        `   ✅ Added ${topCast.length} cast members, ${directors.length} directors`
      );

      // Process cast member images
      for (const castMember of topCast) {
        if (castMember.profilePath) {
          const result = await this.processPersonImages(
            castMember,
            'cast',
            true
          );
          if (result.success && result.processed) {
            console.log(`   📸 Processed images for: ${castMember.name}`);
          } else if (result.success && result.skipped) {
            console.log(`   ⏭️ Skipped ${castMember.name}: ${result.reason}`);
          } else {
            console.log(
              `   ❌ Failed to process ${
                castMember.name
              }: ${result.errors?.join(', ')}`
            );
          }
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Process director images
      for (const director of directors) {
        if (director.profilePath) {
          const result = await this.processPersonImages(director, 'crew', true);
          if (result.success && result.processed) {
            console.log(
              `   🎭 Processed images for director: ${director.name}`
            );
          } else if (result.success && result.skipped) {
            console.log(
              `   ⏭️ Skipped director ${director.name}: ${result.reason}`
            );
          } else {
            console.log(
              `   ❌ Failed to process director ${
                director.name
              }: ${result.errors?.join(', ')}`
            );
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      this.stats.moviesProcessed++;
      this.stats.castMembersAdded += topCast.length;
      this.stats.directorsAdded += directors.length;

      return {
        success: true,
        processed: true,
        castCount: topCast.length,
        directorCount: directors.length
      };
    } catch (error) {
      console.error(`❌ Error processing movie ${movie.title}:`, error.message);
      this.stats.errors.push(`${movie.title}: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async processAllMovies(options = {}) {
    const {
      limit = null,
      offset = 0,
      forceReprocess = false,
      dryRun = false
    } = options;

    try {
      console.log('🚀 Starting Cast & Crew Processing');
      console.log('====================================');

      // Build query
      const query = {};
      if (!forceReprocess) {
        query.$or = [
          { topBilledCast: { $exists: false } },
          { topBilledCast: { $size: 0 } },
          { directors: { $exists: false } },
          { directors: { $size: 0 } }
        ];
      }

      // Get movies to process
      let cursor = this.db.collection('movies').find(query).skip(offset);
      if (limit) {
        cursor = cursor.limit(limit);
      }

      const movies = await cursor.toArray();
      console.log(`📊 Found ${movies.length} movies to process`);

      if (dryRun) {
        console.log('\n🔍 DRY RUN - Movies that would be processed:');
        movies.slice(0, 10).forEach((movie, index) => {
          console.log(
            `${index + 1}. ${movie.title} (TMDB ID: ${movie.tmdbId})`
          );
        });
        if (movies.length > 10) {
          console.log(`   ... and ${movies.length - 10} more movies`);
        }
        return;
      }

      // Process each movie
      for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        console.log(`\n--- Movie ${i + 1}/${movies.length} ---`);

        const result = await this.processMovieCastCrew(movie);

        if (result.success) {
          if (result.processed) {
            console.log(`✅ Completed: ${movie.title}`);
          } else if (result.skipped) {
            console.log(`⏭️ Skipped: ${movie.title}`);
          }
        } else {
          console.log(`❌ Failed: ${movie.title} - ${result.error}`);
        }

        // Delay between movies to be respectful to TMDB API
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      this.printSummary();
    } catch (error) {
      console.error('❌ Fatal error during processing:', error.message);
      throw error;
    }
  }

  printSummary() {
    console.log('\n📈 Processing Summary');
    console.log('====================');
    console.log(`✅ Movies processed: ${this.stats.moviesProcessed}`);
    console.log(`👥 Cast members added: ${this.stats.castMembersAdded}`);
    console.log(`🎭 Directors added: ${this.stats.directorsAdded}`);
    console.log(`📸 People processed: ${this.stats.peopleProcessed}`);
    console.log(`🖼️ Images processed: ${this.stats.imagesProcessed}`);

    if (this.stats.errors.length > 0) {
      console.log(`\n❌ Errors (${this.stats.errors.length}):`);
      this.stats.errors.slice(0, 10).forEach(error => {
        console.log(`   • ${error}`);
      });
      if (this.stats.errors.length > 10) {
        console.log(`   ... and ${this.stats.errors.length - 10} more errors`);
      }
    }
  }
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: null,
    offset: 0,
    forceReprocess: false,
    dryRun: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--limit':
        options.limit = parseInt(args[++i]);
        break;
      case '--offset':
        options.offset = parseInt(args[++i]);
        break;
      case '--force':
        options.forceReprocess = true;
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--help':
        options.help = true;
        break;
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Cast & Crew Processing Script

This script fetches cast and crew data from TMDB for all movies and processes their profile images.

Usage:
  node scripts/process-cast-crew.js [options]

Options:
  --limit <number>    Limit number of movies to process
  --offset <number>   Skip first N movies (default: 0)
  --force            Process movies even if they already have cast/crew data
  --dry-run          Show what would be processed without actually doing it
  --help             Show this help message

Examples:
  # Process first 10 movies
  node scripts/process-cast-crew.js --limit 10

  # See what would be processed
  node scripts/process-cast-crew.js --dry-run --limit 20

  # Process all movies (this will take a while!)
  node scripts/process-cast-crew.js

  # Force reprocess movies that already have data
  node scripts/process-cast-crew.js --force --limit 5
`);
}

// Main execution
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY environment variable is required');
    process.exit(1);
  }

  const processor = new CastCrewProcessor();

  try {
    await processor.connect();
    await processor.processAllMovies(options);
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  } finally {
    await processor.disconnect();
  }
}

main();
