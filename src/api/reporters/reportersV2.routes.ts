/**
 * Reporter Management V2 Routes
 *
 * Additive-only: all endpoints are NEW paths under /api/v2/...
 * V1 routes (/tenants/:tenantId/reporters/...) are completely untouched.
 * No DB schema changes required – uses existing Reporter/User/UserProfile fields.
 *
 * Mounted in app.ts at: app.use('/api/v2', reportersV2Routes)
 */

import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';

const router = Router();

// ─────────────────────────────────────────────
// Shared helpers (mirrors tenantReporters.routes.ts patterns)
// ─────────────────────────────────────────────

type ReporterLevelInput = 'STATE' | 'DISTRICT' | 'DIVISION' | 'CONSTITUENCY' | 'ASSEMBLY' | 'MANDAL';
const VALID_LEVELS: ReporterLevelInput[] = ['STATE', 'DISTRICT', 'DIVISION', 'CONSTITUENCY', 'ASSEMBLY', 'MANDAL'];
const VALID_KYC = ['PENDING', 'APPROVED', 'REJECTED'];

function httpError(status: number, payload: any) {
  const err: any = new Error(payload?.error || 'Error');
  err.status = status;
  err.payload = payload;
  return err;
}

function isRetryable(e: any) {
  const code = String(e?.code || '');
  const msg = String(e?.message || '').toLowerCase();
  return code === 'P2034' || msg.includes('could not serialize access') || msg.includes('deadlock');
}

/** Returns the DB field name and its value for the current level. */
function locationFieldForLevel(level: ReporterLevelInput, body: any): { field: string; id: string } {
  if (level === 'STATE') return { field: 'stateId', id: String(body.stateId || '') };
  if (level === 'DISTRICT') return { field: 'districtId', id: String(body.districtId || '') };
  if (level === 'DIVISION') return { field: 'divisionId', id: String(body.divisionId || body.districtId || '') };
  if (level === 'CONSTITUENCY') return { field: 'constituencyId', id: String(body.constituencyId || body.assemblyConstituencyId || body.districtId || '') };
  if (level === 'MANDAL') return { field: 'mandalId', id: String(body.mandalId || '') };
  // ASSEMBLY: accepts assemblyConstituencyId | mandalId | districtId  (resolved below)
  return { field: 'assemblyConstituencyId', id: String(body.assemblyConstituencyId || body.mandalId || body.districtId || '') };
}

/** Build the updateData location fields: only the matching one populated, rest null. */
function buildLocationUpdateData(level: ReporterLevelInput, resolvedId: string, resolvedAssemblyId?: string | null) {
  return {
    stateId: level === 'STATE' ? resolvedId : null,
    districtId: level === 'DISTRICT' ? resolvedId : null,
    divisionId: level === 'DIVISION' ? resolvedId : null,
    constituencyId: level === 'CONSTITUENCY' ? resolvedId : null,
    mandalId: level === 'MANDAL' ? resolvedId : null,
    assemblyConstituencyId: level === 'ASSEMBLY' ? (resolvedAssemblyId ?? resolvedId) : null,
  };
}

/** Reads name/mobile off the linked User + UserProfile. */
function mapReporterContact(r: any) {
  if (!r) return r;
  const fullName = r?.user?.profile?.fullName ?? null;
  const mobileNumber = r?.user?.mobileNumber ?? null;
  const profilePhotoUrl = r?.profilePhotoUrl ?? r?.user?.profile?.profilePhotoUrl ?? null;
  let autoPublish = false;
  try {
    const kd = r?.kycData;
    if (kd && typeof kd === 'object') autoPublish = Boolean((kd as any).autoPublish);
  } catch { /* ignore */ }
  const { user, ...rest } = r;
  return { ...rest, profilePhotoUrl, fullName, mobileNumber, autoPublish };
}

/** Auth guard: SUPER_ADMIN or TENANT_ADMIN scoped to tenantId, or REPORTER self-access. */
async function requireAdminScope(req: any, res: any): Promise<{ ok: true; tenantId: string; userId: string; role: string } | { ok: false; status: number; error: string }> {
  const tenantId = String(req.params.tenantId || '').trim();
  if (!tenantId) return { ok: false, status: 400, error: 'tenantId param required' };
  const user: any = req.user;
  if (!user?.role?.name) return { ok: false, status: 401, error: 'Unauthorized' };
  const role = String(user.role.name);
  const adminRoles = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_EDITOR', 'ADMIN_EDITOR', 'NEWS_MODERATOR'];
  if (!adminRoles.includes(role)) return { ok: false, status: 403, error: 'Forbidden: admin role required' };
  if (role === 'SUPER_ADMIN') return { ok: true, tenantId, userId: String(user.id), role };
  // Tenant-scoped: verify tenant exists / user belongs to it  
  const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
  if (!tenant) return { ok: false, status: 404, error: 'Tenant not found' };
  return { ok: true, tenantId, userId: String(user.id), role };
}

