# Baphomet Server

A streamlined GraphQL backend server for movie management and user authentication.

## Overview
Baphomet Server provides a simple GraphQL API for managing a movie database with user authentication. The server is optimized for deployment on Render and works seamlessly with the [baphomet-ui](https://github.com/collinlucke/baphomet-ui) React frontend hosted on Ionos.

## Features
- 🎬 Movie CRUD operations (Create, Read, Update, Delete)
- 🔐 JWT-based authentication
- 🔍 Movie search and pagination
- 📊 GraphQL API with introspection
- 🚀 Optimized for Render deployment
- 🌐 CORS-enabled for cross-origin requests

## API Endpoints
- **GraphQL**: `/graphql` - Main API endpoint
- **Health Check**: `/health` - Server status monitoring

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Required environment variables (see below)

### Environment Variables
```bash
ATLAS_DB_USERNAME=your_mongodb_username
ATLAS_DB_PASSWORD=your_mongodb_password
ATLAS_CLUSTER=your_cluster_url
ACCESS_TOKEN_SECRET=your_jwt_secret
BAPHOMET_UI_URL=https://your-frontend-url.com
PORT=5050
```

### Installation & Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## GraphQL Operations
See [API_REFERENCE.md](./API_REFERENCE.md) for complete GraphQL schema and usage examples.

### Core Operations
- `getAllMovies` - Paginated movie listing with search
- `getMovie` - Single movie details
- `login` - User authentication
- `addMovie` - Create new movie (authenticated)
- `updateMovie` - Update existing movie (authenticated)
- `deleteMovie` - Remove movie (authenticated)
- `checkAuth` - Validate JWT token

## Production Deployment
This server is optimized for Render deployment with automatic builds and environment variable management.

## Demo
See the live application at https://collinlucke.com

**Demo Login Credentials:**
- Email: `notareal@email.address.com`
- Password: `baphy!demo2024`

## Related Projects
- [baphomet-ui](https://github.com/collinlucke/baphomet-ui) - React frontend
- [Docs](https://github.com/collinlucke/baphomet-server/wiki) - Additional documentation
