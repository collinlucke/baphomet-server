import { db } from '../src/dBConnection.js';

console.log('🔄 Starting simple test...');
console.log(
  '📊 Database connection status:',
  db ? 'Connected' : 'Not connected'
);

async function testConnection() {
  try {
    const moviesCollection = db.collection('movies');
    const count = await moviesCollection.countDocuments();
    console.log('📊 Movies count:', count);
    console.log('✅ Test successful!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testConnection();
