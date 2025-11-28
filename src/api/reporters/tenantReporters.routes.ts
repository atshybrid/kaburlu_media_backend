import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

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
 *   - name: TenantReporters
 *     description: Tenant-scoped Reporter management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TenantReporterBase:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         tenantId: { type: string }
 *         designationId: { type: string }
 *         level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *         stateId: { type: string, nullable: true }
 *         districtId: { type: string, nullable: true }
 *         mandalId: { type: string, nullable: true }
 *         assemblyConstituencyId: { type: string, nullable: true }
 *         subscriptionActive: { type: boolean }
 *         monthlySubscriptionAmount: { type: integer, nullable: true, description: 'Smallest currency unit' }
 *         idCardCharge: { type: integer, nullable: true, description: 'Smallest currency unit' }
 *         kycStatus: { type: string, enum: [PENDING, SUBMITTED, APPROVED, REJECTED] }
 *         kycData: { type: object, nullable: true }
 *         profilePhotoUrl: { type: string, nullable: true }
  *         fullName: { type: string, nullable: true, description: 'Derived from UserProfile.fullName' }
  *         mobileNumber: { type: string, nullable: true, description: 'Derived from User.mobileNumber' }
 *         active: { type: boolean }
 *         createdAt: { type: string, format: date-time }
 *         updatedAt: { type: string, format: date-time }
 *     TenantReporterCreate:
 *       type: object
 *       required: [designationId, level, fullName, mobileNumber, profilePhotoUrl]
 *       properties:
 *         designationId: { type: string }
 *         level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *         stateId: { type: string }
 *         districtId: { type: string }
 *         mandalId: { type: string }
 *         assemblyConstituencyId: { type: string }
 *         subscriptionActive: { type: boolean }
 *         monthlySubscriptionAmount: { type: integer }
 *         idCardCharge: { type: integer }
 *         profilePhotoUrl: { type: string }
 *         fullName: { type: string, description: 'Reporter full name (stored in UserProfile)' }
 *         mobileNumber: { type: string, description: 'Reporter mobile number (creates or links User)' }
 *     TenantReporterUpdate:
 *       type: object
 *       properties:
 *         designationId: { type: string }
 *         level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *         stateId: { type: string }
 *         districtId: { type: string }
 *         mandalId: { type: string }
 *         assemblyConstituencyId: { type: string }
 *         subscriptionActive: { type: boolean }
 *         monthlySubscriptionAmount: { type: integer }
 *         idCardCharge: { type: integer }
 *         profilePhotoUrl: { type: string }
 *         active: { type: boolean }
 *     ReporterKycSubmit:
 *       type: object
 *       required: [aadharNumberMasked, panNumberMasked]
 *       properties:
 *         aadharNumberMasked: { type: string, description: 'Mask sensitive digits e.g. ****1234' }
 *         panNumberMasked: { type: string }
 *         workProofUrl: { type: string, description: 'URL to last working paper / document' }
 *     ReporterKycVerify:
 *       type: object
 *       required: [status]
 *       properties:
 *         status: { type: string, enum: [APPROVED, REJECTED] }
 *         notes: { type: string }
 *         verifiedAadhar: { type: boolean }
 *         verifiedPan: { type: boolean }
 *         verifiedWorkProof: { type: boolean }
 *     ReporterIDCard:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         reporterId: { type: string }
 *         cardNumber: { type: string }
 *         issuedAt: { type: string, format: date-time }
 *         expiresAt: { type: string, format: date-time }
 *         pdfUrl: { type: string, nullable: true }
 */

/**
 * @swagger
 * /tenants/{tenantId}/reporters:
 *   get:
 *     summary: List tenant reporters (filter by geography/level/status)
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
 *       200: { description: List }
 */
