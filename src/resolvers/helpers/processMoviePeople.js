import { processPersonImages } from './processPersonImage';

export async function processMoviePeople(people, type, db) {
  const processedPeople = [];

  for (const person of people) {
    if (person.profilePath && person.id) {
      try {
        // Check if person already exists and has processed images
        const existingPerson = await db.collection('people').findOne({
          tmdbId: parseInt(person.id)
        });
        let shouldProcess = true;

        if (
          existingPerson?.profileImages &&
          existingPerson?.profilePath === person.profilePath
        ) {
          // Person exists with same profile path and processed images
          shouldProcess = false;
          console.log(`⏭️ Skipping ${person.name} - already processed`);
        }

        if (shouldProcess) {
          const personData = {
            tmdbId: parseInt(person.id),
            name: person.name,
            profilePath: person.profilePath,
            knownFor: type === 'cast' ? 'Acting' : 'Directing'
          };

          const result = await processPersonImages(personData, true, db);

          if (result.errors.length === 0) {
            processedPeople.push({
              personId: person.id,
              name: person.name,
              success: true
            });
          } else {
            processedPeople.push({
              personId: person.id,
              name: person.name,
              success: false,
              errors: result.errors
            });
          }
        } else {
          processedPeople.push({
            personId: person.id,
            name: person.name,
            success: true,
            skipped: true
          });
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `❌ Failed to process person ${person.name}:`,
          error.message
        );
        processedPeople.push({
          personId: person.id,
          name: person.name,
          success: false,
          errors: [error.message]
        });
      }
    }
  }

  return processedPeople;
}
