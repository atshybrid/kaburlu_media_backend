import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperAdmin, requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import { getRazorpayClientForTenant } from '../reporterPayments/razorpay.service';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// Import subscription activator
import { activateScheduledSubscriptions } from '../../lib/activateScheduledSubscriptions';

function asInt(value: any, fallback: number): number {
  const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function asBool(value: any, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  const s = String(value ?? '').toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(s)) return true;
  if (['0', 'false', 'no', 'n'].includes(s)) return false;
  return fallback;
}

function parseIsoDate(value: any): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

type BillingCycle = 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';

function addCycle(start: Date, cycle: BillingCycle): Date {
  const d = new Date(start);
  if (cycle === 'YEARLY') {
    d.setFullYear(d.getFullYear() + 1);
    return d;
  }

  const monthsToAdd =
    cycle === 'HALF_YEARLY' ? 6 :
    cycle === 'QUARTERLY' ? 3 :
    1;

  d.setMonth(d.getMonth() + monthsToAdd);
  return d;
}

async function getTenantActiveSubscription(tenantId: string) {
  return (prisma as any).tenantSubscription.findFirst({
    where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { createdAt: 'desc' },
    include: {
      plan: { include: { components: true } },
    },
  });
}

async function getActiveRazorpayConfigForTenant(tenantId: string) {
  return (prisma as any).razorpayConfig.findFirst({
    where: {
      OR: [{ tenantId }, { tenantId: null }],
      active: true,
    },
    orderBy: { tenantId: 'desc' },
  });
}

async function buildInvoicePreview(params: { tenantId: string; periodStart?: Date; periodEnd?: Date }) {
  const { tenantId } = params;
  const sub = await getTenantActiveSubscription(tenantId).catch(() => null);
  if (!sub) return null;

  const periodStart = params.periodStart || new Date(sub.currentPeriodStart);
  const periodEnd = params.periodEnd || new Date(sub.currentPeriodEnd);

  const components: Record<string, any> = {};
  for (const c of sub.plan?.components || []) components[String(c.component)] = c;

  const [newsDomains, epaperDomains, designAgg] = await Promise.all([
    (prisma as any).domain.count({ where: { tenantId, status: 'ACTIVE', kind: 'NEWS' } }),
    (prisma as any).domain.count({ where: { tenantId, status: 'ACTIVE', kind: 'EPAPER' } }),
    (prisma as any).billingUsageEvent.aggregate({
      where: {
        tenantId,
        component: 'NEWSPAPER_DESIGN_PAGE',
        occurredAt: { gte: periodStart, lt: periodEnd },
      },
      _sum: { quantity: true },
    }),
  ]);

  const designPages = asInt(designAgg?._sum?.quantity, 0);

  const lineItems: any[] = [];
  const addLine = (item: any) => {
    lineItems.push(item);
    return item.amountMinor;
  };

  let total = 0;
  if (sub.plan.baseAmountMinor > 0) {
    total += addLine({
      component: null,
      description: `Base (${sub.plan.name})`,
      quantity: 1,
      unitAmountMinor: sub.plan.baseAmountMinor,
      amountMinor: sub.plan.baseAmountMinor,
    });
  }

  const newsCfg = components.NEWS_DOMAIN;
  if (newsCfg) {
    const chargeable = Math.max(0, newsDomains - asInt(newsCfg.includedUnits, 0));
    const amt = chargeable * asInt(newsCfg.unitAmountMinor, 0);
    total += addLine({
      component: 'NEWS_DOMAIN',
      description: 'News domains',
      quantity: newsDomains,
      includedUnits: asInt(newsCfg.includedUnits, 0),
      unitAmountMinor: asInt(newsCfg.unitAmountMinor, 0),
      chargeableUnits: chargeable,
      amountMinor: amt,
    });
  }

  const epaperCfg = components.EPAPER_SUBDOMAIN;
  if (epaperCfg) {
    const chargeable = Math.max(0, epaperDomains - asInt(epaperCfg.includedUnits, 0));
    const amt = chargeable * asInt(epaperCfg.unitAmountMinor, 0);
    total += addLine({
      component: 'EPAPER_SUBDOMAIN',
      description: 'ePaper subdomains',
      quantity: epaperDomains,
      includedUnits: asInt(epaperCfg.includedUnits, 0),
      unitAmountMinor: asInt(epaperCfg.unitAmountMinor, 0),
      chargeableUnits: chargeable,
      amountMinor: amt,
    });
  }

  const designCfg = components.NEWSPAPER_DESIGN_PAGE;
  // Prepaid policy: design page overages are purchased via TOPUP invoices.
  // To avoid double-charging, do not bill NEWSPAPER_DESIGN_PAGE in the subscription invoice preview.

  return {
    tenantId,
    subscription: sub,
    periodStart,
    periodEnd,
    counts: { newsDomains, epaperDomains, designPages },
    currency: sub.plan.currency,
    totalAmountMinor: total,
    lineItems,
  };
}

async function getDesignPagePricingForTenant(tenantId: string): Promise<{
  subscription: any;
  periodStart: Date;
  periodEnd: Date;
  includedUnits: number;
  unitAmountMinor: number;
  currency: string;
} | null> {
  const sub = await getTenantActiveSubscription(tenantId).catch(() => null);
  if (!sub) return null;

  const periodStart = new Date(sub.currentPeriodStart);
  const periodEnd = new Date(sub.currentPeriodEnd);

  const components: Record<string, any> = {};
  for (const c of sub.plan?.components || []) components[String(c.component)] = c;

  const designCfg = components.NEWSPAPER_DESIGN_PAGE;
  return {
    subscription: sub,
    periodStart,
    periodEnd,
    includedUnits: asInt(designCfg?.includedUnits, 0),
    unitAmountMinor: asInt(designCfg?.unitAmountMinor, 0),
    currency: String(sub.plan?.currency || 'INR'),
  };
}

