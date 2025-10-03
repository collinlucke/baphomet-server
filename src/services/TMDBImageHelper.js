import ImageService from './ImageService.js';

export class TMDBImageHelper {
  static getFullImageUrl(path, size = 'original') {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}/${path}`;
  }

  static async processMovieImages(movie) {
    const results = {};

    try {
      if (movie.poster_path) {
        const posterUrl = this.getFullImageUrl(movie.poster_path);
        results.poster = await ImageService.processImage(posterUrl, 'poster');
      }

      if (movie.backdrop_path) {
        const backdropUrl = this.getFullImageUrl(movie.backdrop_path);
        results.backdrop = await ImageService.processImage(
          backdropUrl,
          'backdrop'
        );
      }

      return results;
    } catch (error) {
      console.error('Failed to process movie images:', error);
      return null;
    }
  }

  static async processPersonImage(person) {
    try {
      if (!person.profile_path) return null;

      const profileUrl = this.getFullImageUrl(person.profile_path);
      return await ImageService.processImage(profileUrl, 'profile');
    } catch (error) {
      console.error('Failed to process person image:', error);
      return null;
    }
  }

  static async getOptimizedImageUrl(tmdbPath, type, size = null) {
    if (!tmdbPath) return null;

    try {
      const fullUrl = this.getFullImageUrl(tmdbPath);
      return await ImageService.getImage(fullUrl, type, size);
    } catch (error) {
      console.error('Failed to get optimized image:', error);

      return this.getFullImageUrl(tmdbPath, size || 'w500');
    }
  }

  static async batchProcessMoviesImages(movies) {
    const imageJobs = [];

    movies.forEach(movie => {
      if (movie.poster_path) {
        imageJobs.push({
          tmdbUrl: this.getFullImageUrl(movie.poster_path),
          type: 'poster',
          id: `${movie.id}_poster`
        });
      }

      if (movie.backdrop_path) {
        imageJobs.push({
          tmdbUrl: this.getFullImageUrl(movie.backdrop_path),
          type: 'backdrop',
          id: `${movie.id}_backdrop`
        });
      }
    });

    if (imageJobs.length === 0) return {};

    try {
      return await ImageService.batchProcessImages(imageJobs);
    } catch (error) {
      console.error('Batch processing failed:', error);
      return {};
    }
  }

  static async enhanceMovieWithImages(movie, preferredSizes = {}) {
    const { posterSize = 'w342', backdropSize = 'w780' } = preferredSizes;

    const enhanced = { ...movie };

    try {
      if (movie.poster_path) {
        enhanced.optimizedPosterUrl = await this.getOptimizedImageUrl(
          movie.poster_path,
          'poster',
          posterSize
        );
      }

      if (movie.backdrop_path) {
        enhanced.optimizedBackdropUrl = await this.getOptimizedImageUrl(
          movie.backdrop_path,
          'backdrop',
          backdropSize
        );
      }

      return enhanced;
    } catch (error) {
      console.error('Failed to enhance movie with images:', error);
      return movie;
    }
  }

  static async getResponsiveImageUrls(tmdbPath, type) {
    if (!tmdbPath) return null;

    try {
      const fullUrl = this.getFullImageUrl(tmdbPath);
      const variants = await ImageService.processImage(fullUrl, type);

      switch (type) {
        case 'poster':
          return {
            small: variants.w185,
            medium: variants.w342,
            large: variants.w500,
            xlarge: variants.w780,
            original: variants.original
          };

        case 'backdrop':
          return {
            small: variants.w300,
            medium: variants.w780,
            large: variants.w1280,
            original: variants.original
          };

        case 'profile':
          return {
            small: variants.w45,
            medium: variants.w185,
            large: variants.h632,
            original: variants.original
          };

        default:
          return variants;
      }
    } catch (error) {
      console.error('Failed to get responsive URLs:', error);
      return null;
    }
  }
}

export default TMDBImageHelper;
