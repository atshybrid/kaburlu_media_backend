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

// ─── Swagger component schemas (declared once, reused by all endpoints) ────────
/**
 * @swagger
 * components:
 *   schemas:
 *     PresidentDashboard:
 *       type: object
 *       properties:
 *         summary:
 *           type: object
 *           properties:
 *             total:       { type: integer, example: 312 }
 *             approved:    { type: integer, example: 289 }
 *             pending:     { type: integer, example: 18 }
 *             rejected:    { type: integer, example: 5 }
 *             kycVerified: { type: integer, example: 201 }
 *         stateWise:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               state:    { type: string,  example: "Telangana" }
 *               total:    { type: integer, example: 180 }
 *               approved: { type: integer, example: 165 }
 *               pending:  { type: integer, example: 15 }
 *         districtWise:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               district: { type: string,  example: "Hyderabad" }
 *               total:    { type: integer, example: 72 }
 *         mandalWise:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               mandal: { type: string,  example: "Secunderabad" }
 *               total:  { type: integer, example: 18 }
 *         postsByLevel:
 *           type: object
 *           additionalProperties:
 *             type: object
 *             properties:
 *               count: { type: integer, example: 5 }
 *               posts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title: { type: string,  example: "State President" }
 *                     count: { type: integer, example: 1 }
 *           example:
 *             STATE:
 *               count: 3
 *               posts:
 *                 - title: "State President"
 *                   count: 1
 *                 - title: "State Secretary"
 *                   count: 2
 *             DISTRICT:
 *               count: 22
 *               posts:
 *                 - title: "District President"
 *                   count: 22
 *         insurance:
 *           type: object
 *           properties:
 *             active:  { type: integer, example: 245 }
 *             expired: { type: integer, example: 44 }
 *     MemberSummary:
 *       type: object
 *       properties:
 *         id:           { type: string, example: "clx9abc001" }
 *         pressId:      { type: string, example: "TJ-2025-00142" }
 *         designation:  { type: string, example: "Reporter" }
 *         district:     { type: string, example: "Hyderabad" }
 *         state:        { type: string, example: "Telangana" }
 *         mandal:       { type: string, example: "Secunderabad" }
 *         organization: { type: string, example: "Eenadu" }
 *         unionName:    { type: string, example: "Telangana Journalists Union" }
 *         approved:     { type: boolean, example: true }
 *         approvedAt:   { type: string, format: date-time, example: "2025-01-15T10:00:00.000Z" }
 *         kycVerified:  { type: boolean, example: true }
 *         photoUrl:     { type: string, example: "https://cdn.example.com/journalist/photos/clx9abc001.jpg" }
 *         createdAt:    { type: string, format: date-time }
 *         user:
 *           type: object
 *           properties:
 *             id:           { type: string, example: "usr001" }
 *             name:         { type: string, example: "రాజు కుమార్" }
 *             mobileNumber: { type: string, example: "9876543210" }
 *             email:        { type: string, example: "raju@example.com" }
 *         card:
 *           type: object
 *           nullable: true
 *           properties:
 *             id:         { type: string, example: "card001" }
 *             cardNumber: { type: string, example: "TJU-2025-001420" }
 *             status:     { type: string, enum: [ACTIVE, EXPIRED], example: "ACTIVE" }
 *             expiryDate: { type: string, format: date-time, example: "2026-01-15T00:00:00.000Z" }
 *             issuedAt:   { type: string, format: date-time }
 *     InsuranceRecord:
 *       type: object
 *       properties:
 *         id:               { type: string, example: "ins001" }
 *         profileId:        { type: string, example: "clx9abc001" }
 *         type:             { type: string, enum: [ACCIDENTAL, HEALTH], example: "ACCIDENTAL" }
 *         policyNumber:     { type: string, example: "POL-2025-88421" }
 *         insurer:          { type: string, example: "LIC of India" }
 *         coverAmount:      { type: integer, example: 500000 }
 *         premium:          { type: integer, example: 2500 }
 *         validFrom:        { type: string, format: date-time, example: "2025-01-01T00:00:00.000Z" }
 *         validTo:          { type: string, format: date-time, example: "2026-01-01T00:00:00.000Z" }
 *         isActive:         { type: boolean, example: true }
 *         notes:            { type: string, example: "Group insurance via union" }
 *         insuranceCardUrl: { type: string, nullable: true, example: "https://cdn.example.com/journalist-union/insurance-cards/clx9abc001/ins001-1714200000.jpg" }
 *         assignedById:     { type: string, example: "usr_admin_01" }
 *         createdAt:        { type: string, format: date-time }
 *         updatedAt:        { type: string, format: date-time }
 *     PostHolder:
 *       type: object
 *       properties:
 *         id:            { type: string, example: "ph001" }
 *         unionName:     { type: string, example: "Telangana Journalists Union" }
 *         stateId:       { type: string, nullable: true, example: "Telangana" }
 *         districtId:    { type: string, nullable: true, example: "Hyderabad" }
 *         mandalId:      { type: string, nullable: true, example: null }
 *         termStartDate: { type: string, format: date-time, example: "2024-01-01T00:00:00.000Z" }
 *         termEndDate:   { type: string, format: date-time, nullable: true }
 *         isActive:      { type: boolean, example: true }
 *         post:
 *           type: object
 *           properties:
 *             title:       { type: string, example: "District President" }
 *             nativeTitle: { type: string, example: "జిల్లా అధ్యక్షుడు" }
 *             level:       { type: string, enum: [STATE, DISTRICT, MANDAL, CITY, SPECIAL_WING], example: "DISTRICT" }
 *             type:        { type: string, enum: [ELECTED, APPOINTED], example: "ELECTED" }
 *         profile:
 *           $ref: '#/components/schemas/MemberSummary'
 */

