# Baphomet Server - Streamlined GraphQL API

## Overview
The Baphomet Server has been streamlined to provide only the GraphQL operations actually used by the frontend. All REST endpoints have been removed, and the API now focuses solely on the core movie management and authentication functionality.

## GraphQL Endpoint
- **URL**: `/graphql`
- **Method**: POST
- **Content-Type**: `application/json`

## Authentication
For authenticated operations, include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Available Operations

### Queries

#### 1. Get All Movies
```graphql
query GetAllMovies($limit: Int, $searchTerm: String, $cursor: String, $loadAction: String) {
  getAllMovies(limit: $limit, searchTerm: $searchTerm, cursor: $cursor, loadAction: $loadAction) {
    newMovies {
      id
      title
      releaseDate
      rated
      poster
      fullplot
    }
    newTotalMovieCount
    newCursor
    loadAction
    endOfResults
  }
}
```
**Usage**: Retrieve a paginated list of movies with optional search functionality.

#### 2. Get Single Movie
```graphql
query GetMovie($id: ID!) {
  getMovie(id: $id) {
    id
    title
    releaseDate
    rated
    poster
    fullplot
  }
}
```
**Usage**: Retrieve details for a specific movie by ID.

#### 3. Check Authentication
```graphql
query CheckAuth($token: String) {
  checkAuth(token: $token) {
    isValid
    message
  }
}
```
**Usage**: Validate if a JWT token is still valid.

### Mutations

#### 1. Login
```graphql
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
  }
}
```
**Usage**: Authenticate a user and receive a JWT token.

#### 2. Add Movie (Authenticated)
```graphql
mutation AddMovie($title: String!, $releaseDate: String, $rated: String, $poster: String, $fullplot: String) {
  addMovie(title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, fullplot: $fullplot) {
    id
    title
    releaseDate
    rated
    poster
    fullplot
  }
}
```
**Usage**: Create a new movie entry. Requires authentication.

#### 3. Update Movie (Authenticated)
```graphql
mutation UpdateMovie($id: ID!, $title: String, $releaseDate: String, $rated: String, $poster: String, $fullplot: String) {
  updateMovie(id: $id, title: $title, releaseDate: $releaseDate, rated: $rated, poster: $poster, fullplot: $fullplot) {
    id
    title
    releaseDate
    rated
    poster
    fullplot
  }
}
```
**Usage**: Update an existing movie. Requires authentication.

#### 4. Delete Movie (Authenticated)
```graphql
mutation DeleteMovie($id: ID!) {
  deleteMovie(id: $id)
}
```
**Usage**: Delete a movie by ID. Requires authentication. Returns boolean success status.

## Additional Endpoints

### Health Check
- **URL**: `/health`
- **Method**: GET
- **Response**: 
```json
{
  "status": "OK",
  "service": "baphomet-server",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "graphql": "/graphql"
}
```

## Error Handling
- Authentication errors return appropriate GraphQL errors
- Invalid tokens result in "Authentication required" or "Invalid authentication token" errors
- Database connection issues are handled gracefully
- All errors follow GraphQL error format

## Frontend Integration
This API is optimized for the React frontend hosted on Ionos and supports:
- Movie browsing and searching
- User authentication
- Movie management (CRUD operations for authenticated users)
- Proper CORS handling for cross-origin requests

## Removed Features
The following features were removed as they were not used by the frontend:
- REST API endpoints
- User registration (signUp mutation)
- User profile management
- Arena data queries
- Application config queries
- Separate public/protected GraphQL endpoints

The API now provides only the essential functionality required by the frontend application.
