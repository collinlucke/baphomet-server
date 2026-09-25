# Cloudflare R2 Image Storage Setup for Render

## Required Environment Variables

Add these to your Render environment variables:

```bash
# Cloudflare R2 Configuration
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id  
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=baphomet-images

# Optional: Custom domain for R2 bucket (recommended for production)
R2_CUSTOM_DOMAIN=https://images.yourdomain.com
```

## Benefits of Native Implementation

✅ **No AWS dependencies** - Pure Node.js implementation  
✅ **Smaller bundle size** - Only fetch + crypto (built-in)  
✅ **Faster cold starts** - No heavy SDK loading  
✅ **Direct R2 integration** - Native S3-compatible API calls  
✅ **Custom domain ready** - Easy to switch to public URLs  

## Setup Steps

### 1. Create Cloudflare R2 Bucket
1. Go to Cloudflare Dashboard → R2 Object Storage
2. Create a new bucket named `baphomet-images`
3. **Bucket Access**: Can remain private - the service uses signed URLs for secure access
   - No DNS configuration required for private buckets
   - Images are served via time-limited signed URLs (default 1 hour)
   - For custom domains, see optional setup below

### 2. Create R2 API Token  
1. Go to Cloudflare Dashboard → R2 → Manage R2 API tokens
2. Create new token with:
   - **Permissions**: Admin Read & Write (or Edit permissions)
   - **Account resources**: Include your account
   - **Bucket resources**: Include your bucket  
3. Copy the Access Key ID and Secret Access Key

### 3. Optional: Set up Custom Domain (for public buckets)
1. Go to your R2 bucket → Settings → Custom Domains
2. Add your domain (e.g., `images.yourdomain.com`)
3. Add the CNAME record to your DNS
4. Configure bucket for public access
5. Set `R2_CUSTOM_DOMAIN=https://images.yourdomain.com`

### 4. Dependencies
Only minimal dependencies required:
- `sharp` - Image processing  
- `node-fetch` - HTTP requests (already installed)
- `crypto` - Built into Node.js (signatures)

## Usage Examples

### Process a single image
```graphql
mutation {
  processImage(
    tmdbUrl: "https://image.tmdb.org/t/p/original/poster.jpg"
    type: POSTER
  ) {
    success
    variants {
      w342
      w500
      original
    }
    message
  }
}
```

### Get image URL for specific size
```graphql
query {
  getImage(
    tmdbUrl: "https://image.tmdb.org/t/p/original/poster.jpg"
    type: POSTER
    size: "w342"
  )
}
```

### Batch process multiple images
```graphql
mutation {
  batchProcessImages(
    images: [
      {
        tmdbUrl: "https://image.tmdb.org/t/p/original/poster1.jpg"
        type: POSTER
        id: "movie_123_poster"
      },
      {
        tmdbUrl: "https://image.tmdb.org/t/p/original/backdrop1.jpg" 
        type: BACKDROP
        id: "movie_123_backdrop"
      }
    ]
  ) {
    success
    results
    message
  }
}
```

## Image Types and Sizes

### POSTER
- w92, w154, w185, w342, w500, w780, original
- Aspect ratio: 2:3 (posters)

### PROFILE  
- w45, w185, h632, original
- Aspect ratio: 2:3 (profile pictures)

### BACKDROP
- w300, w780, w1280, original  
- Aspect ratio: 16:9 (background images)

## Cost Optimization

- Images are only processed once and cached in R2
- All variants are generated on first request
- Subsequent requests serve directly from R2
- 1 year cache headers for optimal performance