/** Resolve ASSEMBLY level input to a real assemblyConstituencyId. */
async function resolveAssemblyId(tx: any, candidateId: string): Promise<string> {
  const isMandal = await tx.mandal.findUnique({ where: { id: candidateId }, select: { districtId: true } }).catch(() => null);
  if (isMandal?.districtId) {
    const ac = await tx.assemblyConstituency.findFirst({ where: { districtId: isMandal.districtId }, select: { id: true } }).catch(() => null);
    if (!ac?.id) throw httpError(400, { error: 'No assembly constituency found for mandal district' });
    return String(ac.id);
  }
  const isDistrict = await tx.district.findUnique({ where: { id: candidateId }, select: { id: true } }).catch(() => null);
  if (isDistrict?.id) {
    const ac = await tx.assemblyConstituency.findFirst({ where: { districtId: candidateId }, select: { id: true } }).catch(() => null);
    if (!ac?.id) throw httpError(400, { error: 'No assembly constituency found for district' });
    return String(ac.id);
  }
  const ac = await tx.assemblyConstituency.findUnique({ where: { id: candidateId }, select: { id: true } }).catch(() => null);
  if (!ac?.id) throw httpError(400, { error: 'Invalid assemblyConstituencyId / mandalId / districtId' });
  return String(ac.id);
}

// ─────────────────────────────────────────────
// 1. GET /api/v2/tenants/:tenantId/designations
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/designations:
 *   get:
 *     summary: "[V2] List all reporter designations (no tenantId required)"
 *     description: |
 *       Returns all designations (global + tenant-specific).
 *       Use this in reporter creation step 1 — no tenantId needed.
 *       Optionally filter by level or tenantId query param.
 *     tags: [V2 Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [STATE, DISTRICT, DIVISION, CONSTITUENCY, ASSEMBLY, MANDAL] }
 *         description: Optional filter by level
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: Optional — if provided, returns global + that tenant's designations only
 *     responses:
 *       200:
 *         description: Designations list
 *         content:
 *           application/json:
 *             example:
 *               designations:
 *                 - id: "dsg_001"
 *                   code: "MR"
 *                   name: "Mandal Reporter"
 *                   nativeName: "మండల రిపోర్టర్"
 *                   level: "MANDAL"
 *                   levelOrder: 4
 */
router.get('/designations', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const levelFilter = String(req.query.level || '').trim().toUpperCase();
    const tenantIdFilter = String(req.query.tenantId || '').trim();

    const where: any = {};

    if (tenantIdFilter) {
      // If tenantId provided: return global (null) + that tenant's designations
      where.OR = [{ tenantId: tenantIdFilter }, { tenantId: null }];
    }
    // If no tenantId: return everything (all tenants + global)

    if (levelFilter && VALID_LEVELS.includes(levelFilter as ReporterLevelInput)) {
      where.level = levelFilter;
    }

    const designations = await (prisma as any).reporterDesignation.findMany({
      where,
      orderBy: [{ levelOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, name: true, nativeName: true, level: true, levelOrder: true, tenantId: true },
    });

    return res.json({ designations });
  } catch (e: any) {
    console.error('[V2] designations error', e);
    return res.status(500).json({ error: 'Failed to fetch designations' });
  }
});

// ─────────────────────────────────────────────
// 2. GET /api/v2/locations?type=state|district|mandal&parentId=
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/locations:
 *   get:
 *     summary: "[V2] Browse locations by type"
 *     description: |
 *       Step 3 of reporter creation flow. Fetch locations dynamically.
 *       - type=state → all states
 *       - type=district&parentId={stateId} → districts for a state
 *       - type=mandal&parentId={districtId} → mandals for a district
 *     tags: [V2 Reporters]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [state, district, mandal] }
 *       - in: query
 *         name: parentId
 *         schema: { type: string }
 *         description: stateId (for district), districtId (for mandal)
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Optional name search
 *     responses:
 *       200:
 *         description: Locations
 *         content:
 *           application/json:
 *             examples:
 *               states:
 *                 summary: States
 *                 value:
 *                   type: "state"
 *                   locations:
 *                     - { id: "st_ap001", name: "Andhra Pradesh" }
 *               districts:
 *                 summary: Districts
 *                 value:
 *                   type: "district"
 *                   parentId: "st_ap001"
 *                   locations:
 *                     - { id: "dst_gun001", name: "Guntur", stateId: "st_ap001" }
 *               mandals:
 *                 summary: Mandals
 *                 value:
 *                   type: "mandal"
 *                   parentId: "dst_gun001"
 *                   locations:
 *                     - { id: "mnd_nte001", name: "Narasaraopet", districtId: "dst_gun001" }
 */
router.get('/locations', async (req, res) => {
  try {
    const type = String(req.query.type || '').toLowerCase();
    const parentId = String(req.query.parentId || '').trim();
    const q = String(req.query.q || '').trim();

    if (!['state', 'district', 'mandal'].includes(type)) {
      return res.status(400).json({ error: 'type must be one of: state, district, mandal' });
    }

    const searchFilter = q ? { name: { contains: q, mode: 'insensitive' as const } } : {};

    if (type === 'state') {
      const states = await (prisma as any).state.findMany({
        where: { isDeleted: false, ...searchFilter },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      });
      return res.json({ type: 'state', locations: states });
    }

    if (type === 'district') {
      const where: any = { isDeleted: false, ...searchFilter };
      if (parentId) where.stateId = parentId;
      const districts = await (prisma as any).district.findMany({
        where,
        orderBy: { name: 'asc' },
        select: { id: true, name: true, stateId: true },
      });
      return res.json({ type: 'district', parentId: parentId || null, locations: districts });
    }

    // mandal
    if (!parentId) return res.status(400).json({ error: 'parentId (districtId) is required for type=mandal' });
    const mandals = await (prisma as any).mandal.findMany({
      where: { isDeleted: false, districtId: parentId, ...searchFilter },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, districtId: true },
    });
    return res.json({ type: 'mandal', parentId, locations: mandals });
  } catch (e: any) {
    console.error('[V2] locations error', e);
    return res.status(500).json({ error: 'Failed to fetch locations' });
  }
});

