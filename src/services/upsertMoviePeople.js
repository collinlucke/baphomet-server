import { tmdbFetch, tmdbPersonUrl } from './tmdbClient.js';

const personFields = (person, stub) => ({
  tmdbId: person.id,
  imdbId: person.external_ids?.imdb_id || '',
  name: person.name || stub.name || '',
  biography: person.biography || '',
  birthday: person.birthday || '',
  deathday: person.deathday || '',
  placeOfBirth: person.place_of_birth || '',
  homepage: person.homepage || '',
  profilePath: person.profile_path || stub.profilePath || '',
  gender: person.gender ?? null,
  knownForDepartment: person.known_for_department || stub.knownForDepartment || '',
  popularity: person.popularity ?? null,
  alsoKnownAs: person.also_known_as || [],
  lastUpdated: new Date()
});

export const attachPeople = async (db, credits = []) => {
  const ids = [...new Set(credits.map(credit => credit.personId).filter(Boolean))];
  if (!ids.length) return credits;

  const people = await db
    .collection('people')
    .find({ tmdbId: { $in: ids } })
    .toArray();
  const byId = new Map(people.map(person => [person.tmdbId, person]));

  return credits.map(credit => {
    const person = byId.get(credit.personId);
    return {
      ...credit,
      name: person?.name || '',
      profilePath: person?.profilePath || ''
    };
  });
};

export const upsertMoviePeople = async (db, stubs) => {
  if (!stubs.length) return;

  const existing = await db
    .collection('people')
    .find({ tmdbId: { $in: stubs.map(stub => stub.tmdbId) } })
    .project({ tmdbId: 1 })
    .toArray();
  const have = new Set(existing.map(person => person.tmdbId));

  for (const stub of stubs) {
    if (have.has(stub.tmdbId)) continue;

    const response = await tmdbFetch(tmdbPersonUrl(stub.tmdbId));
    if (!response.ok) {
      console.error(
        `Failed to fetch TMDB person ${stub.tmdbId}: ${response.status}`
      );
      continue;
    }

    const person = await response.json();
    await db.collection('people').updateOne(
      { tmdbId: person.id },
      { $set: personFields(person, stub) },
      { upsert: true }
    );
    have.add(person.id);
  }
};
