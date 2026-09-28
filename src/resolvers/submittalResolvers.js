import { catalog, savedSubmittals } from '../services/submittals/catalog.service.js';

const toCatalogItem = material => {
  const size = material.purchaseUnit || material.size || '';
  const rawName = material.materialName || material.itemName || material.name || material.commonName || '';
  const suffix = size ? ` - ${size}` : '';
  const name =
    suffix && rawName.toLowerCase().endsWith(suffix.toLowerCase())
      ? rawName.slice(0, rawName.length - suffix.length).trim()
      : rawName;
  return {
    id: material.id,
    category: material.categoryName || material.category || material.categoryId || '',
    name,
    alternateName: material.altName || material.alternateName || '',
    description: material.description || '',
    size,
    imageUrl: material.imageUrl ?? null,
    active: material.active !== false
  };
};

export const submittalResolvers = {
  Query: {
    catalogCategories: async () => {
      const categories = await catalog.listCategories();
      return categories.map(category => category.categoryName);
    },
    catalogItems: async (_parent, { category, search }) => {
      if (search) {
        const results = await catalog.search(search);
        return results.map(toCatalogItem);
      }
      const materials = await catalog.listByCategory(category);
      return materials.map(toCatalogItem);
    },
    savedSubmittals: async () => savedSubmittals.list(),
    savedSubmittal: async (_parent, { id }) => savedSubmittals.get(id)
  },
  Mutation: {
    createCatalogItem: async (_parent, args) => {
      return toCatalogItem(await catalog.createItem(args));
    },
    updateCatalogItem: async (_parent, { id, ...rest }) => {
      return toCatalogItem(await catalog.updateItem(id, rest));
    },
    deleteCatalogItem: async () => {
      throw new Error('Delete is not available yet');
    },
    createSavedSubmittal: async (_parent, { input }) => {
      const created = await savedSubmittals.create(input);
      return savedSubmittals.get(created.id);
    },
    updateSavedSubmittal: async (_parent, { id, input }) => {
      await savedSubmittals.update(id, input);
      return savedSubmittals.get(id);
    },
    deleteSavedSubmittal: async (_parent, { id }) => savedSubmittals.remove(id)
  }
};
