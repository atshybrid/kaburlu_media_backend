import { Router, Request, Response } from 'express';
import passport from 'passport';
import multer from 'multer';
import prisma from '../../lib/prisma';
import { requireSuperAdmin } from '../middlewares/authz';
import {
  createPrgiNewspapers,
  formatPrgiNewspaper,
  parseBodyToInput,
  parseCsvText,
  parseSearchQuery,
  searchPrgiNewspapers,
  updatePrgiNewspaper,
} from '../../lib/prgiRegisteredTitle';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * @swagger
 * tags:
 *   - name: PRGI Newspaper
 *     description: |
 *       PRGI (Press Registrar General of India) registered newspaper titles.
 *       GET endpoints are public. POST, PUT, and CSV import require SUPER_ADMIN JWT.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PrgiNewspaper:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         serialNumber: { type: integer, nullable: true }
 *         title: { type: string, example: "VAARTHA BHOOMI" }
 *         registrationNumber: { type: string, example: "TELTEL/2015/65957" }
 *         prgiNumber: { type: string, description: Alias of registrationNumber }
 *         registrationDate: { type: string, format: date, nullable: true, example: "2016-02-02" }
 *         language: { type: string, example: Telugu }
 *         periodicity: { type: string, example: Daily }
 *         type: { type: string, description: Alias of periodicity }
 *         publisher: { type: string }
 *         owner: { type: string }
 *         publicationState: { type: string, example: Telangana }
 *         state: { type: string, description: Alias of publicationState }
 *         publicationDistrict: { type: string, example: Warangal }
 *         district: { type: string, description: Alias of publicationDistrict }
 *     PrgiNewspaperInput:
 *       type: object
 *       required: [title, registrationNumber, publicationState]
 *       properties:
 *         serialNumber: { type: integer }
 *         title: { type: string }
 *         registrationNumber: { type: string }
 *         prgiNumber: { type: string, description: Alias of registrationNumber }
 *         registrationDate: { type: string, example: "10-04-1980" }
 *         language: { type: string }
 *         periodicity: { type: string }
 *         type: { type: string, description: Alias of periodicity }
 *         publisher: { type: string }
 *         owner: { type: string }
 *         publicationState: { type: string }
 *         publicationDistrict: { type: string }
 *     PrgiNewspaperListResponse:
 *       type: object
 *       properties:
 *         success: { type: boolean, example: true }
 *         total: { type: integer }
 *         page: { type: integer }
 *         limit: { type: integer }
 *         totalPages: { type: integer }
 *         items:
 *           type: array
 *           items: { $ref: '#/components/schemas/PrgiNewspaper' }
 */

/**
 * @swagger
 * /prgi/newspapers:
 *   get:
 *     summary: Search PRGI registered newspapers (public)
 *     description: |
 *       Filter by title, PRGI registration number, publisher, state, district, periodicity (type), language.
 *       Use `q` for broad search across title, number, publisher, owner, state, district, type, language.
 *     tags: [PRGI Newspaper]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Broad search text
 *       - in: query
 *         name: title
 *         schema: { type: string }
 *       - in: query
 *         name: registrationNumber
 *         schema: { type: string }
 *       - in: query
 *         name: prgiNumber
 *         schema: { type: string }
 *         description: Alias of registrationNumber
 *       - in: query
 *         name: publisher
 *         schema: { type: string }
 *       - in: query
 *         name: owner
 *         schema: { type: string }
 *       - in: query
 *         name: publicationState
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: publicationDistrict
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: periodicity
 *         schema: { type: string }
 *         description: Publication type (Daily, Weekly, Monthly, …)
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *         description: Alias of periodicity
 *       - in: query
 *         name: language
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [title, registrationNumber, registrationDate, publicationState, publicationDistrict, periodicity, publisher, createdAt]
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: asc }
 *     responses:
 *       200:
 *         description: Paginated list
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/PrgiNewspaperListResponse' }
 *             example:
 *               success: true
 *               total: 2
 *               page: 1
 *               limit: 20
 *               totalPages: 1
 *               items:
 *                 - id: clx123
 *                   title: VAARTHA BHOOMI
 *                   registrationNumber: TELTEL/2015/65957
 *                   prgiNumber: TELTEL/2015/65957
 *                   publicationState: Telangana
 *                   publicationDistrict: Warangal
 *                   periodicity: Daily
 *                   publisher: LINGA REDDY VENKAT REDDY
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await searchPrgiNewspapers(parseSearchQuery(req.query as Record<string, unknown>));
    res.json({ success: true, ...result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Search failed' });
  }
});

/**
 * @swagger
 * /prgi/newspapers/meta/filters:
 *   get:
 *     summary: List distinct states and publication types for filters (public)
 *     tags: [PRGI Newspaper]
 *     responses:
 *       200:
 *         description: Filter options
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               states: [Telangana, Andhra Pradesh]
 *               types: [Daily, Weekly, Monthly]
 *               languages: [Telugu, English]
 */