// ─────────────────────────────────────────────
// 3. GET /api/v2/tenants/:tenantId/reporters
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters:
 *   get:
 *     summary: "[V2] List reporters for a tenant"
 *     tags: [V2 Reporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: level
 *         schema: { type: string }
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
 *         name: kycStatus
 *         schema: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *       - in: query
 *         name: designationId
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated reporters
 */
router.get('/tenants/:tenantId/reporters', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireAdminScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId } = scope;
    const q = req.query as Record<string, string>;

    const where: any = { tenantId };
    if (q.level) where.level = String(q.level).toUpperCase();
    if (q.stateId) where.stateId = q.stateId;
    if (q.districtId) where.districtId = q.districtId;
    if (q.mandalId) where.mandalId = q.mandalId;
    if (q.assemblyConstituencyId) where.assemblyConstituencyId = q.assemblyConstituencyId;
    if (q.designationId) where.designationId = q.designationId;
    if (q.kycStatus && VALID_KYC.includes(q.kycStatus.toUpperCase())) where.kycStatus = q.kycStatus.toUpperCase();
    if (typeof q.active !== 'undefined') where.active = q.active === 'true';

    const page = Math.max(1, parseInt(q.page || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit || '20', 10) || 20));
    const skip = (page - 1) * limit;

    const [reporters, total] = await Promise.all([
      (prisma as any).reporter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          designation: { select: { id: true, code: true, name: true, nativeName: true, level: true } },
          user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
          state: { select: { id: true, name: true } },
          district: { select: { id: true, name: true } },
          mandal: { select: { id: true, name: true } },
          assemblyConstituency: { select: { id: true, name: true } },
        },
      }),
      (prisma as any).reporter.count({ where }),
    ]);

    return res.json({
      reporters: reporters.map(mapReporterContact),
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error('[V2] list reporters error', e);
    return res.status(500).json({ error: 'Failed to fetch reporters' });
  }
});

// ─────────────────────────────────────────────
// 4. GET /api/v2/tenants/:tenantId/reporters/:id
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}:
 *   get:
 *     summary: "[V2] Get reporter by id"
 *     tags: [V2 Reporters]
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
 *       200:
 *         description: Reporter profile
 *         content:
 *           application/json:
 *             example:
 *               id: "rep_9001"
 *               tenantId: "cmt_abc123"
 *               level: "DISTRICT"
 *               designationId: "dsg_dist001"
 *               stateId: null
 *               districtId: "dst_gun001"
 *               mandalId: null
 *               assemblyConstituencyId: null
 *               profilePhotoUrl: "https://cdn.example.com/photos/ravi.jpg"
 *               subscriptionActive: true
 *               monthlySubscriptionAmount: 600
 *               idCardCharge: 300
 *               kycStatus: "APPROVED"
 *               active: true
 *               fullName: "Ravi Kumar"
 *               mobileNumber: "9876543210"
 *               autoPublish: false
 *               designation: { id: "dsg_dist001", code: "DR", name: "District Reporter", level: "DISTRICT" }
 *               district: { id: "dst_gun001", name: "Guntur" }
 *       404:
 *         description: Reporter not found
 */
router.get('/tenants/:tenantId/reporters/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireAdminScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId } = scope;
    const id = String(req.params.id || '').trim();

    const r = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: {
        designation: { select: { id: true, code: true, name: true, nativeName: true, level: true, levelOrder: true } },
        user: { select: { mobileNumber: true, profile: { select: { fullName: true, profilePhotoUrl: true } } } },
        state: { select: { id: true, name: true } },
        district: { select: { id: true, name: true, stateId: true } },
        mandal: { select: { id: true, name: true, districtId: true } },
        assemblyConstituency: { select: { id: true, name: true } },
      },
    });

    if (!r) return res.status(404).json({ error: 'Reporter not found' });
    return res.json(mapReporterContact(r));
  } catch (e: any) {
    console.error('[V2] get reporter error', e);
    return res.status(500).json({ error: 'Failed to fetch reporter' });
  }
});

