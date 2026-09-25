export function getOptimizedImageUrl(imageVariants, preferredSize = 'w342') {
  if (!imageVariants) return null;

  // Try preferred size first, fallback to available sizes
  const fallbackOrder = ['w342', 'w500', 'w185', 'w780', 'original'];

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
