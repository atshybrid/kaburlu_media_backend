import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcrypt';

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

// POST /tenants/:tenantId/reporters - upsert user/profile and create reporter
/**
 * @swagger
 * /tenants/{tenantId}/reporters:
 *   post:
 *     summary: Create tenant reporter (creates/links User + UserProfile)
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [designationId, level, fullName, mobileNumber]
 *             properties:
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer, description: 'Smallest currency unit' }
 *               idCardCharge: { type: integer, description: 'Smallest currency unit' }
 *               fullName: { type: string }
 *               mobileNumber: { type: string }
 *           examples:
 *             stateReporter:
 *               summary: STATE level reporter
 *               value:
 *                 designationId: cmit7cpar0001ugkojh66y6ww
 *                 level: STATE
 *                 stateId: cmit7pjf30001ugaov86j0ed5
 *                 subscriptionActive: false
 *                 monthlySubscriptionAmount: 0
 *                 idCardCharge: 0
 *                 fullName: Nishchay Reddy
 *                 mobileNumber: '9502337778'
 *             districtReporter:
 *               summary: DISTRICT level reporter
 *               value:
 *                 designationId: cmit7cpar0001ugkojh66y6ww
 *                 level: DISTRICT
 *                 districtId: cmit7pjf30001ugaov86j0abc
 *                 fullName: District Reporter
 *                 mobileNumber: '9502000000'
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 tenantId: { type: string }
 *                 designationId: { type: string }
 *                 level: { type: string }
 *                 stateId: { type: string, nullable: true }
 *                 districtId: { type: string, nullable: true }
 *                 mandalId: { type: string, nullable: true }
 *                 assemblyConstituencyId: { type: string, nullable: true }
 *                 subscriptionActive: { type: boolean }
 *                 monthlySubscriptionAmount: { type: integer, nullable: true }
 *                 idCardCharge: { type: integer, nullable: true }
 *                 fullName: { type: string, nullable: true }
 *                 mobileNumber: { type: string, nullable: true }
 *       400: { description: Validation error }
 */
router.post('/tenants/:tenantId/reporters', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};
    const { designationId, level, stateId, districtId, mandalId, assemblyConstituencyId } = body;
    const fullName: string | undefined = body.fullName;
    const mobileNumber: string | undefined = body.mobileNumber;
    if (!designationId || !level) return res.status(400).json({ error: 'designationId and level required' });
    if (!mobileNumber || !fullName) return res.status(400).json({ error: 'mobileNumber and fullName required' });

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });

    const languageTe = await prisma.language.findFirst({ where: { code: 'te' } });
    if (!languageTe) return res.status(500).json({ error: 'Language te not seeded' });

    // Resolve role strictly as REPORTER for tenant reporters
    const reporterRoleOverride = process.env.DEFAULT_TENANT_REPORTER_ROLE_ID;
    let role = reporterRoleOverride
      ? await prisma.role.findUnique({ where: { id: String(reporterRoleOverride) } })
      : await prisma.role.findFirst({ where: { name: 'REPORTER' } });
    if (!role) return res.status(500).json({ error: 'REPORTER role missing. Seed roles.' });

    const normalizedMobile = String(mobileNumber).trim();
    let user = await prisma.user.findFirst({ where: { mobileNumber: normalizedMobile } });
    if (!user) {
      const mpinHash = await bcrypt.hash(normalizedMobile.slice(-4), 10);
      user = await prisma.user.create({
        data: {
          mobileNumber: normalizedMobile,
          mpin: mpinHash,
          roleId: role.id,
          languageId: languageTe.id,
          status: 'ACTIVE',
        },
      });
    } else if (user.roleId !== role.id) {
      user = await prisma.user.update({ where: { id: user.id }, data: { roleId: role.id } });
    }

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { fullName },
      create: { userId: user.id, fullName },
    });

    const data: any = {
      tenantId,
      designationId,
      level,
      stateId: stateId || null,
      districtId: districtId || null,
      mandalId: mandalId || null,
      assemblyConstituencyId: assemblyConstituencyId || null,
      subscriptionActive: !!body.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
      userId: user.id,
    };
    if (level === 'STATE' && !data.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (level === 'DISTRICT' && !data.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (level === 'MANDAL' && !data.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (level === 'ASSEMBLY' && !data.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });

    const created = await (prisma as any).reporter.create({ data, include: includeReporterContact });
    return res.status(201).json(mapReporterContact(created));
  } catch (e: any) {
    console.error('tenant reporter create error', e);
    return res.status(500).json({ error: 'Failed to create reporter' });
  }
});

export default router;
/**
 * @swagger
 * tags:
 *   - name: TenantReporters
 *     description: Tenant-scoped Reporter management
 */

/**
 * @swagger
 * /tenants/{tenantId}/reporters:
 *   get:
 *     summary: List tenant reporters
 *     tags: [TenantReporters]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
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
 *       200: { description: List of reporters }
 */
