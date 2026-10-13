import { isCastLikeCrewJob, isKeptCrewJob, shapeCredits } from './creditFilter.js';

const names = items =>
  (items || []).map(item => item.english_name || item.name).filter(Boolean);

export const mapTmdbMovie = (payload, genres = []) => {
  const credits = payload.credits || {};
  const images = payload.images || {};
  const releaseResults = payload.release_dates?.results || [];
  const keywords = payload.keywords?.keywords || payload.keywords?.results || [];
  const logos = images.logos || [];
  const englishLogo = logos.find(logo => logo.iso_639_1 === 'en') || logos[0];

  const certifications = releaseResults.flatMap(country =>
    (country.release_dates || [])
      .filter(release => release.certification)
      .map(release => ({
        country: country.iso_3166_1,
        rating: release.certification,
        releaseDate: (release.release_date || '').slice(0, 10)
      }))
  );

  const usTheatrical = (
    releaseResults.find(country => country.iso_3166_1 === 'US')?.release_dates ||
    []
  )
    .filter(release => release.type === 3 && release.certification)
    .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))[0];

  return {
    tmdbId: payload.id,
    imdbId: payload.external_ids?.imdb_id || '',
    title: payload.title || 'Unknown Title',
    originalTitle: payload.original_title || '',
    originalLanguage: payload.original_language || '',
    overview: payload.overview || '',
    tagline: payload.tagline || '',
    homepage: payload.homepage || '',
    status: payload.status || '',
    releaseDate: payload.release_date || '',
    runtime: payload.runtime ?? null,
    budget: payload.budget ?? null,
    revenue: payload.revenue ?? null,
    popularity: payload.popularity ?? null,
    voteAverage: payload.vote_average ?? null,
    voteCount: payload.vote_count ?? null,
    adult: Boolean(payload.adult),
    mpaRating: usTheatrical?.certification || '',
    spokenLanguages: names(payload.spoken_languages),
    productionCompanies: names(payload.production_companies),
    productionCountries: (payload.production_countries || [])
      .map(country => country.name || country.iso_3166_1)
      .filter(Boolean),
    originCountries: payload.origin_country || [],
    keywords: keywords.map(keyword => keyword.name).filter(Boolean),
    posterPath: payload.poster_path || '',
    backdropPath: payload.backdrop_path || '',
    logoPath: englishLogo?.file_path || '',
    posterPaths: (images.posters || []).map(poster => poster.file_path).filter(Boolean),
    backdropPaths: (images.backdrops || [])
      .map(backdrop => backdrop.file_path)
      .filter(Boolean),
    genres,
    certifications,
    videos: (payload.videos?.results || [])
      .filter(video => video.site === 'YouTube' && video.key)
      .map(video => ({
        name: video.name || '',
        site: video.site,
        key: video.key,
        type: video.type || '',
        official: Boolean(video.official)
      })),
    ...shapeCredits(
      (credits.cast || [])
        .filter(member => member.id)
        .map(member => ({
          personId: member.id,
          character: member.character || '',
          order: member.order ?? 0
        })),
      (credits.crew || [])
        .filter(member => member.id)
        .map(member => ({
          personId: member.id,
          job: member.job || '',
          department: member.department || ''
        }))
    )
  };
};

export const creditPersonStubs = payload => {
  const byId = new Map();
  const add = (member, fallbackDepartment) => {
    if (!member?.id || byId.has(member.id)) return;
    byId.set(member.id, {
      tmdbId: member.id,
      name: member.name || '',
      profilePath: member.profile_path || '',
      knownForDepartment: member.known_for_department || fallbackDepartment
    });
  };

  for (const member of payload.credits?.cast || []) add(member, 'Acting');
  for (const member of payload.credits?.crew || []) {
    if (isKeptCrewJob(member.job) || isCastLikeCrewJob(member.job)) {
      add(member, member.department || '');
    }
  }
  return [...byId.values()];
};
