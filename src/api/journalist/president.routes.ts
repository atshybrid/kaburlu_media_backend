// src/api/journalist/president.routes.ts
// President / Union Admin Dashboard APIs
// Auth: SUPER_ADMIN OR JournalistUnionAdmin record
// Mounts at: /journalist/president

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import multer from 'multer';
import * as bcrypt from 'bcrypt';
import sharp from 'sharp';
import prisma from '../../lib/prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from '../../lib/bunnyStorage';
import { putPublicObject } from '../../lib/objectStorage';
import { generateAndUploadPressCardPdf } from '../../lib/journalistPressCardPdf';
import { sendWhatsappIdCardTemplate } from '../../lib/whatsapp';

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

// Multer for president member photo upload (image-only)
const uploadMemberPhoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
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

function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s ? s : null;
}

function maskAadhaarLast4(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const digits = v.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

type LocationInput = {
  stateId?: string | null;
  stateName?: string | null;
  state?: string | null;
  districtId?: string | null;
  districtName?: string | null;
  district?: string | null;
  mandalId?: string | null;
  mandalName?: string | null;
  mandal?: string | null;
};

async function resolveLocation(input: LocationInput) {
  let stateName: string | null = null;
  let districtName: string | null = null;
  let mandalName: string | null = null;

  const mandalId = cleanText(input.mandalId);
  const districtId = cleanText(input.districtId);
  const stateId = cleanText(input.stateId);
  const requestedMandalName = cleanText(input.mandalName) || cleanText(input.mandal);
  const requestedDistrictName = cleanText(input.districtName) || cleanText(input.district);
  const requestedStateName = cleanText(input.stateName) || cleanText(input.state);

  if (mandalId) {
    const m = await p.mandal.findFirst({
      where: { id: mandalId, isDeleted: false },
      include: { district: { include: { state: true } } },
    });
    if (!m) throw new Error('Invalid mandalId');
    mandalName = m.name;
    districtName = m.district?.name ?? null;
    stateName = m.district?.state?.name ?? null;
  }

  if (!mandalName && requestedMandalName) {
    const m = await p.mandal.findFirst({
      where: {
        isDeleted: false,
        name: { equals: requestedMandalName, mode: 'insensitive' },
        ...(districtId ? { districtId } : {}),
      },
      include: { district: { include: { state: true } } },
    });
    if (!m) throw new Error('Invalid mandalName');
    mandalName = m.name;
    districtName = m.district?.name ?? null;
    stateName = m.district?.state?.name ?? null;
  }

  if (!districtName && districtId) {
    const d = await p.district.findFirst({
      where: { id: districtId, isDeleted: false },
      include: { state: true },
    });
    if (!d) throw new Error('Invalid districtId');
    districtName = d.name;
    stateName = d.state?.name ?? stateName;
  }

  if (!districtName && requestedDistrictName) {
    const d = await p.district.findFirst({
      where: {
        isDeleted: false,
        name: { equals: requestedDistrictName, mode: 'insensitive' },
        ...(stateId ? { stateId } : {}),
      },
      include: { state: true },
    });
    if (!d) throw new Error('Invalid districtName');
    districtName = d.name;
    stateName = d.state?.name ?? stateName;
  }

  if (!stateName && stateId) {
    const s = await p.state.findFirst({ where: { id: stateId, isDeleted: false } });
    if (!s) throw new Error('Invalid stateId');
    stateName = s.name;
  }

  if (!stateName && requestedStateName) {
    const s = await p.state.findFirst({
      where: { isDeleted: false, name: { equals: requestedStateName, mode: 'insensitive' } },
    });
    if (!s) throw new Error('Invalid stateName');
    stateName = s.name;
  }

  return {
    state: stateName,
    district: districtName,
    mandal: mandalName,
  };
}

async function uploadJournalistPhoto(profileId: string, file?: Express.Multer.File | null): Promise<string | null> {
  if (!file) return null;

  const outBuffer = await sharp(file.buffer).webp({ quality: 85 }).toBuffer();
  const key = `journalist-union/kyc/${profileId}/photo.webp`;

  if (isBunnyStorageConfigured()) {
    const r = await bunnyStoragePutObject({ key, body: outBuffer, contentType: 'image/webp' });
    return r.publicUrl;
  }

  const r = await putPublicObject({ key, body: outBuffer, contentType: 'image/webp' });
  return r.publicUrl;
}

async function ensureCardAndSendWhatsapp(profileId: string, mobileNumber: string | null, orgName: string | null, pressId: string | null) {
  const existingCard = await p.journalistCard.findUnique({ where: { profileId } });
  if (!existingCard) {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    await p.journalistCard.create({
      data: {
        profileId,
        cardNumber: `JU-${Date.now()}`,
        expiryDate: expiry,
        status: 'ACTIVE',
      },
    });
  }

  const pdfResult = await generateAndUploadPressCardPdf(profileId);
  let whatsappSent = false;

  if (pdfResult.ok && pdfResult.pdfUrl && mobileNumber) {
    await sendWhatsappIdCardTemplate({
      toMobileNumber: mobileNumber,
      pdfUrl: pdfResult.pdfUrl,
      cardType: 'Journalist Press ID',
      organizationName: orgName || 'Journalist Union',
      documentType: 'Press ID Card',
      pdfFilename: `Press_ID_${pressId || pdfResult.cardNumber || profileId}.pdf`,
    });
    whatsappSent = true;
  }

  const card = await p.journalistCard.findUnique({ where: { profileId } });
  return { card, pdfResult, whatsappSent };
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
const presidentDashboardHandler = async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const districtFilter = cleanText(q.district);
    const mandalFilter = cleanText(q.mandal);
    const baseWhere = buildMemberWhere(req, res, {
      ...(districtFilter ? { district: districtFilter } : {}),
      ...(mandalFilter ? { mandal: mandalFilter } : {}),
    });

    // --- Core counts ---
    const [total, approved, kycVerified, pendingApplications] = await Promise.all([
      p.journalistProfile.count({ where: baseWhere }),
      p.journalistProfile.count({ where: { ...baseWhere, approved: true } }),
      p.journalistProfile.count({ where: { ...baseWhere, kycVerified: true } }),
      p.journalistProfile.count({ where: { ...baseWhere, approved: false, rejectedAt: null } }),
    ]);
    const rejected = await p.journalistProfile.count({ where: { ...baseWhere, rejectedAt: { not: null } } });
    const activeMembers = approved;
    const inactiveMembers = Math.max(0, total - activeMembers);

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
    const scope: { unionName?: string; state?: string } | null = res.locals.unionScope;
    const postWhere: Record<string, unknown> = { isActive: true };
    if (scope?.unionName) postWhere.unionName = scope.unionName;
    if (cleanText(q.districtId)) postWhere.districtId = cleanText(q.districtId);
    if (cleanText(q.mandalId)) postWhere.mandalId = cleanText(q.mandalId);
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
    const [activeInsurance, expiredInsurance, activeAccidentalInsurance, activeHealthInsurance] = await Promise.all([
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { gte: now } } }),
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { lt: now } } }),
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { gte: now }, type: 'ACCIDENTAL' } }),
      p.journalistInsurance.count({ where: { ...insWhere, isActive: true, validTo: { gte: now }, type: 'HEALTH' } }),
    ]);

    // Claim-like metrics from complaint table (closest available model in current schema)
    const complaintWhere: Record<string, unknown> = {
      user: {
        journalistProfile: {
          is: {
            ...(scope?.unionName ? { unionName: scope.unionName } : {}),
            ...(scope?.state ? { state: scope.state } : {}),
            ...(districtFilter ? { district: districtFilter } : {}),
            ...(mandalFilter ? { mandal: mandalFilter } : {}),
          },
        },
      },
    };
    const [claimsTotal, claimsOpen, claimsInProgress, claimsClosed] = await Promise.all([
      p.journalistComplaint.count({ where: complaintWhere }),
      p.journalistComplaint.count({ where: { ...complaintWhere, status: 'OPEN' } }),
      p.journalistComplaint.count({ where: { ...complaintWhere, status: 'IN_PROGRESS' } }),
      p.journalistComplaint.count({ where: { ...complaintWhere, status: 'CLOSED' } }),
    ]);
    const claims = {
      supported: true,
      total: claimsTotal,
      open: claimsOpen,
      inProgress: claimsInProgress,
      closed: claimsClosed,
      note: 'Counts are based on journalist complaints table',
    };

    // District-level election readiness for ELECTED posts
    const electedPostWhere: Record<string, unknown> = { level: 'DISTRICT', type: 'ELECTED', isActive: true };
    if (scope?.unionName) electedPostWhere.unionName = scope.unionName;
    const districtElectedDefs = await p.journalistUnionPostDefinition.findMany({
      where: electedPostWhere,
      select: { id: true, title: true, nativeTitle: true, maxSeats: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const holdersWhere: Record<string, unknown> = { isActive: true, postId: { in: districtElectedDefs.map((d: any) => d.id) } };
    if (scope?.unionName) holdersWhere.unionName = scope.unionName;
    if (cleanText(q.districtId)) holdersWhere.districtId = cleanText(q.districtId);
    const filledByPost = await p.journalistUnionPostHolder.groupBy({
      by: ['postId'],
      where: holdersWhere,
      _count: { _all: true },
    });
    const filledMap: Record<string, number> = {};
    for (const row of filledByPost) filledMap[row.postId] = row._count._all;
    const districtElectionReadiness = districtElectedDefs.map((d: any) => {
      const filled = filledMap[d.id] || 0;
      return {
        postId: d.id,
        title: d.title,
        nativeTitle: d.nativeTitle,
        maxSeats: d.maxSeats,
        seatsFilled: filled,
        seatsVacant: Math.max(0, d.maxSeats - filled),
        electionRequired: filled < d.maxSeats,
      };
    });

    const electionSummary = {
      districtFilter: cleanText(q.districtId) || districtFilter || null,
      totalDistrictElectedPosts: districtElectionReadiness.length,
      postsNeedElection: districtElectionReadiness.filter((p: any) => p.electionRequired).length,
      postsReady: districtElectionReadiness.filter((p: any) => !p.electionRequired).length,
      posts: districtElectionReadiness,
    };

    return res.json({
      summary: {
        total,
        approved,
        active: activeMembers,
        inactive: inactiveMembers,
        pending: pendingApplications,
        rejected,
        kycVerified,
      },
      filters: {
        district: districtFilter,
        mandal: mandalFilter,
        districtId: cleanText(q.districtId),
        mandalId: cleanText(q.mandalId),
      },
      stateWise,
      districtWise,
      mandalWise,
      postsByLevel,
      insurance: {
        active: activeInsurance,
        expired: expiredInsurance,
        accidentalActive: activeAccidentalInsurance,
        healthActive: activeHealthInsurance,
      },
      claims,
      election: electionSummary,
    });
  } catch (e: any) {
    console.error('[president/dashboard]', e);
    return res.status(500).json({ error: 'Dashboard query failed', details: e.message });
  }
};

router.get('/dashboard', jwtAuth, requireUnionAdmin, presidentDashboardHandler);
router.get('/union-dashboard', jwtAuth, requireUnionAdmin, presidentDashboardHandler);

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

// ─── 12. District Election Readiness ─────────────────────────────────────────
/**
 * @swagger
 * /journalist/president/elections/district-readiness:
 *   get:
 *     summary: District election readiness by post designations
 *     description: Returns seat-filled vs seat-vacant status for DISTRICT-level ELECTED posts.
 *     tags: [President Union APIs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *       - in: query
 *         name: district
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Readiness data
 */
router.get('/elections/district-readiness', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const q = req.query as Record<string, string | undefined>;
    const scope: { unionName?: string } | null = res.locals.unionScope;
    const districtId = cleanText(q.districtId);

    const postDefWhere: Record<string, unknown> = { level: 'DISTRICT', type: 'ELECTED', isActive: true };
    if (scope?.unionName) postDefWhere.unionName = scope.unionName;
    const defs = await p.journalistUnionPostDefinition.findMany({
      where: postDefWhere,
      select: { id: true, title: true, nativeTitle: true, maxSeats: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });

    const holdersWhere: Record<string, unknown> = {
      isActive: true,
      postId: { in: defs.map((d: any) => d.id) },
      ...(scope?.unionName ? { unionName: scope.unionName } : {}),
      ...(districtId ? { districtId } : {}),
    };
    const grouped = await p.journalistUnionPostHolder.groupBy({
      by: ['postId'],
      where: holdersWhere,
      _count: { _all: true },
    });

    const filledMap: Record<string, number> = {};
    for (const g of grouped) filledMap[g.postId] = g._count._all;

    const posts = defs.map((d: any) => {
      const filled = filledMap[d.id] || 0;
      return {
        postId: d.id,
        title: d.title,
        nativeTitle: d.nativeTitle,
        maxSeats: d.maxSeats,
        seatsFilled: filled,
        seatsVacant: Math.max(0, d.maxSeats - filled),
        electionRequired: filled < d.maxSeats,
      };
    });

    return res.json({
      districtId: districtId || null,
      totalPosts: posts.length,
      needElection: posts.filter((p: any) => p.electionRequired).length,
      ready: posts.filter((p: any) => !p.electionRequired).length,
      posts,
    });
  } catch (e: any) {
    console.error('[president/elections/district-readiness]', e);
    return res.status(500).json({ error: 'Failed to fetch district election readiness', details: e.message });
  }
});

