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
 *     summary: List districts (filter by stateId; non-deleted by default)
 *     tags: [Districts]
 *     responses:
 *       200:
 *         description: Array of districts
 */
router.get('/', async (req, res) => {
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
  const stateId = (req.query.stateId as string | undefined) || undefined;
  const where: any = includeDeleted ? {} : { isDeleted: false };
  if (stateId) where.stateId = stateId;
  const districts = await prisma.district.findMany({ where, orderBy: { name: 'asc' } });
  res.json(districts);
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