router.get('/tenants/:tenantId/reporters', async (req, res) => {
  const { tenantId } = req.params;
  const { level, stateId, districtId, mandalId, assemblyConstituencyId } = req.query as Record<string,string>;
  const activeRaw = req.query.active;
  const where: any = { tenantId };
  if (level) where.level = level;
  if (stateId) where.stateId = stateId;
  if (districtId) where.districtId = districtId;
  if (mandalId) where.mandalId = mandalId;
  if (assemblyConstituencyId) where.assemblyConstituencyId = assemblyConstituencyId;
  if (typeof activeRaw !== 'undefined') where.active = String(activeRaw).toLowerCase() === 'true';
  const list = await (prisma as any).reporter.findMany({ where, orderBy: { createdAt: 'desc' }, include: includeReporterContact });
  res.json(list.map(mapReporterContact));
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters:
 *   post:
 *     summary: Create tenant reporter (atomic with User + UserProfile)
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
 *             $ref: '#/components/schemas/TenantReporterCreate'
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 */
router.post('/tenants/:tenantId/reporters', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};
    const { designationId, level, fullName, mobileNumber, profilePhotoUrl } = body;
    if (!designationId || !level || !fullName || !mobileNumber || !profilePhotoUrl) {
      return res.status(400).json({ error: 'designationId, level, fullName, mobileNumber, profilePhotoUrl required' });
    }
    // Validate tenant
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(400).json({ error: 'Invalid tenantId' });
    // Validate designation belongs to tenant or global
    const designation = await (prisma as any).reporterDesignation.findUnique({ where: { id: designationId } });
    if (!designation || (designation.tenantId && designation.tenantId !== tenantId)) {
      return res.status(400).json({ error: 'Invalid designationId for this tenant' });
    }
    const normalizedMobile = String(mobileNumber).trim();
    if (!/^[0-9]{7,15}$/.test(normalizedMobile)) return res.status(400).json({ error: 'Invalid mobileNumber format' });
    if (String(fullName).trim().length < 2) return res.status(400).json({ error: 'fullName too short' });
    const citizenReporterRole = await (prisma as any).role.findFirst({ where: { name: 'CITIZEN_REPORTER' } });
    if (!citizenReporterRole) return res.status(500).json({ error: 'CITIZEN_REPORTER role missing' });
    const defaultLanguage = await (prisma as any).language.findFirst({ where: { code: 'en' } }).catch(()=>null);
    const existingUser = await (prisma as any).user.findFirst({ where: { mobileNumber: normalizedMobile } });
    const result = await (prisma as any).$transaction(async (tx: any) => {
      let user = existingUser;
      if (!user) {
        user = await tx.user.create({ data: { mobileNumber: normalizedMobile, roleId: citizenReporterRole.id, languageId: defaultLanguage?.id || citizenReporterRole.id, status: 'ACTIVE' } });
      } else if (user.roleId !== citizenReporterRole.id) {
        user = await tx.user.update({ where: { id: user.id }, data: { roleId: citizenReporterRole.id } });
      }
      await tx.userProfile.upsert({ where: { userId: user.id }, update: { fullName, profilePhotoUrl }, create: { userId: user.id, fullName, profilePhotoUrl } });
      const data: any = {
        tenantId,
        designationId,
        level,
        stateId: body.stateId || null,
        districtId: body.districtId || null,
        mandalId: body.mandalId || null,
        assemblyConstituencyId: body.assemblyConstituencyId || null,
        subscriptionActive: !!body.subscriptionActive,
        monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : null,
        idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : null,
        profilePhotoUrl: profilePhotoUrl || null,
        userId: user.id
      };
      if (level === 'STATE' && !data.stateId) throw new Error('stateId required for STATE level');
      if (level === 'DISTRICT' && !data.districtId) throw new Error('districtId required for DISTRICT level');
      if (level === 'MANDAL' && !data.mandalId) throw new Error('mandalId required for MANDAL level');
      if (level === 'ASSEMBLY' && !data.assemblyConstituencyId) throw new Error('assemblyConstituencyId required for ASSEMBLY level');
      const reporter = await tx.reporter.create({ data, include: includeReporterContact });
      return reporter ? mapReporterContact(reporter) : reporter;
    });
    res.status(201).json(result);
  } catch (e: any) {
    console.error('create tenant reporter error', e);
    res.status(500).json({ error: 'Failed to create reporter' });
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
  const { tenantId, id } = req.params;
  const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId }, include: includeReporterContact });
  if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
  res.json(mapReporterContact(reporter));
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}:
 *   put:
 *     summary: Replace tenant reporter mutable fields
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
 *             $ref: '#/components/schemas/TenantReporterUpdate'
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/tenants/:tenantId/reporters/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const existing = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    const body = req.body || {};
    let designationId = body.designationId || existing.designationId;
    if (designationId) {
      const designation = await (prisma as any).reporterDesignation.findUnique({ where: { id: designationId } });
      if (!designation || (designation.tenantId && designation.tenantId !== tenantId)) return res.status(400).json({ error: 'Invalid designationId' });
    }
    const data: any = {
      designationId,
      level: body.level || existing.level,
      stateId: body.stateId ?? existing.stateId,
      districtId: body.districtId ?? existing.districtId,
      mandalId: body.mandalId ?? existing.mandalId,
      assemblyConstituencyId: body.assemblyConstituencyId ?? existing.assemblyConstituencyId,
      subscriptionActive: typeof body.subscriptionActive === 'boolean' ? body.subscriptionActive : existing.subscriptionActive,
      monthlySubscriptionAmount: typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : existing.monthlySubscriptionAmount,
      idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : existing.idCardCharge,
      profilePhotoUrl: body.profilePhotoUrl ?? existing.profilePhotoUrl,
      active: typeof body.active === 'boolean' ? body.active : existing.active
    };
    /**
     * @swagger
     * /tenants/{tenantId}/reporters/{id}/kyc:
     *   post:
     *     summary: Submit KYC documents (moves status to SUBMITTED)
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
     *             $ref: '#/components/schemas/ReporterKycSubmit'
     *     responses:
     *       200: { description: KYC submitted }
     *       400: { description: Validation error }
     *       404: { description: Not found }
     */
    router.post('/tenants/:tenantId/reporters/:id/kyc', passport.authenticate('jwt', { session: false }), async (req, res) => {
      try {
        const { tenantId, id } = req.params;
        const { aadharNumberMasked, panNumberMasked, workProofUrl } = req.body || {};
        if (!aadharNumberMasked || !panNumberMasked) return res.status(400).json({ error: 'aadharNumberMasked and panNumberMasked required' });
        const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
        if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
        if (reporter.kycStatus !== 'PENDING' && reporter.kycStatus !== 'REJECTED') {
          return res.status(400).json({ error: 'KYC already submitted or approved' });
        }
        const kycData = {
          documents: {
            aadharNumberMasked,
            panNumberMasked,
            workProofUrl: workProofUrl || null
          },
          submittedAt: new Date().toISOString()
        };
        const updated = await (prisma as any).reporter.update({ where: { id }, data: { kycStatus: 'SUBMITTED', kycData } });
        res.json(updated);
      } catch (e: any) {
        console.error('submit kyc error', e);
        res.status(500).json({ error: 'Failed to submit KYC' });
      }
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
     *             $ref: '#/components/schemas/ReporterKycVerify'
     *     responses:
     *       200: { description: KYC verified }
     *       400: { description: Validation error }
     *       403: { description: Forbidden }
     *       404: { description: Not found }
     */
    router.patch('/tenants/:tenantId/reporters/:id/kyc/verify', passport.authenticate('jwt', { session: false }), async (req, res) => {
      try {
        const { tenantId, id } = req.params;
        const { status, notes, verifiedAadhar, verifiedPan, verifiedWorkProof } = req.body || {};
        if (!status || !['APPROVED', 'REJECTED'].includes(status)) return res.status(400).json({ error: 'status must be APPROVED or REJECTED' });
        const principal: any = req.user;
        if (!principal || !['SUPER_ADMIN', 'TENANT_ADMIN'].includes(principal.role)) {
          return res.status(403).json({ error: 'Forbidden' });
        }
        const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
        if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
        if (reporter.kycStatus !== 'SUBMITTED') return res.status(400).json({ error: 'KYC must be SUBMITTED to verify' });
        const currentData = (reporter as any).kycData || {};
        const verification = {
          status,
          notes: notes || null,
          verifiedAadhar: !!verifiedAadhar,
          verifiedPan: !!verifiedPan,
          verifiedWorkProof: !!verifiedWorkProof,
          verifiedAt: new Date().toISOString(),
          verifiedByUserId: principal.userId || null
        };
        const newData = { ...currentData, verification };
        const updated = await (prisma as any).reporter.update({ where: { id }, data: { kycStatus: status, kycData: newData } });
        res.json(updated);
      } catch (e: any) {
        console.error('verify kyc error', e);
        res.status(500).json({ error: 'Failed to verify KYC' });
      }
    });
    // Revalidate location constraints
    if (data.level === 'STATE' && !data.stateId) return res.status(400).json({ error: 'stateId required for STATE level' });
    if (data.level === 'DISTRICT' && !data.districtId) return res.status(400).json({ error: 'districtId required for DISTRICT level' });
    if (data.level === 'MANDAL' && !data.mandalId) return res.status(400).json({ error: 'mandalId required for MANDAL level' });
    if (data.level === 'ASSEMBLY' && !data.assemblyConstituencyId) return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });
    const updated = await (prisma as any).reporter.update({ where: { id: existing.id }, data, include: includeReporterContact });
    res.json(mapReporterContact(updated));
  } catch (e: any) {
    console.error('update tenant reporter error', e);
    res.status(500).json({ error: 'Failed to update reporter' });
  }
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
 *       404: { description: Not found }
 */
