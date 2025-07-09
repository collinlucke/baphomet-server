import express from 'express';
import { authenticateToken } from './authenticateToken.js';
import db from './dBConnection.js';

const router = express.Router();

// Public routes (no authentication required)
router.get('/health', (req, res) => {
  res.json({ status: 'OK', service: 'baphomet-api' });
});

// Frontend configuration endpoint (public)
router.get('/config', (req, res) => {
  res.json({
    graphqlEndpoint: '/graphql',
    apiEndpoint: '/api',
    version: '0.2.2',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Authentication status check (public, but will show auth status)
router.get('/auth/status', (req, res) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.json({ authenticated: false, message: 'No token provided' });
  }

  // You can add token validation here if needed
  res.json({ authenticated: true, message: 'Token present' });
});

// Public movie routes (for /movielist and /view/:id)
router.get('/movies', async (req, res) => {
  try {
    // Get list of all movies (public)
    const movies = await db.collection('movies').find({}).toArray();
    res.json({ success: true, movies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/movies/:id', async (req, res) => {
  try {
    // Get single movie by ID (public for viewing)
    const movie = await db.collection('movies').findOne({ _id: req.params.id });
    if (!movie) {
      return res.status(404).json({ error: 'Movie not found' });
    }
    res.json({ success: true, movie });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Arena routes (public)
router.get('/arena/data', async (req, res) => {
  try {
    // Get arena data
    res.json({ message: 'Arena data endpoint', data: [] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected routes (authentication required for /edit/:id and /create)
router.use('/protected', authenticateToken);

router.post('/protected/movies', async (req, res) => {
  try {
    // Create new movie (for /create route)
    const newMovie = await db.collection('movies').insertOne(req.body);
    res.json({ success: true, movieId: newMovie.insertedId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/protected/movies/:id', async (req, res) => {
  try {
    // Update movie (for /edit/:id route)
    const result = await db
      .collection('movies')
      .updateOne({ _id: req.params.id }, { $set: req.body });
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/protected/movies/:id', async (req, res) => {
  try {
    // Delete movie (protected)
    const result = await db
      .collection('movies')
      .deleteOne({ _id: req.params.id });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/protected/user/profile', async (req, res) => {
  try {
    // Get user profile logic
    res.json({ message: 'User profile endpoint', user: req.user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/protected/user/update', async (req, res) => {
  try {
    // Update user logic
    res.json({ message: 'User update endpoint', data: req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
