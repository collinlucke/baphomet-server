import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from the server root directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const updateImagePaths = async () => {
  const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;

  if (!uri) {
    console.error('Error: MONGODB_URI environment variable is not set');
    console.log(
      'Make sure you have a .env file in the baphomet-server directory with MONGODB_URI=your_connection_string'
    );
    process.exit(1);
  }

  // Validate URI format
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    console.error(
      'Error: Invalid MongoDB URI format. Must start with mongodb:// or mongodb+srv://'
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('baphy');
    const movies = db.collection('movies');

    // Get all movies that have either posterPath or backdropPath

    // const moviesWithUrls = await movies
    //   .find({
    //     $or: [
    //       { posterPath: { $exists: true } },
    //       { backdropPath: { $exists: true } }
    //     ]
    //   })
    //   .toArray();

    let updatedCount = 0;

    for (const movie of await movies.find().toArray()) {
      const posterPath = movie.posterPath.split('/').pop();
      const backdropPath = movie.backdropPath.split('/').pop();
      await movies.updateOne(
        { _id: movie._id },
        {
          $set: {
            posterPath: `/${posterPath}`,
            backdropPath: `/${backdropPath}`
          },
          $unset: { posterPath: '', backdropPath: '' },
          $unset: { posterPath: '', backdropPath: '' }
        }
      );
    }

    // for (const movie of moviesWithUrls) {
    //   const updates = {};

    //   if (movie.posterPath) {
    //     // Extract path from URL for poster
    //     const posterPath = movie.posterPath.split('/').pop();
    //     console.log(posterPath);
    //     if (posterPath) {
    //       updates.posterPath = posterPath;
    //       updates.posterPath = null;
    //     }
    //   }

    // if (movie.backdropPath) {
    //   // Extract path from URL for backdrop
    //   const backdropPath = movie.backdropPath.split('/').pop();
    //   if (backdropPath) {
    //     updates.backdropPath = backdropPath;
    //     updates.backdropPath = null;
    //   }
    // }

    // Only update if we have changes
    //   if (Object.keys(updates).length > 0) {
    //     await movies.updateOne(
    //       { _id: movie._id },
    //       {
    //         $set: updates,
    //         $unset: {
    //           ...(updates.posterPath ? { posterPath: '' } : {}),
    //           ...(updates.backdropPath ? { backdropPath: '' } : {})
    //         }
    //       }
    //     );
    //     updatedCount++;
    //     console.log(`Updated movie: ${movie.title}`);
    //   }
    // }

    console.log(`\nComplete! Updated ${updatedCount} movies.`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
};

updateImagePaths().catch(console.error);