// ─── 13. Conduct District Election (appoint winners) ────────────────────────
/**
 * @swagger
 * /journalist/president/elections/conduct-district:
 *   post:
 *     summary: Conduct district election and appoint winners for a post
 *     description: |
 *       Replaces existing active holders for given district/post and sets new winners.
 *       Validates seat count and approved members.
 *     tags: [President Union APIs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, districtId, winnerProfileIds, termStartDate]
 *             properties:
 *               postId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               winnerProfileIds:
 *                 type: array
 *                 items: { type: string }
 *               termStartDate: { type: string, format: date }
 *               termEndDate: { type: string, format: date }
 *               notes: { type: string }
 *     responses:
 *       201:
 *         description: Election result saved
 */
router.post('/elections/conduct-district', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const admin = currentUser(req);
    const scope: { unionName?: string } | null = res.locals.unionScope;
    const {
      postId,
      districtId,
      mandalId,
      winnerProfileIds,
      termStartDate,
      termEndDate,
      notes,
    } = req.body || {};

    if (!postId || !districtId || !Array.isArray(winnerProfileIds) || winnerProfileIds.length === 0 || !termStartDate) {
      return res.status(400).json({ error: 'postId, districtId, winnerProfileIds, termStartDate are required' });
    }

    const postDef = await p.journalistUnionPostDefinition.findUnique({ where: { id: postId } });
    if (!postDef) return res.status(404).json({ error: 'Post definition not found' });
    if (postDef.level !== 'DISTRICT' || postDef.type !== 'ELECTED') {
      return res.status(400).json({ error: 'Only DISTRICT ELECTED posts are allowed in this endpoint' });
    }
    if (scope?.unionName && postDef.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: post belongs to different union' });
    }
    if (winnerProfileIds.length > postDef.maxSeats) {
      return res.status(400).json({ error: `Selected winners exceed maxSeats (${postDef.maxSeats})` });
    }

    const profiles = await p.journalistProfile.findMany({
      where: {
        id: { in: winnerProfileIds },
        approved: true,
        ...(scope?.unionName ? { unionName: scope.unionName } : {}),
      },
      select: { id: true, unionName: true, approved: true },
    });
    if (profiles.length !== winnerProfileIds.length) {
      return res.status(400).json({ error: 'Some winnerProfileIds are invalid/not approved/not in your union scope' });
    }

    const startDate = new Date(termStartDate);
    const endDate = termEndDate ? new Date(termEndDate) : null;
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'Invalid termStartDate format. Use YYYY-MM-DD.' });
    if (endDate && isNaN(endDate.getTime())) return res.status(400).json({ error: 'Invalid termEndDate format. Use YYYY-MM-DD.' });

    const result = await p.$transaction(async (tx: any) => {
      await tx.journalistUnionPostHolder.updateMany({
        where: {
          postId,
          districtId,
          ...(mandalId ? { mandalId } : {}),
          unionName: postDef.unionName,
          isActive: true,
        },
        data: { isActive: false, termEndDate: new Date() },
      });

      const created: any[] = [];
      for (const profileId of winnerProfileIds) {
        const holder = await tx.journalistUnionPostHolder.create({
          data: {
            postId,
            profileId,
            unionName: postDef.unionName,
            districtId,
            mandalId: mandalId || null,
            termStartDate: startDate,
            termEndDate: endDate || null,
            isActive: true,
            appointedById: admin.id,
            notes: notes || 'Elected via district election',
          },
          include: {
            post: { select: { title: true, nativeTitle: true, level: true, type: true } },
            profile: { select: { id: true, pressId: true, user: { select: { profile: { select: { fullName: true } } } } } },
          },
        });
        created.push(holder);
      }
      return created;
    });

    return res.status(201).json({
      message: 'District election conducted successfully',
      post: {
        id: postDef.id,
        title: postDef.title,
        nativeTitle: postDef.nativeTitle,
        maxSeats: postDef.maxSeats,
      },
      districtId,
      mandalId: mandalId || null,
      winnersCount: result.length,
      winners: result,
    });
  } catch (e: any) {
    console.error('[president/elections/conduct-district]', e);
    return res.status(500).json({ error: 'Failed to conduct district election', details: e.message });
  }
});

