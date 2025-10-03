import ImageService from '../services/ImageService.js';

export const imageResolvers = {
  Query: {
    async getImage(parent, { tmdbUrl, type, size }) {
      try {
        return await ImageService.getImage(tmdbUrl, type, size);
      } catch (error) {
        throw new Error(`Failed to get image: ${error.message}`);
      }
    },

    async getImageVariants(parent, { tmdbUrl, type }) {
      try {
        return await ImageService.processImage(tmdbUrl, type);
      } catch (error) {
        throw new Error(`Failed to get image variants: ${error.message}`);
      }
    }
  },

  Mutation: {
    async processImage(parent, { tmdbUrl, type }) {
      try {
        const variants = await ImageService.processImage(tmdbUrl, type);
        return {
          success: true,
          variants,
          message: 'Image processed successfully'
        };
      } catch (error) {
        return {
          success: false,
          variants: null,
          message: error.message
        };
      }
    },

    async batchProcessImages(parent, { images }) {
      try {
        const results = await ImageService.batchProcessImages(images);
        return {
          success: true,
          results,
          message: `Processed ${Object.keys(results).length} images`
        };
      } catch (error) {
        return {
          success: false,
          results: null,
          message: error.message
        };
      }
    }
  }
};
