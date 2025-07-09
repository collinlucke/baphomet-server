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
import { authenticateToken } from './authenticateToken.js';
import apiRoutes from './apiRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const corsOptions = {
  credentials: true,
  origin: [
    'http://localhost:3000', // Local development
    'http://localhost:5173', // Vite dev server
    process.env.BAPHOMET_UI_URL || 'https://collinlucke.com' // Your Ionos frontend URL
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

// GraphQL endpoint (protected)
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

// API Routes for frontend integration (some protected, some public)
app.use('/api', apiRoutes);

// Health check endpoint (public)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', service: 'baphomet-server' });
});

// CORS preflight handling for all routes
app.options('*', cors(corsOptions));

// Handle SPA routing for frontend - don't redirect, return JSON with frontend URL
app.get('*', (req, res) => {
  // For API requests that don't exist, return 404
  if (req.path.startsWith('/api/') || req.path.startsWith('/graphql')) {
    return res.status(404).json({
      error: 'API endpoint not found',
      path: req.path,
      availableEndpoints: ['/health', '/api/health', '/graphql']
    });
  }

  // For frontend routes, return info about where the frontend is hosted
  const frontendUrl = process.env.BAPHOMET_UI_URL || 'https://collinlucke.com';
  res.json({
    message: 'Frontend is hosted separately',
    frontendUrl: frontendUrl,
    requestedPath: req.path,
    fullUrl: `${frontendUrl}${req.path}`
  });
});

// Serve HTTP on the port provided by Render or default to 5050
const PORT = parseInt(process.env.PORT || '5050');

const httpServer = http.createServer(app);

// Handle port already in use error
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

httpServer.listen(PORT, () => {
  console.log(`🚀 HTTP server listening on port ${PORT}`);
});

// HTTPS is handled by Render automatically - only use local HTTPS if SSL certs are provided
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
