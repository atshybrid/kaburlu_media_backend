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

type ReporterLevelInput = 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY';

type RoleName = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'REPORTER' | string;

function isAllowedCreatorRole(roleName: RoleName) {
  return roleName === 'SUPER_ADMIN' || roleName === 'TENANT_ADMIN' || roleName === 'REPORTER';
}

function allowedChildLevelsForCreator(creatorLevel: ReporterLevelInput): ReporterLevelInput[] {
  if (creatorLevel === 'STATE') return ['DISTRICT', 'ASSEMBLY', 'MANDAL'];
  if (creatorLevel === 'DISTRICT') return ['ASSEMBLY', 'MANDAL'];
  if (creatorLevel === 'ASSEMBLY') return ['MANDAL'];
  return [];
}

async function assertReporterCanCreateWithinChildScope(tx: any, input: {
  creator: any;
  requestedLevel: ReporterLevelInput;
  requestedLocation: { field: 'stateId' | 'districtId' | 'mandalId' | 'assemblyConstituencyId'; id: string };
}) {
  const creatorLevel = String(input.creator?.level || '') as ReporterLevelInput;
  if (!['STATE', 'DISTRICT', 'MANDAL', 'ASSEMBLY'].includes(creatorLevel)) {
    throw httpError(403, { error: 'Reporter scope missing or invalid' });
  }

  const allowedChildren = allowedChildLevelsForCreator(creatorLevel);
  if (!allowedChildren.includes(input.requestedLevel)) {
    throw httpError(403, { error: 'Reporter can only create child-level reporters' });
  }

  // Validate location is within creator scope.
  if (creatorLevel === 'STATE') {
    const creatorStateId = String(input.creator?.stateId || '');
    if (!creatorStateId) throw httpError(403, { error: 'Reporter state scope missing' });

    if (input.requestedLevel === 'DISTRICT') {
      const district = await tx.district.findUnique({ where: { id: input.requestedLocation.id }, select: { stateId: true } });
      if (!district || String(district.stateId) !== creatorStateId) throw httpError(403, { error: 'Target district is outside reporter scope' });
      return;
    }

    if (input.requestedLevel === 'MANDAL') {
      const mandal = await tx.mandal.findUnique({
        where: { id: input.requestedLocation.id },
        select: { district: { select: { stateId: true } } },
      });
      if (!mandal || String(mandal.district.stateId) !== creatorStateId) throw httpError(403, { error: 'Target mandal is outside reporter scope' });
      return;
    }

    if (input.requestedLevel === 'ASSEMBLY') {
      const assembly = await tx.assemblyConstituency.findUnique({
        where: { id: input.requestedLocation.id },
        select: { district: { select: { stateId: true } } },
      });
      if (!assembly || String(assembly.district.stateId) !== creatorStateId) throw httpError(403, { error: 'Target assembly is outside reporter scope' });
      return;
    }
  }

  if (creatorLevel === 'DISTRICT') {
    const creatorDistrictId = String(input.creator?.districtId || '');
    if (!creatorDistrictId) throw httpError(403, { error: 'Reporter district scope missing' });

    if (input.requestedLevel === 'MANDAL') {
      const mandal = await tx.mandal.findUnique({ where: { id: input.requestedLocation.id }, select: { districtId: true } });
      if (!mandal || String(mandal.districtId) !== creatorDistrictId) throw httpError(403, { error: 'Target mandal is outside reporter scope' });
      return;
    }

    if (input.requestedLevel === 'ASSEMBLY') {
      const assembly = await tx.assemblyConstituency.findUnique({ where: { id: input.requestedLocation.id }, select: { districtId: true } });
      if (!assembly || String(assembly.districtId) !== creatorDistrictId) throw httpError(403, { error: 'Target assembly is outside reporter scope' });
      return;
    }
  }

  if (creatorLevel === 'ASSEMBLY') {
    const creatorAssemblyId = String(input.creator?.assemblyConstituencyId || '');
    if (!creatorAssemblyId) throw httpError(403, { error: 'Reporter assembly scope missing' });
    const creatorAssembly = await tx.assemblyConstituency.findUnique({ where: { id: creatorAssemblyId }, select: { districtId: true } });
    if (!creatorAssembly?.districtId) throw httpError(403, { error: 'Reporter assembly scope invalid' });

    // Best-effort: allow creating mandal reporters within the same district as the assembly.
    if (input.requestedLevel === 'MANDAL') {
      const mandal = await tx.mandal.findUnique({ where: { id: input.requestedLocation.id }, select: { districtId: true } });
      if (!mandal || String(mandal.districtId) !== String(creatorAssembly.districtId)) {
        throw httpError(403, { error: 'Target mandal is outside reporter scope' });
      }
      return;
    }
  }

  // Fallback deny.
  throw httpError(403, { error: 'Target location is outside reporter scope' });
}

