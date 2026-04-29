// src/api/journalist/president.routes.ts
// President / Union Admin Dashboard APIs
// Auth: SUPER_ADMIN OR JournalistUnionAdmin record
// Mounts at: /journalist/president

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import multer from 'multer';
import prisma from '../../lib/prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from '../../lib/bunnyStorage';
import { putPublicObject } from '../../lib/objectStorage';

const p: any = prisma;
const router = Router();
const jwtAuth = passport.authenticate('jwt', { session: false });

// Multer for insurance card uploads (images + PDF)
const uploadInsuranceCard = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
});

function currentUser(req: Request): { id: string; role: { name: string } } {
  return (req as any).user;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────
// Allows SUPER_ADMIN or any JournalistUnionAdmin. Populates res.locals.unionScope.
async function requireUnionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = currentUser(req);
    const role = user?.role?.name;
    if (role === 'SUPER_ADMIN') {
      res.locals.unionScope = null; // no restriction
      return next();
    }
    const unionAdmin = await p.journalistUnionAdmin.findFirst({
      where: { userId: user.id },
      select: { unionName: true, state: true },
    });
    if (!unionAdmin) {
      return res.status(403).json({ error: 'Forbidden: no journalist union admin assignment' });
    }
    res.locals.unionScope = { unionName: unionAdmin.unionName, state: unionAdmin.state };
    return next();
  } catch {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

// Build Prisma where clause from scope + any additional filters
function buildMemberWhere(
  req: Request,
  res: Response,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const scope: { unionName?: string; state?: string } | null = res.locals.unionScope;
  const where: Record<string, unknown> = {};
  if (scope?.unionName) where.unionName = scope.unionName;
  if (scope?.state) where.state = scope.state;
  return { ...where, ...extra };
}

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/dashboard:
 *   get:
 *     summary: President / Union Admin Dashboard Stats
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard statistics
 */
router.get('/dashboard', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const baseWhere = buildMemberWhere(req, res);

    // --- Core counts ---
    const [total, approved, kycVerified, pendingApplications] = await Promise.all([
      p.journalistProfile.count({ where: baseWhere }),
      p.journalistProfile.count({ where: { ...baseWhere, approved: true } }),
      p.journalistProfile.count({ where: { ...baseWhere, kycVerified: true } }),
      p.journalistProfile.count({ where: { ...baseWhere, approved: false, rejectedAt: null } }),
    ]);
    const rejected = await p.journalistProfile.count({ where: { ...baseWhere, rejectedAt: { not: null } } });

    // --- State-wise breakdown ---
    const [allByState, approvedByState] = await Promise.all([
      p.journalistProfile.groupBy({ by: ['state'], where: baseWhere, _count: { _all: true }, orderBy: { _count: { state: 'desc' } } }),
      p.journalistProfile.groupBy({ by: ['state'], where: { ...baseWhere, approved: true }, _count: { _all: true } }),
    ]);
    const approvedStateMap: Record<string, number> = {};
    for (const r of approvedByState) approvedStateMap[r.state ?? ''] = r._count._all;
    const stateWise = allByState.map((r: any) => ({
      state: r.state ?? '—',
      total: r._count._all,
      approved: approvedStateMap[r.state ?? ''] ?? 0,
      pending: (r._count._all) - (approvedStateMap[r.state ?? ''] ?? 0),
    }));

    // --- District-wise breakdown ---
    const districtStats = await p.journalistProfile.groupBy({
      by: ['district'],
      where: { ...baseWhere },
      _count: { _all: true },
      orderBy: { _count: { district: 'desc' } },
    });
    const districtWise = districtStats.map((r: any) => ({ district: r.district ?? '—', total: r._count._all }));

    // --- Mandal-wise breakdown ---
    const mandalStats = await p.journalistProfile.groupBy({
      by: ['mandal'],
      where: { ...baseWhere, mandal: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { mandal: 'desc' } },
    });
    const mandalWise = mandalStats.map((r: any) => ({ mandal: r.mandal ?? '—', total: r._count._all }));

    // --- Post holders counts by level ---
    const scope: { unionName?: string } | null = res.locals.unionScope;
    const postWhere: Record<string, unknown> = { isActive: true };
    if (scope?.unionName) postWhere.unionName = scope.unionName;
    const postStats = await p.journalistUnionPostHolder.groupBy({
      by: ['postId'],
      where: postWhere,
      _count: { _all: true },
    });
    const postIds = postStats.map((r: any) => r.postId);
    const postDefs = postIds.length
      ? await p.journalistUnionPostDefinition.findMany({ where: { id: { in: postIds } }, select: { id: true, title: true, level: true } })
      : [];
    const postDefMap: Record<string, { title: string; level: string }> = {};
    for (const d of postDefs) postDefMap[d.id] = { title: d.title, level: d.level };
    const postsByLevel: Record<string, { count: number; posts: { title: string; count: number }[] }> = {};
    for (const r of postStats) {
      const def = postDefMap[r.postId];
      const level = def?.level ?? 'UNKNOWN';
      if (!postsByLevel[level]) postsByLevel[level] = { count: 0, posts: [] };
      postsByLevel[level].count += r._count._all;
      postsByLevel[level].posts.push({ title: def?.title ?? r.postId, count: r._count._all });
    }

    // --- Insurance counts ---
    const now = new Date();
    const insWhere: Record<string, unknown> = {};
    if (scope?.unionName) {
      // Insurance doesn't have unionName directly; filter via profile
      insWhere.profile = { unionName: scope.unionName };
    }
    const [activeInsurance, expiredInsurance] = await Promise.all([
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { gte: now } } }),
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { lt: now } } }),
    ]);

    return res.json({
      summary: { total, approved, pending: pendingApplications, rejected, kycVerified },
      stateWise,
      districtWise,
      mandalWise,
      postsByLevel,
      insurance: { active: activeInsurance, expired: expiredInsurance },
    });
  } catch (e: any) {
    console.error('[president/dashboard]', e);
    return res.status(500).json({ error: 'Dashboard query failed', details: e.message });
  }
});

