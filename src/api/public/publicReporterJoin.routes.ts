import { Router } from 'express';
import prisma from '../../lib/prisma';
import { createUser, findUserByMobileNumber } from '../users/users.service';
import { getRazorpayClientForTenant } from '../reporterPayments/razorpay.service';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

type ReporterLevelInput = 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY';

type ReporterPricingConfig = {
  subscriptionEnabled?: boolean;
  currency?: string;
  defaultMonthlyAmount?: number;
  defaultIdCardCharge?: number;
  byDesignation?: Array<{
    designationId: string;
    monthlyAmount?: number;
    idCardCharge?: number;
  }>;
};

const DEFAULT_REPORTER_PRICING: Required<Pick<ReporterPricingConfig, 'subscriptionEnabled' | 'currency' | 'defaultMonthlyAmount' | 'defaultIdCardCharge'>> = {
  subscriptionEnabled: false,
  currency: 'INR',
  defaultMonthlyAmount: 0,
  defaultIdCardCharge: 0,
};

function nowUtcYearMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, now };
}

function httpError(status: number, payload: any) {
  const err: any = new Error(payload?.error || 'Request failed');
  err.status = status;
  err.payload = payload;
  return err;
}

function getLocationKeyFromLevel(level: ReporterLevelInput, body: any): { field: 'stateId' | 'districtId' | 'mandalId' | 'assemblyConstituencyId'; id: string } {
  if (level === 'STATE') return { field: 'stateId', id: String(body?.stateId || '') };
  if (level === 'DISTRICT') return { field: 'districtId', id: String(body?.districtId || '') };
  if (level === 'ASSEMBLY') {
    // Accept assemblyConstituencyId directly, or fall back to mandalId for backward compatibility
    const assemblyId = String(body?.assemblyConstituencyId || body?.mandalId || '');
    return { field: 'assemblyConstituencyId', id: assemblyId };
  }
  return { field: 'mandalId', id: String(body?.mandalId || '') };
}

async function validateLocationExists(level: ReporterLevelInput, locationId: string): Promise<{ valid: boolean; error?: string }> {
  if (!locationId) return { valid: false, error: 'Location ID is required' };

  try {
    if (level === 'STATE') {
      const state = await p.state.findUnique({ where: { id: locationId } });
      if (!state) return { valid: false, error: 'State not found' };
      return { valid: true };
    }

    if (level === 'DISTRICT') {
      const district = await p.district.findUnique({ 
        where: { id: locationId, isDeleted: false } 
      });
      if (!district) return { valid: false, error: 'District not found' };
      return { valid: true };
    }

    if (level === 'ASSEMBLY') {
      // For ASSEMBLY, check if it's a valid district OR mandal (backward compatibility)
      const district = await p.district.findUnique({ 
        where: { id: locationId, isDeleted: false } 
      });
      if (district) return { valid: true };

      const mandal = await p.mandal.findUnique({ 
        where: { id: locationId, isDeleted: false } 
      });
      if (mandal) return { valid: true };

      return { valid: false, error: 'District or Mandal not found for ASSEMBLY level' };
    }

    if (level === 'MANDAL') {
      const mandal = await p.mandal.findUnique({ 
        where: { id: locationId, isDeleted: false } 
      });
      if (!mandal) return { valid: false, error: 'Mandal not found' };
      return { valid: true };
    }

    return { valid: false, error: 'Invalid level' };
  } catch (error) {
    console.error('[validateLocationExists] Error:', error);
    return { valid: false, error: 'Failed to validate location' };
  }
}

