import { Router } from 'express';
import passport from 'passport';
import multer from 'multer';
import { bulkUploadMandals, createMandal, getMandal, listMandals, softDeleteMandal, updateMandal } from './mandals.service';
import { CreateMandalDto, UpdateMandalDto } from './mandals.dto';

const router = Router();
const upload = multer({ dest: 'uploads/' });

/**
 * @swagger
 * tags:
 *   name: Mandals
 *   description: Mandal management
 */

/**
 * @swagger
 * /mandals:
 *   get:
 *     summary: List mandals (filter by districtId)
 *     tags: [Mandals]
 *     parameters:
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Array of mandals }
 */
router.get('/', async (req, res) => {
  const districtId = req.query.districtId as string | undefined;
  const mandals = await listMandals(districtId);
  res.json(mandals);
});

/**
 * @swagger
 * /mandals/{id}:
 *   get:
 *     summary: Get mandal by ID
 *     tags: [Mandals]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Mandal }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const m = await getMandal(req.params.id);
  if (!m || m.isDeleted) return res.status(404).json({ error: 'Mandal not found' });
  res.json(m);
});

/**
 * @swagger
 * /mandals:
 *   post:
 *     summary: Create mandal
 *     tags: [Mandals]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, districtId]
 *             properties:
 *               name: { type: string }
 *               districtId: { type: string }
 *               isAssemblyConstituency: { type: boolean }
 *     responses:
 *       201: { description: Created }
 */
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const data = req.body as CreateMandalDto;
    if (!data.name || !data.districtId) return res.status(400).json({ error: 'name and districtId required' });
    const created = await createMandal(data);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /mandals/{id}:
 *   patch:
 *     summary: Update mandal
 *     tags: [Mandals]
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
 *           schema: { $ref: '#/components/schemas/UpdateMandalDto' }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const updated = await updateMandal(req.params.id, req.body as UpdateMandalDto);
    res.json(updated);
  } catch (e: any) {
    res.status(404).json({ error: 'Mandal not found' });
  }
});

/**
 * @swagger
 * /mandals/{id}:
 *   delete:
 *     summary: Soft delete mandal
 *     tags: [Mandals]
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
    await softDeleteMandal(req.params.id);
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Mandal not found' });
  }
});

/**
 * @swagger
 * /mandals/bulk-upload:
 *   post:
 *     summary: Bulk upload mandals via CSV
 *     description: |
 *       Upload a CSV file to create mandals. Columns accepted:
 *       - name (required)
 *       - districtId OR districtName (one required)
 *       - isAssemblyConstituency (optional boolean: true/false/1/yes)
 *     tags: [Mandals]
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
 *     x-csv-example: |-
 *       name,districtName,isAssemblyConstituency
 *       Utnoor,Adilabad,true
 *       Narnoor,Adilabad,false
 *       Inderavelly,Adilabad,true
 */
router.post('/bulk-upload', passport.authenticate('jwt', { session: false }), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'CSV file required' });
  try {
    const summary = await bulkUploadMandals(req.file.path);
    res.json(summary);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