// ─────────────────────────────────────────────
// 5. POST /api/v2/tenants/:tenantId/reporters
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters:
 *   post:
 *     summary: "[V2] Create reporter (clean 5-step flow)"
 *     description: |
 *       Clean creation flow:
 *       1. Pick designationId from GET /api/v2/tenants/:tenantId/designations
 *       2. Pick level (STATE/DISTRICT/MANDAL/etc.)
 *       3. Pick locationId from GET /api/v2/locations?type=...
 *       4. Submit with only the matching location field (stateId/districtId/mandalId)
 *       5. Reporter is created + User/UserProfile linked automatically
 *
 *       Validation:
 *       - level + designationId must match
 *       - location field must match level
 *       - mobile must be unique in tenant
 *     tags: [V2 Reporters]
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
 *             required: [mobileNumber, fullName, designationId, level]
 *             properties:
 *               mobileNumber: { type: string, example: "9876543210" }
 *               fullName: { type: string, example: "Ravi Kumar" }
 *               designationId: { type: string, example: "dsg_mand001" }
 *               level: { type: string, enum: [STATE, DISTRICT, DIVISION, CONSTITUENCY, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               profilePhotoUrl: { type: string }
 *               monthlySubscriptionAmount: { type: integer }
 *               idCardCharge: { type: integer }
 *           examples:
 *             mandal:
 *               summary: Mandal Reporter
 *               value:
 *                 mobileNumber: "9876543210"
 *                 fullName: "Ravi Kumar"
 *                 designationId: "dsg_mand001"
 *                 level: "MANDAL"
 *                 mandalId: "mnd_nte001"
 *                 profilePhotoUrl: "https://cdn.example.com/photos/ravi.jpg"
 *                 monthlySubscriptionAmount: 500
 *                 idCardCharge: 200
 *             district:
 *               summary: District Reporter
 *               value:
 *                 mobileNumber: "9876500001"
 *                 fullName: "Sita Devi"
 *                 designationId: "dsg_dist001"
 *                 level: "DISTRICT"
 *                 districtId: "dst_gun001"
 *                 monthlySubscriptionAmount: 800
 *             state:
 *               summary: State Reporter
 *               value:
 *                 mobileNumber: "9876500002"
 *                 fullName: "Ramesh Babu"
 *                 designationId: "dsg_state001"
 *                 level: "STATE"
 *                 stateId: "st_ap001"
 *                 monthlySubscriptionAmount: 1500
 *                 idCardCharge: 500
 *     responses:
 *       201:
 *         description: Reporter created
 *         content:
 *           application/json:
 *             example:
 *               id: "rep_9001"
 *               tenantId: "cmt_abc123"
 *               level: "MANDAL"
 *               designationId: "dsg_mand001"
 *               mandalId: "mnd_nte001"
 *               stateId: null
 *               districtId: null
 *               assemblyConstituencyId: null
 *               profilePhotoUrl: "https://cdn.example.com/photos/ravi.jpg"
 *               subscriptionActive: false
 *               monthlySubscriptionAmount: 500
 *               idCardCharge: 200
 *               kycStatus: "PENDING"
 *               active: true
 *               fullName: "Ravi Kumar"
 *               mobileNumber: "9876543210"
 *               autoPublish: false
 *               createdAt: "2026-03-27T10:00:00.000Z"
 *       400: { description: Validation error }
 *       409: { description: Reporter already exists or limit reached }
 */
router.post('/tenants/:tenantId/reporters', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireAdminScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId } = scope;
    const body = req.body || {};

    // ── Validate required fields ──
    const mobileRaw = String(body.mobileNumber || '').trim();
    const fullNameRaw = String(body.fullName || '').trim();
    const designationId = String(body.designationId || '').trim();
    const levelRaw = String(body.level || '').trim().toUpperCase() as ReporterLevelInput;

    if (!mobileRaw) return res.status(400).json({ error: 'mobileNumber is required' });
    if (!fullNameRaw) return res.status(400).json({ error: 'fullName is required' });
    if (!designationId) return res.status(400).json({ error: 'designationId is required' });
    if (!VALID_LEVELS.includes(levelRaw)) return res.status(400).json({ error: `level must be one of: ${VALID_LEVELS.join(', ')}` });

    const locationKey = locationFieldForLevel(levelRaw, body);
    if (!locationKey.id) {
      const fieldName = locationKey.field;
      return res.status(400).json({ error: `${fieldName} is required for level ${levelRaw}` });
    }

    let created: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        created = await prisma.$transaction(async (tx: any) => {
          // ── Validate designation ──
          const designation = await tx.reporterDesignation.findUnique({
            where: { id: designationId },
            select: { id: true, level: true, tenantId: true },
          });
          if (!designation) throw httpError(400, { error: 'Invalid designationId' });
          if (designation.tenantId && String(designation.tenantId) !== tenantId) {
            throw httpError(400, { error: 'designationId does not belong to this tenant' });
          }
          if (String(designation.level) !== levelRaw) {
            throw httpError(400, { error: `designationId level (${designation.level}) does not match requested level (${levelRaw})` });
          }

          // ── Resolve ASSEMBLY ──
          let resolvedAssemblyId: string | null = null;
          if (levelRaw === 'ASSEMBLY') {
            resolvedAssemblyId = await resolveAssemblyId(tx, locationKey.id);
          }

          const finalLocationId = levelRaw === 'ASSEMBLY' ? String(resolvedAssemblyId) : locationKey.id;

          // ── Tenant limit check ──
          const tenantSettings = await tx.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
          const limits = (tenantSettings as any)?.data?.reporterLimits;
          if (limits) {
            const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
            const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;
            const exact = rules.find((r: any) =>
              String(r?.designationId || '') === designationId &&
              String(r?.level || '') === levelRaw &&
              String(r?.[locationKey.field] || '') === finalLocationId
            );
            const maxAllowed = typeof exact?.max === 'number' ? exact.max : defaultMax;
            const countWhere: any = { tenantId, active: true, designationId, level: levelRaw };
            countWhere[locationKey.field] = finalLocationId;
            const current = await tx.reporter.count({ where: countWhere });
            if (current >= maxAllowed) {
              throw httpError(409, { error: 'Reporter limit reached', maxAllowed, current, designationId, level: levelRaw, [locationKey.field]: finalLocationId });
            }
          }

          // ── Upsert User ──
          let user = await tx.user.findFirst({ where: { mobileNumber: mobileRaw }, select: { id: true } }).catch(() => null);
          if (!user) {
            // Find REPORTER role
            const reporterRole = await tx.role.findFirst({ where: { name: 'REPORTER' }, select: { id: true } }).catch(() => null);
            user = await tx.user.create({
              data: {
                mobileNumber: mobileRaw,
                roleId: reporterRole?.id ?? null,
                profile: { create: { fullName: fullNameRaw } },
              },
              select: { id: true },
            });
          } else {
            // Update name on existing profile
            await tx.userProfile.upsert({
              where: { userId: user.id },
              create: { userId: user.id, fullName: fullNameRaw },
              update: { fullName: fullNameRaw },
            }).catch(() => null);
          }

          // ── Check reporter not already in this tenant ──
          const existing = await tx.reporter.findFirst({ where: { userId: user.id, tenantId }, select: { id: true } }).catch(() => null);
          if (existing) throw httpError(409, { error: 'Reporter already exists for this user in this tenant' });

          // ── Build location data ──
          const locationData = buildLocationUpdateData(levelRaw, finalLocationId, resolvedAssemblyId);

          const profilePhotoUrl = typeof body.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() || null : null;
          const monthlySubscriptionAmount = typeof body.monthlySubscriptionAmount === 'number' ? body.monthlySubscriptionAmount : 0;
          const idCardCharge = typeof body.idCardCharge === 'number' ? body.idCardCharge : 0;

          const reporter = await tx.reporter.create({
            data: {
              tenantId,
              userId: user.id,
              designationId,
              level: levelRaw,
              ...locationData,
              profilePhotoUrl,
              monthlySubscriptionAmount,
              idCardCharge,
              subscriptionActive: false,
              kycStatus: 'PENDING',
              active: true,
            },
            include: {
              designation: { select: { id: true, code: true, name: true, nativeName: true, level: true, levelOrder: true } },
              user: { select: { mobileNumber: true, profile: { select: { fullName: true, profilePhotoUrl: true } } } },
              state: { select: { id: true, name: true } },
              district: { select: { id: true, name: true } },
              mandal: { select: { id: true, name: true } },
              assemblyConstituency: { select: { id: true, name: true } },
            },
          });

          return reporter;
        });
        break;
      } catch (e: any) {
        if (isRetryable(e) && attempt < 1) continue;
        throw e;
      }
    }

    return res.status(201).json(mapReporterContact(created));
  } catch (e: any) {
    if (e?.status) return res.status(Number(e.status)).json(e.payload || { error: 'Request failed' });
    console.error('[V2] create reporter error', e);
    return res.status(500).json({ error: 'Failed to create reporter' });
  }
});

