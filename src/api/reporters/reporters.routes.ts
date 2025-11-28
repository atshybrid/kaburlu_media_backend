import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { createUser, findUserByMobileNumber } from '../users/users.service';

const router = Router();

const includeReporterContact = {
  designation: true,
  user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
} as const;

function mapReporterContact(r: any) {
  if (!r) return r;
  const fullName = r?.user?.profile?.fullName || null;
  const mobileNumber = r?.user?.mobileNumber || null;
  const { user, ...rest } = r;
  return { ...rest, fullName, mobileNumber };
}

/**
 * @swagger
 * tags:
 *   - name: Reporters
 *     description: Reporter hierarchy & roles
 */

/**
 * @swagger
 * /reporters:
 *   get:
 *     summary: List reporters with filters (legacy global scope)
 *     tags: [Reporters]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *       - in: query
 *         name: mandalId
 *         schema: { type: string }
 *       - in: query
 *         name: assemblyConstituencyId
 *         schema: { type: string }
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *     responses:
 *       200:
 *         description: Filtered reporters
 */
router.get('/', async (req, res) => {
  const { tenantId, level, stateId, districtId, mandalId, assemblyConstituencyId } = req.query as Record<string, string>;
  const activeRaw = req.query.active;
  const where: any = {};
  if (tenantId) where.tenantId = tenantId;
  if (level) where.level = level;
  if (stateId) where.stateId = stateId;
  if (districtId) where.districtId = districtId;
  if (mandalId) where.mandalId = mandalId;
  if (assemblyConstituencyId) where.assemblyConstituencyId = assemblyConstituencyId;
  if (typeof activeRaw !== 'undefined') where.active = String(activeRaw).toLowerCase() === 'true';
  const reporters = await (prisma as any).reporter.findMany({ where, orderBy: { createdAt: 'desc' }, include: includeReporterContact });
  res.json(reporters.map(mapReporterContact));
});

/**
 * @swagger
 * /reporters/{id}:
 *   get:
 *     summary: Get single reporter
 *     tags: [Reporters]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reporter }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const r = await (prisma as any).reporter.findUnique({ where: { id: req.params.id }, include: includeReporterContact });
  if (!r) return res.status(404).json({ error: 'Reporter not found' });
  res.json(mapReporterContact(r));
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   post:
 *     summary: Generate or fetch reporter ID card (number + validity)
 *     description: |
 *       Generates a Reporter ID card for the given reporter using per-tenant ID card settings
 *       (prefix, digit length, validity rules). If a card already exists, it simply returns it.
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         description: Reporter id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Reporter ID card created or returned
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 reporterId: { type: string }
 *                 cardNumber: { type: string, example: "KM000123" }
 *                 issuedAt: { type: string, format: date-time }
 *                 expiresAt: { type: string, format: date-time }
 *                 pdfUrl: { type: string, nullable: true }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Reporter or settings not found }
 */
router.post('/tenants/:tenantId/reporters/:id/id-card', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: { idCard: true }
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    if (reporter.idCard) {
      return res.status(201).json(reporter.idCard);
    }

    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'Tenant ID card settings not configured' });

    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;

    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId } }
    });
    const nextNumber = existingCount + 1;
    const padded = String(nextNumber).padStart(digits, '0');
    const cardNumber = `${prefix}${padded}`;

    const issuedAt = new Date();
    let expiresAt: Date;
    if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
      expiresAt = new Date(settings.fixedValidUntil);
    } else {
      const days = settings.validityDays && settings.validityDays > 0 ? settings.validityDays : 365;
      expiresAt = new Date(issuedAt.getTime() + days * 24 * 60 * 60 * 1000);
    }

    const idCard = await (prisma as any).reporterIDCard.create({
      data: {
        reporterId: reporter.id,
        cardNumber,
        issuedAt,
        expiresAt,
        pdfUrl: null
      }
    });

    res.status(201).json(idCard);
  } catch (e) {
    console.error('generate reporter id-card error', e);
    res.status(500).json({ error: 'Failed to generate reporter ID card' });
  }
});

