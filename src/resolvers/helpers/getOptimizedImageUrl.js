export function getOptimizedImageUrl(imageVariants, preferredSize = 'w500') {
  if (!imageVariants) return null;

  const fallbackOrder = ['w500', 'w780', 'w1920', 'w185', 'h632'];

  if (imageVariants[preferredSize]) {
    return imageVariants[preferredSize];
  }

  for (const size of fallbackOrder) {
    if (imageVariants[size]) {
      return imageVariants[size];
    }
  }

  return null;
}