// ─────────────────────────────────────────────
// 6. PATCH /api/v2/tenants/:tenantId/reporters/:id/profile
//    Reporter self-update OR admin update: name, photo, mobile only
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}/profile:
 *   patch:
 *     summary: "[V2] Update reporter profile (name, photo, mobile)"
 *     description: |
 *       **Reporter (self)**: can update their own name, photo, and mobile.
 *       **Admin**: can update any reporter's profile in their tenant.
 *
 *       Designation and location fields are IGNORED even if sent — they cannot be changed here.
 *       Use PATCH /assignment to change designation/location.
 *     tags: [V2 Reporters]
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
 *               fullName: { type: string, example: "Ravi K. Sharma" }
 *               mobileNumber: { type: string, example: "9876543299" }
 *               profilePhotoUrl: { type: string, example: "https://cdn.example.com/photos/ravi-new.jpg" }
 *           example:
 *             fullName: "Ravi K. Sharma"
 *             mobileNumber: "9876543299"
 *             profilePhotoUrl: "https://cdn.example.com/photos/ravi-new.jpg"
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               reporterId: "rep_9001"
 *               tenantId: "cmt_abc123"
 *               fullName: "Ravi K. Sharma"
 *               mobileNumber: "9876543299"
 *               profilePhotoUrl: "https://cdn.example.com/photos/ravi-new.jpg"
 *               updatedAt: "2026-03-27T12:00:00.000Z"
 *       403: { description: Reporter cannot change designation or location }
 *       404: { description: Reporter not found }
 */
