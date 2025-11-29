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
 *     summary: List mandals (optional districtId filter, pagination)
 *     tags: [Mandals]
 *     parameters:
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *         required: false
 *         description: Filter mandals by a specific district ID
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean }
 *         required: false
 *         description: Include soft-deleted mandals when true
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
 *       200: { description: Paginated mandals list }
 */
router.get('/', async (req, res) => {
  const districtId = req.query.districtId as string | undefined;
  const includeDeleted = String(req.query.includeDeleted || '').toLowerCase() === 'true';
  const pageRaw = req.query.page as string | undefined;
  const pageSizeRaw = req.query.pageSize as string | undefined;
  let page = pageRaw ? parseInt(pageRaw, 10) : 1;
  let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
  if (pageSize > 200) pageSize = 200;

  const where: any = { ...(districtId ? { districtId } : {}), ...(includeDeleted ? {} : { isDeleted: false }) };
  const total = await (await import('../../lib/prisma')).default.mandal.count({ where });
  const skip = (page - 1) * pageSize;
  const mandals = await (await import('../../lib/prisma')).default.mandal.findMany({ where, orderBy: { name: 'asc' }, skip, take: pageSize });
  res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: mandals });
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
 *           examples:
 *             createExample:
 *               summary: Create a mandal
 *               value:
 *                 name: "Some Mandal"
 *                 districtId: "<districtId>"
 *                 isAssemblyConstituency: false
 *     responses:
 *       201: { description: Created }
 *       409: { description: Conflict – mandal with same name exists in district }
 */
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const data = req.body as CreateMandalDto;
    if (!data.name || !data.districtId) return res.status(400).json({ error: 'name and districtId required' });
    try {
      const created = await createMandal(data);
      return res.status(201).json(created);
    } catch (e: any) {
      if (String(e.message).toLowerCase().includes('exists')) {
        return res.status(409).json({ error: e.message });
      }
      throw e;
    }
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
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/UpdateMandalDto'
 *               - type: string
 *             example: "Some Mandal"
 *             description: Supports raw JSON string body to update only the name.
 *           examples:
 *             updateObject:
 *               summary: Update name via object
 *               value:
 *                 name: "Some Mandal"
 *             updateString:
 *               summary: Update name via raw string
 *               value: "Some Mandal"
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Conflict – duplicate mandal name in district }
 *       404: { description: Not found }
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? { name: req.body } : (req.body as UpdateMandalDto);
    const updated = await updateMandal(req.params.id, body as UpdateMandalDto);
    res.json(updated);
  } catch (e: any) {
    if (String(e.message).toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: e.message });
    }
    res.status(404).json({ error: 'Mandal not found' });
  }
});

/**
 * @swagger
 * /mandals/{id}:
 *   put:
 *     summary: Update mandal (PUT)
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
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/UpdateMandalDto'
 *               - type: string
 *             example: "Some Mandal"
 *             description: Supports raw JSON string body to update only the name.
 *           examples:
 *             putObject:
 *               summary: PUT name via object
 *               value:
 *                 name: "Some Mandal"
 *             putString:
 *               summary: PUT name via raw string
 *               value: "Some Mandal"
 *     responses:
 *       200: { description: Updated }
 *       409: { description: Conflict – duplicate mandal name in district }
 *       404: { description: Not found }
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = typeof req.body === 'string' ? { name: req.body } : (req.body as UpdateMandalDto);
    const updated = await updateMandal(req.params.id, body as UpdateMandalDto);
    res.json(updated);
  } catch (e: any) {
    if (String(e.message).toLowerCase().includes('duplicate')) {
      return res.status(409).json({ error: e.message });
    }
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
 * /mandals/{id}/restore:
 *   post:
 *     summary: Restore soft-deleted mandal
 *     tags: [Mandals]
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
    const restored = await updateMandal(req.params.id, { isDeleted: false });
    res.json(restored);
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