router.get('/meta/filters', async (_req: Request, res: Response) => {
  try {
    const [states, types, languages] = await Promise.all([
      prisma.prgiRegisteredTitle.findMany({
        distinct: ['publicationState'],
        select: { publicationState: true },
        orderBy: { publicationState: 'asc' },
      }),
      prisma.prgiRegisteredTitle.findMany({
        where: { periodicity: { not: null } },
        distinct: ['periodicity'],
        select: { periodicity: true },
        orderBy: { periodicity: 'asc' },
        take: 200,
      }),
      prisma.prgiRegisteredTitle.findMany({
        where: { language: { not: null } },
        distinct: ['language'],
        select: { language: true },
        orderBy: { language: 'asc' },
        take: 200,
      }),
    ]);
    res.json({
      success: true,
      states: states.map((s) => s.publicationState).filter(Boolean),
      types: types.map((t) => t.periodicity).filter(Boolean),
      languages: languages.map((l) => l.language).filter(Boolean),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed to load filters' });
  }
});

/**
 * @swagger
 * /prgi/newspapers/meta/districts:
 *   get:
 *     summary: List publication districts for a state (public)
 *     tags: [PRGI Newspaper]
 *     parameters:
 *       - in: query
 *         name: state
 *         required: true
 *         schema: { type: string, example: Telangana }
 *     responses:
 *       200:
 *         description: District names
 */
router.get('/meta/districts', async (req: Request, res: Response) => {
  const state = String(req.query.state || req.query.publicationState || '').trim();
  if (!state) return res.status(400).json({ success: false, error: 'state query parameter is required' });
  try {
    const rows = await prisma.prgiRegisteredTitle.findMany({
      where: { publicationState: { equals: state, mode: 'insensitive' }, publicationDistrict: { not: null } },
      distinct: ['publicationDistrict'],
      select: { publicationDistrict: true },
      orderBy: { publicationDistrict: 'asc' },
    });
    res.json({
      success: true,
      state,
      districts: rows.map((r) => r.publicationDistrict).filter(Boolean),
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'Failed to load districts' });
  }
});

/**
 * @swagger
 * /prgi/newspapers/registration/{registrationNumber}:
 *   get:
 *     summary: Get newspaper by PRGI registration number (public)
 *     tags: [PRGI Newspaper]
 *     parameters:
 *       - in: path
 *         name: registrationNumber
 *         required: true
 *         schema: { type: string, example: "TELTEL/2015/65957" }
 *     responses:
 *       200:
 *         description: Newspaper record
 *       404:
 *         description: Not found
 */
router.get('/registration/:registrationNumber', async (req: Request, res: Response) => {
  const reg = decodeURIComponent(req.params.registrationNumber).trim();
  const row = await prisma.prgiRegisteredTitle.findFirst({
    where: { registrationNumber: { equals: reg, mode: 'insensitive' } },
  });
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: formatPrgiNewspaper(row) });
});

/**
 * @swagger
 * /prgi/newspapers/{id}:
 *   get:
 *     summary: Get newspaper by id (public)
 *     tags: [PRGI Newspaper]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Newspaper record
 *       404:
 *         description: Not found
 */
