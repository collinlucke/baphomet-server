const POSTER_RATIO = 2 / 3;
const BACKDROP_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.01;
const IMAGE_LIMIT = 50;

const languageRank = image => {
  if (image.iso_639_1 === 'en') return 0;
  if (!image.iso_639_1) return 1;
  return 2;
};

const aspectRatio = image => {
  if (Number.isFinite(image?.aspect_ratio) && image.aspect_ratio > 0) {
    return image.aspect_ratio;
  }
  if (image?.width > 0 && image?.height > 0) return image.width / image.height;
  return null;
};

const matchesRatio = (image, target) => {
  const ratio = aspectRatio(image);
  return ratio != null && Math.abs(ratio - target) <= RATIO_TOLERANCE;
};

export const selectTmdbImagePaths = (items, targetRatio, preferredPath = '') => {
  const matching = [...(items || [])].filter(
    image => image?.file_path && matchesRatio(image, targetRatio)
  );

  matching.sort((left, right) => {
    if (preferredPath) {
      if (left.file_path === preferredPath) return -1;
      if (right.file_path === preferredPath) return 1;
    }
    return languageRank(left) - languageRank(right);
  });

  const seen = new Set();
  const paths = [];
  for (const image of matching) {
    if (seen.has(image.file_path)) continue;
    seen.add(image.file_path);
    paths.push(image.file_path);
    if (paths.length === IMAGE_LIMIT) break;
  }
  return paths;
};

export const selectPosterPaths = (posters, preferredPath) =>
  selectTmdbImagePaths(posters, POSTER_RATIO, preferredPath);

export const selectBackdropPaths = (backdrops, preferredPath) =>
  selectTmdbImagePaths(backdrops, BACKDROP_RATIO, preferredPath);