function pickReporterLimitMax(settingsData: any, input: { designationId: string; level: ReporterLevelInput; location: { field: string; id: string } }): number | undefined {
  const limits = settingsData?.reporterLimits;
  // Limits are always enforced.
  // Default behavior (when not configured): allow max=1 per (designationId + level + location)
  // so the UI can rely on stable availability behavior.
  if (!limits) return 1;

  const rules: any[] = Array.isArray(limits.rules) ? limits.rules : [];
  const defaultMax = typeof limits.defaultMax === 'number' ? limits.defaultMax : 1;

  const locationField = input.location.field;
  const locationId = input.location.id;

  const exact = rules.find(
    (r) =>
      String(r?.designationId || '') === input.designationId &&
      String(r?.level || '') === input.level &&
      String(r?.[locationField] || '') === locationId
  );
  if (typeof exact?.max === 'number') return exact.max;

  const wildcardLocation = rules.find(
    (r) =>
      String(r?.designationId || '') === input.designationId &&
      String(r?.level || '') === input.level &&
      !r?.stateId &&
      !r?.districtId &&
      !r?.mandalId &&
      !r?.assemblyConstituencyId
  );
  if (typeof wildcardLocation?.max === 'number') return wildcardLocation.max;

  const wildcardDesignation = rules.find((r) => String(r?.designationId || '') === input.designationId && !r?.level);
  if (typeof wildcardDesignation?.max === 'number') return wildcardDesignation.max;

  return defaultMax;
}

function normalizePricingFromSettings(settingsData: any): ReporterPricingConfig {
  const raw = settingsData?.reporterPricing;
  if (!raw || typeof raw !== 'object') return {};
  return raw as ReporterPricingConfig;
}

function resolvePricingForDesignation(pricing: ReporterPricingConfig, designationId: string) {
  const currency = typeof pricing.currency === 'string' && pricing.currency ? pricing.currency : DEFAULT_REPORTER_PRICING.currency;
  const subscriptionEnabled = pricing.subscriptionEnabled === true;

  const defaultMonthlyAmount =
    typeof pricing.defaultMonthlyAmount === 'number' ? pricing.defaultMonthlyAmount : DEFAULT_REPORTER_PRICING.defaultMonthlyAmount;
  const defaultIdCardCharge =
    typeof pricing.defaultIdCardCharge === 'number' ? pricing.defaultIdCardCharge : DEFAULT_REPORTER_PRICING.defaultIdCardCharge;

  const row = Array.isArray(pricing.byDesignation) ? pricing.byDesignation.find((x) => String(x.designationId) === designationId) : undefined;

  const monthlySubscriptionAmount = typeof row?.monthlyAmount === 'number' ? row.monthlyAmount : defaultMonthlyAmount;
  const idCardCharge = typeof row?.idCardCharge === 'number' ? row.idCardCharge : defaultIdCardCharge;

  return {
    subscriptionEnabled,
    currency,
    // Requirement: when subscription is disabled, public join should not require any payment.
    monthlySubscriptionAmount: subscriptionEnabled ? monthlySubscriptionAmount : 0,
    idCardCharge: subscriptionEnabled ? idCardCharge : 0,
  };
}

