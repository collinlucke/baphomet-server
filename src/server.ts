import express from 'express';
import cors from 'cors';
import gql from 'graphql-tag';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4';
import resolvers from './resolvers.js';
import fs from 'fs';
import https from 'https';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault
} from '@apollo/server/plugin/landingPage/default';
// import letterboxdApi from './routes/letterboxdApi.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

const corsOptions = {
  credentials: 'include',
  origin: [
    'http://localhost:5173',
    'http://192.168.1.112:5173',
    'https://baphomet.collinlucke.com',
    'https://collinlucke.github.io',
    process.env.BAPHOMET_UI_URL || 'https://collinlucke.com'
  ]
};
app.use(cors(corsOptions));
app.use(express.json());

const typeDefs = gql(
  fs.readFileSync(path.join(__dirname, './schema.graphql'), {
    encoding: 'utf-8'
  })
);

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers }),
  introspection: process.env.NODE_ENV !== 'production',
  plugins: [
    process.env.NODE_ENV === 'production'
      ? ApolloServerPluginLandingPageProductionDefault()
      : ApolloServerPluginLandingPageLocalDefault()
  ]
});

await server.start();

app.options('*', cors(corsOptions));

app.use(
  '/graphql',
  cors(corsOptions),
  express.json(),
  expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization || '';
      return { token };
    }
  })
);

// app.use('/letterboxdApi', letterboxdApi);

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    service: 'baphomet-server',
    timestamp: new Date().toISOString(),
    graphql: '/graphql'
  });
});

app.get('*', (req, res) => {
  const frontendUrl = process.env.BAPHOMET_UI_URL || 'https://collinlucke.com';
  res.json({
    message: 'Baphomet Server - GraphQL API',
    frontend: frontendUrl,
    graphql: '/graphql',
    health: '/health',
    requestedPath: req.path,
    note: 'This is a GraphQL API server. The frontend is hosted separately.'
  });
});

const PORT = parseInt(process.env.PORT || '5050');

const httpServer = http.createServer(app);

httpServer.on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
    console.log(`💡 To kill the process using port ${PORT}:`);
    if (process.platform === 'win32') {
      console.log(`   Run: netstat -ano | findstr :${PORT}`);
      console.log(`   Then: taskkill /PID <PID> /F`);
    } else {
      console.log(`   Run: lsof -ti:${PORT} | xargs kill -9`);
    }
    process.exit(1);
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 GraphQL server running on port ${PORT}`);
  console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
});

if (process.env.NODE_ENV === 'production' && process.env.SSL_PRIVATE_KEY) {
  const readCert = (envVar, filePath) => {
    if (process.env[envVar]) {
      const decodedValue = Buffer.from(process.env[envVar], 'base64').toString(
        'utf8'
      );
      return decodedValue.replace(/\\n/g, '\n');
    }
    return fs.readFileSync(path.join(__dirname, filePath), 'utf8');
  };

  const httpsOptions = {
    key: readCert('SSL_PRIVATE_KEY', '../keyfile.key'),
    cert: readCert('SSL_CERT', '../certfile.cer'),
    ca: [readCert('SSL_CERT_INTERMEDIATE', '../intermediate.cer')]
  };

  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(443, () => {
    console.log('Server is running on https://localhost:443');
  });
}