/**
 * @swagger
 * /reporters:
 *   post:
 *     summary: Create reporter (admin/manual - prefer /reporters/register for combined user creation)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, level]
 *             properties:
 *               tenantId: { type: string }
 *               userId: { type: string, description: 'Existing user id (role REPORTER)' }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               designationCode: { type: string, description: 'Optional designation code to resolve' }
 *               designationId: { type: string }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = req.body || {};
    const { tenantId, level } = body;
    if (!tenantId || !level) return res.status(400).json({ error: 'tenantId and level required' });
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });
    let designationId = body.designationId || null;
    if (!designationId && body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId, code: body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || null;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }
    const data: any = {
      tenantId,
      level,
      userId: body.userId || null,
      designationId,
      stateId: body.stateId || null,
      districtId: body.districtId || null,
      mandalId: body.mandalId || null,
      assemblyConstituencyId: body.assemblyConstituencyId || null,
      subscriptionActive: !!body.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
      // KYC intentionally excluded from direct creation; default PENDING
    };
    if (level === 'STATE' && !data.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (level === 'DISTRICT' && !data.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (level === 'MANDAL' && !data.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (level === 'ASSEMBLY' && !data.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });
    const created = await (prisma as any).reporter.create({ data, include: includeReporterContact });
    res.status(201).json(mapReporterContact(created));
  } catch (e: any) {
    console.error('create reporter error', e);
    res.status(500).json({ error: 'Failed to create reporter' });
  }
});

/**
 * @swagger
 * /reporters/{id}:
 *   patch:
 *     summary: Update reporter
 *     tags: [Reporters]
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
 *             type: object
 *             properties:
 *               designationId: { type: string }
 *               designationCode: { type: string }
 *               active: { type: boolean }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).reporter.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    let designationId = req.body.designationId || existing.designationId;
    if (!designationId && req.body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: existing.tenantId, code: req.body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: req.body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || designationId;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }
    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: {
        designationId,
        active: typeof req.body.active === 'boolean' ? req.body.active : existing.active,
        subscriptionActive: typeof req.body.subscriptionActive === 'boolean' ? req.body.subscriptionActive : existing.subscriptionActive,
        monthlySubscriptionAmount: typeof req.body.monthlySubscriptionAmount === 'number' ? req.body.monthlySubscriptionAmount : existing.monthlySubscriptionAmount,
        idCardCharge: typeof req.body.idCardCharge === 'number' ? req.body.idCardCharge : existing.idCardCharge,
        // KYC modifications blocked in generic patch
      },
      include: includeReporterContact
    });
    res.json(mapReporterContact(updated));
  } catch (e: any) {
    console.error('update reporter error', e);
    res.status(500).json({ error: 'Failed to update reporter' });
  }
});

/**
 * @swagger
 * /reporters/{id}:
 *   delete:
 *     summary: Soft deactivate reporter
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deactivated }
 *       404: { description: Not found }
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).reporter.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    const updated = await (prisma as any).reporter.update({ where: { id }, data: { active: false }, include: includeReporterContact });
    res.json({ success: true, reporter: mapReporterContact(updated) });
  } catch (e: any) {
    console.error('deactivate reporter error', e);
    res.status(500).json({ error: 'Failed to deactivate reporter' });
  }
});

/**
 * @swagger
 * /reporter-designations:
 *   get:
 *     summary: List reporter designations (global or tenant)
 *     tags: [Reporters]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL, VILLAGE] }
 *     responses:
 *       200: { description: List }
 */
// Merge global and tenant-specific designation overrides (tenant overrides replace by code)
router.get('/designations', async (req, res) => {
  const { tenantId, level } = req.query as Record<string, string>;
  const whereGlobal: any = { tenantId: null };
  const whereTenant: any = tenantId ? { tenantId } : null;
  if (level) { whereGlobal.level = level; if (whereTenant) whereTenant.level = level; }
  const [global, tenantRows] = await Promise.all([
    (prisma as any).reporterDesignation.findMany({ where: whereGlobal }),
    whereTenant ? (prisma as any).reporterDesignation.findMany({ where: whereTenant }) : []
  ]);
  if (!tenantId) {
    return res.json(global.sort((a: any,b: any)=> a.level.localeCompare(b.level)));
  }
  const byCode: Record<string, any> = {};
  for (const g of global) byCode[g.code] = g;
  for (const t of tenantRows) byCode[t.code] = t; // override
  const merged = Object.values(byCode).sort((a: any,b: any)=> a.level.localeCompare(b.level));
  res.json(merged);
});

/**
 * @swagger
 * /reporter-designations:
 *   post:
 *     summary: Create reporter designation
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level, code, name]
 *             properties:
 *               tenantId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL, VILLAGE] }
 *               code: { type: string }
 *               name: { type: string }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/designations', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, level, code, name } = req.body || {};
    if (!level || !code || !name) return res.status(400).json({ error: 'level, code, name required' });
    const created = await (prisma as any).reporterDesignation.create({ data: { tenantId: tenantId || null, level, code, name } });
    res.status(201).json(created);
  } catch (e: any) {
    if (e?.code === 'P2002') return res.status(409).json({ error: 'Designation code already exists for tenant' });
    console.error('create designation error', e);
    res.status(500).json({ error: 'Failed to create designation' });
  }
});

/**
 * @swagger
 * /reporter-designations/{id}:
 *   patch:
 *     summary: Update reporter designation
 *     tags: [Reporters]
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
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.patch('/designations/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).reporterDesignation.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Designation not found' });
    const updated = await (prisma as any).reporterDesignation.update({ where: { id }, data: { name: req.body.name || existing.name } });
    res.json(updated);
  } catch (e: any) {
    console.error('update designation error', e);
    res.status(500).json({ error: 'Failed to update designation' });
  }
});

/**
 * @swagger
 * /reporter-designations/{id}:
 *   delete:
 *     summary: Delete reporter designation (fails if reporters reference it)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 *       409: { description: In use }
 */
