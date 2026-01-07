import { Router } from 'express';
import passport from 'passport';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { CreateSurnameDto } from './meta.dto';
import { findOrCreateSurname, listSurnames } from './meta.service';
import { listCastes } from '../castes/castes.service';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   name: Meta
 *   description: App metadata helpers (surnames, castes)
 */

/**
 * @swagger
 * /meta/surnames:
 *   get:
 *     summary: Auto-suggest surnames
 *     tags: [Meta]
 *     parameters:
 *       - in: query
 *         name: suggest
 *         schema: { type: string }
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/surnames', async (req, res) => {
  const items = await listSurnames({
    suggest: req.query.suggest ? String(req.query.suggest) : undefined,
    stateId: req.query.stateId ? String(req.query.stateId) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ count: items.length, items });
});

/**
 * @swagger
 * /meta/surnames:
 *   post:
 *     summary: Create surname if missing (returns existing if already present)
 *     tags: [Meta]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [surnameEn]
 *             properties:
 *               surnameEn: { type: string }
 *               surnameNative: { type: string }
 *               stateId: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/surnames', auth, validationMiddleware(CreateSurnameDto), async (req: any, res) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : undefined;
    const item = await findOrCreateSurname({
      surnameEn: req.body.surnameEn,
      surnameNative: req.body.surnameNative,
      stateId: req.body.stateId,
      createdByUserId: userId,
    });
    res.json(item);
  } catch (e: any) {
    res.status(400).json({ error: e.message || 'Failed to create surname' });
  }
});

/**
 * @swagger
 * /meta/castes:
 *   get:
 *     summary: List castes (community)
 *     tags: [Meta]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/castes', auth, async (_req: any, res) => {
  // Note: existing /castes module is the source of truth; this is a convenience alias.
  const items = await listCastes();
  res.json({ count: items.length, items });
});

export default router;