router.get('/tenants/:tenantId/reporters', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { level, stateId, districtId, mandalId, assemblyConstituencyId } = req.query as Record<string,string>;
    const activeRaw = req.query.active;
    const where: any = {};
    // If tenantId is the string 'null', list across tenants
    if (tenantId && tenantId !== 'null') where.tenantId = tenantId;
    if (level) where.level = level;
    if (stateId) where.stateId = stateId;
    if (districtId) where.districtId = districtId;
    if (mandalId) where.mandalId = mandalId;
    if (assemblyConstituencyId) where.assemblyConstituencyId = assemblyConstituencyId;
    if (typeof activeRaw !== 'undefined') where.active = String(activeRaw).toLowerCase() === 'true';
    const fetchList = async () => {
      return await (prisma as any).reporter.findMany({ where, orderBy: { createdAt: 'desc' }, include: {
        designation: true,
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
      } });
    };
    let list: any[] = [];
    try {
      list = await fetchList();
    } catch (err: any) {
      // Retry once after brief delay for transient Neon pooler hiccups
      if (String(err?.code) === 'P1001') {
        await new Promise((r) => setTimeout(r, 300));
        list = await fetchList();
      } else {
        throw err;
      }
    }
    const mapped = list.map((r: any) => {
      const fullName = r?.user?.profile?.fullName || null;
      const mobileNumber = r?.user?.mobileNumber || null;
      const { user, ...rest } = r;
      return { ...rest, fullName, mobileNumber };
    });
    res.json(mapped);
  } catch (e: any) {
    if (String(e?.code) === 'P1001') {
      return res.status(503).json({ error: 'Database temporarily unavailable', code: 'P1001' });
    }
    console.error('list tenant reporters error', e);
    res.status(500).json({ error: 'Failed to list reporters' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}:
 *   get:
 *     summary: Get tenant reporter by id
 *     tags: [TenantReporters]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Reporter }
 *       404: { description: Not found }
 */
router.get('/tenants/:tenantId/reporters/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const where: any = { id };
    if (tenantId && tenantId !== 'null') where.tenantId = tenantId;
    const r = await (prisma as any).reporter.findFirst({ where, include: {
      designation: true,
      user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
    } });
    if (!r) return res.status(404).json({ error: 'Reporter not found' });
    const fullName = r?.user?.profile?.fullName || null;
    const mobileNumber = r?.user?.mobileNumber || null;
    const { user, ...rest } = r;
    return res.json({ ...rest, fullName, mobileNumber });
  } catch (e: any) {
    if (String(e?.code) === 'P1001') return res.status(503).json({ error: 'Database temporarily unavailable', code: 'P1001' });
    console.error('get tenant reporter error', e);
    return res.status(500).json({ error: 'Failed to get reporter' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}:
 *   put:
 *     summary: Update tenant reporter
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
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
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *               profilePhotoUrl: { type: string }
 *               active: { type: boolean }
 *     responses:
 *       200: { description: Updated }
 */
router.put('/tenants/:tenantId/reporters/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/profile-photo:
 *   patch:
 *     summary: Set reporter profile photo URL
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
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
 *             required: [profilePhotoUrl]
 *             properties:
 *               profilePhotoUrl: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/profile-photo:
 *   delete:
 *     summary: Clear reporter profile photo URL
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Removed }
 */
router.delete('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   post:
 *     summary: Issue reporter ID card
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201: { description: Issued }
 */
router.post('/tenants/:tenantId/reporters/:id/id-card', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   get:
 *     summary: Get reporter ID card
 *     tags: [TenantReporters]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Card | null }
 */
router.get('/tenants/:tenantId/reporters/:id/id-card', async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/kyc:
 *   post:
 *     summary: Submit KYC documents
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
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
 *             required: [aadharNumberMasked, panNumberMasked]
 *             properties:
 *               aadharNumberMasked: { type: string }
 *               panNumberMasked: { type: string }
 *               workProofUrl: { type: string }
 *     responses:
 *       200: { description: KYC submitted }
 */
router.post('/tenants/:tenantId/reporters/:id/kyc', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/kyc/verify:
 *   patch:
 *     summary: Verify KYC (SUPER_ADMIN or TENANT_ADMIN)
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
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
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [APPROVED, REJECTED] }
 *               notes: { type: string }
 *               verifiedAadhar: { type: boolean }
 *               verifiedPan: { type: boolean }
 *               verifiedWorkProof: { type: boolean }
 *     responses:
 *       200: { description: KYC verified }
 */
router.patch('/tenants/:tenantId/reporters/:id/kyc/verify', passport.authenticate('jwt', { session: false }), async (req, res) => {
  res.status(501).json({ error: 'Not implemented in this build' });
});
