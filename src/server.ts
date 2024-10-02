import express from 'express';
import cors from 'cors';
import movies from '../server/routes/movies.js';
import gql from 'graphql-tag';
import { ApolloServer } from '@apollo/server';
import { buildSubgraphSchema } from '@apollo/subgraph';
import { expressMiddleware } from '@apollo/server/express4';
import resolvers from '../src/resolvers.js';
import { readFileSync } from 'fs';
import {
  ApolloServerPluginLandingPageLocalDefault,
  ApolloServerPluginLandingPageProductionDefault
} from '@apollo/server/plugin/landingPage/default';

const PORT = 5050;
const app = express();
const corsOptions = {
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

const typeDefs = gql(
  readFileSync('./src/schema.graphql', {
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

app.use('/movie', movies);
app.use('/graphql', cors(), express.json(), expressMiddleware(server));

app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