/**
 * @swagger
 * tags:
 *   - name: Billing
 *     description: Tenant subscription, pricing plans, and invoice preview
 */

/**
 * @swagger
 * /billing/plans:
 *   get:
 *     summary: List billing plans (SUPER_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: List of billing plans
 *         content:
 *           application/json:
 *             examples:
 *               plans:
 *                 value:
 *                   - id: "cplan_01"
 *                     name: "Basic Monthly"
 *                     currency: "INR"
 *                     cycle: "MONTHLY"
 *                     baseAmountMinor: 0
 *                     isActive: true
 *                     components:
 *                       - id: "cpc_01"
 *                         component: "NEWS_DOMAIN"
 *                         includedUnits: 1
 *                         unitAmountMinor: 19900
 *                       - id: "cpc_02"
 *                         component: "EPAPER_SUBDOMAIN"
 *                         includedUnits: 0
 *                         unitAmountMinor: 9900
 *                       - id: "cpc_03"
 *                         component: "NEWSPAPER_DESIGN_PAGE"
 *                         includedUnits: 240
 *                         unitAmountMinor: 500
 */
router.get('/billing/plans', auth, requireSuperAdmin, async (_req, res) => {
  const plans = await (prisma as any).billingPlan.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: { components: true },
  });
  return res.json(plans);
});

/**
 * @swagger
 * /billing/plans:
 *   post:
 *     summary: Create billing plan (SUPER_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               currency: { type: string, enum: [INR, USD], default: INR }
 *               cycle: { type: string, enum: [MONTHLY, QUARTERLY, HALF_YEARLY, YEARLY], default: MONTHLY }
 *               baseAmountMinor: { type: integer, default: 0, description: Amount in minor units (e.g., paise) }
 *               components:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [component]
 *                   properties:
 *                     component: { type: string, enum: [NEWS_DOMAIN, EPAPER_SUBDOMAIN, NEWSPAPER_DESIGN_PAGE] }
 *                     includedUnits: { type: integer, default: 0 }
 *                     unitAmountMinor: { type: integer, default: 0, description: Amount per unit in minor units }
 *           examples:
 *             monthlyBasic:
 *               summary: Monthly plan with domain + epaper + design pricing
 *               value:
 *                 name: "Basic Monthly"
 *                 currency: "INR"
 *                 cycle: "MONTHLY"
 *                 baseAmountMinor: 0
 *                 components:
 *                   - component: "NEWS_DOMAIN"
 *                     includedUnits: 1
 *                     unitAmountMinor: 19900
 *                   - component: "EPAPER_SUBDOMAIN"
 *                     includedUnits: 0
 *                     unitAmountMinor: 9900
 *                   - component: "NEWSPAPER_DESIGN_PAGE"
 *                     includedUnits: 0
 *                     unitAmountMinor: 5000
 *     responses:
 *       201:
 *         description: Created plan
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   id: "cplan_01"
 *                   name: "Basic Monthly"
 *                   currency: "INR"
 *                   cycle: "MONTHLY"
 *                   baseAmountMinor: 0
 *                   isActive: true
 *                   components:
 *                     - id: "cpc_01"
 *                       component: "NEWS_DOMAIN"
 *                       includedUnits: 1
 *                       unitAmountMinor: 19900
 *                     - id: "cpc_02"
 *                       component: "EPAPER_SUBDOMAIN"
 *                       includedUnits: 0
 *                       unitAmountMinor: 9900
 *                     - id: "cpc_03"
 *                       component: "NEWSPAPER_DESIGN_PAGE"
 *                       includedUnits: 240
 *                       unitAmountMinor: 500
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               missingName:
 *                 value: { error: "name is required" }
 *               invalidCycle:
 *                 value: { error: "Invalid cycle" }
 */