// ─── 2. Members List (paginated + filtered) ───────────────────────────────────
/**
 * @swagger
 * /journalist/president/members:
 *   get:
 *     summary: List journalist members (admin view)
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *       - in: query
 *         name: mandal
 *         schema: { type: string }
 *       - in: query
 *         name: approved
 *         schema: { type: boolean }
 *       - in: query
 *         name: kycVerified
 *         schema: { type: boolean }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of members
 */
router.get('/members', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1'));
    const limit = Math.min(100, Math.max(1, parseInt(q.limit ?? '20')));
    const skip = (page - 1) * limit;

    const extra: Record<string, unknown> = {};
    if (q.state) extra.state = q.state;
    if (q.district) extra.district = q.district;
    if (q.mandal) extra.mandal = q.mandal;
    if (q.approved !== undefined) extra.approved = q.approved === 'true';
    if (q.kycVerified !== undefined) extra.kycVerified = q.kycVerified === 'true';
    if (q.search) {
      extra.OR = [
        { organization: { contains: q.search, mode: 'insensitive' } },
        { designation: { contains: q.search, mode: 'insensitive' } },
        { district: { contains: q.search, mode: 'insensitive' } },
        { user: { name: { contains: q.search, mode: 'insensitive' } } },
        { pressId: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    const where = buildMemberWhere(req, res, extra);
    const [items, total] = await Promise.all([
      p.journalistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          pressId: true,
          designation: true,
          district: true,
          state: true,
          mandal: true,
          organization: true,
          unionName: true,
          approved: true,
          approvedAt: true,
          rejectedAt: true,
          kycVerified: true,
          kycVerifiedAt: true,
          photoUrl: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, name: true, mobileNumber: true, email: true } },
          card: { select: { id: true, cardNumber: true, status: true, expiryDate: true, issuedAt: true } },
        },
      }),
      p.journalistProfile.count({ where }),
    ]);

    return res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e: any) {
    console.error('[president/members]', e);
    return res.status(500).json({ error: 'Failed to fetch members', details: e.message });
  }
});

// ─── 3. Single Member Full Details ───────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}:
 *   get:
 *     summary: Full details of a journalist member
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Full member profile with card, insurance, and post holdings
 */
