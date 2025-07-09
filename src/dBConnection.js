import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;

// Save for when there is actually a difference
// const databaseName =
//   process.env.NODE_ENV === 'development'
//     ? process.env.ATLAS_DEV_DB
//     : process.env.ATLAS_PROD_DB;

const databaseName = 'baphy';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
});

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });

  console.log('✅ Successfully connected to MongoDB!');
} catch (err) {
  console.error('❌ MongoDB connection failed:', err.message);
  console.log('Server will continue without database connection...');
}

let db = client.db(databaseName);

export default db;