function httpError(status: number, payload: any) {
  const err: any = new Error(payload?.error || payload?.message || 'Error');
  err.status = status;
  err.payload = payload;
  return err;
}

function isRetryableTransactionError(e: any) {
  // Prisma may surface Postgres serialization/deadlock issues as P2034.
  // Some drivers may bubble the SQLSTATE text.
  const code = String(e?.code || '');
  const msg = String(e?.message || '').toLowerCase();
  return code === 'P2034' || msg.includes('could not serialize access') || msg.includes('deadlock');
}

function getLocationKeyFromLevel(level: ReporterLevelInput, body: any): { field: 'stateId' | 'districtId' | 'mandalId' | 'assemblyConstituencyId'; id: string } {
  if (level === 'STATE') return { field: 'stateId', id: String(body.stateId || '') };
  if (level === 'DISTRICT') return { field: 'districtId', id: String(body.districtId || '') };
  if (level === 'MANDAL') return { field: 'mandalId', id: String(body.mandalId || '') };
  return { field: 'assemblyConstituencyId', id: String(body.assemblyConstituencyId || '') };
}

function pickReporterLimitMax(settingsData: any, input: { designationId: string; level: ReporterLevelInput; location: { field: string; id: string } }): number | undefined {
  const limits = settingsData?.reporterLimits;
  if (!limits || limits.enabled !== true) return undefined;

  const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
  const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;

  const locationField = input.location.field;
  const locationId = input.location.id;

  // Priority:
  // 1) exact match: designationId + level + specific location id
  // 2) wildcard location: designationId + level (no location fields)
  // 3) wildcard level+location: designationId only
  const exact = rules.find(r =>
    String(r?.designationId || '') === input.designationId &&
    String(r?.level || '') === input.level &&
    String(r?.[locationField] || '') === locationId
  );
  if (typeof exact?.max === 'number') return exact.max;

  const wildcardLocation = rules.find(r =>
    String(r?.designationId || '') === input.designationId &&
    String(r?.level || '') === input.level &&
    !r?.stateId && !r?.districtId && !r?.mandalId && !r?.assemblyConstituencyId
  );
  if (typeof wildcardLocation?.max === 'number') return wildcardLocation.max;

  const wildcardDesignation = rules.find(r => String(r?.designationId || '') === input.designationId && !r?.level);
  if (typeof wildcardDesignation?.max === 'number') return wildcardDesignation.max;

  return defaultMax;
}

type ReporterPricingConfig = {
  subscriptionEnabled?: boolean;
  currency?: string;
  defaultMonthlyAmount?: number;
  defaultIdCardCharge?: number;
  byDesignation?: Array<{ designationId: string; monthlyAmount?: number; idCardCharge?: number }>;
};

function normalizePricingFromSettings(settingsData: any): ReporterPricingConfig {
  const raw = settingsData?.reporterPricing;
  if (!raw || typeof raw !== 'object') return {};
  return raw as ReporterPricingConfig;
}

function resolvePricingForDesignation(pricing: ReporterPricingConfig, designationId: string) {
  const subscriptionEnabled = pricing.subscriptionEnabled === true;
  const defaultMonthlyAmount = typeof pricing.defaultMonthlyAmount === 'number' ? pricing.defaultMonthlyAmount : 0;
  const defaultIdCardCharge = typeof pricing.defaultIdCardCharge === 'number' ? pricing.defaultIdCardCharge : 0;
  const row = Array.isArray(pricing.byDesignation) ? pricing.byDesignation.find((x) => String(x.designationId) === designationId) : undefined;
  const monthly = typeof row?.monthlyAmount === 'number' ? row.monthlyAmount : defaultMonthlyAmount;
  const idCard = typeof row?.idCardCharge === 'number' ? row.idCardCharge : defaultIdCardCharge;
  return {
    subscriptionEnabled,
    monthlySubscriptionAmount: subscriptionEnabled ? monthly : 0,
    idCardCharge: idCard,
  };
}

