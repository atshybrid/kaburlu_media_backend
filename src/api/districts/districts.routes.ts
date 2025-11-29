import { Router } from 'express';
import passport from 'passport';
import multer from 'multer';
import { createDistrict, getDistrict, listDistricts, softDeleteDistrict, updateDistrict, bulkUploadDistricts } from './districts.service';
import { CreateDistrictDto, UpdateDistrictDto } from './districts.dto';
import prisma from '../../lib/prisma';

const router = Router();
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * tags:
 *   name: Districts
 *   description: District management
 */

/**
 * @swagger
 * /districts:
 *   get:
 *     summary: List districts (optional stateId filter, pagination, includeDeleted)
 *     tags: [Districts]
 *     parameters:
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *         required: false
 *         description: Filter districts by a specific state ID
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean }
 *         required: false
 *         description: Include soft-deleted districts when true
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         required: false
 *         description: Items per page (default 50, max 200)
 *     responses:
 *       200:
 *         description: Paginated districts list
 */
router.get('/', async (req, res) => {
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
  const stateId = (req.query.stateId as string | undefined) || undefined;
  const pageRaw = req.query.page as string | undefined;
  const pageSizeRaw = req.query.pageSize as string | undefined;
  let page = pageRaw ? parseInt(pageRaw, 10) : 1;
  let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
  if (pageSize > 200) pageSize = 200;

  const where: any = includeDeleted ? {} : { isDeleted: false };
  if (stateId) where.stateId = stateId;

  const total = await prisma.district.count({ where });
  const skip = (page - 1) * pageSize;
  const districts = await prisma.district.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize });
  res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: districts });
});

/**
 * @swagger
 * /districts/{id}:
 *   get:
 *     summary: Get district by ID
 *     tags: [Districts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeDeleted
 *         required: false
 *         schema: { type: boolean }
 *         description: Return even if soft-deleted when true
 *     responses:
 *       200: { description: District }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
  const d = await getDistrict(req.params.id);
  if (!d) return res.status(404).json({ error: 'District not found' });
  if (d.isDeleted && !includeDeleted) return res.status(404).json({ error: 'District not found' });
  res.json(d);
});

/**
 * @swagger
 * /districts:
 *   post:
 *     summary: Create district
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, stateId]
 *             properties:
 *               name: { type: string }
 *               stateId: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const data = req.body as CreateDistrictDto;
    if (!data.name || !data.stateId) return res.status(400).json({ error: 'name and stateId required' });
    const created = await createDistrict(data);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /districts/{id}:
 *   patch:
 *     summary: Update district
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateDistrictDto' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const updated = await updateDistrict(req.params.id, req.body as UpdateDistrictDto);
    res.json(updated);
  } catch (e: any) {
    res.status(404).json({ error: 'District not found' });
  }
});

/**
 * @swagger
 * /districts/{id}:
 *   put:
 *     summary: Update district (PUT)
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UpdateDistrictDto' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const updated = await updateDistrict(req.params.id, req.body as UpdateDistrictDto);
    res.json(updated);
  } catch (e: any) {
    res.status(404).json({ error: 'District not found' });
  }
});

/**
 * @swagger
 * /districts/{id}:
 *   delete:
 *     summary: Soft delete district
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    await softDeleteDistrict(req.params.id);
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'District not found' });
  }
});

/**
 * @swagger
 * /districts/{id}/restore:
 *   post:
 *     summary: Restore soft-deleted district
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Restored }
 *       404: { description: Not found }
 */
router.post('/:id/restore', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const restored = await updateDistrict(req.params.id, { isDeleted: false });
    res.json(restored);
  } catch {
    res.status(404).json({ error: 'District not found' });
  }
});

/**
 * @swagger
 * /districts/bulk-upload:
 *   post:
 *     summary: Bulk upload districts via CSV (name,stateId)
 *     tags: [Districts]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Upload summary }
 */
router.post('/bulk-upload', passport.authenticate('jwt', { session: false }), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const summary = await bulkUploadDistricts(req.file.path);
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
