import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

console.log('🔍 MongoDB Environment Variables:');
console.log(
  'ATLAS_DB_USERNAME:',
  process.env.ATLAS_DB_USERNAME ? '✅ Set' : '❌ Missing'
);
console.log(
  'ATLAS_DB_PASSWORD:',
  process.env.ATLAS_DB_PASSWORD ? '✅ Set' : '❌ Missing'
);
console.log(
  'ATLAS_CLUSTER:',
  process.env.ATLAS_CLUSTER ? '✅ Set' : '❌ Missing'
);
console.log('NODE_ENV:', process.env.NODE_ENV || 'undefined');

const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@${process.env.ATLAS_CLUSTER}/?retryWrites=true&w=majority&appName=Cluster0`;
console.log('📝 Connection URI:', uri.replace(/:([^:@]+)@/, ':***@'));

const databaseName = 'baphy';
const mdDatabaseName = 'md-projects';

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

try {
  await client.connect();

  console.log('✅ Successfully connected to MongoDB!');
} catch (err) {
  console.error('❌ MongoDB connection failed:', err.message);
  console.log('Server will continue without database connection...');
}

let db = client.db(databaseName);
let mdDb = client.db(mdDatabaseName);

export { db, mdDb, client, databaseName, mdDatabaseName };
