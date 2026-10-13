const KEPT_CREW_JOBS = new Set([
  'Director',
  'Director of Photography',
  'Writer',
  'Dialogue',
  'Head of Story',
  'Screenplay',
  'Producer',
  'Executive Producer',
  'Production Designer',
  'Art Director',
  'Original Music Composer',
  'Main Title Theme Composer',
  'Songs',
  'Theme Song Performance',
  'Lyricist',
  'Playback Singer'
]);

const CAST_LIKE_CREW_JOBS = new Set([
  'Additional Voices',
  'Additional Voice',
  'Voice',
  'ADR Voice',
  'Loop Group'
]);

export const isKeptCrewJob = job => KEPT_CREW_JOBS.has(job);
export const isCastLikeCrewJob = job => CAST_LIKE_CREW_JOBS.has(job);

export function shapeCredits(cast = [], crew = []) {
  const nextCast = cast.map(row => ({
    personId: row.personId,
    character: row.character || '',
    order: row.order ?? 0
  }));
  const seen = new Set(nextCast.map(row => row.personId).filter(Boolean));
  let order = nextCast.reduce(
    (max, row) => Math.max(max, Number(row.order) || 0),
    -1
  );
  const nextCrew = [];

  for (const row of crew) {
    const personId = row.personId;
    const job = row.job || '';
    if (!personId) continue;

    if (isCastLikeCrewJob(job)) {
      if (!seen.has(personId)) {
        order += 1;
        nextCast.push({ personId, character: job, order });
        seen.add(personId);
      }
      continue;
    }

    if (isKeptCrewJob(job)) {
      nextCrew.push({
        personId,
        job,
        department: row.department || ''
      });
    }
  }

  return { cast: nextCast, crew: nextCrew };
}