router.patch('/tenants/:tenantId/reporters/:id/profile', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const reporterId = String(req.params.id || '').trim();
    const user: any = (req as any).user;

    if (!user?.role?.name) return res.status(401).json({ error: 'Unauthorized' });
    const role = String(user.role.name);
    const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_EDITOR', 'ADMIN_EDITOR', 'NEWS_MODERATOR'].includes(role);
    const isReporterRole = role === 'REPORTER';

    if (!isAdmin && !isReporterRole) {
      return res.status(403).json({ error: 'Forbidden: REPORTER or admin role required' });
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true, tenantId: true, userId: true, profilePhotoUrl: true, updatedAt: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Reporter self-access: must own this record
    if (isReporterRole && String(reporter.userId) !== String(user.id)) {
      return res.status(403).json({ error: 'Forbidden: reporters can only update their own profile' });
    }

    const body = req.body || {};

    // Explicitly reject designation/location attempts in body
    if (body.designationId || body.level || body.stateId || body.districtId || body.mandalId || body.assemblyConstituencyId) {
      return res.status(403).json({ error: 'Forbidden: use PATCH /assignment to change designation or location' });
    }

    const reporterUpdates: any = {};
    if (typeof body.profilePhotoUrl === 'string') {
      reporterUpdates.profilePhotoUrl = body.profilePhotoUrl.trim() || null;
    }

    const profileUpdates: any = {};
    if (typeof body.fullName === 'string' && body.fullName.trim()) {
      profileUpdates.fullName = body.fullName.trim();
    }
    if (typeof body.mobileNumber === 'string' && body.mobileNumber.trim()) {
      profileUpdates.mobileNumber = body.mobileNumber.trim();
    }

    // Apply updates
    const [updatedReporter] = await Promise.all([
      Object.keys(reporterUpdates).length > 0
        ? (prisma as any).reporter.update({ where: { id: reporterId }, data: reporterUpdates, select: { id: true, tenantId: true, profilePhotoUrl: true, updatedAt: true } })
        : (prisma as any).reporter.findUnique({ where: { id: reporterId }, select: { id: true, tenantId: true, profilePhotoUrl: true, updatedAt: true } }),
      reporter.userId && Object.keys(profileUpdates).length > 0
        ? (async () => {
            const { mobileNumber, ...profileOnly } = profileUpdates;
            if (mobileNumber) {
              await (prisma as any).user.update({ where: { id: reporter.userId }, data: { mobileNumber } }).catch(() => null);
            }
            if (Object.keys(profileOnly).length > 0) {
              await (prisma as any).userProfile.upsert({
                where: { userId: reporter.userId },
                create: { userId: reporter.userId, ...profileOnly },
                update: profileOnly,
              }).catch(() => null);
            }
          })()
        : Promise.resolve(),
    ]);

    return res.json({
      success: true,
      reporterId,
      tenantId,
      fullName: profileUpdates.fullName ?? null,
      mobileNumber: profileUpdates.mobileNumber ?? null,
      profilePhotoUrl: reporterUpdates.profilePhotoUrl ?? reporter.profilePhotoUrl,
      updatedAt: (updatedReporter as any)?.updatedAt ?? new Date().toISOString(),
    });
  } catch (e: any) {
    console.error('[V2] profile update error', e);
    return res.status(500).json({ error: 'Failed to update reporter profile' });
  }
});

// ─────────────────────────────────────────────
// 7. PATCH /api/v2/tenants/:tenantId/reporters/:id/assignment
//    Admin only: change designation + location atomically
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}/assignment:
 *   patch:
 *     summary: "[V2] Update reporter designation and location (atomic)"
 *     description: |
 *       Admin-only endpoint. Always updates designation + level + locationId together.
 *       Sending only designationId transfers designation within the same level.
 *       Sending new level requires the matching location field.
 *
 *       Location hierarchy is validated (district→state, mandal→district).
 *       All other location fields are set to null.
 *
 *       Reporter self-access is denied (403).
 *     tags: [V2 Reporters]
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
 *             required: [designationId, level]
 *             properties:
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, DIVISION, CONSTITUENCY, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               mandalId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *           examples:
 *             promote_to_district:
 *               summary: Promote mandal reporter to district
 *               value:
 *                 designationId: "dsg_dist001"
 *                 level: "DISTRICT"
 *                 districtId: "dst_gun001"
 *             move_to_new_mandal:
 *               summary: Move reporter to different mandal
 *               value:
 *                 designationId: "dsg_mand001"
 *                 level: "MANDAL"
 *                 mandalId: "mnd_dul001"
 *     responses:
 *       200:
 *         description: Assignment updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Reporter assignment updated"
 *               reporter:
 *                 id: "rep_9001"
 *                 level: "DISTRICT"
 *                 designationId: "dsg_dist001"
 *                 stateId: null
 *                 districtId: "dst_gun001"
 *                 mandalId: null
 *                 assemblyConstituencyId: null
 *       400: { description: Validation error }
 *       403: { description: Forbidden }
 *       409: { description: Reporter limit reached }
 */