router.patch('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const { profilePhotoUrl } = req.body || {};
    if (!profilePhotoUrl) return res.status(400).json({ error: 'profilePhotoUrl required' });
    const existing = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    const updated = await (prisma as any).reporter.update({ where: { id }, data: { profilePhotoUrl }, include: includeReporterContact });
    res.json(mapReporterContact(updated));
  } catch (e: any) {
    console.error('update reporter photo error', e);
    res.status(500).json({ error: 'Failed to update profile photo' });
  }
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
 *       404: { description: Not found }
 */
router.delete('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const existing = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
    if (!existing) return res.status(404).json({ error: 'Reporter not found' });
    const updated = await (prisma as any).reporter.update({ where: { id }, data: { profilePhotoUrl: null }, include: includeReporterContact });
    res.json({ success: true, reporter: mapReporterContact(updated) });
  } catch (e: any) {
    console.error('delete reporter photo error', e);
    res.status(500).json({ error: 'Failed to remove profile photo' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   post:
 *     summary: Issue reporter ID card (if subscriptionActive then PAID payment required)
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
 *       400: { description: Validation error }
 *       404: { description: Not found }
 */
router.post('/tenants/:tenantId/reporters/:id/id-card', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
    // If subscription is ACTIVE, require at least one PAID payment record
    if (reporter.subscriptionActive) {
      const hasPaid = await (prisma as any).reporterPayment.findFirst({
        where: { reporterId: reporter.id, status: 'PAID' }
      });
      if (!hasPaid) return res.status(400).json({ error: 'Payment required: active subscription must have PAID status' });
    }
    // Mandatory fields gating
    if (!reporter.profilePhotoUrl) return res.status(400).json({ error: 'profilePhotoUrl required before ID card issuance' });
    if (!reporter.userId) return res.status(400).json({ error: 'Linked user required before ID card issuance' });
    const user = await (prisma as any).user.findUnique({ where: { id: reporter.userId } });
    if (!user || !user.mobileNumber) return res.status(400).json({ error: 'User mobileNumber required before ID card issuance' });
    const profile = await (prisma as any).userProfile.findUnique({ where: { userId: user.id } });
    if (!profile || !profile.fullName) return res.status(400).json({ error: 'User fullName required before ID card issuance' });
    if (reporter.idCardCharge && reporter.idCardCharge > 0) {
      // Optionally verify payment present; skipped for now
    }
    // Prevent duplicate card
    const existingCard = await (prisma as any).reporterIDCard.findUnique({ where: { reporterId: reporter.id } });
    if (existingCard) return res.status(400).json({ error: 'ID card already issued' });
    const cardNumber = `RID-${tenantId.slice(0,6)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    const issuedAt = new Date();
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    const card = await (prisma as any).reporterIDCard.create({ data: { reporterId: reporter.id, cardNumber, issuedAt, expiresAt } });
    // Set pdfUrl to public PDF endpoint (print-ready two-page card size)
    const pdfUrl = `/api/v1/id-cards/pdf?reporterId=${reporter.id}&print=true`;
    const updatedCard = await (prisma as any).reporterIDCard.update({ where: { reporterId: reporter.id }, data: { pdfUrl } });
    res.status(201).json(updatedCard);
  } catch (e: any) {
    console.error('issue id card error', e);
    res.status(500).json({ error: 'Failed to issue ID card' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card:
 *   get:
 *     summary: Get reporter ID card (null if not issued)
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
 *       404: { description: Not found }
 */
router.get('/tenants/:tenantId/reporters/:id/id-card', async (req, res) => {
  const { tenantId, id } = req.params;
  const reporter = await (prisma as any).reporter.findFirst({ where: { id, tenantId } });
  if (!reporter) return res.status(404).json({ error: 'Reporter not found' });
  const card = await (prisma as any).reporterIDCard.findUnique({ where: { reporterId: reporter.id } });
  res.json(card || null);
});

export default router;