router.get('/:id', async (req: Request, res: Response) => {
  const row = await prisma.prgiRegisteredTitle.findUnique({ where: { id: req.params.id } });
  if (!row) return res.status(404).json({ success: false, error: 'Not found' });
  res.json({ success: true, data: formatPrgiNewspaper(row) });
});

/**
 * @swagger
 * /prgi/newspapers:
 *   post:
 *     summary: Add one or many PRGI newspapers [Super Admin]
 *     description: |
 *       Send a single object, `{ "items": [ ... ] }`, or a raw JSON array.
 *       Duplicate `registrationNumber` values are skipped.
 *     tags: [PRGI Newspaper]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - $ref: '#/components/schemas/PrgiNewspaperInput'
 *               - type: object
 *                 properties:
 *                   items:
 *                     type: array
 *                     items: { $ref: '#/components/schemas/PrgiNewspaperInput' }
 *               - type: array
 *                 items: { $ref: '#/components/schemas/PrgiNewspaperInput' }
 *           examples:
 *             single:
 *               summary: Single newspaper
 *               value:
 *                 title: TEST DAILY
 *                 registrationNumber: TGTEL/26/A9999
 *                 registrationDate: "23-01-2026"
 *                 language: Telugu
 *                 periodicity: Daily
 *                 publisher: Test Publisher
 *                 owner: Test Owner
 *                 publicationState: Telangana
 *                 publicationDistrict: Hyderabad
 *             multiple:
 *               summary: Multiple newspapers
 *               value:
 *                 items:
 *                   - title: PAPER ONE
 *                     registrationNumber: REG-001
 *                     publicationState: Telangana
 *                   - title: PAPER TWO
 *                     registrationNumber: REG-002
 *                     publicationState: Andhra Pradesh
 *     responses:
 *       201:
 *         description: Created (may include skipped duplicates)
 *       403:
 *         description: Super Admin only
 */
router.post('/', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    let rawItems: any[] = [];
    if (Array.isArray(body)) rawItems = body;
    else if (Array.isArray(body?.items)) rawItems = body.items;
    else if (body && typeof body === 'object') rawItems = [body];

    if (!rawItems.length) {
      return res.status(400).json({ success: false, error: 'Provide a newspaper object, items array, or JSON array' });
    }

    const inputs = rawItems.map((item) => parseBodyToInput(item));
    const result = await createPrgiNewspapers(inputs, 'api:post');
    res.status(201).json({ success: true, ...result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e?.message || 'Invalid request' });
  }
});

/**
 * @swagger
 * /prgi/newspapers/import/csv:
 *   post:
 *     summary: Bulk import newspapers from PRGI CSV [Super Admin]
 *     description: |
 *       Upload official PRGI export CSV with columns:
 *       SN., Title, Registration Number, Registration Date, Language, Periodicity,
 *       Publisher, Owner, Publication State, Publication District
 *     tags: [PRGI Newspaper]
 *     security:
 *       - bearerAuth: []
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
 *     responses:
 *       201:
 *         description: Import summary
 *       403:
 *         description: Super Admin only
 */
router.post('/import/csv', auth, requireSuperAdmin, uploadCsv.single('file'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ success: false, error: 'CSV file is required (field name: file)' });
    }
    const content = file.buffer.toString('utf8');
    const inputs = parseCsvText(content, file.originalname || 'upload.csv');
    if (!inputs.length) {
      return res.status(400).json({ success: false, error: 'No valid rows found in CSV' });
    }
    const result = await createPrgiNewspapers(inputs, file.originalname || 'upload.csv');
    res.status(201).json({
      success: true,
      parsedRows: inputs.length,
      ...result,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'CSV import failed' });
  }
});

/**
 * @swagger
 * /prgi/newspapers/{id}:
 *   put:
 *     summary: Update a PRGI newspaper by id [Super Admin]
 *     tags: [PRGI Newspaper]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/PrgiNewspaperInput' }
 *     responses:
 *       200:
 *         description: Updated record
 *       404:
 *         description: Not found
 *       403:
 *         description: Super Admin only
 */
router.put('/:id', auth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const updated = await updatePrgiNewspaper(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'registrationNumber already exists' });
    }
    res.status(400).json({ success: false, error: e?.message || 'Update failed' });
  }
});

export default router;
