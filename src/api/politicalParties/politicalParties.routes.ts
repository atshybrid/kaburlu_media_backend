/**
 * Indian political parties — public search + Super Admin CRUD (colors, symbols).
 */
import { Router, Request, Response } from 'express';
import passport from 'passport';
import multer from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { requireSuperAdmin } from '../middlewares/authz';
import {
  formatPartyRow,
  searchParties,
  upsertPartyFromSeed,
  type PartySeedRow,
} from '../../lib/indianPoliticalParty';
import {
  adminListParties,
  createParty,
  findPartyByIdOrCode,
  softDeleteParty,
  updateParty,
  updatePartyColors,
  updatePartySymbolMeta,
  uploadPartySymbolImage,
} from '../../lib/indianPoliticalPartyAdmin';
import { enrichPartyColorsWithAi } from '../../lib/indianPoliticalPartyAi';
import prisma from '../../lib/prisma';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });
const uploadSymbol = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const SEED_PATH = path.join(
  process.cwd(),
  'scripts/data/indian-political-parties/eci-national-state-seed.json',
);

const TAG = 'India Political Parties';

function parseQuery(req: Request) {
  const q = req.query as Record<string, string>;
  return {
    q: q.q,
    state: q.state,
    recognition: q.recognition,
    page: parseInt(q.page ?? '1', 10),
    limit: parseInt(q.limit ?? '50', 10),
  };
}

/**
 * @swagger
 * components:
 *   schemas:
 *     IndianPoliticalParty:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         shortCode: { type: string, example: BJP }
 *         name: { type: string }
 *         abbreviation: { type: string, nullable: true }
 *         recognition: { type: string, enum: [NATIONAL, STATE, REGISTERED_UNRECOGNIZED] }
 *         symbolName: { type: string, nullable: true, example: Lotus }
 *         symbolImageUrl: { type: string, nullable: true }
 *         primaryColor: { type: string, example: "#FF9933" }
 *         secondaryColor: { type: string, example: "#138808" }
 *         states: { type: array, items: { type: string } }
 *         headquartersAddress: { type: string, nullable: true }
 *         eciSerialNumber: { type: integer, nullable: true }
 *         eciNotificationRef: { type: string, nullable: true }
 *         eciSourceUrl: { type: string, nullable: true }
 *         colorSource: { type: string, enum: [ECI, MANUAL, AI_CURATED] }
 *         isActive: { type: boolean }
 *     IndianPoliticalPartyInput:
 *       type: object
 *       required: [shortCode, name, recognition]
 *       properties:
 *         shortCode: { type: string, example: BRS }
 *         name: { type: string }
 *         abbreviation: { type: string }
 *         recognition: { type: string, enum: [NATIONAL, STATE, REGISTERED_UNRECOGNIZED] }
 *         symbolName: { type: string }
 *         symbolImageUrl: { type: string }
 *         primaryColor: { type: string, example: "#E91E63" }
 *         secondaryColor: { type: string, example: "#FFFFFF" }
 *         states: { type: array, items: { type: string } }
 *         headquartersAddress: { type: string }
 *         eciSerialNumber: { type: integer }
 *         eciNotificationRef: { type: string }
 *         colorSource: { type: string, enum: [ECI, MANUAL, AI_CURATED] }
 *     IndianPoliticalPartyColorsInput:
 *       type: object
 *       properties:
 *         primaryColor: { type: string, example: "#FF9933" }
 *         secondaryColor: { type: string, example: "#138808" }
 *         colorSource: { type: string, enum: [ECI, MANUAL, AI_CURATED] }
 *     IndianPoliticalPartySymbolInput:
 *       type: object
 *       properties:
 *         symbolName: { type: string, example: Lotus }
 *         symbolImageUrl: { type: string, description: External CDN URL (optional if uploading file) }
 */

/**
 * @swagger
 * /political-parties:
 *   get:
 *     summary: Search Indian political parties (public)
 *     description: |
 *       ECI party name + reserved symbol. **primaryColor / secondaryColor** are UI theme colors (not official ECI).
 *     tags: [India Political Parties]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string, example: Telangana }
 *       - in: query
 *         name: recognition
 *         schema: { type: string, enum: [NATIONAL, STATE, REGISTERED_UNRECOGNIZED] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated active parties
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await searchParties({ ...parseQuery(req), isActive: true });
    return res.json({ success: true, ...data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

/**
 * @swagger
 * /political-parties/admin:
 *   get:
 *     summary: List parties (Super Admin, includes inactive)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: recognition
 *         schema: { type: string, enum: [NATIONAL, STATE, REGISTERED_UNRECOGNIZED] }
 *       - in: query
 *         name: isActive
 *         schema: { type: string, enum: [true, false] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated list
 *   post:
 *     summary: Create party (Super Admin)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IndianPoliticalPartyInput' }
 *     responses:
 *       201:
 *         description: Created
 */
