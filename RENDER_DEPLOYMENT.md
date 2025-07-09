# Render Deployment Checklist for Baphomet Server

## Environment Variables to Set in Render Dashboard

When deploying to Render, you need to set these environment variables in your service settings:

### Required Environment Variables:
All are pulled from GitHub secrets save for the NODE_ENV
- `NODE_ENV=production`
- `ATLAS_DB_USERNAME` - Your MongoDB Atlas username
- `ATLAS_DB_PASSWORD` - Your MongoDB Atlas password  
- `ATLAS_CLUSTER` - Your MongoDB Atlas cluster URL
- `ATLAS_PROD_DB` - Your production database name
- `ACCESS_TOKEN_SECRET` - Secret key for JWT tokens
- `BAPHOMET_UI_URL` - Your Ionos frontend domain (e.g., https://collinlucke.com)

### Optional Environment Variables:
- None (removed Docker-related static file serving)

## Deployment Steps:

1. **Push your code to GitHub/GitLab**
   
2. **Create a new Web Service in Render:**
   - Connect your repository
   - Set Build Command: `npm install && npm run build`
   - Set Start Command: `npm start`
   - Set Environment: `Node`

3. **Configure Environment Variables:**
   - Go to your service settings in Render
   - Add all the environment variables listed above

4. **MongoDB Atlas Configuration:**
   - Ensure your MongoDB Atlas cluster allows connections from `0.0.0.0/0` (all IPs) or add Render's IP ranges
   - Your connection string should work with the environment variables

5. **Deploy:**
   - Render will automatically deploy when you push to your connected branch

## Key Changes Made for Render Compatibility:

✅ **Port Configuration**: Changed from hardcoded port 5050 to use `process.env.PORT`
✅ **Build Scripts**: Added proper build script and separated compile from start
✅ **HTTPS Handling**: Disabled local HTTPS since Render handles SSL automatically
✅ **CORS Configuration**: Configured for separate frontend deployment on Ionos
✅ **Removed Docker**: Removed Docker-related static file serving (frontend is on Ionos)
✅ **Health Check**: Added `/health` endpoint for monitoring
✅ **Render Config**: Added `render.yaml` for configuration

## Frontend Integration:

Since your frontend is deployed on Ionos:
1. Set `FRONTEND_URL` environment variable to your Ionos domain
2. Configure your frontend to make API calls to your Render GraphQL endpoint
3. The CORS settings will allow your Ionos frontend to communicate with the Render backend

## Testing Locally:

Before deploying, test locally with production-like settings:

```bash
NODE_ENV=production npm run build
NODE_ENV=production npm start
```

## Troubleshooting:

- **Build Fails**: Check that all dependencies are in `dependencies` not `devDependencies`
- **Server Won't Start**: Verify the PORT environment variable is being used correctly
- **Database Connection Issues**: Check MongoDB Atlas IP whitelist and connection string
- **Environment Variables**: Verify all required env vars are set in Render dashboard

## GraphQL Endpoint:

Once deployed, your GraphQL endpoint will be available at:
`https://your-render-app.onrender.com/graphql`
