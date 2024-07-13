import { MongoClient, ServerApiVersion } from 'mongodb';
import 'dotenv/config';

const uri = `mongodb+srv://${process.env.ATLAS_DB_USERNAME}:${process.env.ATLAS_DB_PASSWORD}@cluster0.4b8h77k.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

try {
  await client.connect();
  await client.db('admin').command({ ping: 1 });

  console.log('Pinged your deployment. You successfully connected to MongoDB!');
} catch (err) {
  console.error(err);
}

let db = client.db('sample_mflix');

export default db;