// ─── 14. President Member Mobile Precheck ───────────────────────────────────
/**
 * @swagger
 * /journalist/president/members/precheck:
 *   get:
 *     summary: President Member Precheck by mobile number
 *     description: |
 *       Checks mobile number before creating union member.
 *       Response includes:
 *       - `tenantReporter`: whether this mobile is already a tenant reporter
 *       - `alreadyUnionMember`: whether this mobile already has journalist union membership
 *       - Full details for both (if available)
 *     tags: [President Union APIs]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: mobileNumber
 *         required: true
 *         schema:
 *           type: string
 *         example: "9876543210"
 *     responses:
 *       200:
 *         description: Precheck result
 *       400:
 *         description: mobileNumber missing
 */
router.get('/members/precheck', jwtAuth, requireUnionAdmin, async (req, res) => {
  try {
    const mobileNumber = cleanText(req.query.mobileNumber);
    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });

    const user = await p.user.findUnique({
      where: { mobileNumber },
      include: {
        profile: { select: { fullName: true, profilePhotoUrl: true } },
        reporterProfile: {
          include: {
            tenant: { select: { id: true, name: true } },
            state: { select: { id: true, name: true } },
            district: { select: { id: true, name: true } },
            mandal: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true, nativeName: true } },
          },
        },
        journalistProfile: {
          include: {
            card: { select: { id: true, cardNumber: true, status: true, expiryDate: true, pdfUrl: true } },
          },
        },
      },
    });

    const tenantReporter = !!user?.reporterProfile;
    const alreadyUnionMember = !!user?.journalistProfile;

    return res.json({
      mobileNumber,
      tenantReporter,
      alreadyUnionMember,
      tenantReporterDetails: tenantReporter
        ? {
            reporterId: user!.reporterProfile!.id,
            tenant: user!.reporterProfile!.tenant,
            designation: user!.reporterProfile!.designation,
            state: user!.reporterProfile!.state,
            district: user!.reporterProfile!.district,
            mandal: user!.reporterProfile!.mandal,
            fullName: user!.profile?.fullName || null,
            profilePhotoUrl: user!.reporterProfile!.profilePhotoUrl || user!.profile?.profilePhotoUrl || null,
          }
        : null,
      unionMemberDetails: alreadyUnionMember
        ? {
            id: user!.journalistProfile!.id,
            unionName: user!.journalistProfile!.unionName,
            approved: user!.journalistProfile!.approved,
            kycVerified: user!.journalistProfile!.kycVerified,
            pressId: user!.journalistProfile!.pressId,
            designation: user!.journalistProfile!.designation,
            organization: user!.journalistProfile!.organization,
            state: user!.journalistProfile!.state,
            district: user!.journalistProfile!.district,
            mandal: user!.journalistProfile!.mandal,
            card: user!.journalistProfile!.card,
          }
        : null,
    });
  } catch (e: any) {
    console.error('[president/members/precheck]', e);
    return res.status(500).json({ error: 'Precheck failed', details: e.message });
  }
});