async function requireTenantEditorialScope(req: any, res: any): Promise<{ ok: true; tenantId: string } | { ok: false; status: number; error: string }> {
  const { tenantId } = req.params as any;
  const user: any = req.user;
  if (!user?.role?.name) return { ok: false, status: 401, error: 'Unauthorized' };

  const roleName = String(user.role.name);
  const allowed = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_EDITOR', 'ADMIN_EDITOR', 'NEWS_MODERATOR'];
  if (!allowed.includes(roleName)) return { ok: false, status: 403, error: 'Forbidden' };
  if (!tenantId) return { ok: false, status: 400, error: 'tenantId param required' };

  if (roleName === 'SUPER_ADMIN') return { ok: true, tenantId: String(tenantId) };

  // Tenant roles: ensure user is linked to a Reporter profile in the same tenant
  const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
  if (!rep?.tenantId) return { ok: false, status: 403, error: 'Reporter profile not linked to tenant' };
  if (String(rep.tenantId) !== String(tenantId)) return { ok: false, status: 403, error: 'Tenant scope mismatch' };
  return { ok: true, tenantId: String(tenantId) };
}

// POST /tenants/:tenantId/reporters - upsert user/profile and create reporter
/**
 * @swagger
 * /tenants/{tenantId}/reporters:
 *   post:
 *     summary: Create tenant reporter (creates/links User + UserProfile)
 *     description: |
 *       Roles allowed: SUPER_ADMIN, TENANT_ADMIN, REPORTER.
 *
 *       TENANT_ADMIN and REPORTER are tenant-scoped: the authenticated user must have a Reporter profile linked to the same tenant.
 *
 *       REPORTER can only create reporters in child location scope (e.g. STATE→DISTRICT/ASSEMBLY/MANDAL, DISTRICT→ASSEMBLY/MANDAL, ASSEMBLY→MANDAL)
 *       and must have `subscriptionActive=true`.
 *
 *       Reporter creation is subject to tenant settings `reporterLimits` stored under `TenantSettings.data.reporterLimits`.
 *       When enabled, default is `defaultMax=1` per (designationId + level + locationId) unless overridden by a matching rule.
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
 *       409:
 *         description: Reporter limit reached for this designation + location
 *         content:
 *           application/json:
 *             examples:
 *               limitReached:
 *                 value:
 *                   error: "Reporter limit reached"
 *                   maxAllowed: 1
 *                   current: 1
 *                   designationId: "desg_abc"
 *                   level: "MANDAL"
 *                   mandalId: "mandal_xyz"
 */
