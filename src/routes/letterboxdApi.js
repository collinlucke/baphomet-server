import express from 'express';
import { getLetterboxdRating } from '../utils/getLetterboxdRating.js';

const router = express.Router();

router.get('/letterboxd-rating/:tmdbId', async (req, res) => {
  try {
    const rating = await getLetterboxdRating(req.params.tmdbId);
    res.json({ rating });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch Letterboxd rating' });
  }
});

export default router;