async function resolveTenantDesignationContext(params: {
  tenantId: string;
  designationId: string;
  level: ReporterLevelInput;
}): Promise<{ designation: { id: string; tenantId: string | null; level: ReporterLevelInput; code: string }; effectiveDesignationId: string; designationIds: string[] }> {
  const { tenantId, designationId, level } = params;

  let designation = await p.reporterDesignation
    .findFirst({ where: { id: designationId }, select: { id: true, tenantId: true, level: true, code: true } })
    .catch(() => null);

  if (!designation?.id) throw httpError(404, { error: 'Designation not found' });
  if (String(designation.level) !== level) throw httpError(400, { error: `Designation level must be ${level}` });

  // Best-practice: designations are global. If client sends an old cached designationId from another tenant,
  // treat it as a pointer to the (code+level) and map it to the global designation.
  if (designation.tenantId && String(designation.tenantId) !== tenantId) {
    const global = await p.reporterDesignation
      .findFirst({ where: { tenantId: null, code: String(designation.code), level }, select: { id: true, tenantId: true, level: true, code: true } })
      .catch(() => null);
    if (!global?.id) throw httpError(404, { error: 'Global designation not found for this code' });
    designation = global;
  }

  // If a tenant has its own designation row for the same code, prefer it for pricing/limits storage.
  const tenantOverride = await p.reporterDesignation
    .findFirst({ where: { tenantId, code: String(designation.code), level }, select: { id: true } })
    .catch(() => null);

  const effectiveDesignationId = String(tenantOverride?.id || designation.id);

  // For counting (and to support global-id clients with tenant-id reporters), consider both tenant+global ids for same code.
  const idsRows = await p.reporterDesignation
    .findMany({
      where: {
        level,
        code: String(designation.code),
        OR: [{ tenantId }, { tenantId: null }],
      },
      select: { id: true },
    })
    .catch(() => []);

  const designationIds = Array.from(new Set([effectiveDesignationId, ...(idsRows as any[]).map((r) => String(r.id))]));

  return {
    designation: {
      id: String(designation.id),
      tenantId: designation.tenantId ? String(designation.tenantId) : null,
      level: String(designation.level) as ReporterLevelInput,
      code: String(designation.code),
    },
    effectiveDesignationId,
    designationIds,
  };
}

/**
 * @swagger
 * tags:
 *   - name: Public - Reporter Join
 *     description: Public endpoints to check reporter slot availability & initiate onboarding payments.
 */

/**
 * @swagger
 * /public-join/reporter-pricing/default:
 *   get:
 *     summary: Get default reporter pricing (fallback)
 *     tags: [Public - Reporter Join]
 *     responses:
 *       200:
 *         description: Default pricing values
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   subscriptionEnabled: false
 *                   currency: "INR"
 *                   defaultMonthlyAmount: 0
 *                   defaultIdCardCharge: 0
 */
router.get('/reporter-pricing/default', async (_req, res) => {
  return res.json({
    subscriptionEnabled: DEFAULT_REPORTER_PRICING.subscriptionEnabled,
    currency: DEFAULT_REPORTER_PRICING.currency,
    defaultMonthlyAmount: DEFAULT_REPORTER_PRICING.defaultMonthlyAmount,
    defaultIdCardCharge: DEFAULT_REPORTER_PRICING.defaultIdCardCharge,
  });
});

/**
 * @swagger
 * /public-join/tenants/{tenantId}/reporter-pricing:
 *   get:
 *     summary: Get tenant reporter pricing (designation-wise)
 *     description: |
 *       Pricing is stored in `TenantSettings.data.reporterPricing`.
 *       Amounts are in the smallest currency unit (e.g. paise for INR).
 *
 *       Best-practice: when a reporter is created, snapshot these amounts into `Reporter.monthlySubscriptionAmount` and `Reporter.idCardCharge`
 *       so later price changes do not affect already-onboarded reporters.
 *     tags: [Public - Reporter Join]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant pricing configuration + resolved designation pricing
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "tenant_123"
 *                   pricing:
 *                     subscriptionEnabled: true
 *                     currency: "INR"
 *                     defaultMonthlyAmount: 9900
 *                     defaultIdCardCharge: 19900
 *                   designations:
 *                     - designationId: "desg_1"
 *                       level: "MANDAL"
 *                       code: "MANDAL_REPORTER"
 *                       name: "Mandal Reporter"
 *                       monthlySubscriptionAmount: 9900
 *                       idCardCharge: 19900
 */
