import ImageService from '../../services/ImageService.js';

export async function processPersonImages(
  person,
  updateInDb = false,
  db = null
) {
  const results = {
    profileImages: null,
    errors: []
  };

  try {
    if (person.profilePath) {
      const tmdbProfileUrl = `https://image.tmdb.org/t/p/original${person.profilePath}`;
      try {
        results.profileImages = await ImageService.processImage(
          tmdbProfileUrl,
          'profile'
        );
        console.log(`✅ Processed profile images for: ${person.name}`);
      } catch (error) {
        console.error(
          `❌ Failed to process profile images for ${person.name}:`,
          error.message
        );
        results.errors.push(`Profile: ${error.message}`);
      }
    }

    if (updateInDb && db && person.tmdbId) {
      // Check if person already exists by tmdbId
      const existingPerson = await db
        .collection('people')
        .findOne({ tmdbId: person.tmdbId });

      const updateData = {
        tmdbId: person.tmdbId,
        name: person.name,
        profilePath: person.profilePath,
        knownFor: person.knownFor,
        profileImages: results.profileImages,
        lastUpdated: new Date(),
        processedAt: new Date()
      };

      if (existingPerson) {
        // Update existing person
        await db
          .collection('people')
          .updateOne({ _id: existingPerson._id }, { $set: updateData });
      } else {
        // Create new person with auto-incrementing _id
        await db.collection('people').insertOne(updateData);
      }
      console.log(`✅ Updated person ${person.name} with processed images`);
    }
  } catch (error) {
    console.error('❌ Error in processPersonImages:', error.message);
    results.errors.push(`General: ${error.message}`);
  }

  return results;
}