router.get('/members/:id', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const profile = await p.journalistProfile.findFirst({
      where,
      include: {
        user: { select: { id: true, name: true, mobileNumber: true, email: true, createdAt: true } },
        card: true,
        insurances: { orderBy: { createdAt: 'desc' } },
        postHoldings: {
          where: { isActive: true },
          include: {
            post: { select: { title: true, nativeTitle: true, level: true, type: true } },
          },
        },
      },
    });

    if (!profile) return res.status(404).json({ error: 'Member not found' });

    // membershipId = pressId (if set) or cardNumber
    const membershipId = profile.pressId ?? profile.card?.cardNumber ?? null;
    return res.json({ ...profile, membershipId });
  } catch (e: any) {
    console.error('[president/members/:id]', e);
    return res.status(500).json({ error: 'Failed to fetch member', details: e.message });
  }
});

// ─── 4. Update Member Profile ────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}:
 *   put:
 *     summary: Update a journalist member's profile
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
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
 *               designation: { type: string }
 *               district: { type: string }
 *               state: { type: string }
 *               mandal: { type: string }
 *               organization: { type: string }
 *               currentNewspaper: { type: string }
 *               currentDesignation: { type: string }
 *               joiningDate: { type: string, format: date-time }
 *               totalExperienceYears: { type: number }
 *               additionalInfo: { type: string }
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.put('/members/:id', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const exists = await p.journalistProfile.findFirst({ where, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Member not found' });

    const {
      designation, district, state, mandal, organization,
      currentNewspaper, currentDesignation, joiningDate,
      totalExperienceYears, additionalInfo,
    } = req.body;

    const data: Record<string, unknown> = {};
    if (designation !== undefined) data.designation = designation;
    if (district !== undefined) data.district = district;
    if (state !== undefined) data.state = state;
    if (mandal !== undefined) data.mandal = mandal;
    if (organization !== undefined) data.organization = organization;
    if (currentNewspaper !== undefined) data.currentNewspaper = currentNewspaper;
    if (currentDesignation !== undefined) data.currentDesignation = currentDesignation;
    if (joiningDate !== undefined) data.joiningDate = new Date(joiningDate);
    if (totalExperienceYears !== undefined) data.totalExperienceYears = Number(totalExperienceYears);
    if (additionalInfo !== undefined) data.additionalInfo = additionalInfo;

    const updated = await p.journalistProfile.update({ where: { id }, data });
    return res.json(updated);
  } catch (e: any) {
    console.error('[president/members/:id PUT]', e);
    return res.status(500).json({ error: 'Update failed', details: e.message });
  }
});

// ─── 5. KYC Approve / Reject ─────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}/kyc:
 *   patch:
 *     summary: Approve or reject a member's KYC
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
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
 *             required: [approved]
 *             properties:
 *               approved: { type: boolean }
 *               kycNote: { type: string }
 *               approveApplication: { type: boolean, description: "Also mark application as approved" }
 *     responses:
 *       200:
 *         description: Updated profile
 */
router.patch('/members/:id/kyc', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const exists = await p.journalistProfile.findFirst({ where, select: { id: true } });
    if (!exists) return res.status(404).json({ error: 'Member not found' });

    const { approved, kycNote, approveApplication } = req.body;
    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: '"approved" (boolean) is required' });
    }

    const now = new Date();
    const data: Record<string, unknown> = {
      kycVerified: approved,
      kycVerifiedAt: approved ? now : null,
      kycNote: kycNote ?? null,
    };

    if (approveApplication === true) {
      data.approved = true;
      data.approvedAt = now;
      data.rejectedAt = null;
    }

    const updated = await p.journalistProfile.update({ where: { id }, data });
    return res.json(updated);
  } catch (e: any) {
    console.error('[president/members/:id/kyc]', e);
    return res.status(500).json({ error: 'KYC update failed', details: e.message });
  }
});

// ─── 6. List Member Insurances ────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}/insurance:
 *   get:
 *     summary: Get all insurance records for a member
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of insurance records
 */