// ─── 15. President Create Member (Reporter/Non-Reporter flow) ──────────────
/**
 * @swagger
 * /journalist/president/members/create:
 *   post:
 *     summary: President creates union member and sends ID card
 *     description: |
 *       Two flows in one API:
 *       1) If mobile belongs to existing tenant reporter (`tenantReporter=true`) -> mobile-only creation with internal auto-fill.
 *       2) If no tenant reporter (`tenantReporter=false`) -> requires fullName, designation, and mapped location input.
 *
 *       Supports location by id OR name:
 *       - stateId/stateName
 *       - districtId/districtName
 *       - mandalId/mandalName
 *
 *       Optional photo upload (multipart field: `photo`).
 *       After successful creation:
 *       - profile saved
 *       - press card generated (if not existing)
 *       - PDF generated
 *       - ID card sent to WhatsApp
 *     tags: [President Union APIs]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [mobileNumber]
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9876543210"
 *               tenantReporter:
 *                 type: boolean
 *                 description: Optional explicit branch selector; validated against actual mobile status
 *               unionName:
 *                 type: string
 *                 description: Required only for SUPER_ADMIN (scoped admins auto-use their union)
 *               fullName:
 *                 type: string
 *               mpin:
 *                 type: string
 *                 description: 4-digit; if omitted for new user, last 4 digits of mobile are used
 *               designation:
 *                 type: string
 *               organization:
 *                 type: string
 *               currentNewspaper:
 *                 type: string
 *               currentDesignation:
 *                 type: string
 *               stateId:
 *                 type: string
 *               stateName:
 *                 type: string
 *               districtId:
 *                 type: string
 *               districtName:
 *                 type: string
 *               mandalId:
 *                 type: string
 *               mandalName:
 *                 type: string
 *               aadhaarNumber:
 *                 type: string
 *                 description: Any format; backend stores only last 4 digits
 *               nomineeName:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *                 description: Optional image; if absent and tenant reporter has photo, existing photo is used
 *     responses:
 *       201:
 *         description: Member created with ID card flow status
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Mobile already has union membership
 */