router.delete('/designations/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { id } = req.params;
    const count = await (prisma as any).reporter.count({ where: { designationId: id } });
    if (count > 0) return res.status(409).json({ error: 'Designation in use by reporters' });
    await (prisma as any).reporterDesignation.delete({ where: { id } });
    res.json({ success: true });
  } catch (e: any) {
    console.error('delete designation error', e);
    res.status(500).json({ error: 'Failed to delete designation' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporter-designations/seed:
 *   post:
 *     summary: Seed default designations for tenant (idempotent)
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Seeded }
 *       404: { description: Tenant not found }
 */
router.post('/tenants/:tenantId/reporter-designations/seed', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const defaults: { level: string; code: string; name: string }[] = [
      { level: 'STATE', code: 'EDITOR_IN_CHIEF', name: 'Editor-in-Chief' },
      { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief' },
      { level: 'STATE', code: 'STATE_EDITOR', name: 'State Editor' },
      { level: 'STATE', code: 'STATE_REPORTER', name: 'State Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF', name: 'District Bureau Chief' },
      { level: 'DISTRICT', code: 'SENIOR_CORRESPONDENT', name: 'Senior Correspondent' },
      { level: 'DISTRICT', code: 'DISTRICT_REPORTER', name: 'District Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_DESK', name: 'District Desk' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_INCHARGE', name: 'Assembly Incharge' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_REPORTER', name: 'Assembly Reporter' },
      { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter' },
      { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' },
    ];
    const ops = [] as any[];
    for (const d of defaults) {
      ops.push((prisma as any).reporterDesignation.upsert({
        where: { tenantId_code: { tenantId, code: d.code } },
        update: { name: d.name, level: d.level },
        create: { tenantId, level: d.level, code: d.code, name: d.name }
      }));
    }
    await (prisma as any).$transaction(ops);
    const list = await (prisma as any).reporterDesignation.findMany({ where: { tenantId }, orderBy: { level: 'asc' } });
    res.json({ seeded: list.length, items: list });
  } catch (e: any) {
    console.error('seed designations error', e);
    res.status(500).json({ error: 'Failed to seed designations' });
  }
});

export default router;

/**
 * @swagger
 * /reporters/register:
 *   post:
 *     summary: Register reporter (create user+reporter in one step)
 *     description: Creates a User (if mobile not existing) with role REPORTER (or provided roleName) and a Reporter profile. Allows skipping MPIN creation (mpin null) for later secure setup.
 *     tags: [Reporters]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, mobileNumber, languageId]
 *             properties:
 *               tenantId: { type: string }
 *               mobileNumber: { type: string }
 *               languageId: { type: string }
 *               roleName: { type: string, description: 'Override default reporter role (default REPORTER)' }
 *               designationCode: { type: string }
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer, description: 'Smallest currency unit (e.g. paise)' }
 *               idCardCharge: { type: integer, description: 'Smallest currency unit (e.g. paise)' }
 *               kycData: { type: object }
 *     responses:
 *       201: { description: Reporter registered }
 *       400: { description: Validation error }
 */
router.post('/register', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const body = req.body || {};
    const { tenantId, mobileNumber, languageId } = body;
    if (!tenantId || !mobileNumber || !languageId) return res.status(400).json({ error: 'tenantId, mobileNumber, languageId required' });
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });

    let user = await findUserByMobileNumber(mobileNumber);
    if (!user) {
      const roleName = body.roleName || 'REPORTER';
      const role = await (prisma as any).role.findUnique({ where: { name: roleName } });
      if (!role) return res.status(400).json({ error: 'Invalid roleName' });
      user = await createUser({ mobileNumber, languageId, roleId: role.id, skipMpinDefault: true, status: 'ACTIVE' });
    }
    if (!user) return res.status(500).json({ error: 'Failed to create user' });

    let designationId = body.designationId || null;
    if (!designationId && body.designationCode) {
      const dTenant = await (prisma as any).reporterDesignation.findFirst({ where: { tenantId, code: body.designationCode } });
      const dGlobal = !dTenant ? await (prisma as any).reporterDesignation.findFirst({ where: { tenantId: null, code: body.designationCode } }) : null;
      designationId = (dTenant || dGlobal)?.id || null;
      if (!designationId) return res.status(400).json({ error: 'Unknown designationCode' });
    }

    const level = body.level || null;

    const reporterData: any = {
      tenantId,
      userId: user.id,
      designationId,
      level,
      stateId: body.stateId || null,
      districtId: body.districtId || null,
      mandalId: body.mandalId || null,
      assemblyConstituencyId: body.assemblyConstituencyId || null,
      subscriptionActive: !!body.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
      kycData: body.kycData || null
    };

    if (reporterData.level === 'STATE' && !reporterData.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (reporterData.level === 'DISTRICT' && !reporterData.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (reporterData.level === 'MANDAL' && !reporterData.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (reporterData.level === 'ASSEMBLY' && !reporterData.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });

    const reporter = await (prisma as any).reporter.create({ data: reporterData, include: { designation: true } });
    res.status(201).json({ reporter, user });
  } catch (e: any) {
    console.error('register reporter error', e);
    res.status(500).json({ error: 'Failed to register reporter' });
  }
});