router.post('/billing/plans', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, currency, cycle, baseAmountMinor, components } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name is required' });

    const currencyNorm = String(currency || 'INR').toUpperCase();
    if (!['INR', 'USD'].includes(currencyNorm)) return res.status(400).json({ error: 'Invalid currency' });

    const cycleNorm = String(cycle || 'MONTHLY').toUpperCase();
    if (!['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'].includes(cycleNorm)) return res.status(400).json({ error: 'Invalid cycle' });

    const base = asInt(baseAmountMinor, 0);
    if (base < 0) return res.status(400).json({ error: 'baseAmountMinor must be >= 0' });

    const compsRaw = Array.isArray(components) ? components : [];
    const comps = compsRaw.map((c: any) => ({
      component: String(c.component || '').toUpperCase(),
      includedUnits: asInt(c.includedUnits, 0),
      unitAmountMinor: asInt(c.unitAmountMinor, 0),
    }));

    for (const c of comps) {
      if (!['NEWS_DOMAIN', 'EPAPER_SUBDOMAIN', 'NEWSPAPER_DESIGN_PAGE'].includes(c.component)) {
        return res.status(400).json({ error: `Invalid component: ${c.component}` });
      }
      if (c.includedUnits < 0) return res.status(400).json({ error: 'includedUnits must be >= 0' });
      if (c.unitAmountMinor < 0) return res.status(400).json({ error: 'unitAmountMinor must be >= 0' });
    }

    const created = await (prisma as any).billingPlan.create({
      data: {
        name: String(name),
        currency: currencyNorm,
        cycle: cycleNorm,
        baseAmountMinor: base,
        components: comps.length ? { create: comps } : undefined,
      },
      include: { components: true },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error('billing plan create error', e);
    return res.status(500).json({ error: 'Failed to create billing plan' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/subscription:
 *   get:
 *     summary: Get current tenant subscription (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Current subscription or null
 *         content:
 *           application/json:
 *             examples:
 *               active:
 *                 value:
 *                   id: "sub_01"
 *                   tenantId: "tenant_01"
 *                   planId: "cplan_01"
 *                   status: "ACTIVE"
 *                   currentPeriodStart: "2026-01-01T00:00:00.000Z"
 *                   currentPeriodEnd: "2026-02-01T00:00:00.000Z"
 *                   cancelAtPeriodEnd: false
 *                   plan:
 *                     id: "cplan_01"
 *                     name: "Basic Monthly"
 *                     currency: "INR"
 *                     cycle: "MONTHLY"
 *                     baseAmountMinor: 0
 *                     components:
 *                       - component: "NEWS_DOMAIN"
 *                         includedUnits: 1
 *                         unitAmountMinor: 19900
 *                       - component: "EPAPER_SUBDOMAIN"
 *                         includedUnits: 0
 *                         unitAmountMinor: 9900
 *                       - component: "NEWSPAPER_DESIGN_PAGE"
 *                         includedUnits: 240
 *                         unitAmountMinor: 500
 *               none:
 *                 value: null
 */
router.get('/tenants/:tenantId/billing/subscription', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  const { tenantId } = req.params;
  const sub = await getTenantActiveSubscription(tenantId).catch(() => null);
  return res.json(sub);
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/subscription:
 *   put:
 *     summary: Set/update tenant subscription (SUPER_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
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
 *             required: [planId]
 *             properties:
 *               planId: { type: string }
 *               currentPeriodStart: { type: string, format: date-time }
 *               currentPeriodEnd: { type: string, format: date-time }
 *               status: { type: string, enum: [SCHEDULED, ACTIVE, TRIALING, PAST_DUE, CANCELED], default: ACTIVE }
 *               cancelAtPeriodEnd: { type: boolean, default: false }
 *           examples:
 *             startNow:
 *               summary: Start monthly subscription now
 *               value:
 *                 planId: "cplan123"
 *                 status: "ACTIVE"
 *             scheduleFuture:
 *               summary: Schedule subscription for future date
 *               value:
 *                 planId: "cplan123"
 *                 currentPeriodStart: "2026-03-01T00:00:00.000Z"
 *                 currentPeriodEnd: "2026-04-01T00:00:00.000Z"
 *                 status: "SCHEDULED"
 *     responses:
 *       200:
 *         description: Updated subscription
 *         content:
 *           application/json:
 *             examples:
 *               updated:
 *                 value:
 *                   id: "sub_01"
 *                   tenantId: "tenant_01"
 *                   planId: "cplan_01"
 *                   status: "ACTIVE"
 *                   currentPeriodStart: "2026-01-01T00:00:00.000Z"
 *                   currentPeriodEnd: "2026-02-01T00:00:00.000Z"
 *                   cancelAtPeriodEnd: false
 *                   plan:
 *                     id: "cplan_01"
 *                     name: "Basic Monthly"
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             examples:
 *               invalidPlan:
 *                 value: { error: "Invalid planId" }
 *               invalidDates:
 *                 value: { error: "currentPeriodEnd must be after currentPeriodStart" }
 */
router.put('/tenants/:tenantId/billing/subscription', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { planId, currentPeriodStart, currentPeriodEnd, status, cancelAtPeriodEnd } = req.body || {};
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    const plan = await (prisma as any).billingPlan.findUnique({ where: { id: String(planId) }, include: { components: true } });
    if (!plan) return res.status(400).json({ error: 'Invalid planId' });

    const statusNorm = String(status || 'ACTIVE').toUpperCase();
    if (!['SCHEDULED', 'ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED'].includes(statusNorm)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const start = parseIsoDate(currentPeriodStart) || new Date();
    const planCycle = String(plan.cycle || 'MONTHLY').toUpperCase();
    const cycle: BillingCycle = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'].includes(planCycle)
      ? (planCycle as BillingCycle)
      : 'MONTHLY';
    const end = parseIsoDate(currentPeriodEnd) || addCycle(start, cycle);
    if (end.getTime() <= start.getTime()) return res.status(400).json({ error: 'currentPeriodEnd must be after currentPeriodStart' });

    // Auto-determine status: SCHEDULED if start date is in future, otherwise ACTIVE
    const now = new Date();
    const autoStatus = start.getTime() > now.getTime() ? 'SCHEDULED' : statusNorm;
    
    const cancelFlag = asBool(cancelAtPeriodEnd, false);

    const existing = await getTenantActiveSubscription(tenantId).catch(() => null);

    const saved = await (prisma as any).tenantSubscription.upsert({
      where: { id: existing?.id || '___nope___' },
      create: {
        tenantId,
        planId: String(planId),
        status: autoStatus,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: cancelFlag,
        canceledAt: statusNorm === 'CANCELED' ? new Date() : null,
      },
      update: {
        planId: String(planId),
        status: autoStatus,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        cancelAtPeriodEnd: cancelFlag,
        canceledAt: statusNorm === 'CANCELED' ? new Date() : null,
      },
      include: { plan: { include: { components: true } } },
    });

    return res.json(saved);
  } catch (e: any) {
    console.error('tenant subscription upsert error', e);
    return res.status(500).json({ error: 'Failed to save tenant subscription' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/usage/design-pages:
 *   post:
 *     summary: Record newspaper design page usage (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
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
 *             required: [pages]
 *             properties:
 *               pages: { type: integer, minimum: 1 }
 *               occurredAt: { type: string, format: date-time }
 *               description: { type: string }
 *               meta: { type: object }
 *           examples:
 *             sample:
 *               value:
 *                 pages: 4
 *                 description: "Jan-02 front page + inside"
 *     responses:
 *       201:
 *         description: Usage event created
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   id: "usage_01"
 *                   tenantId: "tenant_01"
 *                   subscriptionId: "sub_01"
 *                   component: "NEWSPAPER_DESIGN_PAGE"
 *                   quantity: 4
 *                   occurredAt: "2026-01-02T08:30:00.000Z"
 *                   meta: { description: "Jan-02 front page + inside" }
 *                   prepaid:
 *                     periodStart: "2026-01-01T00:00:00.000Z"
 *                     periodEnd: "2026-02-01T00:00:00.000Z"
 *                     includedUnits: 240
 *                     usedPages: 10
 *                     includedRemaining: 230
 *                     requiredFromCredits: 0
 *                     balanceAfter: 0
 *       402:
 *         description: Insufficient prepaid credits for pages beyond includedUnits
 *         content:
 *           application/json:
 *             examples:
 *               insufficient:
 *                 value:
 *                   error: "INSUFFICIENT_PREPAID_CREDITS"
 *                   component: "NEWSPAPER_DESIGN_PAGE"
 *                   periodStart: "2026-01-01T00:00:00.000Z"
 *                   periodEnd: "2026-02-01T00:00:00.000Z"
 *                   includedUnits: 240
 *                   usedPages: 240
 *                   includedRemaining: 0
 *                   requestedPages: 10
 *                   prepaidBalance: 2
 *                   requiredFromCredits: 10
 *                   shortagePages: 8
 *                   unitAmountMinor: 500
 *                   shortageAmountMinor: 4000
 *                   currency: "INR"
 *                   next:
 *                     topupOrderUrl: "/api/v1/tenants/tenant_01/billing/topups/design-pages/order"
 *                     topupPagesSuggested: 8
 */
router.post('/tenants/:tenantId/billing/usage/design-pages', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const pages = asInt(req.body?.pages, 0);
    if (!Number.isFinite(pages) || pages < 1) return res.status(400).json({ error: 'pages must be >= 1' });

    const occurredAt = parseIsoDate(req.body?.occurredAt) || new Date();
    const meta: any = req.body?.meta && typeof req.body.meta === 'object' ? req.body.meta : undefined;
    const description = req.body?.description ? String(req.body.description) : undefined;

    const pricing = await getDesignPagePricingForTenant(tenantId);
    if (!pricing) return res.status(404).json({ error: 'No active subscription for tenant' });

    // PREPAID enforcement for pages beyond includedUnits.
    const usedAgg = await (prisma as any).billingUsageEvent.aggregate({
      where: {
        tenantId,
        component: 'NEWSPAPER_DESIGN_PAGE',
        occurredAt: { gte: pricing.periodStart, lt: pricing.periodEnd },
      },
      _sum: { quantity: true },
    });
    const usedPages = asInt(usedAgg?._sum?.quantity, 0);
    const includedRemaining = Math.max(0, pricing.includedUnits - usedPages);
    const requiredFromCredits = Math.max(0, pages - includedRemaining);

    const creditRow = await (prisma as any).billingCreditBalance
      .findUnique({ where: { tenantId_component: { tenantId, component: 'NEWSPAPER_DESIGN_PAGE' } } })
      .catch(() => null);
    const balance = asInt(creditRow?.balance, 0);

    if (requiredFromCredits > 0 && balance < requiredFromCredits) {
      const shortage = requiredFromCredits - balance;
      const unitAmountMinor = pricing.unitAmountMinor;
      return res.status(402).json({
        error: 'INSUFFICIENT_PREPAID_CREDITS',
        component: 'NEWSPAPER_DESIGN_PAGE',
        periodStart: pricing.periodStart,
        periodEnd: pricing.periodEnd,
        includedUnits: pricing.includedUnits,
        usedPages,
        includedRemaining,
        requestedPages: pages,
        prepaidBalance: balance,
        requiredFromCredits,
        shortagePages: shortage,
        unitAmountMinor,
        shortageAmountMinor: shortage * unitAmountMinor,
        currency: pricing.currency,
        next: {
          topupOrderUrl: `/api/v1/tenants/${tenantId}/billing/topups/design-pages/order`,
          topupPagesSuggested: shortage,
        },
      });
    }

    const result = await (prisma as any).$transaction(async (tx: any) => {
      const created = await tx.billingUsageEvent.create({
        data: {
          tenantId,
          subscriptionId: pricing.subscription?.id || null,
          component: 'NEWSPAPER_DESIGN_PAGE',
          quantity: pages,
          occurredAt,
          meta: {
            ...(meta || {}),
            ...(description ? { description } : {}),
          },
        },
      });

      let newBalance = balance;
      if (requiredFromCredits > 0) {
        const updated = await tx.billingCreditBalance.upsert({
          where: { tenantId_component: { tenantId, component: 'NEWSPAPER_DESIGN_PAGE' } },
          create: { tenantId, component: 'NEWSPAPER_DESIGN_PAGE', balance: 0 },
          update: { balance: { decrement: requiredFromCredits } },
        });
        newBalance = asInt(updated?.balance, 0);
      }

      return { created, newBalance };
    });

    return res.status(201).json({
      ...result.created,
      prepaid: {
        periodStart: pricing.periodStart,
        periodEnd: pricing.periodEnd,
        includedUnits: pricing.includedUnits,
        usedPages,
        includedRemaining,
        requiredFromCredits,
        balanceAfter: result.newBalance,
      },
    });
  } catch (e: any) {
    console.error('billing usage design-pages error', e);
    return res.status(500).json({ error: 'Failed to record usage' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/credits:
 *   get:
 *     summary: Get prepaid credit balances for a tenant (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Credit balances
 *         content:
 *           application/json:
 *             examples:
 *               credits:
 *                 value:
 *                   tenantId: "tenant_01"
 *                   periodStart: "2026-01-01T00:00:00.000Z"
 *                   periodEnd: "2026-02-01T00:00:00.000Z"
 *                   currency: "INR"
 *                   components:
 *                     NEWSPAPER_DESIGN_PAGE:
 *                       includedUnits: 240
 *                       unitAmountMinor: 500
 *                       usedPages: 245
 *                       includedRemaining: 0
 *                       prepaidBalance: 20
 */
router.get('/tenants/:tenantId/billing/credits', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const pricing = await getDesignPagePricingForTenant(tenantId);
    if (!pricing) return res.status(404).json({ error: 'No active subscription for tenant' });

    const [usedAgg, creditRow] = await Promise.all([
      (prisma as any).billingUsageEvent.aggregate({
        where: {
          tenantId,
          component: 'NEWSPAPER_DESIGN_PAGE',
          occurredAt: { gte: pricing.periodStart, lt: pricing.periodEnd },
        },
        _sum: { quantity: true },
      }),
      (prisma as any).billingCreditBalance
        .findUnique({ where: { tenantId_component: { tenantId, component: 'NEWSPAPER_DESIGN_PAGE' } } })
        .catch(() => null),
    ]);

    const usedPages = asInt(usedAgg?._sum?.quantity, 0);
    const includedRemaining = Math.max(0, pricing.includedUnits - usedPages);

    return res.json({
      tenantId,
      periodStart: pricing.periodStart,
      periodEnd: pricing.periodEnd,
      currency: pricing.currency,
      components: {
        NEWSPAPER_DESIGN_PAGE: {
          includedUnits: pricing.includedUnits,
          unitAmountMinor: pricing.unitAmountMinor,
          usedPages,
          includedRemaining,
          prepaidBalance: asInt(creditRow?.balance, 0),
        },
      },
    });
  } catch (e: any) {
    console.error('billing credits get error', e);
    return res.status(500).json({ error: 'Failed to fetch credits' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/topups/design-pages/order:
 *   post:
 *     summary: Create a prepaid top-up Razorpay order for design pages (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     description: |
 *       Prepaid flow: buy page credits in advance. When paid, webhook credits the tenant balance.
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
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
 *             required: [pages]
 *             properties:
 *               pages: { type: integer, minimum: 1 }
 *           examples:
 *             sample:
 *               value: { pages: 60 }
 *     responses:
 *       201:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             examples:
 *               order:
 *                 value:
 *                   tenantId: "tenant_01"
 *                   invoiceId: "inv_topup_01"
 *                   razorpayKeyId: "rzp_live_xxxxx"
 *                   orderId: "order_RZP_123"
 *                   amount: 30000
 *                   currency: "INR"
 *                   pages: 60
 *       400: { description: Validation error }
 *       404: { description: No active subscription }
 */
router.post('/tenants/:tenantId/billing/topups/design-pages/order', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const pages = asInt(req.body?.pages, 0);
    if (!Number.isFinite(pages) || pages < 1) return res.status(400).json({ error: 'pages must be >= 1' });

    const pricing = await getDesignPagePricingForTenant(tenantId);
    if (!pricing) return res.status(404).json({ error: 'No active subscription for tenant' });
    if (pricing.unitAmountMinor <= 0) return res.status(400).json({ error: 'Design page unit price not configured for plan' });
    if (String(pricing.currency) !== 'INR') return res.status(400).json({ error: 'Razorpay supports INR only in this integration' });

    const amountMinor = pages * pricing.unitAmountMinor;
    if (amountMinor <= 0) return res.status(400).json({ error: 'Invalid topup amount' });

    const cfg = await getActiveRazorpayConfigForTenant(tenantId);
    if (!cfg?.keyId) return res.status(500).json({ error: 'Razorpay config missing for tenant/global' });
    const razorpay = await getRazorpayClientForTenant(tenantId);

    const invoice = await (prisma as any).billingInvoice.create({
      data: {
        tenantId,
        subscriptionId: pricing.subscription?.id || null,
        kind: 'TOPUP',
        status: 'OPEN',
        currency: pricing.currency,
        periodStart: pricing.periodStart,
        periodEnd: pricing.periodEnd,
        totalAmountMinor: amountMinor,
        lineItems: {
          create: [
            {
              component: 'NEWSPAPER_DESIGN_PAGE',
              description: `Design pages top-up (${pages} pages)`,
              quantity: pages,
              unitAmountMinor: pricing.unitAmountMinor,
              amountMinor,
            },
          ],
        },
      },
      include: { lineItems: true },
    });

    let receipt = `TOPUP-${invoice.id.slice(0, 12)}-${Date.now()}`;
    if (receipt.length > 40) receipt = receipt.slice(0, 40);

    const order = await (razorpay as any).orders.create({
      amount: amountMinor,
      currency: 'INR',
      receipt,
      notes: { tenantId, invoiceId: invoice.id, type: 'TENANT_BILLING_INVOICE', kind: 'TOPUP', component: 'NEWSPAPER_DESIGN_PAGE', pages },
    });

    await (prisma as any).billingInvoice.update({
      where: { id: invoice.id },
      data: { razorpayOrderId: order.id, meta: { ...(invoice.meta || {}), order } },
    });

    return res.status(201).json({
      tenantId,
      invoiceId: invoice.id,
      razorpayKeyId: cfg.keyId,
      orderId: order.id,
      amount: amountMinor,
      currency: 'INR',
      pages,
    });
  } catch (e: any) {
    console.error('design pages topup order error', e);
    return res.status(500).json({ error: e?.message || 'Failed to create topup order' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/preview:
 *   get:
 *     summary: Preview invoice for a tenant (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     description: |
 *       Calculates charges from active domains (NEWS/EPAPER) and the base plan price.
 *       Note: Design page overages are PREPAID via TOPUP invoices, so NEWSPAPER_DESIGN_PAGE is not billed here.
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: periodStart
 *         required: false
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: periodEnd
 *         required: false
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200:
 *         description: Invoice preview breakdown
 *         content:
 *           application/json:
 *             examples:
 *               preview:
 *                 value:
 *                   tenantId: "tenant_01"
 *                   subscription:
 *                     id: "sub_01"
 *                     planId: "cplan_01"
 *                     planName: "Basic Monthly"
 *                     status: "ACTIVE"
 *                     currentPeriodStart: "2026-01-01T00:00:00.000Z"
 *                     currentPeriodEnd: "2026-02-01T00:00:00.000Z"
 *                   periodStart: "2026-01-01T00:00:00.000Z"
 *                   periodEnd: "2026-02-01T00:00:00.000Z"
 *                   counts:
 *                     newsDomains: 2
 *                     epaperDomains: 1
 *                     designPages: 300
 *                   currency: "INR"
 *                   totalAmountMinor: 29800
 *                   lineItems:
 *                     - component: null
 *                       description: "Base (Basic Monthly)"
 *                       quantity: 1
 *                       unitAmountMinor: 0
 *                       amountMinor: 0
 *                     - component: "NEWS_DOMAIN"
 *                       description: "News domains"
 *                       quantity: 2
 *                       includedUnits: 1
 *                       unitAmountMinor: 19900
 *                       chargeableUnits: 1
 *                       amountMinor: 19900
 *                     - component: "EPAPER_SUBDOMAIN"
 *                       description: "ePaper subdomains"
 *                       quantity: 1
 *                       includedUnits: 0
 *                       unitAmountMinor: 9900
 *                       chargeableUnits: 1
 *                       amountMinor: 9900
 *       404:
 *         description: No active subscription
 */
router.get('/tenants/:tenantId/billing/invoices/preview', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const periodStart = parseIsoDate(req.query.periodStart);
    const periodEnd = parseIsoDate(req.query.periodEnd);
    if ((req.query.periodStart && !periodStart) || (req.query.periodEnd && !periodEnd)) {
      return res.status(400).json({ error: 'Invalid periodStart/periodEnd; must be ISO date-time' });
    }

    const preview = await buildInvoicePreview({ tenantId, periodStart: periodStart || undefined, periodEnd: periodEnd || undefined });
    if (!preview) return res.status(404).json({ error: 'No active subscription for tenant' });
    if (preview.periodEnd.getTime() <= preview.periodStart.getTime()) return res.status(400).json({ error: 'periodEnd must be after periodStart' });

    const sub = preview.subscription;
    return res.json({
      tenantId,
      subscription: {
        id: sub.id,
        planId: sub.planId,
        planName: sub.plan?.name,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
      periodStart: preview.periodStart,
      periodEnd: preview.periodEnd,
      counts: preview.counts,
      currency: preview.currency,
      totalAmountMinor: preview.totalAmountMinor,
      lineItems: preview.lineItems,
    });
  } catch (e: any) {
    console.error('invoice preview error', e);
    return res.status(500).json({ error: 'Failed to preview invoice' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/generate:
 *   post:
 *     summary: Generate and store an invoice (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     description: Creates a BillingInvoice row from the preview calculation. Idempotent for same period if invoice already exists.
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               periodStart: { type: string, format: date-time }
 *               periodEnd: { type: string, format: date-time }
 *           examples:
 *             currentPeriod: { value: {} }
 *     responses:
 *       201:
 *         description: Invoice created
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   id: "inv_01"
 *                   tenantId: "tenant_01"
 *                   subscriptionId: "sub_01"
 *                   kind: "SUBSCRIPTION"
 *                   status: "OPEN"
 *                   currency: "INR"
 *                   periodStart: "2026-01-01T00:00:00.000Z"
 *                   periodEnd: "2026-02-01T00:00:00.000Z"
 *                   totalAmountMinor: 29800
 *                   lineItems:
 *                     - component: "NEWS_DOMAIN"
 *                       description: "News domains"
 *                       quantity: 1
 *                       unitAmountMinor: 19900
 *                       amountMinor: 19900
 *                     - component: "EPAPER_SUBDOMAIN"
 *                       description: "ePaper subdomains"
 *                       quantity: 1
 *                       unitAmountMinor: 9900
 *                       amountMinor: 9900
 *       200:
 *         description: Existing invoice returned
 */
router.post('/tenants/:tenantId/billing/invoices/generate', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const periodStart = parseIsoDate(req.body?.periodStart);
    const periodEnd = parseIsoDate(req.body?.periodEnd);
    if ((req.body?.periodStart && !periodStart) || (req.body?.periodEnd && !periodEnd)) {
      return res.status(400).json({ error: 'Invalid periodStart/periodEnd; must be ISO date-time' });
    }

    const preview = await buildInvoicePreview({ tenantId, periodStart: periodStart || undefined, periodEnd: periodEnd || undefined });
    if (!preview) return res.status(404).json({ error: 'No active subscription for tenant' });
    if (preview.periodEnd.getTime() <= preview.periodStart.getTime()) return res.status(400).json({ error: 'periodEnd must be after periodStart' });

    // Idempotency: return existing invoice for same period if any
    const existing = await (prisma as any).billingInvoice.findFirst({
      where: {
        tenantId,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        status: { notIn: ['VOID'] },
      },
      include: { lineItems: true },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return res.status(200).json(existing);

    const created = await (prisma as any).billingInvoice.create({
      data: {
        tenantId,
        subscriptionId: preview.subscription.id,
        status: 'OPEN',
        currency: preview.currency,
        periodStart: preview.periodStart,
        periodEnd: preview.periodEnd,
        totalAmountMinor: preview.totalAmountMinor,
        lineItems: {
          create: preview.lineItems.map((li: any) => ({
            component: li.component,
            description: String(li.description || ''),
            quantity: asInt(li.chargeableUnits ?? li.quantity ?? 1, 1),
            unitAmountMinor: asInt(li.unitAmountMinor ?? 0, 0),
            amountMinor: asInt(li.amountMinor ?? 0, 0),
          })),
        },
      },
      include: { lineItems: true },
    });

    return res.status(201).json(created);
  } catch (e: any) {
    console.error('invoice generate error', e);
    return res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/{invoiceId}/pay/order:
 *   post:
 *     summary: Create Razorpay order for an invoice (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       201:
 *         description: Razorpay order created
 *         content:
 *           application/json:
 *             examples:
 *               order:
 *                 value:
 *                   tenantId: "tenant_01"
 *                   invoiceId: "inv_01"
 *                   razorpayKeyId: "rzp_live_xxxxx"
 *                   orderId: "order_RZP_456"
 *                   amount: 29800
 *                   currency: "INR"
 *       400: { description: Validation error }
 *       404: { description: Invoice not found }
 */
router.post('/tenants/:tenantId/billing/invoices/:invoiceId/pay/order', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const invoice = await (prisma as any).billingInvoice.findFirst({ where: { id: invoiceId, tenantId } }).catch(() => null);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (String(invoice.status) === 'PAID') return res.status(400).json({ error: 'Invoice already paid' });
    if (!invoice.totalAmountMinor || invoice.totalAmountMinor <= 0) return res.status(400).json({ error: 'Invoice totalAmountMinor must be > 0' });

    if (String(invoice.currency) !== 'INR') {
      return res.status(400).json({ error: 'Razorpay supports INR only in this integration' });
    }

    const cfg = await getActiveRazorpayConfigForTenant(tenantId);
    if (!cfg?.keyId) return res.status(500).json({ error: 'Razorpay config missing for tenant/global' });

    const razorpay = await getRazorpayClientForTenant(tenantId);

    let receipt = `INV-${invoiceId.slice(0, 12)}-${Date.now()}`;
    if (receipt.length > 40) receipt = receipt.slice(0, 40);

    const order = await (razorpay as any).orders.create({
      amount: invoice.totalAmountMinor,
      currency: 'INR',
      receipt,
      notes: { tenantId, invoiceId, type: 'TENANT_BILLING_INVOICE' },
    });

    await (prisma as any).billingInvoice
      .update({
        where: { id: invoice.id },
        data: {
          razorpayOrderId: order.id,
          meta: { ...(invoice.meta || {}), order },
        },
      })
      .catch(() => null);

    return res.status(201).json({
      tenantId,
      invoiceId: invoice.id,
      razorpayKeyId: cfg.keyId,
      orderId: order.id,
      amount: invoice.totalAmountMinor,
      currency: 'INR',
    });
  } catch (e: any) {
    console.error('invoice pay order error', e);
    return res.status(500).json({ error: e?.message || 'Failed to create invoice payment order' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices:
 *   get:
 *     summary: List billing invoices for a tenant (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: take
 *         required: false
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *       - in: query
 *         name: skip
 *         required: false
 *         schema: { type: integer, minimum: 0, default: 0 }
 *     responses:
 *       200:
 *         description: Paginated invoices
 *         content:
 *           application/json:
 *             examples:
 *               page:
 *                 value:
 *                   meta: { total: 2, skip: 0, take: 50 }
 *                   data:
 *                     - id: "inv_01"
 *                       tenantId: "tenant_01"
 *                       kind: "SUBSCRIPTION"
 *                       status: "OPEN"
 *                       currency: "INR"
 *                       totalAmountMinor: 29800
 *                       lineItems: []
 *                     - id: "inv_topup_01"
 *                       tenantId: "tenant_01"
 *                       kind: "TOPUP"
 *                       status: "PAID"
 *                       currency: "INR"
 *                       totalAmountMinor: 30000
 *                       lineItems:
 *                         - component: "NEWSPAPER_DESIGN_PAGE"
 *                           quantity: 60
 *                           unitAmountMinor: 500
 *                           amountMinor: 30000
 */
router.get('/tenants/:tenantId/billing/invoices', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const take = Math.min(Math.max(asInt(req.query.take, 50), 1), 200);
    const skip = Math.max(asInt(req.query.skip, 0), 0);

    const [total, rows] = await Promise.all([
      (prisma as any).billingInvoice.count({ where: { tenantId } }),
      (prisma as any).billingInvoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { lineItems: true },
      }),
    ]);

    return res.json({ meta: { total, skip, take }, data: rows });
  } catch (e: any) {
    console.error('billing invoices list error', e);
    return res.status(500).json({ error: 'Failed to list invoices' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/{invoiceId}:
 *   get:
 *     summary: Get a billing invoice (SUPER_ADMIN or scoped TENANT_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice
 *         content:
 *           application/json:
 *             examples:
 *               invoice:
 *                 value:
 *                   id: "inv_01"
 *                   tenantId: "tenant_01"
 *                   kind: "SUBSCRIPTION"
 *                   status: "OPEN"
 *                   currency: "INR"
 *                   periodStart: "2026-01-01T00:00:00.000Z"
 *                   periodEnd: "2026-02-01T00:00:00.000Z"
 *                   totalAmountMinor: 29800
 *                   lineItems:
 *                     - component: "NEWS_DOMAIN"
 *                       description: "News domains"
 *                       quantity: 1
 *                       unitAmountMinor: 19900
 *                       amountMinor: 19900
 *       404: { description: Not found }
 */
router.get('/tenants/:tenantId/billing/invoices/:invoiceId', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const invoice = await (prisma as any).billingInvoice.findFirst({
      where: { id: invoiceId, tenantId },
      include: { lineItems: true },
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    return res.json(invoice);
  } catch (e: any) {
    console.error('billing invoice get error', e);
    return res.status(500).json({ error: 'Failed to get invoice' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/{invoiceId}/mark-paid:
 *   post:
 *     summary: Manually mark an invoice as PAID (SUPER_ADMIN)
 *     description: Use for offline payments (cash/UPI/bank transfer). Stores metadata in invoice.meta.
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [method]
 *             properties:
 *               method: { type: string, description: e.g. CASH, UPI, BANK_TRANSFER }
 *               reference: { type: string, description: UTR/Txn Id or receipt number }
 *               note: { type: string }
 *               paidAt: { type: string, format: date-time }
 *           examples:
 *             upi:
 *               value:
 *                 method: "UPI"
 *                 reference: "UTR123456789"
 *                 note: "Paid by admin"
 *     responses:
 *       200:
 *         description: Updated invoice
 *         content:
 *           application/json:
 *             examples:
 *               paid:
 *                 value:
 *                   id: "inv_01"
 *                   status: "PAID"
 *                   paidAt: "2026-01-02T10:00:00.000Z"
 *                   meta:
 *                     manualPayment:
 *                       method: "UPI"
 *                       reference: "UTR123456789"
 *                       note: "Paid by admin"
 *       404: { description: Not found }
 */
router.post('/tenants/:tenantId/billing/invoices/:invoiceId/mark-paid', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const method = String(req.body?.method || '').trim();
    if (!method) return res.status(400).json({ error: 'method is required' });

    const paidAt = parseIsoDate(req.body?.paidAt) || new Date();
    const reference = req.body?.reference ? String(req.body.reference) : undefined;
    const note = req.body?.note ? String(req.body.note) : undefined;

    const invoice = await (prisma as any).billingInvoice.findFirst({ where: { id: invoiceId, tenantId } }).catch(() => null);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const updated = await (prisma as any).billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'PAID',
        paidAt,
        externalRef: reference || invoice.externalRef,
        meta: {
          ...(invoice.meta || {}),
          manualPayment: {
            method,
            reference: reference || null,
            note: note || null,
            paidAt,
          },
        },
      },
      include: { lineItems: true },
    });

    return res.json(updated);
  } catch (e: any) {
    console.error('billing invoice mark-paid error', e);
    return res.status(500).json({ error: 'Failed to mark invoice paid' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/billing/invoices/{invoiceId}/void:
 *   post:
 *     summary: Void an invoice (SUPER_ADMIN)
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: invoiceId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200:
 *         description: Updated invoice
 *         content:
 *           application/json:
 *             examples:
 *               voided:
 *                 value:
 *                   id: "inv_01"
 *                   status: "VOID"
 *                   meta:
 *                     voidedAt: "2026-01-02T10:30:00.000Z"
 *                     voidReason: "Duplicate invoice"
 */
router.post('/tenants/:tenantId/billing/invoices/:invoiceId/void', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, invoiceId } = req.params;
    const invoice = await (prisma as any).billingInvoice.findFirst({ where: { id: invoiceId, tenantId } }).catch(() => null);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (String(invoice.status) === 'PAID') return res.status(400).json({ error: 'Cannot void a PAID invoice' });

    const reason = req.body?.reason ? String(req.body.reason) : undefined;

    const updated = await (prisma as any).billingInvoice.update({
      where: { id: invoice.id },
      data: {
        status: 'VOID',
        meta: {
          ...(invoice.meta || {}),
          voidedAt: new Date(),
          ...(reason ? { voidReason: reason } : {}),
        },
      },
      include: { lineItems: true },
    });

    return res.json(updated);
  } catch (e: any) {
    console.error('billing invoice void error', e);
    return res.status(500).json({ error: 'Failed to void invoice' });
  }
});

/**
 * @swagger
 * /billing/subscriptions/activate-scheduled:
 *   post:
 *     summary: Manually activate scheduled subscriptions (SUPER_ADMIN)
 *     description: |
 *       Activates all SCHEDULED subscriptions where currentPeriodStart <= now.
 *       Normally runs via cron job, but can be triggered manually for testing.
 *     tags: [Billing]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Activation results
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 value:
 *                   activated: 3
 *                   failed: 0
 *               partial:
 *                 value:
 *                   activated: 2
 *                   failed: 1
 */
router.post('/billing/subscriptions/activate-scheduled', auth, requireSuperAdmin, async (req, res) => {
  try {
    const result = await activateScheduledSubscriptions();
    return res.json(result);
  } catch (e: any) {
    console.error('activate scheduled subscriptions error', e);
    return res.status(500).json({ error: 'Failed to activate scheduled subscriptions' });
  }
});

export default router;