router.post('/members/create', jwtAuth, requireUnionAdmin, uploadMemberPhoto.single('photo'), async (req, res) => {
  try {
    const mobileNumber = cleanText(req.body.mobileNumber);
    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });

    const scope: { unionName?: string; state?: string } | null = res.locals.unionScope;
    const unionName = scope?.unionName || cleanText(req.body.unionName);
    if (!unionName) {
      return res.status(400).json({ error: 'unionName is required for SUPER_ADMIN' });
    }

    const userWithProfiles = await p.user.findUnique({
      where: { mobileNumber },
      include: {
        profile: { select: { fullName: true, profilePhotoUrl: true } },
        reporterProfile: {
          include: {
            tenant: { select: { id: true, name: true } },
            state: { select: { id: true, name: true } },
            district: { select: { id: true, name: true } },
            mandal: { select: { id: true, name: true } },
            designation: { select: { name: true } },
          },
        },
        journalistProfile: { select: { id: true, unionName: true, approved: true, pressId: true } },
      },
    });

    if (userWithProfiles?.journalistProfile) {
      return res.status(409).json({
        error: 'This mobile number already has a union member profile',
        alreadyUnionMember: true,
        unionMemberDetails: userWithProfiles.journalistProfile,
      });
    }

    const detectedTenantReporter = !!userWithProfiles?.reporterProfile;
    if (req.body.tenantReporter !== undefined) {
      const requestedBranch = String(req.body.tenantReporter) === 'true';
      if (requestedBranch !== detectedTenantReporter) {
        return res.status(400).json({
          error: 'tenantReporter branch mismatch with mobile precheck result',
          detectedTenantReporter,
        });
      }
    }

    // Shared fields
    const fullNameInput = cleanText(req.body.fullName);
    const designationInput = cleanText(req.body.designation);
    const organizationInput = cleanText(req.body.organization) || cleanText(req.body.currentNewspaper);
    const currentDesignationInput = cleanText(req.body.currentDesignation);
    const nomineeName = cleanText(req.body.nomineeName);
    const aadhaarLast4 = maskAadhaarLast4(req.body.aadhaarNumber);

    // Determine/create user
    let user = userWithProfiles;
    if (!user) {
      const citizenRole = await p.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } });
      if (!citizenRole) return res.status(500).json({ error: 'Default role not configured' });

      const lang = await p.language.findFirst({ where: { code: 'te' } }) || await p.language.findFirst();
      if (!lang) return res.status(500).json({ error: 'No language configured in system' });

      const mpinRaw = cleanText(req.body.mpin) || mobileNumber.slice(-4);
      if (!/^\d{4}$/.test(mpinRaw)) {
        return res.status(400).json({ error: 'mpin must be exactly 4 digits' });
      }

      const hashedMpin = await bcrypt.hash(mpinRaw, 10);
      user = await p.user.create({
        data: {
          mobileNumber,
          mpin: hashedMpin,
          roleId: citizenRole.id,
          languageId: lang.id,
          status: 'PENDING',
        },
        include: {
          profile: { select: { fullName: true, profilePhotoUrl: true } },
          reporterProfile: {
            include: {
              tenant: { select: { id: true, name: true } },
              state: { select: { id: true, name: true } },
              district: { select: { id: true, name: true } },
              mandal: { select: { id: true, name: true } },
              designation: { select: { name: true } },
            },
          },
          journalistProfile: { select: { id: true } },
        },
      });
    }

    let resolvedState: string | null = null;
    let resolvedDistrict: string | null = null;
    let resolvedMandal: string | null = null;
    let profilePhotoUrl: string | null = null;
    let finalFullName: string | null = null;
    let finalDesignation: string | null = null;
    let finalOrganization: string | null = null;
    let linkedTenantId: string | null = null;
    let linkedTenantName: string | null = null;

    if (detectedTenantReporter && user.reporterProfile) {
      // Reporter true branch: auto-fill from reporter profile
      finalFullName = user.profile?.fullName || fullNameInput;
      finalDesignation = designationInput || user.reporterProfile.designation?.name || 'Reporter';
      finalOrganization = organizationInput || user.reporterProfile.tenant?.name || 'Reporter';

      resolvedState = user.reporterProfile.state?.name || null;
      resolvedDistrict = user.reporterProfile.district?.name || null;
      resolvedMandal = user.reporterProfile.mandal?.name || null;

      linkedTenantId = user.reporterProfile.tenantId || null;
      linkedTenantName = user.reporterProfile.tenant?.name || null;

      profilePhotoUrl = user.reporterProfile.profilePhotoUrl || user.profile?.profilePhotoUrl || null;
    } else {
      // Reporter false branch: require full details + location mapping
      finalFullName = fullNameInput;
      finalDesignation = designationInput;
      finalOrganization = organizationInput || 'Independent';

      if (!finalFullName) return res.status(400).json({ error: 'fullName is required when tenantReporter is false' });
      if (!finalDesignation) return res.status(400).json({ error: 'designation is required when tenantReporter is false' });

      const hasLocationInput =
        !!cleanText(req.body.stateId) || !!cleanText(req.body.stateName) || !!cleanText(req.body.state) ||
        !!cleanText(req.body.districtId) || !!cleanText(req.body.districtName) || !!cleanText(req.body.district) ||
        !!cleanText(req.body.mandalId) || !!cleanText(req.body.mandalName) || !!cleanText(req.body.mandal);
      if (!hasLocationInput) {
        return res.status(400).json({
          error: 'Provide at least one location input: stateId/stateName, districtId/districtName, or mandalId/mandalName',
        });
      }

      const resolved = await resolveLocation({
        stateId: cleanText(req.body.stateId),
        stateName: cleanText(req.body.stateName),
        state: cleanText(req.body.state),
        districtId: cleanText(req.body.districtId),
        districtName: cleanText(req.body.districtName),
        district: cleanText(req.body.district),
        mandalId: cleanText(req.body.mandalId),
        mandalName: cleanText(req.body.mandalName),
        mandal: cleanText(req.body.mandal),
      });

      resolvedState = resolved.state;
      resolvedDistrict = resolved.district;
      resolvedMandal = resolved.mandal;
    }

    // If president admin is state-scoped and member state is missing, default to president state.
    if (scope?.state && !resolvedState) {
      resolvedState = scope.state;
    }

    // If president admin is state-scoped, member state must match admin state.
    if (scope?.state && resolvedState && scope.state.toLowerCase() !== resolvedState.toLowerCase()) {
      return res.status(400).json({
        error: 'Member state and president state mismatch',
        presidentState: scope.state,
        memberState: resolvedState,
      });
    }

    if (!finalFullName) {
      finalFullName = `Member ${mobileNumber.slice(-4)}`;
    }
    if (!finalDesignation) {
      finalDesignation = 'Member';
    }
    if (!finalOrganization) {
      finalOrganization = 'Journalist';
    }

    // Ensure user profile name
    await p.userProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        fullName: finalFullName,
        ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
      },
      update: {
        fullName: finalFullName,
        ...(profilePhotoUrl ? { profilePhotoUrl } : {}),
      },
    });

    let profile = await p.journalistProfile.create({
      data: {
        userId: user.id,
        designation: finalDesignation,
        district: resolvedDistrict || 'Unknown',
        state: resolvedState,
        mandal: resolvedMandal,
        organization: finalOrganization,
        unionName,
        linkedTenantId,
        linkedTenantName,
        currentNewspaper: linkedTenantName || finalOrganization,
        currentDesignation: currentDesignationInput || finalDesignation,
        nomineeName,
        aadhaarNumber: aadhaarLast4,
        approved: true,
        approvedAt: new Date(),
        kycVerified: true,
        kycVerifiedAt: new Date(),
      },
      include: {
        user: { select: { id: true, mobileNumber: true, email: true } },
      },
    });

    // Upload provided photo (if any); else keep reporter photo/user profile photo
    const uploadedPhoto = await uploadJournalistPhoto(profile.id, req.file);
    const effectivePhoto = uploadedPhoto || profilePhotoUrl || user.profile?.profilePhotoUrl || null;
    if (effectivePhoto) {
      profile = await p.journalistProfile.update({
        where: { id: profile.id },
        data: { photoUrl: effectivePhoto },
        include: {
          user: { select: { id: true, mobileNumber: true, email: true } },
        },
      });
    }

    const cardFlow = await ensureCardAndSendWhatsapp(
      profile.id,
      profile.user?.mobileNumber || mobileNumber,
      profile.linkedTenantName || profile.organization || null,
      profile.pressId || null,
    );

    return res.status(201).json({
      message: 'Union member created successfully. Union member ID card process started.',
      tenantReporter: detectedTenantReporter,
      member: profile,
      card: cardFlow.card,
      idCard: {
        pdfGenerated: !!cardFlow.pdfResult?.ok,
        pdfUrl: cardFlow.pdfResult?.pdfUrl || null,
        whatsappSent: cardFlow.whatsappSent,
      },
    });
  } catch (e: any) {
    const message = String(e?.message || '');
    if (message.startsWith('Invalid ')) {
      return res.status(400).json({ error: message });
    }
    console.error('[president/members/create]', e);
    return res.status(500).json({ error: 'Member creation failed', details: e.message });
  }
});

export default router;