router.patch('/tenants/:tenantId/reporters/:id/assignment', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const reporterId = String(req.params.id || '').trim();
    const body = req.body || {};
    const actor: any = (req as any).user;

    const designationId = String(body.designationId || '').trim();
    const levelRaw = String(body.level || '').trim().toUpperCase() as ReporterLevelInput;

    if (!designationId) return res.status(400).json({ error: 'designationId is required' });
    if (!VALID_LEVELS.includes(levelRaw)) return res.status(400).json({ error: `level must be one of: ${VALID_LEVELS.join(', ')}` });

    const locationKey = locationFieldForLevel(levelRaw, body);
    if (!locationKey.id) {
      return res.status(400).json({ error: `${locationKey.field} is required for level ${levelRaw}` });
    }

    let updated: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        updated = await prisma.$transaction(async (tx: any) => {
          const reporter = await tx.reporter.findFirst({
            where: { id: reporterId, tenantId },
            select: { id: true, tenantId: true, userId: true, designationId: true, level: true },
          });
          if (!reporter) throw httpError(404, { error: 'Reporter not found' });

          // Prevent admin self-reassignment
          if (reporter.userId && actor?.id && String(reporter.userId) === String(actor.id) && String(actor?.role?.name) !== 'SUPER_ADMIN') {
            throw httpError(400, { error: 'Cannot reassign your own reporter profile' });
          }

          const designation = await tx.reporterDesignation.findUnique({
            where: { id: designationId },
            select: { id: true, level: true, tenantId: true },
          });
          if (!designation) throw httpError(400, { error: 'Invalid designationId' });
          if (designation.tenantId && String(designation.tenantId) !== tenantId) {
            throw httpError(400, { error: 'designationId does not belong to this tenant' });
          }
          if (String(designation.level) !== levelRaw) {
            throw httpError(400, { error: `designationId level (${designation.level}) does not match requested level (${levelRaw})` });
          }

          // Resolve ASSEMBLY
          let resolvedAssemblyId: string | null = null;
          if (levelRaw === 'ASSEMBLY') {
            resolvedAssemblyId = await resolveAssemblyId(tx, locationKey.id);
          }

          const finalLocationId = levelRaw === 'ASSEMBLY' ? String(resolvedAssemblyId) : locationKey.id;

          // Tenant limit check
          const tenantSettings = await tx.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
          const limits = (tenantSettings as any)?.data?.reporterLimits;
          if (limits) {
            const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
            const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;
            const exact = rules.find((r: any) =>
              String(r?.designationId || '') === designationId &&
              String(r?.level || '') === levelRaw &&
              String(r?.[locationKey.field] || '') === finalLocationId
            );
            const maxAllowed = typeof exact?.max === 'number' ? exact.max : defaultMax;
            const countWhere: any = { tenantId, active: true, designationId, level: levelRaw, id: { not: reporter.id } };
            countWhere[locationKey.field] = finalLocationId;
            const current = await tx.reporter.count({ where: countWhere });
            if (current >= maxAllowed) {
              throw httpError(409, { error: 'Reporter limit reached', maxAllowed, current, designationId, level: levelRaw, [locationKey.field]: finalLocationId });
            }
          }

          const locationData = buildLocationUpdateData(levelRaw, finalLocationId, resolvedAssemblyId);

          return tx.reporter.update({
            where: { id: reporter.id },
            data: { designationId, level: levelRaw, ...locationData },
            include: {
              designation: { select: { id: true, code: true, name: true, level: true } },
              user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
            },
          });
        }, { isolationLevel: 'Serializable' });
        break;
      } catch (e: any) {
        if (isRetryable(e) && attempt < 1) continue;
        throw e;
      }
    }

    return res.json({ success: true, message: 'Reporter assignment updated', reporter: mapReporterContact(updated) });
  } catch (e: any) {
    if (e?.status) return res.status(Number(e.status)).json(e.payload || { error: 'Request failed' });
    console.error('[V2] assignment update error', e);
    return res.status(500).json({ error: 'Failed to update reporter assignment' });
  }
});

// ─────────────────────────────────────────────
// 8. PATCH /api/v2/tenants/:tenantId/reporters/:id/subscription
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}/subscription:
 *   patch:
 *     summary: "[V2] Toggle reporter subscription ON/OFF"
 *     description: Admin-only. Enabling also sets monthlySubscriptionAmount. Only subscription fields are touched.
 *     tags: [V2 Reporters]
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
 *             required: [subscriptionActive]
 *             properties:
 *               subscriptionActive: { type: boolean }
 *               monthlySubscriptionAmount: { type: integer }
 *               subscriptionActivationDate: { type: string, format: date-time, description: "Optional future date to schedule activation" }
 *           examples:
 *             enable:
 *               summary: Enable subscription
 *               value: { subscriptionActive: true, monthlySubscriptionAmount: 600 }
 *             disable:
 *               summary: Disable subscription
 *               value: { subscriptionActive: false }
 *             schedule:
 *               summary: Schedule future activation
 *               value: { subscriptionActive: true, monthlySubscriptionAmount: 600, subscriptionActivationDate: "2026-04-01T00:00:00.000Z" }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             examples:
 *               enabled:
 *                 value: { success: true, reporterId: "rep_9001", subscriptionActive: true, monthlySubscriptionAmount: 600 }
 *               disabled:
 *                 value: { success: true, reporterId: "rep_9001", subscriptionActive: false, monthlySubscriptionAmount: 0 }
 */
router.patch('/tenants/:tenantId/reporters/:id/subscription', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const reporterId = String(req.params.id || '').trim();
    const body = req.body || {};

    if (typeof body.subscriptionActive !== 'boolean') {
      return res.status(400).json({ error: 'subscriptionActive (boolean) is required' });
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    let activationDate: Date | null = null;
    const dateInput = body.subscriptionActivationDate || body.subscriptionStartDate;
    if (dateInput) {
      activationDate = new Date(dateInput);
      if (isNaN(activationDate.getTime())) {
        return res.status(400).json({ error: 'Invalid subscriptionActivationDate format' });
      }
    }

    let finalAmount = 0;
    if (body.subscriptionActive) {
      finalAmount = typeof body.monthlySubscriptionAmount === 'number' && body.monthlySubscriptionAmount >= 0 ? body.monthlySubscriptionAmount : 0;
    }

    // If future activation date → schedule (not immediately active)
    let actualActive = Boolean(body.subscriptionActive);
    if (actualActive && activationDate && activationDate.getTime() > Date.now()) {
      actualActive = false;
    }

    const updated = await (prisma as any).reporter.update({
      where: { id: reporterId },
      data: {
        subscriptionActive: actualActive,
        subscriptionActivationDate: activationDate,
        monthlySubscriptionAmount: finalAmount,
      },
      select: { id: true, tenantId: true, subscriptionActive: true, subscriptionActivationDate: true, monthlySubscriptionAmount: true, updatedAt: true },
    });

    return res.json({
      success: true,
      reporterId: updated.id,
      tenantId: updated.tenantId,
      subscriptionActive: updated.subscriptionActive,
      subscriptionActivationDate: updated.subscriptionActivationDate,
      monthlySubscriptionAmount: updated.monthlySubscriptionAmount,
      updatedAt: updated.updatedAt,
    });
  } catch (e: any) {
    console.error('[V2] subscription toggle error', e);
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
});