router.get('/members/:id/insurance', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const profile = await p.journalistProfile.findFirst({ where, select: { id: true } });
    if (!profile) return res.status(404).json({ error: 'Member not found' });

    const insurances = await p.journalistInsurance.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(insurances);
  } catch (e: any) {
    console.error('[president/members/:id/insurance GET]', e);
    return res.status(500).json({ error: 'Failed to fetch insurance records', details: e.message });
  }
});

// ─── 7. Add Insurance to Member ───────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}/insurance:
 *   post:
 *     summary: Add an insurance policy to a member
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
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
 *             required: [type, policyNumber, insurer, validFrom, validTo]
 *             properties:
 *               type: { type: string, enum: [ACCIDENTAL, HEALTH] }
 *               policyNumber: { type: string }
 *               insurer: { type: string }
 *               coverAmount: { type: integer }
 *               premium: { type: integer }
 *               validFrom: { type: string, format: date-time }
 *               validTo: { type: string, format: date-time }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Insurance record created
 */
router.post('/members/:id/insurance', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const profile = await p.journalistProfile.findFirst({ where, select: { id: true } });
    if (!profile) return res.status(404).json({ error: 'Member not found' });

    const { type, policyNumber, insurer, coverAmount, premium, validFrom, validTo, notes } = req.body;
    if (!type || !policyNumber || !insurer || !validFrom || !validTo) {
      return res.status(400).json({ error: 'type, policyNumber, insurer, validFrom, validTo are required' });
    }
    if (!['ACCIDENTAL', 'HEALTH'].includes(type)) {
      return res.status(400).json({ error: 'type must be ACCIDENTAL or HEALTH' });
    }

    const user = currentUser(req);
    const insurance = await p.journalistInsurance.create({
      data: {
        profileId: profile.id,
        type,
        policyNumber,
        insurer,
        coverAmount: coverAmount ? parseInt(coverAmount) : null,
        premium: premium ? parseInt(premium) : null,
        validFrom: new Date(validFrom),
        validTo: new Date(validTo),
        notes: notes ?? null,
        assignedById: user.id,
        isActive: true,
      },
    });
    return res.status(201).json(insurance);
  } catch (e: any) {
    console.error('[president/members/:id/insurance POST]', e);
    return res.status(500).json({ error: 'Failed to create insurance record', details: e.message });
  }
});

// ─── 8. Update Insurance ─────────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}/insurance/{insId}:
 *   patch:
 *     summary: Update an insurance record
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: insId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               policyNumber: { type: string }
 *               insurer: { type: string }
 *               coverAmount: { type: integer }
 *               premium: { type: integer }
 *               validFrom: { type: string, format: date-time }
 *               validTo: { type: string, format: date-time }
 *               isActive: { type: boolean }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Updated insurance record
 */
router.patch('/members/:id/insurance/:insId', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { id, insId } = req.params;
    const where = buildMemberWhere(req, res, { id });

    const profile = await p.journalistProfile.findFirst({ where, select: { id: true } });
    if (!profile) return res.status(404).json({ error: 'Member not found' });

    const existing = await p.journalistInsurance.findFirst({
      where: { id: insId, profileId: profile.id },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Insurance record not found' });

    const { policyNumber, insurer, coverAmount, premium, validFrom, validTo, isActive, notes } = req.body;
    const data: Record<string, unknown> = {};
    if (policyNumber !== undefined) data.policyNumber = policyNumber;
    if (insurer !== undefined) data.insurer = insurer;
    if (coverAmount !== undefined) data.coverAmount = coverAmount ? parseInt(coverAmount) : null;
    if (premium !== undefined) data.premium = premium ? parseInt(premium) : null;
    if (validFrom !== undefined) data.validFrom = new Date(validFrom);
    if (validTo !== undefined) data.validTo = new Date(validTo);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (notes !== undefined) data.notes = notes;

    const updated = await p.journalistInsurance.update({ where: { id: insId }, data });
    return res.json(updated);
  } catch (e: any) {
    console.error('[president/members/:id/insurance/:insId PATCH]', e);
    return res.status(500).json({ error: 'Update failed', details: e.message });
  }
});

// ─── 9. Upload Insurance Card Image ──────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/{id}/insurance/{insId}/card:
 *   post:
 *     summary: Upload insurance card / policy document image
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: insId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               insuranceCard:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Card uploaded, insuranceCardUrl updated
 */