router.post('/tenants/:tenantId/reporters', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId } = req.params;
    const authUser: any = (req as any).user;
    const roleName: RoleName = String(authUser?.role?.name || '');
    if (!roleName) return res.status(401).json({ error: 'Unauthorized' });
    if (!isAllowedCreatorRole(roleName)) return res.status(403).json({ error: 'Forbidden' });

    const body = req.body || {};
    const { designationId, level, stateId, districtId, mandalId, assemblyConstituencyId } = body;
    const fullName: string | undefined = body.fullName;
    const mobileNumber: string | undefined = body.mobileNumber;
    if (!designationId || !level) return res.status(400).json({ error: 'designationId and level required' });
    if (!mobileNumber || !fullName) return res.status(400).json({ error: 'mobileNumber and fullName required' });

    const lvl = String(level) as ReporterLevelInput;
    if (!['STATE', 'DISTRICT', 'MANDAL', 'ASSEMBLY'].includes(lvl)) return res.status(400).json({ error: 'Invalid level' });

    const locationKey = getLocationKeyFromLevel(lvl, { stateId, districtId, mandalId, assemblyConstituencyId });
    if (!locationKey.id) {
      if (lvl === 'STATE') return res.status(400).json({ error: 'stateId required for STATE level' });
      if (lvl === 'DISTRICT') return res.status(400).json({ error: 'districtId required for DISTRICT level' });
      if (lvl === 'MANDAL') return res.status(400).json({ error: 'mandalId required for MANDAL level' });
      return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });
    }

    // If a REPORTER is creating another reporter, require created reporter to have subscription enabled.
    if (roleName === 'REPORTER' && body.subscriptionActive !== true) {
      return res.status(403).json({ error: 'subscriptionActive=true required when reporter creates another reporter' });
    }

    const normalizedMobile = String(mobileNumber).trim();

    let created: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        created = await prisma.$transaction(
          async (tx: any) => {
            // Role/tenant scoping.
            if (roleName !== 'SUPER_ADMIN') {
              const creatorReporter = await tx.reporter.findFirst({
                where: { userId: authUser.id },
                select: {
                  id: true,
                  tenantId: true,
                  level: true,
                  stateId: true,
                  districtId: true,
                  mandalId: true,
                  assemblyConstituencyId: true,
                  subscriptionActive: true,
                  active: true,
                },
              }).catch(() => null);

              if (!creatorReporter?.tenantId) throw httpError(403, { error: 'Reporter profile not linked to tenant' });
              if (String(creatorReporter.tenantId) !== String(tenantId)) throw httpError(403, { error: 'Tenant scope mismatch' });
              if (!creatorReporter.active) throw httpError(403, { error: 'Reporter account inactive' });

              if (roleName === 'REPORTER') {
                if (!creatorReporter.subscriptionActive) throw httpError(403, { error: 'Subscription must be active to create reporters' });
                await assertReporterCanCreateWithinChildScope(tx, {
                  creator: creatorReporter,
                  requestedLevel: lvl,
                  requestedLocation: locationKey,
                });
              }
            }

            const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
            if (!tenant) throw httpError(400, { error: 'Invalid tenantId' });

            // Validate designation belongs to requested level (and tenant/global).
            const designation = await tx.reporterDesignation.findUnique({ where: { id: String(designationId) }, select: { id: true, level: true, tenantId: true } }).catch(() => null);
            if (!designation) throw httpError(400, { error: 'Invalid designationId' });
            if (String(designation.level) !== lvl) throw httpError(400, { error: 'designationId does not match requested level' });
            if (designation.tenantId && String(designation.tenantId) !== String(tenantId)) {
              throw httpError(400, { error: 'designationId does not belong to this tenant' });
            }

            // Enforce per-tenant limits (if configured).
            const tenantSettingsRow = await tx.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
            const pricingConfig = normalizePricingFromSettings((tenantSettingsRow as any)?.data);
            const pricingResolved = resolvePricingForDesignation(pricingConfig, String(designationId));
            const maxAllowed = pickReporterLimitMax((tenantSettingsRow as any)?.data, {
              designationId: String(designationId),
              level: lvl,
              location: locationKey,
            });
            if (typeof maxAllowed === 'number') {
              const where: any = { tenantId, active: true, designationId: String(designationId), level: lvl };
              where[locationKey.field] = locationKey.id;
              const current = await tx.reporter.count({ where });
              if (current >= maxAllowed) {
                throw httpError(409, {
                  error: 'Reporter limit reached',
                  maxAllowed,
                  current,
                  designationId: String(designationId),
                  level: lvl,
                  [locationKey.field]: locationKey.id,
                });
              }
            }

            const languageTe = await tx.language.findFirst({ where: { code: 'te' } });
            if (!languageTe) throw httpError(500, { error: 'Language te not seeded' });

            // Resolve role strictly as REPORTER for tenant reporters
            const reporterRoleOverride = process.env.DEFAULT_TENANT_REPORTER_ROLE_ID;
            const role = reporterRoleOverride
              ? await tx.role.findUnique({ where: { id: String(reporterRoleOverride) } })
              : await tx.role.findFirst({ where: { name: 'REPORTER' } });
            if (!role) throw httpError(500, { error: 'REPORTER role missing. Seed roles.' });

            let user = await tx.user.findFirst({ where: { mobileNumber: normalizedMobile } });
            if (!user) {
              const mpinHash = await bcrypt.hash(normalizedMobile.slice(-4), 10);
              user = await tx.user.create({
                data: {
                  mobileNumber: normalizedMobile,
                  mpin: mpinHash,
                  roleId: role.id,
                  languageId: languageTe.id,
                  status: 'ACTIVE',
                },
              });
            } else if (user.roleId !== role.id) {
              user = await tx.user.update({ where: { id: user.id }, data: { roleId: role.id } });
            }

            await tx.userProfile.upsert({
              where: { userId: user.id },
              update: { fullName },
              create: { userId: user.id, fullName },
            });

            const data: any = {
              tenantId,
              designationId: String(designationId),
              level: lvl,
              stateId: lvl === 'STATE' ? locationKey.id : null,
              districtId: lvl === 'DISTRICT' ? locationKey.id : null,
              mandalId: lvl === 'MANDAL' ? locationKey.id : null,
              assemblyConstituencyId: lvl === 'ASSEMBLY' ? locationKey.id : null,
              // Best-practice: snapshot pricing into the reporter row. If amounts are not provided,
              // default from TenantSettings.data.reporterPricing (tenant-managed).
              subscriptionActive: typeof body.subscriptionActive === 'boolean' ? body.subscriptionActive : pricingResolved.subscriptionEnabled,
              monthlySubscriptionAmount:
                typeof body.monthlySubscriptionAmount === 'number'
                  ? body.monthlySubscriptionAmount
                  : (typeof body.subscriptionActive === 'boolean'
                      ? (body.subscriptionActive ? pricingResolved.monthlySubscriptionAmount : 0)
                      : pricingResolved.monthlySubscriptionAmount),
              idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : pricingResolved.idCardCharge,
              userId: user.id,
            };

            // Normalize subscription amount when subscription is off.
            if (!data.subscriptionActive) {
              data.monthlySubscriptionAmount = 0;
            }

            return tx.reporter.create({ data, include: includeReporterContact });
          },
          { isolationLevel: 'Serializable' }
        );
        break;
      } catch (e: any) {
        if (isRetryableTransactionError(e) && attempt === 0) continue;
        throw e;
      }
    }

    return res.status(201).json(mapReporterContact(created));
  } catch (e: any) {
    if (e?.status && e?.payload) return res.status(e.status).json(e.payload);
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
 *       200:
 *         description: List of reporters
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - id: "cmrep_1"
 *                     tenantId: "cmtenant_1"
 *                     userId: "cmuser_1"
 *                     level: "STATE"
 *                     designationId: "cmdes_1"
 *                     stateId: "cmstate_1"
 *                     districtId: null
 *                     mandalId: null
 *                     assemblyConstituencyId: null
 *                     subscriptionActive: false
 *                     monthlySubscriptionAmount: 0
 *                     idCardCharge: 0
 *                     kycStatus: "PENDING"
 *                     profilePhotoUrl: "https://cdn.example.com/profile.jpg"
 *                     active: true
 *                     createdAt: "2026-01-01T00:00:00.000Z"
 *                     updatedAt: "2026-01-01T00:00:00.000Z"
 *                     designation: { id: "cmdes_1", code: "STATE_BUREAU_CHIEF", name: "State Bureau Chief", level: "STATE" }
 *                     state: { id: "cmstate_1", name: "Telangana" }
 *                     district: null
 *                     mandal: null
 *                     assemblyConstituency: null
 *                     fullName: "Reporter Name"
 *                     mobileNumber: "9999999999"
 *                     stats:
 *                       newspaperArticles:
 *                         total: { submitted: 2, published: 5, rejected: 1 }
 *                         currentMonth: { submitted: 1, published: 2, rejected: 0 }
 *                       webArticleViews:
 *                         total: 1234
 *                         currentMonth: 120
 *                       subscriptionPayment:
 *                         currentMonth:
 *                           year: 2026
 *                           month: 1
 *                           status: "PAID"
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
        user: { select: { mobileNumber: true, profile: { select: { fullName: true, profilePhotoUrl: true } } } },
        state: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
        mandal: { select: { id: true, name: true } },
        assemblyConstituency: { select: { id: true, name: true } },
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
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1; // 1-12

    const reporterIds = list.map((r: any) => String(r.id));
    const authorIds = list.map((r: any) => (r.userId ? String(r.userId) : null)).filter(Boolean) as string[];

    const tenantFilter = tenantId && tenantId !== 'null' ? { tenantId } : {};
    const newspaperStatuses = ['PENDING', 'PUBLISHED', 'REJECTED'];

    const p: any = prisma;
    const [
      newspaperTotalGrouped,
      newspaperMonthGrouped,
      webViewsTotalGrouped,
      webViewsMonthGrouped,
      monthPayments,
    ] = await Promise.all([
      authorIds.length
        ? p.newspaperArticle
            .groupBy({
              by: ['authorId', 'status'],
              where: { ...tenantFilter, authorId: { in: authorIds }, status: { in: newspaperStatuses } },
              _count: { _all: true },
            })
            .catch(() => [])
        : [],
      authorIds.length
        ? p.newspaperArticle
            .groupBy({
              by: ['authorId', 'status'],
              where: { ...tenantFilter, authorId: { in: authorIds }, status: { in: newspaperStatuses }, createdAt: { gte: monthStart, lt: monthEnd } },
              _count: { _all: true },
            })
            .catch(() => [])
        : [],
      authorIds.length
        ? p.tenantWebArticle
            .groupBy({
              by: ['authorId'],
              where: { ...tenantFilter, authorId: { in: authorIds }, status: 'PUBLISHED' },
              _sum: { viewCount: true },
            })
            .catch(() => [])
        : [],
      authorIds.length
        ? p.tenantWebArticle
            .groupBy({
              by: ['authorId'],
              where: { ...tenantFilter, authorId: { in: authorIds }, status: 'PUBLISHED', publishedAt: { gte: monthStart, lt: monthEnd } },
              _sum: { viewCount: true },
            })
            .catch(() => [])
        : [],
      reporterIds.length
        ? p.reporterPayment
            .findMany({
              where: { ...tenantFilter, reporterId: { in: reporterIds }, type: 'MONTHLY_SUBSCRIPTION', year, month },
              select: { reporterId: true, status: true, amount: true, currency: true, expiresAt: true },
            })
            .catch(() => [])
        : [],
    ]);

    const makeEmptyNewspaperCounts = () => ({ submitted: 0, published: 0, rejected: 0 });
    const newspaperTotalsByAuthor = new Map<string, any>();
    const newspaperMonthByAuthor = new Map<string, any>();

    for (const row of newspaperTotalGrouped as any[]) {
      const a = String(row.authorId);
      const status = String(row.status);
      const count = Number(row._count?._all || 0);
      const cur = newspaperTotalsByAuthor.get(a) || makeEmptyNewspaperCounts();
      if (status === 'PENDING') cur.submitted += count;
      if (status === 'PUBLISHED') cur.published += count;
      if (status === 'REJECTED') cur.rejected += count;
      newspaperTotalsByAuthor.set(a, cur);
    }
    for (const row of newspaperMonthGrouped as any[]) {
      const a = String(row.authorId);
      const status = String(row.status);
      const count = Number(row._count?._all || 0);
      const cur = newspaperMonthByAuthor.get(a) || makeEmptyNewspaperCounts();
      if (status === 'PENDING') cur.submitted += count;
      if (status === 'PUBLISHED') cur.published += count;
      if (status === 'REJECTED') cur.rejected += count;
      newspaperMonthByAuthor.set(a, cur);
    }

    const webViewsTotalByAuthor = new Map<string, number>();
    const webViewsMonthByAuthor = new Map<string, number>();
    for (const row of webViewsTotalGrouped as any[]) {
      webViewsTotalByAuthor.set(String(row.authorId), Number(row._sum?.viewCount || 0));
    }
    for (const row of webViewsMonthGrouped as any[]) {
      webViewsMonthByAuthor.set(String(row.authorId), Number(row._sum?.viewCount || 0));
    }

    const paymentByReporterId = new Map<string, any>();
    for (const pay of monthPayments as any[]) {
      paymentByReporterId.set(String(pay.reporterId), pay);
    }

    const mapped = list.map((r: any) => {
      const fullName = r?.user?.profile?.fullName || null;
      const mobileNumber = r?.user?.mobileNumber || null;
      const computedProfilePhotoUrl = r?.profilePhotoUrl || r?.user?.profile?.profilePhotoUrl || null;
      const authorId = r?.userId ? String(r.userId) : null;
      const pay = paymentByReporterId.get(String(r.id)) || null;

      const { user, ...rest } = r;
      return {
        ...rest,
        profilePhotoUrl: computedProfilePhotoUrl,
        fullName,
        mobileNumber,
        stats: {
          newspaperArticles: {
            total: authorId ? (newspaperTotalsByAuthor.get(authorId) || makeEmptyNewspaperCounts()) : makeEmptyNewspaperCounts(),
            currentMonth: authorId ? (newspaperMonthByAuthor.get(authorId) || makeEmptyNewspaperCounts()) : makeEmptyNewspaperCounts(),
          },
          webArticleViews: {
            total: authorId ? (webViewsTotalByAuthor.get(authorId) || 0) : 0,
            currentMonth: authorId ? (webViewsMonthByAuthor.get(authorId) || 0) : 0,
          },
          subscriptionPayment: {
            currentMonth: pay
              ? {
                  year,
                  month,
                  status: pay.status,
                  amount: pay.amount,
                  currency: pay.currency,
                  expiresAt: pay.expiresAt,
                }
              : { year, month, status: null },
          },
        },
      };
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

// PATCH /tenants/:tenantId/reporters/:reporterId/auto-publish
/**
 * @swagger
 * /tenants/{tenantId}/reporters/{reporterId}/auto-publish:
 *   patch:
 *     summary: Set reporter auto-publish (tenant editorial)
 *     description: |
 *       Controls whether REPORTER-created newspaper articles are auto-published.
 *       Stored in Reporter.kycData.autoPublish (boolean).
 *       - When true: reporter POST /articles/newspaper becomes PUBLISHED
 *       - When false: reporter POST /articles/newspaper becomes DRAFT and requires Tenant Admin/Editor to publish
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: reporterId
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
 *               summary: Enable auto publish
 *               value: { autoPublish: true }
 *             disable:
 *               summary: Disable auto publish
 *               value: { autoPublish: false }
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             example: { success: true, reporterId: "cmrep", tenantId: "cmtenant", autoPublish: true }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Reporter not found }
 */
router.patch('/tenants/:tenantId/reporters/:reporterId/auto-publish', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireTenantEditorialScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId, reporterId } = req.params;
    const autoPublish = Boolean((req.body || {}).autoPublish);

    const existing = await (prisma as any).reporter.findFirst({ where: { id: reporterId, tenantId }, select: { id: true, kycData: true } }).catch(() => null);
    if (!existing?.id) return res.status(404).json({ error: 'Reporter not found' });

    const current = (existing as any).kycData && typeof (existing as any).kycData === 'object' ? (existing as any).kycData : {};
    const next = { ...current, autoPublish };

    await (prisma as any).reporter.update({ where: { id: reporterId }, data: { kycData: next } });
    return res.json({ success: true, reporterId, tenantId, autoPublish });
  } catch (e: any) {
    console.error('set reporter autoPublish error', e);
    return res.status(500).json({ error: 'Failed to update reporter auto publish' });
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
 *       200:
 *         description: Reporter
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "cmrep_1"
 *                   tenantId: "cmtenant_1"
 *                   userId: "cmuser_1"
 *                   level: "STATE"
 *                   designationId: "cmdes_1"
 *                   stateId: "cmstate_1"
 *                   districtId: null
 *                   mandalId: null
 *                   assemblyConstituencyId: null
 *                   subscriptionActive: false
 *                   monthlySubscriptionAmount: 0
 *                   idCardCharge: 0
 *                   kycStatus: "PENDING"
 *                   profilePhotoUrl: "https://cdn.example.com/profile.jpg"
 *                   active: true
 *                   createdAt: "2026-01-01T00:00:00.000Z"
 *                   updatedAt: "2026-01-01T00:00:00.000Z"
 *                   designation: { id: "cmdes_1", code: "STATE_BUREAU_CHIEF", name: "State Bureau Chief", level: "STATE" }
 *                   state: { id: "cmstate_1", name: "Telangana" }
 *                   district: null
 *                   mandal: null
 *                   assemblyConstituency: null
 *                   fullName: "Reporter Name"
 *                   mobileNumber: "9999999999"
 *                   stats:
 *                     newspaperArticles:
 *                       total: { submitted: 2, published: 5, rejected: 1 }
 *                       currentMonth: { submitted: 1, published: 2, rejected: 0 }
 *                     webArticleViews:
 *                       total: 1234
 *                       currentMonth: 120
 *                     subscriptionPayment:
 *                       currentMonth:
 *                         year: 2026
 *                         month: 1
 *                         status: "PAID"
 *       404: { description: Not found }
 */
router.get('/tenants/:tenantId/reporters/:id', async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const where: any = { id };
    if (tenantId && tenantId !== 'null') where.tenantId = tenantId;
    const r = await (prisma as any).reporter.findFirst({
      where,
      include: {
        designation: true,
        user: { select: { mobileNumber: true, profile: { select: { fullName: true, profilePhotoUrl: true } } } },
        state: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
        mandal: { select: { id: true, name: true } },
        assemblyConstituency: { select: { id: true, name: true } },
      },
    });
    if (!r) return res.status(404).json({ error: 'Reporter not found' });

    const fullName = r?.user?.profile?.fullName || null;
    const mobileNumber = r?.user?.mobileNumber || null;
    const computedProfilePhotoUrl = r?.profilePhotoUrl || r?.user?.profile?.profilePhotoUrl || null;

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1; // 1-12

    const tenantFilter = tenantId && tenantId !== 'null' ? { tenantId } : {};
    const authorId = r?.userId ? String(r.userId) : null;

    const makeEmptyNewspaperCounts = () => ({ submitted: 0, published: 0, rejected: 0 });
    let newspaperTotal = makeEmptyNewspaperCounts();
    let newspaperCurrentMonth = makeEmptyNewspaperCounts();
    let webViewsTotal = 0;
    let webViewsCurrentMonth = 0;

    const p: any = prisma;

    if (authorId) {
      const newspaperStatuses = ['PENDING', 'PUBLISHED', 'REJECTED'];
      const [totalGrouped, monthGrouped, webTotalAgg, webMonthAgg] = await Promise.all([
        p.newspaperArticle
          .groupBy({
            by: ['status'],
            where: { ...tenantFilter, authorId, status: { in: newspaperStatuses } },
            _count: { _all: true },
          })
          .catch(() => []),
        p.newspaperArticle
          .groupBy({
            by: ['status'],
            where: { ...tenantFilter, authorId, status: { in: newspaperStatuses }, createdAt: { gte: monthStart, lt: monthEnd } },
            _count: { _all: true },
          })
          .catch(() => []),
        p.tenantWebArticle
          .aggregate({ where: { ...tenantFilter, authorId, status: 'PUBLISHED' }, _sum: { viewCount: true } })
          .catch(() => ({ _sum: { viewCount: 0 } })),
        p.tenantWebArticle
          .aggregate({
            where: { ...tenantFilter, authorId, status: 'PUBLISHED', publishedAt: { gte: monthStart, lt: monthEnd } },
            _sum: { viewCount: true },
          })
          .catch(() => ({ _sum: { viewCount: 0 } })),
      ]);

      for (const row of totalGrouped as any[]) {
        const status = String(row.status);
        const count = Number(row._count?._all || 0);
        if (status === 'PENDING') newspaperTotal.submitted += count;
        if (status === 'PUBLISHED') newspaperTotal.published += count;
        if (status === 'REJECTED') newspaperTotal.rejected += count;
      }
      for (const row of monthGrouped as any[]) {
        const status = String(row.status);
        const count = Number(row._count?._all || 0);
        if (status === 'PENDING') newspaperCurrentMonth.submitted += count;
        if (status === 'PUBLISHED') newspaperCurrentMonth.published += count;
        if (status === 'REJECTED') newspaperCurrentMonth.rejected += count;
      }

      webViewsTotal = Number((webTotalAgg as any)?._sum?.viewCount || 0);
      webViewsCurrentMonth = Number((webMonthAgg as any)?._sum?.viewCount || 0);
    }

    const pay = await p.reporterPayment
      .findFirst({
        where: { ...tenantFilter, reporterId: String(r.id), type: 'MONTHLY_SUBSCRIPTION', year, month },
        select: { status: true, amount: true, currency: true, expiresAt: true },
      })
      .catch(() => null);

    const { user, ...rest } = r;
    return res.json({
      ...rest,
      profilePhotoUrl: computedProfilePhotoUrl,
      fullName,
      mobileNumber,
      stats: {
        newspaperArticles: {
          total: newspaperTotal,
          currentMonth: newspaperCurrentMonth,
        },
        webArticleViews: {
          total: webViewsTotal,
          currentMonth: webViewsCurrentMonth,
        },
        subscriptionPayment: {
          currentMonth: pay
            ? { year, month, status: pay.status, amount: pay.amount, currency: pay.currency, expiresAt: pay.expiresAt }
            : { year, month, status: null },
        },
      },
    });
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
