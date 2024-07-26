import express from 'express';
import db from '../db/connection.js';
import { ObjectId } from 'mongodb';

const router = express.Router();

router.get('/', async (req, res) => {
  let collection = db.collection('movies');
  let limit = req.params.limit;
  let results = await collection
    .find(query)
    .limit(limit ? limit : 0)
    .toArray();
  res.send(results).status(200);
});

// This section will help you get a single movie by id
router.get('/:id', async (req, res) => {
  let collection = db.collection('movies');
  let query = { _id: new ObjectId(req.params.id) };
  let result = await collection.findOne(query);

  if (!result) res.send('Not found').status(404);
  else res.send(result).status(200);
});

// This section will help you create a new movie.
router.post('/', async (req, res) => {
  try {
    let newMovie = {
      title: req.body.title,
      year: req.body.year,
      rated: req.body.rated,
      poster: req.body.poster
    };
    let collection = db.collection('movies');
    let result = await collection.insertOne(newMovie);
    res.send(result).status(204);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding movie');
  }
});

// This section will help you update a movie by id.
router.patch('/:id', async (req, res) => {
  try {
    const query = { _id: new ObjectId(req.params.id) };
    const updates = {
      $set: {
        title: req.body.title,
        year: req.body.year,
        rated: req.body.rated,
        poster: req.body.poster
      }
    };

    let collection = db.collection('movies');
    let result = await collection.updateOne(query, updates);
    res.send(result).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error updating movie');
  }
});

// This section will help you delete a movie
router.delete('/:id', async (req, res) => {
  try {
    const query = { _id: new ObjectId(req.params.id) };

    const collection = db.collection('movies');
    let result = await collection.deleteOne(query);

    res.send(result).status(200);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting movie');
  }
});

export default router;
