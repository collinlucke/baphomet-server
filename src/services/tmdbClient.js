const MIN_INTERVAL_MS = 50;
const MAX_RATE_LIMIT_RETRIES = 5;

let nextSlot = 0;
let chain = Promise.resolve();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const waitForSlot = async () => {
  const now = Date.now();
  const start = Math.max(now, nextSlot);
  nextSlot = start + MIN_INTERVAL_MS;
  const delay = start - now;
  if (delay > 0) await sleep(delay);
};

const retryDelayMs = (response, attempt) => {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 1000 * 2 ** (attempt - 1);
};

export const tmdbFetch = url => {
  const task = async () => {
    let attempt = 0;
    while (true) {
      await waitForSlot();
      const response = await fetch(url);
      if (response.status !== 429) return response;
      attempt += 1;
      if (attempt > MAX_RATE_LIMIT_RETRIES) {
        throw new Error(`TMDB rate limit persisted for ${url}`);
      }
      await sleep(retryDelayMs(response, attempt));
    }
  };

  const run = chain.then(task, task);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
};

export const tmdbMovieUrl = tmdbId =>
  `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,release_dates,images,videos,keywords,external_ids&api_key=${process.env.TMDB_API_KEY}`;

export const tmdbPersonUrl = personId =>
  `https://api.themoviedb.org/3/person/${personId}?append_to_response=external_ids&api_key=${process.env.TMDB_API_KEY}`;
