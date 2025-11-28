import { Router } from 'express';
import passport from 'passport';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { CreateCasteDto, UpdateCasteDto, CreateSubCasteDto, UpdateSubCasteDto } from './castes.dto';
import { listCastes, createCaste, updateCaste, deleteCaste, listSubCastes, createSubCaste, updateSubCaste, deleteSubCaste } from './castes.service';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

function isAdmin(req: any) {
  const role = req.user?.role?.name;
  return role === 'SUPERADMIN' || role === 'LANGUAGE_ADMIN';
}

/**
 * @swagger
 * tags:
 *   name: Castes
 *   description: Caste and SubCaste management
 */

/**
 * @swagger
 * /castes:
 *   get:
 *     summary: List all castes
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/', auth, async (_req: any, res) => {
  const items = await listCastes();
  res.json({ count: items.length, items });
});

/**
 * @swagger
 * /castes:
 *   post:
 *     summary: Create a caste
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCaste'
 *     responses:
 *       201: { description: Created }
 */
router.post('/', auth, validationMiddleware(CreateCasteDto), async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await createCaste(req.body.name);
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /castes/{id}:
 *   patch:
 *     summary: Update a caste
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCaste'
 *     responses:
 *       200: { description: OK }
 */
router.patch('/:id', auth, validationMiddleware(UpdateCasteDto), async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await updateCaste(req.params.id, req.body.name);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /castes/{id}:
 *   delete:
 *     summary: Delete a caste (blocked if in use)
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: In use }
 */
router.delete('/:id', auth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await deleteCaste(req.params.id);
    res.json(item);
  } catch (e: any) {
    const msg = String(e.message || '');
    const code = msg.includes('reference') ? 409 : 400;
    res.status(code).json({ error: e.message });
  }
});

// SubCastes
/**
 * @swagger
 * /castes/sub:
 *   get:
 *     summary: List subcastes (optionally filter by casteId)
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: casteId
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get('/sub', auth, async (req: any, res) => {
  const items = await listSubCastes(req.query.casteId ? String(req.query.casteId) : undefined);
  res.json({ count: items.length, items });
});

/**
 * @swagger
 * /castes/sub:
 *   post:
 *     summary: Create a subcaste
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubCaste'
 *     responses:
 *       201: { description: Created }
 */
router.post('/sub', auth, validationMiddleware(CreateSubCasteDto), async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await createSubCaste(req.body.casteId, req.body.name);
    res.status(201).json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /castes/sub/{id}:
 *   patch:
 *     summary: Update a subcaste
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
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
 *             $ref: '#/components/schemas/UpdateSubCaste'
 *     responses:
 *       200: { description: OK }
 */
router.patch('/sub/:id', auth, validationMiddleware(UpdateSubCasteDto), async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await updateSubCaste(req.params.id, req.body.name);
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /castes/sub/{id}:
 *   delete:
 *     summary: Delete a subcaste (blocked if in use)
 *     tags: [Castes]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       409: { description: In use }
 */
router.delete('/sub/:id', auth, async (req: any, res) => {
  if (!isAdmin(req)) return res.status(403).json({ error: 'Forbidden' });
  try {
    const item = await deleteSubCaste(req.params.id);
    res.json(item);
  } catch (e: any) {
    const msg = String(e.message || '');
    const code = msg.includes('reference') ? 409 : 400;
    res.status(code).json({ error: e.message });
  }
});

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     CreateCaste:
 *       type: object
 *       required: [name]
 *       properties:
 *         name: { type: string }
 *     UpdateCaste:
 *       type: object
 *       properties:
 *         name: { type: string }
 *     CreateSubCaste:
 *       type: object
 *       required: [casteId, name]
 *       properties:
 *         casteId: { type: string }
 *         name: { type: string }
 *     UpdateSubCaste:
 *       type: object
 *       properties:
 *         name: { type: string }
 */