router.get('/admin', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string>;
    const data = await adminListParties({
      q: q.q,
      state: q.state,
      recognition: q.recognition,
      isActive: q.isActive,
      page: parseInt(q.page ?? '1', 10),
      limit: parseInt(q.limit ?? '50', 10),
    });
    return res.json({ success: true, ...data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

router.post('/admin', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await createParty(req.body);
    return res.status(201).json({ success: true, data });
  } catch (e: any) {
    const msg = e?.message || 'Create failed';
    const code = msg.includes('already exists') ? 409 : 400;
    return res.status(code).json({ success: false, error: msg });
  }
});

/**
 * @swagger
 * /political-parties/admin/import-seed:
 *   post:
 *     summary: Import National + State parties from bundled ECI seed JSON
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/admin/import-seed', jwtAuth, requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(SEED_PATH)) {
      return res.status(500).json({ success: false, error: 'Seed file not found on server' });
    }
    const raw = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')) as {
      eciSourceUrl?: string;
      parties: PartySeedRow[];
    };
    let count = 0;
    for (const row of raw.parties) {
      await upsertPartyFromSeed(row, raw.eciSourceUrl);
      count++;
    }
    const total = await p.indianPoliticalParty.count();
    return res.json({
      success: true,
      imported: count,
      total,
      source: 'eci-national-state-seed.json',
      eciPortal: 'https://www.eci.gov.in/political-party',
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Import failed' });
  }
});

/**
 * @swagger
 * /political-parties/admin/enrich-colors:
 *   post:
 *     summary: AI-suggest primary/secondary hex colors for parties
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 */
router.post('/admin/enrich-colors', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(100, parseInt(String(req.body?.limit ?? 30), 10));
    const force = !!req.body?.force;
    const updated = await enrichPartyColorsWithAi({ limit, force });
    return res.json({ success: true, updated, message: 'Colors are UI suggestions, not official ECI data' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'AI enrichment failed' });
  }
});

/**
 * @swagger
 * /political-parties/admin/{id}:
 *   get:
 *     summary: Get party by id (Super Admin, includes inactive)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *   put:
 *     summary: Update party fields (Super Admin)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IndianPoliticalPartyInput' }
 *   delete:
 *     summary: Deactivate party (soft delete)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/admin/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const row = await findPartyByIdOrCode(req.params.id, true);
    if (!row) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data: formatPartyRow(row) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

router.put('/admin/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await updateParty(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Update failed' });
  }
});

router.delete('/admin/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await softDeleteParty(req.params.id);
    if (!data) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Delete failed' });
  }
});

/**
 * @swagger
 * /political-parties/admin/{id}/colors:
 *   put:
 *     summary: Set party brand colors (Super Admin)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IndianPoliticalPartyColorsInput' }
 */
router.put('/admin/:id/colors', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await updatePartyColors(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Invalid colors' });
  }
});

/**
 * @swagger
 * /political-parties/admin/{id}/symbol:
 *   put:
 *     summary: Set ECI symbol name and/or symbol image URL (Super Admin)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/IndianPoliticalPartySymbolInput' }
 */
router.put('/admin/:id/symbol', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const data = await updatePartySymbolMeta(req.params.id, req.body);
    if (!data) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data });
  } catch (e: any) {
    return res.status(400).json({ success: false, error: e?.message || 'Update failed' });
  }
});

/**
 * @swagger
 * /political-parties/admin/{id}/symbol/upload:
 *   post:
 *     summary: Upload party symbol PNG to CDN (Super Admin)
 *     tags: [India Political Parties]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */
router.post(
  '/admin/:id/symbol/upload',
  jwtAuth,
  requireSuperAdmin,
  uploadSymbol.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, error: 'file is required (multipart field name: file)' });
      }
      const data = await uploadPartySymbolImage(req.params.id, req.file.buffer, req.file.mimetype);
      if (!data) return res.status(404).json({ success: false, error: 'Party not found' });
      return res.json({ success: true, data });
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Upload failed' });
    }
  },
);

/**
 * @swagger
 * /political-parties/{idOrCode}:
 *   get:
 *     summary: Get active party by id or shortCode (BJP, BRS, INC)
 *     tags: [India Political Parties]
 */
router.get('/:idOrCode', async (req: Request, res: Response) => {
  try {
    const key = req.params.idOrCode;
    const row = await findPartyByIdOrCode(key, false);
    if (!row) return res.status(404).json({ success: false, error: 'Party not found' });
    return res.json({ success: true, data: formatPartyRow(row) });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'Failed' });
  }
});

export default router;