router.get('/tenants/:tenantId/reporter-pricing', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const settingsRow = await p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
    const pricing = normalizePricingFromSettings(settingsRow?.data);

    const resolvedPricing = {
      subscriptionEnabled: pricing.subscriptionEnabled === true,
      currency: typeof pricing.currency === 'string' && pricing.currency ? pricing.currency : DEFAULT_REPORTER_PRICING.currency,
      defaultMonthlyAmount:
        typeof pricing.defaultMonthlyAmount === 'number' ? pricing.defaultMonthlyAmount : DEFAULT_REPORTER_PRICING.defaultMonthlyAmount,
      defaultIdCardCharge:
        typeof pricing.defaultIdCardCharge === 'number' ? pricing.defaultIdCardCharge : DEFAULT_REPORTER_PRICING.defaultIdCardCharge,
    };

    const allDesignations = await p.reporterDesignation
      .findMany({
        where: { OR: [{ tenantId }, { tenantId: null }] },
        orderBy: [{ level: 'asc' }, { name: 'asc' }],
        select: { id: true, tenantId: true, level: true, code: true, name: true },
      })
      .catch(() => []);

    // Merge by (level+code) and prefer tenant-specific rows over global rows.
    const mergedByKey = new Map<string, any>();
    const sorted = (allDesignations as any[]).slice().sort((a, b) => {
      const ar = String(a?.tenantId || '') === tenantId ? 0 : 1;
      const br = String(b?.tenantId || '') === tenantId ? 0 : 1;
      if (ar !== br) return ar - br;
      const al = String(a?.level || '');
      const bl = String(b?.level || '');
      if (al !== bl) return al.localeCompare(bl);
      return String(a?.name || '').localeCompare(String(b?.name || ''));
    });

    for (const d of sorted) {
      const key = `${String(d.level)}:${String(d.code)}`;
      if (!mergedByKey.has(key)) mergedByKey.set(key, d);
    }

    const list = Array.from(mergedByKey.values()).map((d) => {
      const amounts = resolvePricingForDesignation(pricing, String(d.id));
      return {
        designationId: d.id,
        level: d.level,
        code: d.code,
        name: d.name,
        monthlySubscriptionAmount: amounts.monthlySubscriptionAmount,
        idCardCharge: amounts.idCardCharge,
      };
    });

    return res.json({ tenantId, pricing: resolvedPricing, designations: list });
  } catch (e: any) {
    console.error('public tenant reporter pricing error', e);
    return res.status(500).json({ error: 'Failed to get reporter pricing' });
  }
});

/**
 * @swagger
 * /public-join/tenants/{tenantId}/reporters/availability:
 *   post:
 *     summary: Check whether a reporter slot is available (designation + location)
 *     description: |
 *       Uses tenant settings `TenantSettings.data.reporterLimits`.
 *       Default when enabled is `defaultMax=1` per (designationId + level + location) unless overridden by a matching rule.
 *
 *       Also returns current pricing for the designation.
 *     tags: [Public - Reporter Join]
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
 *             required: [designationId, level]
 *             properties:
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               mandalId: { type: string }
 *           examples:
 *             mandal:
 *               value:
 *                 designationId: "desg_1"
 *                 level: "MANDAL"
 *                 mandalId: "mandal_1"
 *     responses:
 *       200:
 *         description: Availability + limits + pricing
 *         content:
 *           application/json:
 *             examples:
 *               available:
 *                 value:
 *                   available: true
 *                   maxAllowed: 1
 *                   current: 0
 *                   designationId: "desg_1"
 *                   level: "MANDAL"
 *                   location: { field: "mandalId", id: "mandal_1" }
 *                   pricing:
 *                     subscriptionEnabled: true
 *                     currency: "INR"
 *                     monthlySubscriptionAmount: 9900
 *                     idCardCharge: 19900
 *                   payment:
 *                     required: true
 *                     amount: 29800
 *                     currency: "INR"
 */
