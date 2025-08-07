# GraphQL Migration Guide

The Baphomet Server has been fully migrated from REST endpoints to GraphQL. All business logic is now handled exclusively through GraphQL operations.

## Endpoints

### Public Endpoint (No Authentication Required)
- **URL**: `/graphql/public`
- **Use for**: Public queries that don't require authentication

### Protected Endpoint (Authentication Required)
- **URL**: `/graphql`
- **Use for**: Operations that require user authentication
- **Header**: `Authorization: Bearer <your-jwt-token>`

## Public Operations (Available at `/graphql/public`)

### Queries
```graphql
# Get system health status
query GetHealth {
  getHealth {
    status
    service
    timestamp
  }
}

# Get app configuration
query GetConfig {
  getConfig {
    graphqlEndpoint
    version
    environment
  }
}

# Get all movies (public viewing)
query GetAllMovies($limit: Int, $searchTerm: String, $cursor: String) {
  getAllMovies(limit: $limit, searchTerm: $searchTerm, cursor: $cursor) {
    searchResults {
      id
      title
      releaseDate
      rated
      poster
      overview
    }
    newTotalMovieCount
    newCursor
    endOfResults
  }
}

# Get single movie (public viewing)
query GetMovie($id: ID!) {
  getMovie(id: $id) {
    id
    title
    releaseDate
    rated
    poster
    overview
  }
}

# Get arena data
query GetArenaData {
  getArenaData {
    message
    data
  }
}

# Check authentication status
query GetAuthStatus {
  getAuthStatus {
    authenticated
    message
  }
}

# Validate token
query CheckAuth($token: String) {
  checkAuth(token: $token) {
    isValid
    message
  }
}
```

### Mutations (Public)
```graphql
# User registration
mutation SignUp($email: String!, $password: String!) {
  signUp(email: $email, password: $password) {
    token
  }
}

# User login
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
  }
}
```

## Protected Operations (Available at `/graphql` with Authentication)

### Queries
```graphql
# Get current user profile
query GetUserProfile {
  getUserProfile {
    id
    email
    createdAt
    updatedAt
  }
}

# All public queries are also available here
```

### Mutations
```graphql
# Add new movie
mutation AddMovie($title: String!, $releaseDate: String, $rated: String, $poster: String, $overview: String) {
  addMovie(title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, overview: $overview) {
    id
    title
    releaseDate
    rated
    poster
    overview
  }
}

# Update existing movie
mutation UpdateMovie($id: ID!, $title: String, $releaseDate: String, $rated: String, $poster: String, $overview: String) {
  updateMovie(id: $id, title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, overview: $overview) {
    id
    title
    releaseDate
    rated
    poster
    overview
  }
}

# Delete movie
mutation DeleteMovie($id: ID!) {
  deleteMovie(id: $id)
}

# Update user profile
mutation UpdateUserProfile($email: String, $currentPassword: String, $newPassword: String) {
  updateUserProfile(email: $email, currentPassword: $currentPassword, newPassword: $newPassword) {
    id
    email
    createdAt
    updatedAt
  }
}
```

## Frontend Route Mapping

### `/movielist` - Movie List Page
**Query**: Use `getAllMovies` via `/graphql/public`
```javascript
const GET_ALL_MOVIES = gql`
  query GetAllMovies($limit: Int, $searchTerm: String, $cursor: String) {
    getAllMovies(limit: $limit, searchTerm: $searchTerm, cursor: $cursor) {
      searchResults {
        id
        title
        poster
        rated
      }
      newCursor
      endOfResults
    }
  }
`;
```

### `/view/:id` - Movie Detail Page
**Query**: Use `getMovie` via `/graphql/public`
```javascript
const GET_MOVIE = gql`
  query GetMovie($id: ID!) {
    getMovie(id: $id) {
      id
      title
      releaseDate
      rated
      poster
      overview
    }
  }
`;
```

### `/edit/:id` - Edit Movie Page
**Requires Authentication**: Use `/graphql` endpoint
```javascript
const UPDATE_MOVIE = gql`
  mutation UpdateMovie($id: ID!, $title: String, $releaseDate: String, $rated: String, $poster: String, $overview: String) {
    updateMovie(id: $id, title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, overview: $overview) {
      id
      title
      releaseDate
      rated
      poster
      overview
    }
  }
`;
```

### `/create` - Create Movie Page
**Requires Authentication**: Use `/graphql` endpoint
```javascript
const ADD_MOVIE = gql`
  mutation AddMovie($title: String!, $releaseDate: String, $rated: String, $poster: String, $overview: String) {
    addMovie(title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, overview: $overview) {
      id
      title
    }
  }
`;
```

### `/profile` - User Profile Page
**Requires Authentication**: Use `/graphql` endpoint
```javascript
const GET_USER_PROFILE = gql`
  query GetUserProfile {
    getUserProfile {
      id
      email
      createdAt
      updatedAt
    }
  }
`;

const UPDATE_USER_PROFILE = gql`
  mutation UpdateUserProfile($email: String, $currentPassword: String, $newPassword: String) {
    updateUserProfile(email: $email, currentPassword: $currentPassword, newPassword: $newPassword) {
      id
      email
      updatedAt
    }
  }
`;
```

### `/arena` - Arena Page
**Query**: Use `getArenaData` via `/graphql/public`
```javascript
const GET_ARENA_DATA = gql`
  query GetArenaData {
    getArenaData {
      message
      data
    }
  }
`;
```

## Authentication Implementation

### Setting Up Apollo Client
```javascript
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const publicLink = createHttpLink({
  uri: 'https://your-backend-url/graphql/public',
});

const protectedLink = createHttpLink({
  uri: 'https://your-backend-url/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('authToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : "",
    }
  };
});

// Create separate clients for public and protected operations
export const publicClient = new ApolloClient({
  link: publicLink,
  cache: new InMemoryCache(),
});

export const protectedClient = new ApolloClient({
  link: from([authLink, protectedLink]),
  cache: new InMemoryCache(),
});
```

## Migration Notes

1. **All REST endpoints have been removed** - No more `/api/` routes
2. **Two GraphQL endpoints** - Public and protected for better security
3. **Consistent error handling** - All operations return proper GraphQL errors
4. **Token-based authentication** - Use JWT tokens for protected operations
5. **Backwards compatibility** - Legacy API requests return migration guidance

## CORS Configuration

The server is configured to accept requests from:
- `http://localhost:3000` (React dev server)
- `http://localhost:5173` (Vite dev server)
- Your production frontend URL (configured via `BAPHOMET_UI_URL` environment variable)

## Error Handling

GraphQL errors will be returned in the standard GraphQL error format:
```json
{
  "errors": [
    {
      "message": "Authentication required",
      "extensions": {
        "code": "UNAUTHENTICATED"
      }
    }
  ]
}
```

Handle these in your frontend Apollo Client error handling logic.
