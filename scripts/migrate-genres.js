import { db, client } from '../src/dBConnection.js';
import { ObjectId } from 'mongodb';

// Standard movie genres with our own custom IDs
const STANDARD_GENRES = [
  { id: '1', genre: 'Action' },
  { id: '2', genre: 'Adventure' },
  { id: '3', genre: 'Animation' },
  { id: '4', genre: 'Comedy' },
  { id: '5', genre: 'Crime' },
  { id: '6', genre: 'Documentary' },
  { id: '7', genre: 'Drama' },
  { id: '8', genre: 'Family' },
  { id: '9', genre: 'Fantasy' },
  { id: '10', genre: 'History' },
  { id: '11', genre: 'Horror' },
  { id: '12', genre: 'Music' },
  { id: '13', genre: 'Mystery' },
  { id: '14', genre: 'Romance' },
  { id: '15', genre: 'Science Fiction' },
  { id: '16', genre: 'TV Movie' },
  { id: '17', genre: 'Thriller' },
  { id: '18', genre: 'War' },
  { id: '19', genre: 'Western' }
];

async function migrateGenres() {
  console.log('🔄 Starting genre migration...');
  console.log(
    '📊 Database connection status:',
    db ? 'Connected' : 'Not connected'
  );

  try {
    const moviesCollection = db.collection('movies');
    const genresCollection = db.collection('genres');
    console.log('📊 Collections initialized successfully');

    // Step 1: Create genres collection
    console.log('📝 Creating genres collection...');

    // Clear existing genres collection
    await genresCollection.deleteMany({});

    // Insert standard genres
    await genresCollection.insertMany(STANDARD_GENRES);
    console.log(
      `✅ Inserted ${STANDARD_GENRES.length} genres into genres collection`
    );

    // Step 2: Get all movies and their genres
    console.log('📊 Analyzing existing movies...');
    const movies = await moviesCollection.find({}).toArray();
    console.log(`📊 Found ${movies.length} movies to migrate`);

    // Step 3: Create a mapping of genre names to IDs
    const genreNameToId = {};
    STANDARD_GENRES.forEach(genre => {
      genreNameToId[genre.genre.toLowerCase()] = genre.id;
      // Also handle common variations
      if (genre.genre === 'Science Fiction') {
        genreNameToId['sci-fi'] = genre.id;
        genreNameToId['scifi'] = genre.id;
      }
    });

    // Step 4: Collect unique genres from movies that don't match standard genres
    const unknownGenres = new Set();
    let nextCustomId = 20; // Start custom IDs at 20 since we have 19 standard genres

    movies.forEach(movie => {
      if (Array.isArray(movie.genres)) {
        movie.genres.forEach(genreName => {
          if (typeof genreName === 'string') {
            const normalizedName = genreName.toLowerCase();
            if (!genreNameToId[normalizedName]) {
              unknownGenres.add(genreName);
            }
          }
        });
      }
    });

    // Add custom genres for any that don't match standard genres
    if (unknownGenres.size > 0) {
      console.log(
        `📝 Found ${unknownGenres.size} custom genres not in standard list`
      );
      const customGenres = Array.from(unknownGenres).map(genreName => {
        const customGenre = {
          id: (nextCustomId++).toString(),
          genre: genreName
        };
        genreNameToId[genreName.toLowerCase()] = customGenre.id;
        return customGenre;
      });

      await genresCollection.insertMany(customGenres);
      console.log(`✅ Added ${customGenres.length} custom genres`);
    }

    // Step 5: Update all movies to use genre IDs
    console.log('🔄 Updating movies to use genre IDs...');
    let updatedCount = 0;
    let errorCount = 0;

    for (const movie of movies) {
      try {
        if (Array.isArray(movie.genres)) {
          // Convert string genres to objects with IDs
          const genreObjects = movie.genres
            .filter(genre => typeof genre === 'string') // Only process string genres
            .map(genreName => {
              const genreId = genreNameToId[genreName.toLowerCase()];
              if (!genreId) {
                console.warn(
                  `⚠️  No ID found for genre: ${genreName} in movie: ${movie.title}`
                );
                return null;
              }
              return { id: genreId, genre: genreName };
            })
            .filter(Boolean); // Remove null values

          // Only update if we have genre objects to set
          if (genreObjects.length > 0) {
            await moviesCollection.updateOne(
              { _id: movie._id },
              { $set: { genres: genreObjects } }
            );
            updatedCount++;
          }
        }
      } catch (error) {
        console.error(`❌ Error updating movie ${movie.title}:`, error.message);
        errorCount++;
      }
    }

    console.log(`✅ Migration completed!`);
    console.log(`📊 Updated ${updatedCount} movies`);
    if (errorCount > 0) {
      console.log(`⚠️  ${errorCount} movies had errors`);
    }

    // Step 6: Verify the migration
    const sampleMovie = await moviesCollection.findOne({
      genres: { $exists: true, $ne: [] }
    });
    if (sampleMovie && sampleMovie.genres.length > 0) {
      console.log(
        `✅ Sample movie "${sampleMovie.title}" genres:`,
        sampleMovie.genres
      );
    }

    const totalGenres = await genresCollection.countDocuments();
    console.log(`✅ Total genres in collection: ${totalGenres}`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    console.log('🔌 Migration script completed');
  }
}

// Run the migration
console.log('🚀 Starting migration execution...');
migrateGenres()
  .then(() => {
    console.log('🎉 Genre migration completed successfully!');
    process.exit(0);
  })
  .catch(error => {
    console.error('💥 Migration failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });

export { migrateGenres };