router.post('/tenants/:tenantId/reporters/availability', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};
    const designationId = String(body.designationId || '');
    const level: ReporterLevelInput = String(body.level || '') as any;

    if (!designationId) return res.status(400).json({ error: 'designationId is required' });
    if (!level || !['STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL'].includes(level)) return res.status(400).json({ error: 'Invalid level' });

    const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const loc = getLocationKeyFromLevel(level, body);
    if (!loc.id) return res.status(400).json({ error: `${loc.field} is required for level ${level}` });

    // Validate location exists in database
    const locationValidation = await validateLocationExists(level, loc.id);
    if (!locationValidation.valid) {
      return res.status(404).json({ 
        error: locationValidation.error,
        field: loc.field,
        value: loc.id,
        level
      });
    }

    const { effectiveDesignationId, designationIds } = await resolveTenantDesignationContext({ tenantId, designationId, level });

    const settingsRow = await p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
    const maxAllowed = pickReporterLimitMax(settingsRow?.data, { designationId: effectiveDesignationId, level, location: loc });

    let current = 0;
    if (typeof maxAllowed === 'number') {
      const where: any = { tenantId, active: true, designationId: { in: designationIds }, level };
      where[loc.field] = loc.id;
      current = await p.reporter.count({ where }).catch(() => 0);
    }

    const pricing = normalizePricingFromSettings(settingsRow?.data);
    const amounts = resolvePricingForDesignation(pricing, effectiveDesignationId);

    const payableAmount = Math.max(0, Number(amounts.monthlySubscriptionAmount || 0) + Number(amounts.idCardCharge || 0));
    const paymentRequired = payableAmount > 0;

    const available = typeof maxAllowed === 'number' ? current < maxAllowed : true;
    return res.json({
      available,
      maxAllowed: typeof maxAllowed === 'number' ? maxAllowed : null,
      current: typeof maxAllowed === 'number' ? current : null,
      designationId,
      level,
      location: loc,
      pricing: amounts,
      payment: {
        required: paymentRequired,
        amount: payableAmount,
        currency: amounts.currency,
      },
    });
  } catch (e: any) {
    if (e?.status && e?.payload) return res.status(Number(e.status)).json(e.payload);
    console.error('public reporter availability error', e);
    return res.status(500).json({ error: 'Failed to check availability' });
  }
});

/**
 * @swagger
 * /public-join/tenants/{tenantId}/onboarding-orders/{onboardingOrderId}:
 *   get:
 *     summary: Get onboarding order status (poll)
 *     description: |
 *       Use this after `POST /public-join/tenants/{tenantId}/reporters/join` when it returns `PENDING_PAYMENT`.
 *       Once Razorpay payment is captured and webhook processed, this endpoint will show status changes and the created `reporterId` (if any).
 *
 *       Typical statuses:
 *       - PENDING: Payment not captured yet
 *       - PAID: Payment captured and reporter created (if slot available)
 *       - PAID_NO_SLOT: Payment captured but slot was already taken by the time webhook ran
 *       - DUPLICATE: User already had a reporter in this tenant
 *     tags: [Public - Reporter Join]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: onboardingOrderId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Onboarding order details
 *         content:
 *           application/json:
 *             examples:
 *               pending:
 *                 value:
 *                   id: "onb_1"
 *                   tenantId: "tenant_123"
 *                   status: "PENDING"
 *                   payment:
 *                     orderId: "order_abc"
 *                     required: true
 *                     amount: 29800
 *                     currency: "INR"
 *               paid:
 *                 value:
 *                   id: "onb_1"
 *                   tenantId: "tenant_123"
 *                   status: "PAID"
 *                   reporterId: "rep_1"
 *                   payment:
 *                     orderId: "order_abc"
 *                     required: true
 *                     amount: 29800
 *                     currency: "INR"
 *               paidNoSlot:
 *                 value:
 *                   id: "onb_1"
 *                   tenantId: "tenant_123"
 *                   status: "PAID_NO_SLOT"
 *                   payment:
 *                     orderId: "order_abc"
 *                     required: true
 *                     amount: 29800
 *                     currency: "INR"
 *       404:
 *         description: Not found
 */
