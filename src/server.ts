import express from 'express';
import cors from 'cors';
import gql from 'graphql-tag';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4';
import resolvers from '../src/resolvers.js';
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
import { authenticateToken } from '../src/authenticateToken.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const corsOptions = {
  credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

const typeDefs = gql(
  fs.readFileSync(path.join(__dirname, '../src/schema.graphql'), {
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

app.use(
  '/graphql',
  cors(),
  express.json(),
  authenticateToken,
  expressMiddleware(server, {
    context: async ({ req }) => {
      const token = req.headers.authorization || '';
      return { token };
    }
  })
);

// Serve static files from the frontend build directory
app.use(express.static(path.join(__dirname, '../../usr/src/app/dist')));

// Serve the index.html file for any unmatched routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../usr/src/app/dist', 'index.html'));
});

// Serve HTTP on port 5050
const httpServer = http.createServer(app);
httpServer.listen(5050, () => {
  console.log(`🚀 HTTP server listening on port 5050`);
});

// Serve HTTPS on port 443
const readCert = (envVar, filePath) => {
  if (process.env[envVar]) {
    return process.env[envVar].replace(/\\n/g, '\n');
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
