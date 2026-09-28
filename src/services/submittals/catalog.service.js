import { ObjectId } from 'mongodb';
import { mdDb } from '../../dBConnection.js';

const items = () => mdDb.collection('md-item-catalog');
const saved = () => mdDb.collection('md-saved-submittals');

const toId = value => {
  if (!value) return null;
  const text = String(value);
  return ObjectId.isValid(text) ? new ObjectId(text) : null;
};

const itemName = doc => (doc.name || doc.commonName || '').trim();
const itemAlternateName = doc =>
  (doc.alternateName || doc.botanicalName || '').trim();

export const toMaterial = doc => {
  const size = (doc.size || '').trim();
  const name = itemName(doc);
  const categoryName = (doc.category || '').trim();
  return {
    id: String(doc._id),
    categoryId: categoryName,
    categoryName,
    materialName: size ? `${name} - ${size}` : name,
    altName: itemAlternateName(doc),
    description: (doc.description || '').trim(),
    purchaseUnit: size,
    purchaseUnitCost: 0,
    allocation: 1,
    allocationUnit: size,
    selected: false,
    imageUrl: doc.imageUrl || null,
    active: doc.active !== false,
    availableToBid: true,
    itemType: 'CatalogItem',
    kitId: null,
    kitUrl: null
  };
};

const nameFromItemName = (label, size) => {
  const name = String(label || '').trim();
  const unit = String(size || '').trim();
  if (!name) return '';
  if (!unit) return name;
  const suffix = ` - ${unit}`;
  if (name.toLowerCase().endsWith(suffix.toLowerCase())) {
    return name.slice(0, name.length - suffix.length).trim();
  }
  return name;
};

export const catalog = {
  async listCategories() {
    const names = await items().distinct('category', {
      active: { $ne: false },
      category: { $nin: [null, ''] }
    });
    return names
      .map(name => String(name).trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ id: name, categoryName: name }));
  },

  async listByCategory(categoryName) {
    const name = String(categoryName || '').trim();
    if (!name) return [];
    const docs = await items()
      .find({ category: name, active: { $ne: false } })
      .sort({ name: 1, commonName: 1, size: 1 })
      .toArray();
    return docs.map(doc => toMaterial(doc));
  },

  async search(query) {
    const text = String(query || '').trim();
    if (text.length < 2) return [];
    const regex = new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const docs = await items()
      .find({
        active: { $ne: false },
        $or: [
          { name: regex },
          { alternateName: regex },
          { commonName: regex },
          { botanicalName: regex },
          { size: regex }
        ]
      })
      .limit(25)
      .toArray();
    return docs.map(doc => ({
      id: String(doc._id),
      categoryId: doc.category || '',
      categoryName: doc.category || 'Uncategorized',
      itemName: doc.size ? `${itemName(doc)} - ${doc.size}` : itemName(doc),
      alternateName: itemAlternateName(doc),
      purchaseUnit: doc.size || ''
    }));
  },

  async createItem({
    name,
    commonName,
    alternateName,
    botanicalName,
    description,
    size,
    purchaseUnit,
    categoryId,
    category
  }) {
    const categoryName = String(category || categoryId || '').trim();
    if (!categoryName) throw new Error('A category is required');
    const now = new Date();
    const doc = {
      category: categoryName,
      name: String(name || commonName || '').trim(),
      alternateName: String(alternateName || botanicalName || '').trim(),
      description: String(description || '').trim(),
      size: String(size || purchaseUnit || '').trim(),
      imageUrl: null,
      active: true,
      createdAt: now,
      updatedAt: now
    };
    if (!doc.name) throw new Error('Name is required');
    const result = await items().insertOne(doc);
    return toMaterial({ ...doc, _id: result.insertedId });
  },

  async updateItem(id, payload) {
    const itemId = toId(id);
    if (!itemId) throw new Error('Item not found');
    const current = await items().findOne({ _id: itemId });
    if (!current) throw new Error('Item not found');

    const next = {};
    if (payload.name != null || payload.commonName != null) {
      next.name = String(payload.name ?? payload.commonName).trim();
    }
    if (payload.alternateName != null || payload.botanicalName != null) {
      next.alternateName = String(
        payload.alternateName ?? payload.botanicalName
      ).trim();
    }
    if (payload.description != null) {
      next.description = String(payload.description).trim();
    }
    if (payload.size != null || payload.purchaseUnit != null) {
      next.size = String(payload.size ?? payload.purchaseUnit).trim();
    }
    if (payload.itemName != null) {
      next.name = nameFromItemName(
        payload.itemName,
        payload.size ?? payload.purchaseUnit ?? current.size
      );
    }
    if (payload.category || payload.categoryId) {
      next.category = String(payload.category || payload.categoryId).trim();
    }
    if (payload.imageUrl !== undefined) next.imageUrl = payload.imageUrl;
    next.updatedAt = new Date();

    await items().updateOne({ _id: itemId }, { $set: next });
    const updated = await items().findOne({ _id: itemId });
    return toMaterial(updated);
  },

  async setGroupImage(itemId, imageUrl) {
    const id = toId(itemId);
    if (!id) throw new Error('Item not found');
    const item = await items().findOne({ _id: id });
    if (!item) throw new Error('Item not found');
    const alternate = itemAlternateName(item);
    const filter = alternate
      ? {
          active: { $ne: false },
          $or: [{ alternateName: alternate }, { botanicalName: alternate }]
        }
      : { _id: id };
    const matches = await items().find(filter).project({ _id: 1 }).toArray();
    await items().updateMany(filter, {
      $set: { imageUrl, updatedAt: new Date() }
    });
    return {
      imageUrl,
      alternateName: alternate,
      appliedMaterialIds: matches.map(doc => String(doc._id))
    };
  }
};