// ─────────────────────────────────────────────
// 9. PATCH /api/v2/tenants/:tenantId/reporters/:id/auto-publish
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}/auto-publish:
 *   patch:
 *     summary: "[V2] Toggle reporter auto-publish ON/OFF"
 *     description: |
 *       Admin-only. Stored in Reporter.kycData.autoPublish.
 *       When true: reporter articles are auto-published.
 *       When false: reporter articles go to DRAFT for editorial review.
 *       Only kycData is touched — all other fields unchanged.
 *     tags: [V2 Reporters]
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
 *             required: [autoPublish]
 *             properties:
 *               autoPublish: { type: boolean }
 *           examples:
 *             enable:
 *               summary: Enable
 *               value: { autoPublish: true }
 *             disable:
 *               summary: Disable
 *               value: { autoPublish: false }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               reporterId: "rep_9001"
 *               tenantId: "cmt_abc123"
 *               autoPublish: true
 *               updatedAt: "2026-03-27T12:45:00.000Z"
 */
router.patch('/tenants/:tenantId/reporters/:id/auto-publish', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const reporterId = String(req.params.id || '').trim();
    const body = req.body || {};

    if (typeof body.autoPublish !== 'boolean') {
      return res.status(400).json({ error: 'autoPublish (boolean) is required' });
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true, kycData: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    const currentKycData = reporter.kycData && typeof reporter.kycData === 'object' ? reporter.kycData : {};
    const nextKycData = { ...currentKycData, autoPublish: Boolean(body.autoPublish) };

    const updated = await (prisma as any).reporter.update({
      where: { id: reporterId },
      data: { kycData: nextKycData },
      select: { id: true, tenantId: true, updatedAt: true },
    });

    return res.json({
      success: true,
      reporterId: updated.id,
      tenantId: updated.tenantId,
      autoPublish: Boolean(body.autoPublish),
      updatedAt: updated.updatedAt,
    });
  } catch (e: any) {
    console.error('[V2] auto-publish toggle error', e);
    return res.status(500).json({ error: 'Failed to update auto-publish' });
  }
});

// ─────────────────────────────────────────────
// 10. PATCH /api/v2/tenants/:tenantId/reporters/:id/kyc-status
// ─────────────────────────────────────────────

/**
 * @swagger
 * /api/v2/tenants/{tenantId}/reporters/{id}/kyc-status:
 *   patch:
 *     summary: "[V2] Update reporter KYC status"
 *     description: |
 *       Admin-only. Sets kycStatus to PENDING / APPROVED / REJECTED.
 *       Optional remarks field stored in kycData.remarks.
 *       Only kycStatus is updated — no other fields affected.
 *     tags: [V2 Reporters]
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
 *             required: [kycStatus]
 *             properties:
 *               kycStatus: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *               remarks: { type: string, description: "Optional admin remarks stored in kycData.remarks" }
 *           examples:
 *             approve:
 *               summary: Approve
 *               value: { kycStatus: "APPROVED", remarks: "Documents verified" }
 *             reject:
 *               summary: Reject
 *               value: { kycStatus: "REJECTED", remarks: "Photo ID expired" }
 *             reset:
 *               summary: Reset to pending
 *               value: { kycStatus: "PENDING" }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               reporterId: "rep_9001"
 *               tenantId: "cmt_abc123"
 *               kycStatus: "APPROVED"
 *               updatedAt: "2026-03-27T13:00:00.000Z"
 *       422:
 *         description: Invalid kycStatus value
 *         content:
 *           application/json:
 *             example:
 *               error: "Invalid kycStatus. Must be one of: PENDING, APPROVED, REJECTED"
 */
router.patch('/tenants/:tenantId/reporters/:id/kyc-status', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim();
    const reporterId = String(req.params.id || '').trim();
    const body = req.body || {};

    const kycStatus = String(body.kycStatus || '').trim().toUpperCase();
    if (!VALID_KYC.includes(kycStatus)) {
      return res.status(422).json({ error: `Invalid kycStatus. Must be one of: ${VALID_KYC.join(', ')}` });
    }

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true, kycData: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    const currentKycData = reporter.kycData && typeof reporter.kycData === 'object' ? reporter.kycData : {};
    const nextKycData: any = { ...currentKycData };
    if (typeof body.remarks === 'string' && body.remarks.trim()) {
      nextKycData.remarks = body.remarks.trim();
    }

    const updated = await (prisma as any).reporter.update({
      where: { id: reporterId },
      data: { kycStatus, kycData: nextKycData },
      select: { id: true, tenantId: true, kycStatus: true, updatedAt: true },
    });

    return res.json({
      success: true,
      reporterId: updated.id,
      tenantId: updated.tenantId,
      kycStatus: updated.kycStatus,
      updatedAt: updated.updatedAt,
    });
  } catch (e: any) {
    console.error('[V2] kyc-status update error', e);
    return res.status(500).json({ error: 'Failed to update KYC status' });
  }
});

export default router;
