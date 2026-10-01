import { Router } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import path from 'path';
import imageService from '../services/ImageService.js';
import { catalog, savedSubmittals } from '../services/submittals/catalog.service.js';
import { generateSubmittalPdf } from '../services/submittals/generatePdf.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

const UNIT_TYPES = [
  '1 gal',
  '3 gal',
  '5 gal',
  '7 gal',
  '15 gal',
  '#1',
  '#3',
  '#5',
  'flat',
  'each',
  'B&B'
].map((name, index) => ({ id: index + 1, name }));

const sendError = (res, error) => {
  const status = error.status || 500;
  return res.status(status).json({ error: error.message || 'Request failed' });
};

async function uploadImage(file, keyPrefix) {
  const ext = path.extname(file.originalname || '') || '.jpg';
  const key = `${keyPrefix}/${crypto.randomUUID()}${ext}`;
  await imageService.uploadToR2(key, file.buffer, file.mimetype || 'image/jpeg');
  const url = await imageService.getImageUrl(key);
  return { url, mimeType: file.mimetype || 'image/jpeg' };
}

export const submittalsRouter = Router();

submittalsRouter.get('/categories', async (_req, res) => {
  try {
    res.json(await catalog.listCategories());
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.get('/materials/by-category', async (req, res) => {
  try {
    res.json(await catalog.listByCategory(req.query.name || req.query.category || ''));
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.get('/materials/search', async (req, res) => {
  try {
    res.json(await catalog.search(req.query.q || req.query.search || ''));
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.post('/material-items', async (req, res) => {
  try {
    const material = await catalog.createItem({
      name: req.body?.commonName,
      alternateName: req.body?.alternateName,
      description: req.body?.description,
      size: req.body?.purchaseUnit,
      category: req.body?.categoryId
    });
    res.status(201).json({ material });
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.post('/material-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const materialId = req.body?.materialId;
    if (!materialId) return res.status(400).json({ error: 'Invalid or missing materialId' });
    const uploaded = await uploadImage(req.file, `catalog-images/${materialId}`);
    const applied = await catalog.setGroupImage(materialId, uploaded.url);
    res.json({ success: true, imageUrl: uploaded.url, ...applied });
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.post('/cover-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });
    const uploaded = await uploadImage(req.file, 'submittal-covers');
    res.json(uploaded);
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.get('/saved', async (req, res) => {
  try {
    res.json(await savedSubmittals.list());
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.get('/saved/:id', async (req, res) => {
  try {
    const doc = await savedSubmittals.get(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Saved submittal not found' });
    res.json(doc);
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.post('/saved', async (req, res) => {
  try {
    res.status(201).json(await savedSubmittals.create(req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.put('/saved/:id', async (req, res) => {
  try {
    res.json(await savedSubmittals.update(req.params.id, req.body || {}));
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.delete('/saved/:id', async (req, res) => {
  try {
    const removed = await savedSubmittals.remove(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Saved submittal not found' });
    res.status(204).end();
  } catch (error) {
    sendError(res, error);
  }
});

submittalsRouter.post('/generate-pdf', async (req, res) => {
  try {
    const {
      title,
      coverImageBase64,
      coverImageMimeType,
      coverImageUrl,
      coverImageX,
      coverImageY,
      coverImageWidth,
      coverImageHeight,
      categories,
      materialPages,
      plantScheduleBase64,
      plantScheduleMimeType,
      plantScheduleUrl
    } = req.body || {};

    if (!Array.isArray(categories)) {
      return res.status(400).json({ error: 'categories must be an array' });
    }

    const pdfBuffer = await generateSubmittalPdf({
      title: title || '',
      coverImageBase64: coverImageBase64 || null,
      coverImageMimeType: coverImageMimeType || null,
      coverImageUrl: coverImageUrl || null,
      coverImageX: typeof coverImageX === 'number' ? coverImageX : null,
      coverImageY: typeof coverImageY === 'number' ? coverImageY : null,
      coverImageWidth: typeof coverImageWidth === 'number' ? coverImageWidth : null,
      coverImageHeight: typeof coverImageHeight === 'number' ? coverImageHeight : null,
      categories,
      materialPages: materialPages || [],
      plantScheduleBase64:
        typeof plantScheduleBase64 === 'string' &&
        plantScheduleBase64 &&
        typeof plantScheduleMimeType === 'string' &&
        plantScheduleMimeType.startsWith('image/')
          ? plantScheduleBase64
          : null,
      plantScheduleMimeType:
        typeof plantScheduleMimeType === 'string' &&
        plantScheduleMimeType.startsWith('image/')
          ? plantScheduleMimeType
          : null,
      plantScheduleUrl:
        typeof plantScheduleUrl === 'string' && plantScheduleUrl
          ? plantScheduleUrl
          : null
    });

    const filename = title
      ? `${title.replace(/[^a-z0-9 ]/gi, '_')}.pdf`
      : 'submittal.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Error generating PDF:', error);
    return res.status(500).json({
      error: 'Failed to generate PDF',
      details: error.message
    });
  }
});

export const materialsRouter = Router();

materialsRouter.get('/unit-types', (_req, res) => {
  res.json(UNIT_TYPES);
});

materialsRouter.delete('/:id', async (req, res) => {
  try {
    await catalog.deleteItem(req.params.id);
    res.json({ ok: true });
  } catch (error) {
    sendError(res, error);
  }
});

materialsRouter.put('/:id', async (req, res) => {
  try {
    const material = await catalog.updateItem(req.params.id, req.body || {});
    res.json(material);
  } catch (error) {
    sendError(res, error);
  }
});
