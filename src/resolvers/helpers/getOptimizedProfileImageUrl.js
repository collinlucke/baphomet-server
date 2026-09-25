export function getOptimizedProfileImageUrl(
  imageVariants,
  preferredSize = 'w185'
) {
  if (!imageVariants) return null;

  // Try preferred size first, fallback to available sizes for profiles
  const fallbackOrder = ['w185', 'h632', 'w45', 'original'];

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