// ─── 1. Dashboard ─────────────────────────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/dashboard:
 *   get:
 *     summary: President / Union Admin — Dashboard Stats
 *     description: |
 *       Returns aggregate statistics for the union president or admin:
 *       - Total / approved / pending / rejected member counts
 *       - State-wise, district-wise, mandal-wise member breakdowns
 *       - Active post holders grouped by post level (STATE, DISTRICT, MANDAL …)
 *       - Active and expired insurance counts
 *
 *       **Scope**: Admin sees only their union. SUPER_ADMIN sees all unions.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PresidentDashboard'
 *             example:
 *               summary:
 *                 total: 312
 *                 approved: 289
 *                 pending: 18
 *                 rejected: 5
 *                 kycVerified: 201
 *               stateWise:
 *                 - state: "Telangana"
 *                   total: 180
 *                   approved: 165
 *                   pending: 15
 *                 - state: "Andhra Pradesh"
 *                   total: 132
 *                   approved: 124
 *                   pending: 8
 *               districtWise:
 *                 - district: "Hyderabad"
 *                   total: 72
 *                 - district: "Warangal"
 *                   total: 48
 *               mandalWise:
 *                 - mandal: "Secunderabad"
 *                   total: 18
 *                 - mandal: "Uppal"
 *                   total: 12
 *               postsByLevel:
 *                 STATE:
 *                   count: 3
 *                   posts:
 *                     - title: "State President"
 *                       count: 1
 *                     - title: "State Secretary"
 *                       count: 2
 *                 DISTRICT:
 *                   count: 22
 *                   posts:
 *                     - title: "District President"
 *                       count: 22
 *               insurance:
 *                 active: 245
 *                 expired: 44
 *       401:
 *         description: Unauthorized — missing or invalid JWT
 *       403:
 *         description: Forbidden — not a union admin
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
 *     summary: List journalist members (admin view, paginated)
 *     description: |
 *       Paginated list of journalist profiles visible to the calling union admin.
 *       Supports filtering by state, district, mandal, approval/KYC status, and free-text search.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *         example: "Telangana"
 *         description: Filter by state
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *         example: "Hyderabad"
 *         description: Filter by district
 *       - in: query
 *         name: mandal
 *         schema: { type: string }
 *         example: "Secunderabad"
 *         description: Filter by mandal
 *       - in: query
 *         name: approved
 *         schema: { type: boolean }
 *         example: true
 *         description: Filter by approval status
 *       - in: query
 *         name: kycVerified
 *         schema: { type: boolean }
 *         example: false
 *         description: Filter by KYC verification status
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         example: "రాజు"
 *         description: Search by name, pressId, designation, district, or organization
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated member list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MemberSummary'
 *                 total:      { type: integer, example: 312 }
 *                 page:       { type: integer, example: 1 }
 *                 limit:      { type: integer, example: 20 }
 *                 totalPages: { type: integer, example: 16 }
 *             example:
 *               items:
 *                 - id: "clx9abc001"
 *                   pressId: "TJ-2025-00142"
 *                   designation: "Reporter"
 *                   district: "Hyderabad"
 *                   state: "Telangana"
 *                   mandal: "Secunderabad"
 *                   organization: "Eenadu"
 *                   unionName: "Telangana Journalists Union"
 *                   approved: true
 *                   approvedAt: "2025-01-15T10:00:00.000Z"
 *                   kycVerified: true
 *                   photoUrl: "https://cdn.example.com/journalist/photos/clx9abc001.jpg"
 *                   createdAt: "2025-01-10T08:30:00.000Z"
 *                   user:
 *                     id: "usr001"
 *                     name: "రాజు కుమార్"
 *                     mobileNumber: "9876543210"
 *                     email: "raju@example.com"
 *                   card:
 *                     id: "card001"
 *                     cardNumber: "TJU-2025-001420"
 *                     status: "ACTIVE"
 *                     expiryDate: "2026-01-15T00:00:00.000Z"
 *                     issuedAt: "2025-01-15T10:00:00.000Z"
 *               total: 312
 *               page: 1
 *               limit: 20
 *               totalPages: 16
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
 *     description: |
 *       Returns the complete journalist profile including:
 *       - User contact details (name, mobile, email)
 *       - Press card status and PDF URL
 *       - All insurance records (active and inactive)
 *       - Active post holdings with post title and level
 *       - `membershipId` field (pressId if set, else cardNumber)
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *         description: JournalistProfile id
 *     responses:
 *       200:
 *         description: Full member profile
 *         content:
 *           application/json:
 *             example:
 *               id: "clx9abc001"
 *               pressId: "TJ-2025-00142"
 *               membershipId: "TJ-2025-00142"
 *               designation: "Reporter"
 *               district: "Hyderabad"
 *               state: "Telangana"
 *               mandal: "Secunderabad"
 *               organization: "Eenadu"
 *               unionName: "Telangana Journalists Union"
 *               approved: true
 *               approvedAt: "2025-01-15T10:00:00.000Z"
 *               kycVerified: true
 *               kycVerifiedAt: "2025-01-16T09:00:00.000Z"
 *               kycNote: "Documents verified in person"
 *               photoUrl: "https://cdn.example.com/journalist/photos/clx9abc001.jpg"
 *               aadhaarNumber: "XXXX-XXXX-4321"
 *               nomineeName: "లక్ష్మి కుమార్"
 *               currentNewspaper: "Eenadu Hyderabad"
 *               currentDesignation: "Senior Reporter"
 *               joiningDate: "2010-06-01T00:00:00.000Z"
 *               totalExperienceYears: 14
 *               user:
 *                 id: "usr001"
 *                 name: "రాజు కుమార్"
 *                 mobileNumber: "9876543210"
 *                 email: "raju@example.com"
 *                 createdAt: "2025-01-10T07:00:00.000Z"
 *               card:
 *                 id: "card001"
 *                 cardNumber: "TJU-2025-001420"
 *                 issuedAt: "2025-01-15T10:00:00.000Z"
 *                 expiryDate: "2026-01-15T00:00:00.000Z"
 *                 renewalCount: 0
 *                 pendingRenewal: false
 *                 qrCode: "https://api.kaburlu.com/journalist/verify/TJU-2025-001420"
 *                 pdfUrl: "https://cdn.example.com/journalist-union/cards/TJU-2025-001420.pdf"
 *                 status: "ACTIVE"
 *               insurances:
 *                 - id: "ins001"
 *                   type: "ACCIDENTAL"
 *                   policyNumber: "POL-2025-88421"
 *                   insurer: "LIC of India"
 *                   coverAmount: 500000
 *                   premium: 2500
 *                   validFrom: "2025-01-01T00:00:00.000Z"
 *                   validTo: "2026-01-01T00:00:00.000Z"
 *                   isActive: true
 *                   insuranceCardUrl: "https://cdn.example.com/journalist-union/insurance-cards/clx9abc001/ins001.jpg"
 *                   notes: "Group insurance via union"
 *               postHoldings:
 *                 - id: "ph001"
 *                   stateId: "Telangana"
 *                   districtId: "Hyderabad"
 *                   isActive: true
 *                   termStartDate: "2024-01-01T00:00:00.000Z"
 *                   post:
 *                     title: "District President"
 *                     nativeTitle: "జిల్లా అధ్యక్షుడు"
 *                     level: "DISTRICT"
 *                     type: "ELECTED"
 *       404:
 *         description: Member not found
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
 *     description: Admin can update editable fields. All body fields are optional — only provided fields are updated.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               designation:          { type: string, example: "Senior Reporter" }
 *               district:             { type: string, example: "Hyderabad" }
 *               state:                { type: string, example: "Telangana" }
 *               mandal:               { type: string, example: "Secunderabad" }
 *               organization:         { type: string, example: "Eenadu" }
 *               currentNewspaper:     { type: string, example: "Eenadu Hyderabad" }
 *               currentDesignation:   { type: string, example: "Chief Reporter" }
 *               joiningDate:          { type: string, format: date-time, example: "2010-06-01T00:00:00.000Z" }
 *               totalExperienceYears: { type: number, example: 15 }
 *               additionalInfo:       { type: string, example: "Specializes in political coverage" }
 *           example:
 *             designation: "Chief Reporter"
 *             currentNewspaper: "Eenadu Hyderabad"
 *             totalExperienceYears: 15
 *     responses:
 *       200:
 *         description: Updated profile
 *         content:
 *           application/json:
 *             example:
 *               id: "clx9abc001"
 *               designation: "Chief Reporter"
 *               district: "Hyderabad"
 *               organization: "Eenadu"
 *               currentNewspaper: "Eenadu Hyderabad"
 *               totalExperienceYears: 15
 *               updatedAt: "2026-04-29T12:00:00.000Z"
 *       404:
 *         description: Member not found
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
 *     description: |
 *       Sets `kycVerified` and optionally also marks the full application as `approved`.
 *       Pass `approveApplication: true` to approve both KYC and the membership in one call.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approved]
 *             properties:
 *               approved:           { type: boolean, example: true }
 *               kycNote:            { type: string,  example: "Aadhaar and PAN verified in person" }
 *               approveApplication: { type: boolean, example: false, description: "Also approve the membership application" }
 *           example:
 *             approved: true
 *             kycNote: "Aadhaar and PAN verified in person"
 *             approveApplication: true
 *     responses:
 *       200:
 *         description: Updated profile
 *         content:
 *           application/json:
 *             example:
 *               id: "clx9abc001"
 *               kycVerified: true
 *               kycVerifiedAt: "2026-04-29T10:30:00.000Z"
 *               kycNote: "Aadhaar and PAN verified in person"
 *               approved: true
 *               approvedAt: "2026-04-29T10:30:00.000Z"
 *       400:
 *         description: Missing required field `approved`
 *       404:
 *         description: Member not found
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
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *     responses:
 *       200:
 *         description: List of insurance records
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/InsuranceRecord'
 *             example:
 *               - id: "ins001"
 *                 profileId: "clx9abc001"
 *                 type: "ACCIDENTAL"
 *                 policyNumber: "POL-2025-88421"
 *                 insurer: "LIC of India"
 *                 coverAmount: 500000
 *                 premium: 2500
 *                 validFrom: "2025-01-01T00:00:00.000Z"
 *                 validTo: "2026-01-01T00:00:00.000Z"
 *                 isActive: true
 *                 insuranceCardUrl: "https://cdn.example.com/journalist-union/insurance-cards/clx9abc001/ins001.jpg"
 *                 notes: "Group insurance via union"
 *                 assignedById: "usr_admin_01"
 *                 createdAt: "2025-01-15T10:00:00.000Z"
 *                 updatedAt: "2025-01-15T10:00:00.000Z"
 *               - id: "ins002"
 *                 profileId: "clx9abc001"
 *                 type: "HEALTH"
 *                 policyNumber: "POL-2025-11200"
 *                 insurer: "Star Health"
 *                 coverAmount: 300000
 *                 premium: 4200
 *                 validFrom: "2025-04-01T00:00:00.000Z"
 *                 validTo: "2026-04-01T00:00:00.000Z"
 *                 isActive: true
 *                 insuranceCardUrl: null
 *                 notes: null
 *                 assignedById: "usr_admin_01"
 *                 createdAt: "2025-04-01T09:00:00.000Z"
 *                 updatedAt: "2025-04-01T09:00:00.000Z"
 *       404:
 *         description: Member not found
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
 *     description: Creates a new insurance record for the member. Use the `/card` sub-endpoint afterwards to upload the policy document image.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, policyNumber, insurer, validFrom, validTo]
 *             properties:
 *               type:         { type: string, enum: [ACCIDENTAL, HEALTH], example: "ACCIDENTAL" }
 *               policyNumber: { type: string, example: "POL-2025-88421" }
 *               insurer:      { type: string, example: "LIC of India" }
 *               coverAmount:  { type: integer, example: 500000 }
 *               premium:      { type: integer, example: 2500 }
 *               validFrom:    { type: string, format: date-time, example: "2025-01-01T00:00:00.000Z" }
 *               validTo:      { type: string, format: date-time, example: "2026-01-01T00:00:00.000Z" }
 *               notes:        { type: string, example: "Group insurance via union" }
 *           example:
 *             type: "ACCIDENTAL"
 *             policyNumber: "POL-2025-88421"
 *             insurer: "LIC of India"
 *             coverAmount: 500000
 *             premium: 2500
 *             validFrom: "2025-01-01T00:00:00.000Z"
 *             validTo: "2026-01-01T00:00:00.000Z"
 *             notes: "Group insurance via union"
 *     responses:
 *       201:
 *         description: Insurance record created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsuranceRecord'
 *             example:
 *               id: "ins001"
 *               profileId: "clx9abc001"
 *               type: "ACCIDENTAL"
 *               policyNumber: "POL-2025-88421"
 *               insurer: "LIC of India"
 *               coverAmount: 500000
 *               premium: 2500
 *               validFrom: "2025-01-01T00:00:00.000Z"
 *               validTo: "2026-01-01T00:00:00.000Z"
 *               isActive: true
 *               insuranceCardUrl: null
 *               notes: "Group insurance via union"
 *               assignedById: "usr_admin_01"
 *               createdAt: "2026-04-29T10:00:00.000Z"
 *               updatedAt: "2026-04-29T10:00:00.000Z"
 *       400:
 *         description: Missing required fields or invalid type
 *       404:
 *         description: Member not found
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
 *     description: Partial update — only provided fields are changed.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *       - in: path
 *         name: insId
 *         required: true
 *         schema: { type: string }
 *         example: "ins001"
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               policyNumber: { type: string, example: "POL-2025-88421-REV" }
 *               insurer:      { type: string, example: "LIC of India" }
 *               coverAmount:  { type: integer, example: 750000 }
 *               premium:      { type: integer, example: 3000 }
 *               validFrom:    { type: string, format: date-time }
 *               validTo:      { type: string, format: date-time, example: "2027-01-01T00:00:00.000Z" }
 *               isActive:     { type: boolean, example: true }
 *               notes:        { type: string, example: "Renewed with enhanced cover" }
 *           example:
 *             coverAmount: 750000
 *             validTo: "2027-01-01T00:00:00.000Z"
 *             notes: "Renewed with enhanced cover"
 *     responses:
 *       200:
 *         description: Updated insurance record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/InsuranceRecord'
 *             example:
 *               id: "ins001"
 *               profileId: "clx9abc001"
 *               type: "ACCIDENTAL"
 *               policyNumber: "POL-2025-88421"
 *               insurer: "LIC of India"
 *               coverAmount: 750000
 *               validTo: "2027-01-01T00:00:00.000Z"
 *               isActive: true
 *               notes: "Renewed with enhanced cover"
 *               updatedAt: "2026-04-29T12:00:00.000Z"
 *       404:
 *         description: Member or insurance record not found
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
 *     description: |
 *       Accepts JPEG, PNG, WebP or PDF (max 10 MB).
 *       Stores the file in Bunny CDN / R2 and updates `insuranceCardUrl` on the insurance record.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         example: "clx9abc001"
 *       - in: path
 *         name: insId
 *         required: true
 *         schema: { type: string }
 *         example: "ins001"
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [insuranceCard]
 *             properties:
 *               insuranceCard:
 *                 type: string
 *                 format: binary
 *                 description: Insurance card image (JPEG / PNG / WebP) or policy PDF
 *     responses:
 *       200:
 *         description: Card uploaded successfully
 *         content:
 *           application/json:
 *             example:
 *               insuranceCardUrl: "https://cdn.example.com/journalist-union/insurance-cards/clx9abc001/ins001-1714200000.jpg"
 *               insurance:
 *                 id: "ins001"
 *                 profileId: "clx9abc001"
 *                 type: "ACCIDENTAL"
 *                 policyNumber: "POL-2025-88421"
 *                 insurer: "LIC of India"
 *                 coverAmount: 500000
 *                 validTo: "2026-01-01T00:00:00.000Z"
 *                 isActive: true
 *                 insuranceCardUrl: "https://cdn.example.com/journalist-union/insurance-cards/clx9abc001/ins001-1714200000.jpg"
 *       400:
 *         description: File missing
 *       404:
 *         description: Member or insurance record not found
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
 *     summary: All members in a specific state (sorted district → mandal)
 *     description: Convenience endpoint to pull all members in a single state, useful for printing state-level member directories.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: state
 *         required: true
 *         schema: { type: string }
 *         example: "Telangana"
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Max 200 per request
 *     responses:
 *       200:
 *         description: Paginated members for the state
 *         content:
 *           application/json:
 *             example:
 *               state: "Telangana"
 *               total: 180
 *               page: 1
 *               limit: 50
 *               totalPages: 4
 *               items:
 *                 - id: "clx9abc001"
 *                   pressId: "TJ-2025-00142"
 *                   designation: "Reporter"
 *                   district: "Hyderabad"
 *                   mandal: "Secunderabad"
 *                   organization: "Eenadu"
 *                   approved: true
 *                   kycVerified: true
 *                   photoUrl: "https://cdn.example.com/journalist/photos/clx9abc001.jpg"
 *                   user:
 *                     id: "usr001"
 *                     name: "రాజు కుమార్"
 *                     mobileNumber: "9876543210"
 *                   card:
 *                     cardNumber: "TJU-2025-001420"
 *                     status: "ACTIVE"
 *                     expiryDate: "2026-01-15T00:00:00.000Z"
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
 *     description: |
 *       Returns all currently active post holders in the union, ordered by post level and sort order.
 *       Filter by `level` to get e.g. only district presidents, or by `state`/`district` for geographic scope.
 *     tags: [Journalist President]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, MANDAL, CITY, SPECIAL_WING] }
 *         example: "DISTRICT"
 *         description: Filter by post level
 *       - in: query
 *         name: state
 *         schema: { type: string }
 *         example: "Telangana"
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *         example: "Hyderabad"
 *     responses:
 *       200:
 *         description: List of active post holders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/PostHolder'
 *             example:
 *               - id: "ph001"
 *                 unionName: "Telangana Journalists Union"
 *                 stateId: "Telangana"
 *                 districtId: "Hyderabad"
 *                 mandalId: null
 *                 isActive: true
 *                 termStartDate: "2024-01-01T00:00:00.000Z"
 *                 termEndDate: null
 *                 post:
 *                   title: "District President"
 *                   nativeTitle: "జిల్లా అధ్యక్షుడు"
 *                   level: "DISTRICT"
 *                   type: "ELECTED"
 *                   sortOrder: 1
 *                 profile:
 *                   id: "clx9abc001"
 *                   pressId: "TJ-2025-00142"
 *                   designation: "Reporter"
 *                   district: "Hyderabad"
 *                   state: "Telangana"
 *                   photoUrl: "https://cdn.example.com/journalist/photos/clx9abc001.jpg"
 *                   user:
 *                     id: "usr001"
 *                     name: "రాజు కుమార్"
 *                     mobileNumber: "9876543210"
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