router.post(
  '/members/:id/insurance/:insId/card',
  jwtAuth,
  requireUnionAdmin,
  uploadInsuranceCard.single('insuranceCard'),
  async (req, res) => {
    try {
      const { id, insId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'insuranceCard file is required (multipart/form-data)' });

      const where = buildMemberWhere(req, res, { id });
      const profile = await p.journalistProfile.findFirst({ where, select: { id: true } });
      if (!profile) return res.status(404).json({ error: 'Member not found' });

      const existing = await p.journalistInsurance.findFirst({
        where: { id: insId, profileId: profile.id },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ error: 'Insurance record not found' });

      const ext = file.mimetype === 'application/pdf' ? 'pdf' : file.mimetype.split('/')[1] ?? 'jpg';
      const key = `journalist-union/insurance-cards/${profile.id}/${insId}-${Date.now()}.${ext}`;

      let publicUrl: string;
      if (isBunnyStorageConfigured()) {
        const result = await bunnyStoragePutObject({ key, body: file.buffer, contentType: file.mimetype });
        publicUrl = result.publicUrl;
      } else {
        const result = await putPublicObject({ key, body: file.buffer, contentType: file.mimetype });
        publicUrl = result.publicUrl;
      }

      const updated = await p.journalistInsurance.update({
        where: { id: insId },
        data: { insuranceCardUrl: publicUrl },
      });
      return res.json({ insuranceCardUrl: publicUrl, insurance: updated });
    } catch (e: any) {
      console.error('[president/members/:id/insurance/:insId/card]', e);
      return res.status(500).json({ error: 'Upload failed', details: e.message });
    }
  },
);

// ─── 10. State-wise Member List ───────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/state/{state}/members:
 *   get:
 *     summary: Get all members in a specific state
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: state
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200:
 *         description: Paginated members for the state
 */
router.get('/state/:state/members', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const { state } = req.params;
    const q = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(q.page ?? '1'));
    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50')));
    const skip = (page - 1) * limit;

    const where = buildMemberWhere(req, res, { state });
    const [items, total] = await Promise.all([
      p.journalistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ district: 'asc' }, { mandal: 'asc' }],
        select: {
          id: true,
          pressId: true,
          designation: true,
          district: true,
          mandal: true,
          organization: true,
          approved: true,
          kycVerified: true,
          photoUrl: true,
          user: { select: { id: true, name: true, mobileNumber: true } },
          card: { select: { cardNumber: true, status: true, expiryDate: true } },
        },
      }),
      p.journalistProfile.count({ where }),
    ]);

    return res.json({ state, items, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e: any) {
    console.error('[president/state/:state/members]', e);
    return res.status(500).json({ error: 'Failed to fetch state members', details: e.message });
  }
});

// ─── 11. Post Holders List ────────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/post-holders:
 *   get:
 *     summary: List active post holders with their profiles
 *     tags: [Journalist President]
 *     security: [{ BearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, MANDAL, CITY, SPECIAL_WING] }
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of active post holders
 */
router.get('/post-holders', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string>;
    const scope: { unionName?: string } | null = res.locals.unionScope;

    const postWhere: Record<string, unknown> = { isActive: true };
    if (scope?.unionName) postWhere.unionName = scope.unionName;
    if (q.state) postWhere.stateId = q.state;
    if (q.district) postWhere.districtId = q.district;
    if (q.level) postWhere.post = { level: q.level };

    const holders = await p.journalistUnionPostHolder.findMany({
      where: postWhere,
      orderBy: [{ post: { level: 'asc' } }, { post: { sortOrder: 'asc' } }],
      include: {
        post: { select: { title: true, nativeTitle: true, level: true, type: true, sortOrder: true } },
        profile: {
          select: {
            id: true,
            pressId: true,
            designation: true,
            district: true,
            state: true,
            mandal: true,
            photoUrl: true,
            user: { select: { id: true, name: true, mobileNumber: true } },
          },
        },
      },
    });

    return res.json(holders);
  } catch (e: any) {
    console.error('[president/post-holders]', e);
    return res.status(500).json({ error: 'Failed to fetch post holders', details: e.message });
  }
});

export default router;