const toSaved = doc => ({
  id: String(doc._id),
  name: doc.name,
  coverTitle: doc.coverTitle || '',
  opportunity: null,
  coverImageUrl: doc.coverImageUrl || null,
  coverImageMimeType: doc.coverImageMimeType || null,
  coverImageLayout: doc.coverImageLayout || {
    x: 0,
    y: 0,
    width: 100,
    height: 100
  },
  categories: doc.categories || [],
  createdAt: doc.createdAt?.toISOString?.() || doc.createdAt,
  updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt
});

const toSavedListItem = doc => ({
  id: String(doc._id),
  name: doc.name,
  coverTitle: doc.coverTitle || '',
  opportunity: null,
  hasCover: Boolean(doc.coverImageUrl),
  categoryCount: doc.categories?.length ?? 0,
  materialCount: (doc.categories ?? []).reduce(
    (sum, category) => sum + (category.selectedMaterialIds?.length ?? 0),
    0
  ),
  updatedAt: doc.updatedAt?.toISOString?.() || doc.updatedAt,
  createdAt: doc.createdAt?.toISOString?.() || doc.createdAt
});

export const savedSubmittals = {
  async list() {
    const docs = await saved().find({}).sort({ updatedAt: -1 }).toArray();
    return docs.map(toSavedListItem);
  },

  async get(id) {
    const doc = await saved().findOne({ _id: toId(id) });
    return doc ? toSaved(doc) : null;
  },

  async create(payload) {
    const now = new Date();
    const doc = {
      name: payload.name || 'Untitled submittal',
      coverTitle: payload.coverTitle || '',
      coverImageUrl: payload.coverImageUrl || null,
      coverImageMimeType: payload.coverImageMimeType || null,
      coverImageLayout: payload.coverImageLayout,
      categories: payload.categories || [],
      createdAt: now,
      updatedAt: now
    };
    const result = await saved().insertOne(doc);
    return {
      id: String(result.insertedId),
      name: doc.name,
      updatedAt: now.toISOString()
    };
  },

  async update(id, payload) {
    const now = new Date();
    const result = await saved().findOneAndUpdate(
      { _id: toId(id) },
      {
        $set: {
          name: payload.name || 'Untitled submittal',
          coverTitle: payload.coverTitle || '',
          coverImageUrl: payload.coverImageUrl || null,
          coverImageMimeType: payload.coverImageMimeType || null,
          coverImageLayout: payload.coverImageLayout,
          categories: payload.categories || [],
          updatedAt: now
        }
      },
      { returnDocument: 'after' }
    );
    if (!result) throw new Error('Saved submittal not found');
    return {
      id: String(result._id),
      name: result.name,
      updatedAt: now.toISOString()
    };
  },

  async remove(id) {
    const result = await saved().deleteOne({ _id: toId(id) });
    return result.deletedCount === 1;
  }
};
