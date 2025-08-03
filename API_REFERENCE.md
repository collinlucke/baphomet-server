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
    overview
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
```
**Usage**: Create a new movie entry. Requires authentication.

#### 3. Update Movie (Authenticated)
```graphql
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

## Troubleshooting

### SPA Routing Issues (404 on Direct URL Access)

If you get 404 errors when accessing frontend routes directly (e.g., `https://yourdomain.com/login`), this means your hosting provider isn't configured to handle Single Page Application (SPA) routing.

**For Apache hosting (like Ionos) - Try these solutions in order:**

**Solution 1: Simple .htaccess file**
Create a `.htaccess` file in your React app's `/public` folder (this gets deployed with your build):

```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

**Important:** Place the `.htaccess` file in your React project's `/public` directory, not in the root of your source code. When you build your React app, this file will be copied to the build output and deployed to your hosting provider.

**Solution 2: If .htaccess doesn't work, use PHP fallback**
If Ionos doesn't support .htaccess rewrite rules, you can create an `index.php` file in your React project's `/public` folder and rename your `index.html` to `index.html.bak`:

```php
<?php
$request_uri = $_SERVER['REQUEST_URI'];
$path = parse_url($request_uri, PHP_URL_PATH);

// Static file extensions
$static_extensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot', '.json'];

foreach ($static_extensions as $ext) {
    if (substr($path, -strlen($ext)) === $ext) {
        return false;
    }
}

if (file_exists(__DIR__ . $path) && !is_dir(__DIR__ . $path)) {
    return false;
}

header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/index.html.bak');
?>
```

**Solution 3: Contact Ionos Support**
If neither solution works, contact Ionos support to:
- Enable mod_rewrite for your domain
- Confirm .htaccess files are allowed
- Ask about SPA routing configuration options

**For other hosting providers:**

**Nginx:**
```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

**Netlify/Vercel:**
Create a `_redirects` file:
```
/*    /index.html   200
```

This ensures that all frontend routes serve the main `index.html` file, allowing React Router to handle the routing client-side.

## Related Projects