router.get('/tenants/:tenantId/onboarding-orders/:onboardingOrderId', async (req, res) => {
  try {
    const { tenantId, onboardingOrderId } = req.params;

    const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const order = await p.reporterOnboardingOrder
      .findFirst({
        where: { id: onboardingOrderId, tenantId },
        select: {
          id: true,
          tenantId: true,
          mobileNumber: true,
          status: true,
          amount: true,
          currency: true,
          razorpayOrderId: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => null);

    if (!order?.id) return res.status(404).json({ error: 'Onboarding order not found' });

    let reporterId: string | null = null;
    if (order.status === 'PAID' || order.status === 'DUPLICATE') {
      const user = await p.user.findFirst({ where: { mobileNumber: order.mobileNumber }, select: { id: true } }).catch(() => null);
      if (user?.id) {
        const rep = await p.reporter.findFirst({ where: { tenantId, userId: user.id }, select: { id: true } }).catch(() => null);
        reporterId = rep?.id || null;
      }
    }

    return res.json({
      id: order.id,
      tenantId: order.tenantId,
      status: order.status,
      reporterId,
      expiresAt: order.expiresAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      payment: {
        required: true,
        orderId: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
      },
    });
  } catch (e: any) {
    console.error('public onboarding order status error', e);
    return res.status(500).json({ error: 'Failed to get onboarding order status' });
  }
});

/**
 * @swagger
 * /public-join/tenants/{tenantId}/reporters/join:
 *   post:
 *     summary: Public reporter join (payment-first when subscription enabled)
 *     description: |
 *       Flow:
 *       1) Validates tenant + designation + location level
 *       2) Checks `reporterLimits` availability (default max=1 when enabled)
 *       3) Resolves pricing from `TenantSettings.data.reporterPricing`
 *       4) If subscription is disabled, registers immediately (no payment).
 *       5) If subscription is enabled and payable amount > 0:
 *          - Creates Razorpay order + ReporterOnboardingOrder (pre-registration)
 *          - Reporter/User are created ONLY after payment is captured via webhook.
 *
 *       Activation best-practice:
 *       - On Razorpay webhook `captured`, backend creates the Reporter + User, creates ReporterPayment(type=ONBOARDING, PAID), and upgrades role.
 *     tags: [Public - Reporter Join]
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
 *               mobileNumber: { type: string }
 *               fullName: { type: string }
 *               designationId: { type: string }
 *               level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *               stateId: { type: string }
 *               districtId: { type: string }
 *               assemblyConstituencyId: { type: string }
 *               mandalId: { type: string }
 *               languageId: { type: string, description: "Optional; defaults to tenant language or 'te' if available" }
 *           examples:
 *             mandalJoin:
 *               value:
 *                 mobileNumber: "9502000000"
 *                 fullName: "Mandal Reporter"
 *                 designationId: "desg_1"
 *                 level: "MANDAL"
 *                 mandalId: "mandal_1"
 *     responses:
 *       201:
 *         description: Join created (may require payment)
 *         content:
 *           application/json:
 *             examples:
 *               paymentRequired:
 *                 value:
 *                   tenantId: "tenant_123"
 *                   status: "PENDING_PAYMENT"
 *                   pricing:
 *                     subscriptionEnabled: true
 *                     currency: "INR"
 *                     monthlySubscriptionAmount: 9900
 *                     idCardCharge: 19900
 *                   payment:
 *                     required: true
 *                     type: "ONBOARDING"
 *                     amount: 29800
 *                     currency: "INR"
 *                     orderId: "order_abc"
 *                     onboardingOrderId: "onb_1"
 *                   next:
 *                     pollStatusUrl: "/api/v1/public-join/tenants/tenant_123/onboarding-orders/onb_1"
 *               noPayment:
 *                 value:
 *                   reporterId: "rep_2"
 *                   tenantId: "tenant_123"
 *                   status: "ACTIVE"
 *                   pricing:
 *                     subscriptionEnabled: false
 *                     currency: "INR"
 *                     monthlySubscriptionAmount: 0
 *                     idCardCharge: 0
 *       409:
 *         description: Limit reached or already joined
 */
router.post('/tenants/:tenantId/reporters/join', async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};

    const mobileNumber = String(body.mobileNumber || '').trim();
    const fullName = String(body.fullName || '').trim();
    const designationId = String(body.designationId || '').trim();
    const level: ReporterLevelInput = String(body.level || '').trim() as any;

    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });
    if (!fullName) return res.status(400).json({ error: 'fullName is required' });
    if (!designationId) return res.status(400).json({ error: 'designationId is required' });
    if (!level || !['STATE', 'DISTRICT', 'ASSEMBLY', 'MANDAL'].includes(level)) return res.status(400).json({ error: 'Invalid level' });

    const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const loc = getLocationKeyFromLevel(level, body);
    if (!loc.id) return res.status(400).json({ error: `${loc.field} is required for level ${level}` });

    const { effectiveDesignationId, designationIds } = await resolveTenantDesignationContext({ tenantId, designationId, level });

    const settingsRow = await p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);

    // Limits check (same behavior as tenant admin create)
    const maxAllowed = pickReporterLimitMax(settingsRow?.data, { designationId: effectiveDesignationId, level, location: loc });
    if (typeof maxAllowed === 'number') {
      const where: any = { tenantId, active: true, designationId: { in: designationIds }, level };
      where[loc.field] = loc.id;
      const current = await p.reporter.count({ where }).catch(() => 0);
      if (current >= maxAllowed) {
        return res.status(409).json({
          error: 'Reporter limit reached',
          maxAllowed,
          current,
          designationId,
          level,
          [loc.field]: loc.id,
        });
      }
    }

    // If already joined this tenant, block (if user exists)
    const existingUser = await findUserByMobileNumber(mobileNumber);
    if (existingUser?.id) {
      const existingReporter = await p.reporter.findFirst({ where: { tenantId, userId: existingUser.id } }).catch(() => null);
      if (existingReporter?.id) {
        return res.status(409).json({ error: 'Already joined this tenant', reporterId: existingReporter.id, active: existingReporter.active });
      }
    }

    // Pricing snapshot (used either for free immediate register, or for onboarding order when payment is required)
    const pricing = normalizePricingFromSettings(settingsRow?.data);
    const amounts = resolvePricingForDesignation(pricing, effectiveDesignationId);
    const subscriptionAmount = amounts.subscriptionEnabled ? amounts.monthlySubscriptionAmount : 0;
    const idCardAmount = amounts.subscriptionEnabled ? amounts.idCardCharge || 0 : 0;
    const totalAmount = Math.max(0, Number(subscriptionAmount) + Number(idCardAmount));

    const { year, month, now } = nowUtcYearMonth();

    // If no payment required (subscription disabled), register immediately.
    if (totalAmount <= 0) {
      // Ensure user exists (create directly as REPORTER because no payment gating)
      let user = existingUser;
      if (!user) {
        const explicitLang = body.languageId ? String(body.languageId) : null;
        let languageId = explicitLang;
        if (!languageId) {
          const entity = await p.tenantEntity.findUnique({ where: { tenantId }, select: { languageId: true } }).catch(() => null);
          languageId = entity?.languageId || null;
        }
        if (!languageId) {
          const te = await p.language.findFirst({ where: { code: 'te' }, select: { id: true } }).catch(() => null);
          languageId = te?.id || null;
        }
        if (!languageId) {
          const anyLang = await p.language.findFirst({ select: { id: true } }).catch(() => null);
          languageId = anyLang?.id || null;
        }
        if (!languageId) return res.status(500).json({ error: 'No languages configured' });

        const reporterRole = await p.role.findFirst({ where: { name: 'REPORTER' }, select: { id: true } }).catch(() => null);
        if (!reporterRole?.id) return res.status(500).json({ error: 'Role REPORTER not configured' });

        user = await createUser({ mobileNumber, roleId: reporterRole.id, languageId });
      }

      const existingProfile = await p.userProfile.findUnique({ where: { userId: user.id } }).catch(() => null);
      if (!existingProfile) {
        await p.userProfile.create({ data: { userId: user.id, fullName } }).catch(() => null);
      } else if (!existingProfile.fullName) {
        await p.userProfile.update({ where: { userId: user.id }, data: { fullName } }).catch(() => null);
      }

      const createData: any = {
        tenantId,
        userId: user.id,
        designationId: effectiveDesignationId,
        level,
        subscriptionActive: false,
        monthlySubscriptionAmount: 0,
        idCardCharge: 0,
        active: true,
      };
      createData[loc.field] = loc.id;
      const reporter = await p.reporter.create({ data: createData });

      // Ensure role REPORTER
      const reporterRole = await p.role.findFirst({ where: { name: 'REPORTER' }, select: { id: true } }).catch(() => null);
      if (reporterRole?.id) {
        await p.user.update({ where: { id: user.id }, data: { roleId: reporterRole.id } }).catch(() => null);
      }

      return res.status(201).json({
        reporterId: reporter.id,
        tenantId,
        status: 'ACTIVE',
        pricing: amounts,
        payment: { required: false },
      });
    }

    // Resolve languageId for later user creation (webhook path)
    const explicitLang = body.languageId ? String(body.languageId) : null;
    let languageIdForOnboarding = explicitLang;
    if (!languageIdForOnboarding) {
      const entity = await p.tenantEntity.findUnique({ where: { tenantId }, select: { languageId: true } }).catch(() => null);
      languageIdForOnboarding = entity?.languageId || null;
    }
    if (!languageIdForOnboarding) {
      const te = await p.language.findFirst({ where: { code: 'te' }, select: { id: true } }).catch(() => null);
      languageIdForOnboarding = te?.id || null;
    }
    if (!languageIdForOnboarding) {
      const anyLang = await p.language.findFirst({ select: { id: true } }).catch(() => null);
      languageIdForOnboarding = anyLang?.id || null;
    }

    // Payment-first flow: create Razorpay order + onboarding order record (no reporter/user created yet)
    const razorpay = await getRazorpayClientForTenant(tenantId);
    let receipt = `ONB-${String(tenantId).slice(0, 8)}-${Date.now()}`;
    if (receipt.length > 40) receipt = receipt.slice(0, 40);

    const order = await (razorpay as any).orders.create({
      amount: totalAmount,
      currency: amounts.currency,
      receipt,
      notes: { tenantId, type: 'ONBOARDING' },
    });

    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const onboardingOrder = await p.reporterOnboardingOrder.create({
      data: {
        tenantId,
        mobileNumber,
        fullName,
        languageId: languageIdForOnboarding,
        designationId: effectiveDesignationId,
        level,
        stateId: loc.field === 'stateId' ? loc.id : null,
        districtId: loc.field === 'districtId' ? loc.id : null,
        mandalId: loc.field === 'mandalId' ? loc.id : null,
        assemblyConstituencyId: loc.field === 'assemblyConstituencyId' ? loc.id : null,
        subscriptionEnabled: true,
        monthlySubscriptionAmount: Number(subscriptionAmount) || 0,
        idCardCharge: Number(idCardAmount) || 0,
        amount: totalAmount,
        currency: amounts.currency,
        status: 'PENDING',
        razorpayOrderId: order.id,
        meta: order,
        expiresAt,
      },
      select: { id: true, razorpayOrderId: true },
    });

    return res.status(201).json({
      tenantId,
      status: 'PENDING_PAYMENT',
      pricing: amounts,
      payment: {
        required: true,
        type: 'ONBOARDING',
        amount: totalAmount,
        currency: amounts.currency,
        orderId: order.id,
        onboardingOrderId: onboardingOrder.id,
      },
    });
  } catch (e: any) {
    if (e?.status && e?.payload) return res.status(Number(e.status)).json(e.payload);
    console.error('public reporter join error', e);
    return res.status(500).json({ error: 'Failed to join as reporter' });
  }
});

export default router;
