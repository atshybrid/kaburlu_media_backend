import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcrypt';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import { sendWhatsappIdCardTemplate } from '../../lib/whatsapp';

const router = Router();

/**
 * Send ID card PDF to reporter via WhatsApp.
 * Called after ID card PDF is uploaded or on resend request.
 */
async function sendIdCardViaWhatsApp(params: {
  reporterId: string;
  tenantId: string;
  pdfUrl: string;
  cardNumber: string;
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  try {
    const reporter = await (prisma as any).reporter.findFirst({
      where: { id: params.reporterId, tenantId: params.tenantId },
      include: {
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      },
    });

    if (!reporter?.user?.mobileNumber) {
      return { ok: false, error: 'Reporter mobile number not found' };
    }

    const [tenant, tenantEntity] = await Promise.all([
      (prisma as any).tenant.findUnique({ where: { id: params.tenantId }, select: { name: true } }),
      (prisma as any).tenantEntity?.findUnique?.({ where: { tenantId: params.tenantId }, select: { nativeName: true, publisherName: true } }).catch(() => null),
    ]);

    const organizationName = tenantEntity?.nativeName || tenantEntity?.publisherName || tenant?.name || 'Kaburlu Media';
    const reporterName = reporter.user.profile?.fullName || 'Reporter';
    const pdfFilename = `${reporterName.replace(/\s+/g, '_')}_ID_Card_${params.cardNumber}.pdf`;

    console.log(`[WhatsApp ID Card] Sending to ${reporter.user.mobileNumber} for reporter ${params.reporterId}`);

    const result = await sendWhatsappIdCardTemplate({
      toMobileNumber: reporter.user.mobileNumber,
      pdfUrl: params.pdfUrl,
      cardType: 'Reporter ID',
      organizationName,
      documentType: 'ID Card',
      pdfFilename,
    });

    if (result.ok) {
      console.log(`[WhatsApp ID Card] Sent successfully, messageId: ${result.messageId}`);
      return { ok: true, messageId: result.messageId };
    } else {
      console.error(`[WhatsApp ID Card] Failed:`, result.error);
      return { ok: false, error: result.error };
    }
  } catch (e: any) {
    console.error('[WhatsApp ID Card] Error:', e);
    return { ok: false, error: e.message || 'Failed to send WhatsApp message' };
  }
}

const includeReporterContact = {
  designation: true,
  user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } }
} as const;

function getAutoPublishFromKycData(kycData: any): boolean {
  try {
    if (!kycData || typeof kycData !== 'object') return false;
    if ((kycData as any).autoPublish === true) return true;
    if ((kycData as any)?.settings?.autoPublish === true) return true;
    return false;
  } catch {
    return false;
  }
}

function mapReporterContact(r: any) {
  if (!r) return r;
  const fullName = r?.user?.profile?.fullName || null;
  const mobileNumber = r?.user?.mobileNumber || null;
  const autoPublish = getAutoPublishFromKycData(r?.kycData);
  const { user, ...rest } = r;
  return { ...rest, fullName, mobileNumber, autoPublish };
}

/**
 * @swagger
 * /reporters/me:
 *   get:
 *     summary: Get current reporter profile from JWT token
 *     description: |
 *       Returns the reporter profile for the authenticated user without requiring reporter ID.
 *       Includes accessStatus for frontend gating (payment required / access expired screens).
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Reporter profile with stats and access status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 tenantId: { type: string }
 *                 userId: { type: string }
 *                 level: { type: string, enum: [STATE, DISTRICT, ASSEMBLY, MANDAL] }
 *                 designationId: { type: string }
 *                 stateId: { type: string }
 *                 districtId: { type: string }
 *                 mandalId: { type: string }
 *                 assemblyConstituencyId: { type: string }
 *                 subscriptionActive: { type: boolean }
 *                 monthlySubscriptionAmount: { type: integer }
 *                 idCardCharge: { type: integer }
 *                 kycStatus: { type: string, enum: [PENDING, APPROVED, REJECTED] }
 *                 profilePhotoUrl: { type: string }
 *                 active: { type: boolean }
 *                 fullName: { type: string }
 *                 mobileNumber: { type: string }
 *                 autoPublish: { type: boolean }
 *                 designation: { type: object }
 *                 state: { type: object }
 *                 district: { type: object }
 *                 mandal: { type: object }
 *                 assemblyConstituency: { type: object }
 *                 stats: { type: object }
 *                 accessStatus:
 *                   type: object
 *                   description: Frontend gating status - show overlay screens based on this
 *                   properties:
 *                     status: { type: string, enum: [ACTIVE, PAYMENT_REQUIRED, ACCESS_EXPIRED] }
 *                     reason: { type: string }
 *                     action: { type: string, enum: [NONE, PAY, CONTACT_PUBLISHER] }
 *                 paymentStatus:
 *                   type: object
 *                   description: Payment details when payment is required
 *                   properties:
 *                     required: { type: boolean }
 *                     outstanding: { type: array }
 *                     razorpay: { type: object }
 *                 manualLoginStatus:
 *                   type: object
 *                   description: Manual login access details
 *                   properties:
 *                     enabled: { type: boolean }
 *                     expiresAt: { type: string, format: date-time }
 *                     daysRemaining: { type: integer }
 *                     expired: { type: boolean }
 *                     publisherContact: { type: object }
 *       401: { description: Unauthorized }
 *       404: { description: Reporter profile not found for this user }
 */
router.get('/reporters/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user: any = (req as any).user;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const r = await (prisma as any).reporter.findFirst({
      where: { userId: user.id },
      include: {
        designation: true,
        user: { select: { mobileNumber: true, profile: { select: { fullName: true, profilePhotoUrl: true } } } },
        state: { select: { id: true, name: true } },
        district: { select: { id: true, name: true } },
        mandal: { select: { id: true, name: true } },
        assemblyConstituency: { select: { id: true, name: true } },
        idCard: { select: { id: true, cardNumber: true, issuedAt: true, expiresAt: true, pdfUrl: true } },
        payments: { select: { id: true, type: true, status: true, amount: true, currency: true, year: true, month: true, razorpayOrderId: true } },
      },
    });
    if (!r) return res.status(404).json({ error: 'Reporter profile not found for this user' });

    const fullName = r?.user?.profile?.fullName || null;
    const mobileNumber = r?.user?.mobileNumber || null;
    const computedProfilePhotoUrl = r?.profilePhotoUrl || r?.user?.profile?.profilePhotoUrl || null;
    const autoPublish = getAutoPublishFromKycData(r?.kycData);

    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;

    const tenantId = r.tenantId;
    const authorId = r?.userId ? String(r.userId) : null;

    // Fetch tenant info for publisher contact
    const [tenantInfo, tenantEntity] = await Promise.all([
      (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }).catch(() => null),
      (prisma as any).tenantEntity?.findUnique?.({ where: { tenantId }, select: { publisherName: true, nativeName: true, ownerName: true, editorName: true } }).catch(() => null),
    ]);

    // Calculate accessStatus, paymentStatus, manualLoginStatus
    let accessStatus: { status: 'ACTIVE' | 'PAYMENT_REQUIRED' | 'ACCESS_EXPIRED'; reason: string; action: 'NONE' | 'PAY' | 'CONTACT_PUBLISHER' } = {
      status: 'ACTIVE',
      reason: '',
      action: 'NONE',
    };

    // Manual login status
    const manualLoginExpiresAt = r.manualLoginExpiresAt ? new Date(r.manualLoginExpiresAt) : null;
    const manualLoginExpired = r.manualLoginEnabled && !r.subscriptionActive && manualLoginExpiresAt && manualLoginExpiresAt.getTime() <= now.getTime();
    const daysRemaining = manualLoginExpiresAt ? Math.max(0, Math.ceil((manualLoginExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;

    const publisherContact = {
      name: tenantEntity?.publisherName || tenantEntity?.nativeName || tenantInfo?.name || 'Publisher',
      phone: process.env.WHATSAPP_SUPPORT_MOBILE || '',
      message: 'Your access has expired. Please contact the publisher to extend your access.',
    };

    const manualLoginStatus = {
      enabled: !!r.manualLoginEnabled,
      expiresAt: manualLoginExpiresAt ? manualLoginExpiresAt.toISOString() : null,
      daysRemaining,
      expired: !!manualLoginExpired,
      publisherContact,
    };

    // Check manual login expiry first
    if (manualLoginExpired) {
      accessStatus = {
        status: 'ACCESS_EXPIRED',
        reason: 'Your manual login access has expired. Please contact the publisher to renew.',
        action: 'CONTACT_PUBLISHER',
      };
    }

    // Payment status calculation
    const outstanding: any[] = [];
    let paymentRequired = false;

    // Onboarding fee check
    if (typeof r.idCardCharge === 'number' && r.idCardCharge > 0) {
      const onboardingPaid = (r.payments || []).find((p: any) => p.type === 'ONBOARDING' && p.status === 'PAID');
      if (!onboardingPaid) {
        const existingOnboarding = (r.payments || []).find((p: any) => p.type === 'ONBOARDING');
        outstanding.push({
          type: 'ONBOARDING',
          amount: r.idCardCharge,
          currency: 'INR',
          status: existingOnboarding ? existingOnboarding.status : 'MISSING',
          paymentId: existingOnboarding?.id || null,
          razorpayOrderId: existingOnboarding?.razorpayOrderId || null,
        });
      }
    }

    // Monthly subscription check (only if subscriptionActive=true)
    if (r.subscriptionActive && typeof r.monthlySubscriptionAmount === 'number' && r.monthlySubscriptionAmount > 0) {
      const monthlyPaid = (r.payments || []).find((p: any) => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === year && p.month === month && p.status === 'PAID');
      if (!monthlyPaid) {
        const existingMonthly = (r.payments || []).find((p: any) => p.type === 'MONTHLY_SUBSCRIPTION' && p.year === year && p.month === month);
        outstanding.push({
          type: 'MONTHLY_SUBSCRIPTION',
          amount: r.monthlySubscriptionAmount,
          currency: 'INR',
          year,
          month,
          status: existingMonthly ? existingMonthly.status : 'MISSING',
          paymentId: existingMonthly?.id || null,
          razorpayOrderId: existingMonthly?.razorpayOrderId || null,
        });
      }
    }

    if (outstanding.length > 0 && accessStatus.status !== 'ACCESS_EXPIRED') {
      paymentRequired = true;
      accessStatus = {
        status: 'PAYMENT_REQUIRED',
        reason: outstanding.map(o => o.type === 'ONBOARDING' ? 'Onboarding fee pending' : `${month}/${year} subscription pending`).join(', '),
        action: 'PAY',
      };
    }

    const paymentStatus = {
      required: paymentRequired,
      outstanding,
      razorpay: outstanding.length > 0 && outstanding[0].razorpayOrderId ? { orderId: outstanding[0].razorpayOrderId } : null,
    };

    // Stats calculation
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
            where: { tenantId, authorId, status: { in: newspaperStatuses } },
            _count: { _all: true },
          })
          .catch(() => []),
        p.newspaperArticle
          .groupBy({
            by: ['status'],
            where: { tenantId, authorId, status: { in: newspaperStatuses }, createdAt: { gte: monthStart, lt: monthEnd } },
            _count: { _all: true },
          })
          .catch(() => []),
        p.tenantWebArticle
          .aggregate({ where: { tenantId, authorId, status: 'PUBLISHED' }, _sum: { viewCount: true } })
          .catch(() => ({ _sum: { viewCount: 0 } })),
        p.tenantWebArticle
          .aggregate({
            where: { tenantId, authorId, status: 'PUBLISHED', publishedAt: { gte: monthStart, lt: monthEnd } },
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
        where: { tenantId, reporterId: String(r.id), type: 'MONTHLY_SUBSCRIPTION', year, month },
        select: { status: true, amount: true, currency: true, expiresAt: true },
      })
      .catch(() => null);

    const { user: _user, payments: _payments, ...rest } = r;
    return res.json({
      ...rest,
      profilePhotoUrl: computedProfilePhotoUrl,
      autoPublish,
      fullName,
      mobileNumber,
      // NEW: Access control fields for frontend overlay screens
      accessStatus,
      paymentStatus,
      manualLoginStatus,
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
    console.error('get reporter me error', e);
    return res.status(500).json({ error: 'Failed to get reporter profile' });
  }
});

type ReporterLevelInput = 'STATE' | 'DISTRICT' | 'MANDAL' | 'ASSEMBLY';

type RoleName = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'REPORTER' | string;

function addUtcDays(now: Date, days: number) {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

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
  // ASSEMBLY level accepts assemblyConstituencyId OR mandalId (backward compatibility)
  if (level === 'ASSEMBLY') {
    const assemblyId = String(body.assemblyConstituencyId || body.mandalId || '');
    return { field: 'assemblyConstituencyId', id: assemblyId };
  }
  return { field: 'assemblyConstituencyId', id: String(body.assemblyConstituencyId || '') };
}

function pickReporterLimitMax(settingsData: any, input: { designationId: string; level: ReporterLevelInput; location: { field: string; id: string } }): number | undefined {
  const limits = settingsData?.reporterLimits;
  // Limits are always enforced. Default is max=1 when not configured.
  if (!limits) return 1;

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
 *               subscriptionActivationDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional - Schedule subscription activation for future date
 *               monthlySubscriptionAmount: { type: integer, description: 'Smallest currency unit' }
 *               idCardCharge: { type: integer, description: 'Smallest currency unit' }
 *               manualLoginEnabled:
 *                 type: boolean
 *                 description: Tenant-admin managed time-based login access (only valid when subscriptionActive=false)
 *               manualLoginDays:
 *                 type: integer
 *                 description: Required when manualLoginEnabled=true (e.g. 30)
 *               autoPublish:
 *                 type: boolean
 *                 description: When true, REPORTER-created newspaper articles auto-publish (stored in Reporter.kycData.autoPublish)
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
 *                 manualLoginEnabled: true
 *                 manualLoginDays: 30
 *                 autoPublish: true
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
 *                 subscriptionActive: false
 *                 manualLoginEnabled: true
 *                 manualLoginDays: 7
 *                 autoPublish: false
 *                 fullName: District Reporter
 *                 mobileNumber: '9502000000'
 *             districtReporterSubscription:
 *               summary: DISTRICT reporter with subscription (manual login disabled)
 *               value:
 *                 designationId: cmit7cpar0001ugkojh66y6ww
 *                 level: DISTRICT
 *                 districtId: cmit7pjf30001ugaov86j0abc
 *                 subscriptionActive: true
 *                 monthlySubscriptionAmount: 19900
 *                 idCardCharge: 0
 *                 autoPublish: true
 *                 fullName: District Reporter Subscribed
 *                 mobileNumber: '9502000001'
 *             scheduledSubscription:
 *               summary: Reporter with scheduled subscription activation
 *               value:
 *                 designationId: cmit7cpar0001ugkojh66y6ww
 *                 level: DISTRICT
 *                 districtId: cmit7pjf30001ugaov86j0abc
 *                 subscriptionActive: false
 *                 subscriptionActivationDate: '2026-03-01T00:00:00.000Z'
 *                 monthlySubscriptionAmount: 5000
 *                 idCardCharge: 1000
 *                 fullName: Scheduled Reporter
 *                 mobileNumber: '9502000002'
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
 *                 subscriptionActivationDate: { type: string, format: date-time, nullable: true }
 *                 monthlySubscriptionAmount: { type: integer, nullable: true }
 *                 idCardCharge: { type: integer, nullable: true }
 *                 manualLoginEnabled:
 *                   type: boolean
 *                   description: Tenant-admin managed time-based login access (only valid when subscriptionActive=false)
 *                 manualLoginDays:
 *                   type: integer
 *                   description: Required when manualLoginEnabled=true (e.g. 30)
 *                 autoPublish:
 *                   type: boolean
 *                   description: Reporter editorial setting for auto-publish; derived from Reporter.kycData.autoPublish
 *                 kycData:
 *                   type: object
 *                   description: Includes reporter editorial settings like autoPublish
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

    const manualLoginEnabled: boolean = body.manualLoginEnabled === true;
    const manualLoginDaysRaw = body.manualLoginDays;
    const manualLoginDays = typeof manualLoginDaysRaw === 'number' ? manualLoginDaysRaw : Number(manualLoginDaysRaw);

    // Optional editorial setting for reporter-created articles
    const autoPublish: boolean | undefined = typeof body.autoPublish === 'boolean' ? body.autoPublish : undefined;

    // Parse subscription activation date if provided
    // Support both subscriptionActivationDate and subscriptionStartDate (frontend compatibility)
    let subscriptionActivationDate: Date | null = null;
    const dateInput = body.subscriptionActivationDate || body.subscriptionStartDate;
    if (dateInput) {
      try {
        subscriptionActivationDate = new Date(dateInput);
        if (isNaN(subscriptionActivationDate.getTime())) {
          return res.status(400).json({ error: 'Invalid subscriptionActivationDate/subscriptionStartDate format' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid subscriptionActivationDate/subscriptionStartDate' });
      }
    }

    // Manual login can be enabled only when subscriptionActive=false.
    if (manualLoginEnabled) {
      if (body.subscriptionActive === true) return res.status(400).json({ error: 'manualLoginEnabled requires subscriptionActive=false' });
      if (!Number.isFinite(manualLoginDays) || manualLoginDays <= 0) return res.status(400).json({ error: 'manualLoginDays must be a positive number' });
    }
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
              subscriptionActivationDate: subscriptionActivationDate,
              monthlySubscriptionAmount:
                typeof body.monthlySubscriptionAmount === 'number'
                  ? body.monthlySubscriptionAmount
                  : (typeof body.subscriptionActive === 'boolean'
                      ? (body.subscriptionActive ? pricingResolved.monthlySubscriptionAmount : 0)
                      : pricingResolved.monthlySubscriptionAmount),
              idCardCharge: typeof body.idCardCharge === 'number' ? body.idCardCharge : pricingResolved.idCardCharge,
              manualLoginEnabled: manualLoginEnabled === true,
              manualLoginDays: manualLoginEnabled === true ? manualLoginDays : null,
              manualLoginActivatedAt: manualLoginEnabled === true ? new Date() : null,
              manualLoginExpiresAt: manualLoginEnabled === true ? addUtcDays(new Date(), manualLoginDays) : null,
              userId: user.id,
            };

            if (autoPublish !== undefined) {
              data.kycData = { autoPublish };
            }

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
 *                     autoPublish: false
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
      const autoPublish = getAutoPublishFromKycData(r?.kycData);
      const authorId = r?.userId ? String(r.userId) : null;
      const pay = paymentByReporterId.get(String(r.id)) || null;

      const { user, ...rest } = r;
      return {
        ...rest,
        profilePhotoUrl: computedProfilePhotoUrl,
        autoPublish,
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

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{reporterId}/subscription:
 *   patch:
 *     summary: Enable or disable reporter subscription
 *     description: |
 *       Toggle subscription status for a reporter. When disabled, monthly subscription amount is set to 0.
 *       Use this to activate/deactivate reporter payment requirements.
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
 *             required: [subscriptionActive]
 *             properties:
 *               subscriptionActive:
 *                 type: boolean
 *                 description: Enable or disable subscription
 *               subscriptionActivationDate:
 *                 type: string
 *                 format: date-time
 *                 description: Optional - Schedule subscription activation for future date
 *               monthlySubscriptionAmount:
 *                 type: integer
 *                 description: Monthly subscription amount (optional, defaults to tenant settings)
 *           examples:
 *             enable:
 *               summary: Enable subscription with default amount
 *               value:
 *                 subscriptionActive: true
 *             enableWithAmount:
 *               summary: Enable subscription with custom amount
 *               value:
 *                 subscriptionActive: true
 *                 monthlySubscriptionAmount: 5000
 *             scheduleActivation:
 *               summary: Schedule subscription for future date
 *               value:
 *                 subscriptionActive: false
 *                 subscriptionActivationDate: "2026-03-01T00:00:00.000Z"
 *                 monthlySubscriptionAmount: 5000
 *             disable:
 *               summary: Disable subscription
 *               value:
 *                 subscriptionActive: false
 *     responses:
 *       200:
 *         description: Subscription status updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 reporterId: { type: string }
 *                 tenantId: { type: string }
 *                 subscriptionActive: { type: boolean }
 *                 monthlySubscriptionAmount: { type: integer }
 *             example:
 *               success: true
 *               reporterId: "cmrep_123"
 *               tenantId: "cmtenant_456"
 *               subscriptionActive: true
 *               monthlySubscriptionAmount: 5000
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden - requires TENANT_ADMIN or SUPER_ADMIN }
 *       404: { description: Reporter not found }
 */
router.patch('/tenants/:tenantId/reporters/:reporterId/subscription', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireTenantEditorialScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId, reporterId } = req.params;
    const { subscriptionActive, monthlySubscriptionAmount, subscriptionActivationDate, subscriptionStartDate } = req.body || {};

    if (typeof subscriptionActive !== 'boolean') {
      return res.status(400).json({ error: 'subscriptionActive (boolean) is required' });
    }

    // Parse activation date if provided (support both field names for frontend compatibility)
    const dateInput = subscriptionActivationDate || subscriptionStartDate;
    let activationDate: Date | null = null;
    if (dateInput) {
      try {
        activationDate = new Date(dateInput);
        if (isNaN(activationDate.getTime())) {
          return res.status(400).json({ error: 'Invalid subscriptionActivationDate/subscriptionStartDate format' });
        }
      } catch (e) {
        return res.status(400).json({ error: 'Invalid subscriptionActivationDate/subscriptionStartDate' });
      }
    }

    if (typeof subscriptionActive !== 'boolean') {
      return res.status(400).json({ error: 'subscriptionActive (boolean) is required' });
    }

    const existing = await (prisma as any).reporter.findFirst({
      where: { id: reporterId, tenantId },
      select: { id: true, designationId: true, level: true }
    }).catch(() => null);

    if (!existing?.id) return res.status(404).json({ error: 'Reporter not found' });

    // Get default amount from tenant settings if not provided
    let finalAmount = 0;
    if (subscriptionActive) {
      if (typeof monthlySubscriptionAmount === 'number' && monthlySubscriptionAmount >= 0) {
        finalAmount = monthlySubscriptionAmount;
      } else {
        // Fallback to tenant settings
        const tenantSettings = await (prisma as any).tenantSettings.findUnique({
          where: { tenantId },
          select: { data: true }
        }).catch(() => null);

        const pricingConfig = normalizePricingFromSettings(tenantSettings?.data);
        const pricing = resolvePricingForDesignation(pricingConfig, existing.designationId);
        finalAmount = pricing.monthlySubscriptionAmount || 0;
      }
    }

    // Handle scheduled activation logic
    let actualSubscriptionActive = subscriptionActive;
    
    // If enabling subscription with future activation date, schedule it (not active yet)
    if (subscriptionActive && activationDate) {
      const now = new Date();
      if (activationDate.getTime() > now.getTime()) {
        // Future date - schedule activation (set active=false until date arrives)
        actualSubscriptionActive = false;
      }
    }

    const updated = await (prisma as any).reporter.update({
      where: { id: reporterId },
      data: {
        subscriptionActive: actualSubscriptionActive,
        subscriptionActivationDate: activationDate,
        monthlySubscriptionAmount: finalAmount
      },
      select: {
        id: true,
        tenantId: true,
        subscriptionActive: true,
        subscriptionActivationDate: true,
        monthlySubscriptionAmount: true
      }
    });

    return res.json({
      success: true,
      reporterId: updated.id,
      tenantId: updated.tenantId,
      subscriptionActive: updated.subscriptionActive,
      subscriptionActivationDate: updated.subscriptionActivationDate,
      monthlySubscriptionAmount: updated.monthlySubscriptionAmount
    });
  } catch (e: any) {
    console.error('set reporter subscription error', e);
    return res.status(500).json({ error: 'Failed to update subscription status' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/activate-subscriptions:
 *   post:
 *     summary: Manually activate scheduled reporter subscriptions
 *     description: |
 *       Activates all reporter subscriptions where subscriptionActivationDate <= now.
 *       Normally runs via cron, but can be triggered manually.
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Activation results
 *         content:
 *           application/json:
 *             example:
 *               activated: 3
 *               failed: 0
 */
router.post('/tenants/:tenantId/reporters/activate-subscriptions', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const scope = await requireTenantEditorialScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { activateReporterSubscriptions } = require('../../lib/activateReporterSubscriptions');
    const result = await activateReporterSubscriptions();
    
    return res.json(result);
  } catch (e: any) {
    console.error('activate reporter subscriptions error', e);
    return res.status(500).json({ error: 'Failed to activate subscriptions' });
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
 *                   autoPublish: false
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
    const autoPublish = getAutoPublishFromKycData(r?.kycData);

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
      autoPublish,
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
  try {
    const scope = await requireTenantEditorialScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId, id } = req.params;
    const body = req.body || {};

    const reporter = await (prisma as any).reporter
      .findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          tenantId: true,
          level: true,
          designationId: true,
          stateId: true,
          districtId: true,
          mandalId: true,
          assemblyConstituencyId: true,
          subscriptionActive: true,
          monthlySubscriptionAmount: true,
          idCardCharge: true,
          profilePhotoUrl: true,
          active: true,
        },
      })
      .catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    const nextLevel: ReporterLevelInput = (body.level ? String(body.level) : String(reporter.level)) as ReporterLevelInput;
    if (!['STATE', 'DISTRICT', 'MANDAL', 'ASSEMBLY'].includes(nextLevel)) {
      return res.status(400).json({ error: 'Invalid level' });
    }

    const stateId = body.stateId ?? reporter.stateId;
    const districtId = body.districtId ?? reporter.districtId;
    const mandalId = body.mandalId ?? reporter.mandalId;
    const assemblyConstituencyId = body.assemblyConstituencyId ?? reporter.assemblyConstituencyId;
    const locationKey = getLocationKeyFromLevel(nextLevel, { stateId, districtId, mandalId, assemblyConstituencyId });
    if (!locationKey.id) {
      if (nextLevel === 'STATE') return res.status(400).json({ error: 'stateId required for STATE level' });
      if (nextLevel === 'DISTRICT') return res.status(400).json({ error: 'districtId required for DISTRICT level' });
      if (nextLevel === 'MANDAL') return res.status(400).json({ error: 'mandalId required for MANDAL level' });
      return res.status(400).json({ error: 'assemblyConstituencyId required for ASSEMBLY level' });
    }

    const updateData: any = {
      level: nextLevel,
      stateId: nextLevel === 'STATE' ? locationKey.id : null,
      districtId: nextLevel === 'DISTRICT' ? locationKey.id : null,
      mandalId: nextLevel === 'MANDAL' ? locationKey.id : null,
      assemblyConstituencyId: nextLevel === 'ASSEMBLY' ? locationKey.id : null,
    };

    if (typeof body.subscriptionActive === 'boolean') {
      updateData.subscriptionActive = body.subscriptionActive;
      if (!body.subscriptionActive) {
        updateData.monthlySubscriptionAmount = 0;
      }
    }

    if (typeof body.monthlySubscriptionAmount === 'number') {
      updateData.monthlySubscriptionAmount = body.monthlySubscriptionAmount;
    }

    if (typeof body.idCardCharge === 'number') {
      updateData.idCardCharge = body.idCardCharge;
    }

    if (typeof body.profilePhotoUrl === 'string') {
      updateData.profilePhotoUrl = body.profilePhotoUrl.trim() || null;
    }

    if (typeof body.active === 'boolean') {
      updateData.active = body.active;
    }

    if (body.designationId) {
      const designationId = String(body.designationId);
      const designation = await (prisma as any).reporterDesignation
        .findUnique({ where: { id: designationId }, select: { id: true, level: true, tenantId: true } })
        .catch(() => null);
      if (!designation) return res.status(400).json({ error: 'Invalid designationId' });
      if (String(designation.level) !== nextLevel) return res.status(400).json({ error: 'designationId does not match requested level' });
      if (designation.tenantId && String(designation.tenantId) !== String(tenantId)) {
        return res.status(400).json({ error: 'designationId does not belong to this tenant' });
      }
      updateData.designationId = designationId;
    }

    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        tenantId: true,
        designationId: true,
        level: true,
        stateId: true,
        districtId: true,
        mandalId: true,
        assemblyConstituencyId: true,
        subscriptionActive: true,
        monthlySubscriptionAmount: true,
        idCardCharge: true,
        profilePhotoUrl: true,
        active: true,
        updatedAt: true,
      },
    });

    return res.json(updated);
  } catch (e: any) {
    console.error('tenant reporter update error', e);
    return res.status(500).json({ error: 'Failed to update reporter' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/login-access:
 *   patch:
 *     summary: Set reporter manual login access (tenant admin)
 *     description: |
 *       Allows TENANT_ADMIN/SUPER_ADMIN to enable/disable time-based reporter login access.
 *       When enabled, `manualLoginDays` grants login access for that many days from now.
 *       This is only valid when the reporter has `subscriptionActive=false`.
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
 *               manualLoginEnabled: { type: boolean }
 *               manualLoginDays: { type: integer, description: 'Required when manualLoginEnabled=true' }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       403: { description: Forbidden }
 *       404: { description: Reporter not found }
 */
router.patch('/tenants/:tenantId/reporters/:id/login-access', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const body = req.body || {};

    const manualLoginEnabled: boolean | undefined = typeof body.manualLoginEnabled === 'boolean' ? body.manualLoginEnabled : undefined;
    const manualLoginDaysRaw = body.manualLoginDays;
    const manualLoginDays = typeof manualLoginDaysRaw === 'number' ? manualLoginDaysRaw : Number(manualLoginDaysRaw);

    if (manualLoginEnabled === undefined) return res.status(400).json({ error: 'manualLoginEnabled is required' });
    if (manualLoginEnabled === true && (!Number.isFinite(manualLoginDays) || manualLoginDays <= 0)) {
      return res.status(400).json({ error: 'manualLoginDays must be a positive number' });
    }

    const reporter = await prisma.reporter.findFirst({ where: { id, tenantId }, select: { id: true, tenantId: true, subscriptionActive: true } }).catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    if (manualLoginEnabled === true && reporter.subscriptionActive) {
      return res.status(400).json({ error: 'manualLoginEnabled requires subscriptionActive=false' });
    }

    const now = new Date();
    const updated = await prisma.reporter.update({
      where: { id },
      data: manualLoginEnabled
        ? {
            manualLoginEnabled: true,
            manualLoginDays: manualLoginDays,
            manualLoginActivatedAt: now,
            manualLoginExpiresAt: addUtcDays(now, manualLoginDays),
          }
        : {
            manualLoginEnabled: false,
            manualLoginDays: null,
            manualLoginActivatedAt: null,
            manualLoginExpiresAt: null,
          },
      select: {
        id: true,
        tenantId: true,
        manualLoginEnabled: true,
        manualLoginDays: true,
        manualLoginActivatedAt: true,
        manualLoginExpiresAt: true,
        subscriptionActive: true,
      },
    });

    return res.json(updated);
  } catch (e: any) {
    console.error('tenant reporter login-access patch error', e);
    return res.status(500).json({ error: 'Failed to update login access' });
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
 */
router.patch('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;
    if (!user?.role?.name) return res.status(401).json({ error: 'Unauthorized' });

    const roleName = String(user.role.name);
    const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_EDITOR', 'ADMIN_EDITOR', 'NEWS_MODERATOR'].includes(roleName);
    const isReporter = roleName === 'REPORTER';

    if (!isAdmin && !isReporter) return res.status(403).json({ error: 'Forbidden' });

    // Find the reporter record
    const reporter = await (prisma as any).reporter
      .findFirst({ where: { id, tenantId }, select: { id: true, tenantId: true, userId: true } })
      .catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Reporter can only update their own photo
    if (isReporter) {
      if (String(reporter.userId) !== String(user.id)) {
        return res.status(403).json({ error: 'Access denied - can only update your own profile photo' });
      }
    } else if (!['SUPER_ADMIN'].includes(roleName)) {
      // Tenant admin/editor: ensure they belong to the same tenant
      const actorReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
        .catch(() => null);
      if (!actorReporter?.tenantId || String(actorReporter.tenantId) !== String(tenantId)) {
        return res.status(403).json({ error: 'Tenant scope mismatch' });
      }
    }

    const body = req.body || {};
    const profilePhotoUrl = typeof body.profilePhotoUrl === 'string' ? body.profilePhotoUrl.trim() : '';
    if (!profilePhotoUrl) return res.status(400).json({ error: 'profilePhotoUrl required' });

    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: { profilePhotoUrl },
      select: { id: true, tenantId: true, profilePhotoUrl: true },
    });

    if (reporter.userId) {
      await (prisma as any).userProfile.upsert({
        where: { userId: reporter.userId },
        update: { profilePhotoUrl },
        create: { userId: reporter.userId, profilePhotoUrl },
      });
    }

    return res.json(updated);
  } catch (e: any) {
    console.error('tenant reporter profile-photo patch error', e);
    return res.status(500).json({ error: 'Failed to update profile photo' });
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
 */
router.delete('/tenants/:tenantId/reporters/:id/profile-photo', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;
    if (!user?.role?.name) return res.status(401).json({ error: 'Unauthorized' });

    const roleName = String(user.role.name);
    const isAdmin = ['SUPER_ADMIN', 'TENANT_ADMIN', 'TENANT_EDITOR', 'ADMIN_EDITOR', 'NEWS_MODERATOR'].includes(roleName);
    const isReporter = roleName === 'REPORTER';

    if (!isAdmin && !isReporter) return res.status(403).json({ error: 'Forbidden' });

    // Find the reporter record
    const reporter = await (prisma as any).reporter
      .findFirst({ where: { id, tenantId }, select: { id: true, tenantId: true, userId: true } })
      .catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Reporter can only delete their own photo
    if (isReporter) {
      if (String(reporter.userId) !== String(user.id)) {
        return res.status(403).json({ error: 'Access denied - can only delete your own profile photo' });
      }
    } else if (!['SUPER_ADMIN'].includes(roleName)) {
      // Tenant admin/editor: ensure they belong to the same tenant
      const actorReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
        .catch(() => null);
      if (!actorReporter?.tenantId || String(actorReporter.tenantId) !== String(tenantId)) {
        return res.status(403).json({ error: 'Tenant scope mismatch' });
      }
    }

    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: { profilePhotoUrl: null },
      select: { id: true, tenantId: true, profilePhotoUrl: true },
    });

    if (reporter.userId) {
      await (prisma as any).userProfile
        .upsert({
          where: { userId: reporter.userId },
          update: { profilePhotoUrl: null },
          create: { userId: reporter.userId, profilePhotoUrl: null },
        })
        .catch(() => null);
    }

    return res.json(updated);
  } catch (e: any) {
    console.error('tenant reporter profile-photo delete error', e);
    return res.status(500).json({ error: 'Failed to remove profile photo' });
  }
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
  try {
    const scope = await requireTenantEditorialScope(req, res);
    if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

    const { tenantId, id } = req.params;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: { idCard: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    if (reporter.idCard) {
      return res.status(201).json(reporter.idCard);
    }

    // Generation pre-conditions
    // Note: KYC is NOT mandatory for ID card generation.
    // Require a profile photo, then enforce payment rules.

    // Require profile photo (either Reporter.profilePhotoUrl or UserProfile.profilePhotoUrl)
    let hasPhoto = !!reporter.profilePhotoUrl;
    if (!hasPhoto && reporter.userId) {
      const profile = await (prisma as any).userProfile
        .findUnique({ where: { userId: reporter.userId }, select: { profilePhotoUrl: true } })
        .catch(() => null);
      hasPhoto = !!profile?.profilePhotoUrl;
    }
    if (!hasPhoto) {
      return res.status(403).json({ error: 'Profile photo is required to generate ID card' });
    }

    // Payment requirements
    // - If idCardCharge > 0: onboarding payment must be PAID
    // - If subscriptionActive=true: current month subscription payment must be PAID
    if (typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
      const onboardingPaid = await (prisma as any).reporterPayment.findFirst({
        where: { tenantId, reporterId: reporter.id, type: 'ONBOARDING', status: 'PAID' },
        select: { id: true },
      });
      if (!onboardingPaid) {
        return res.status(403).json({ error: 'Onboarding payment must be PAID to generate ID card' });
      }
    }

    if (reporter.subscriptionActive) {
      // Use Asia/Kolkata month/year to avoid UTC month boundary issues
      const fmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' });
      const parts = fmt.formatToParts(new Date());
      const istYear = Number(parts.find(p => p.type === 'year')?.value);
      const istMonth = Number(parts.find(p => p.type === 'month')?.value);

      // Fallback to UTC if parsing fails
      const now = new Date();
      const utcYear = now.getUTCFullYear();
      const utcMonth = now.getUTCMonth() + 1; // 1-12

      const monthlyPaid = await (prisma as any).reporterPayment.findFirst({
        where: {
          tenantId,
          reporterId: reporter.id,
          type: 'MONTHLY_SUBSCRIPTION',
          status: 'PAID',
          OR: [
            { year: istYear || utcYear, month: istMonth || utcMonth },
            { year: utcYear, month: utcMonth },
          ],
        },
        select: { id: true },
      });
      if (!monthlyPaid) {
        return res.status(403).json({ error: 'Subscription payment must be PAID for current month to generate ID card' });
      }
    }

    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'Tenant ID card settings not configured' });

    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;

    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId } },
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
        pdfUrl: null,
      },
    });

    return res.status(201).json(idCard);
  } catch (e) {
    console.error('tenant reporter id-card error', e);
    return res.status(500).json({ error: 'Failed to generate reporter ID card' });
  }
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
  try {
    const { tenantId, id } = req.params;
    const card = await (prisma as any).reporterIDCard.findFirst({ where: { reporterId: id, reporter: { tenantId } } }).catch(() => null);
    return res.status(200).json(card || null);
  } catch (e) {
    console.error('tenant reporter get id-card error', e);
    return res.status(500).json({ error: 'Failed to fetch reporter ID card' });
  }
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
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '');
    if (!roleName) return res.status(401).json({ error: 'Unauthorized' });

    // Allow reporter to submit their own KYC; allow tenant admins/super admins to submit on behalf.
    const allowed = ['SUPER_ADMIN', 'TENANT_ADMIN', 'REPORTER'];
    if (!allowed.includes(roleName)) return res.status(403).json({ error: 'Forbidden' });

    if (roleName !== 'SUPER_ADMIN') {
      const actorReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id }, select: { id: true, tenantId: true } })
        .catch(() => null);
      if (!actorReporter?.tenantId) return res.status(403).json({ error: 'Reporter profile not linked to tenant' });
      if (String(actorReporter.tenantId) !== String(tenantId)) return res.status(403).json({ error: 'Tenant scope mismatch' });
      if (roleName === 'REPORTER' && String(actorReporter.id) !== String(id)) {
        return res.status(403).json({ error: 'Reporter can only submit their own KYC' });
      }
    }

    const body = req.body || {};
    const aadharNumberMasked = body.aadharNumberMasked;
    const panNumberMasked = body.panNumberMasked;
    const workProofUrl = body.workProofUrl;
    if (!aadharNumberMasked || !panNumberMasked) {
      return res.status(400).json({ error: 'aadharNumberMasked and panNumberMasked required' });
    }

    const reporter = await (prisma as any).reporter
      .findFirst({ where: { id, tenantId }, select: { id: true, kycData: true, kycStatus: true } })
      .catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    const prevKycData = reporter.kycData && typeof reporter.kycData === 'object' ? reporter.kycData : {};
    const nextKycData = {
      ...(prevKycData as any),
      documents: {
        ...(((prevKycData as any)?.documents as any) || {}),
        aadharNumberMasked: String(aadharNumberMasked),
        panNumberMasked: String(panNumberMasked),
        ...(workProofUrl ? { workProofUrl: String(workProofUrl) } : {}),
      },
      submittedAt: new Date().toISOString(),
    };

    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: {
        kycStatus: 'SUBMITTED',
        kycData: nextKycData,
      },
      select: { id: true, tenantId: true, kycStatus: true, kycData: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error('tenant reporter kyc submit error', e);
    return res.status(500).json({ error: 'Failed to submit KYC' });
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
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '');
    if (!roleName) return res.status(401).json({ error: 'Unauthorized' });

    // Spec says SUPER_ADMIN or TENANT_ADMIN
    if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(roleName)) return res.status(403).json({ error: 'Forbidden' });

    if (roleName !== 'SUPER_ADMIN') {
      const actorReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id }, select: { tenantId: true } })
        .catch(() => null);
      if (!actorReporter?.tenantId) return res.status(403).json({ error: 'Reporter profile not linked to tenant' });
      if (String(actorReporter.tenantId) !== String(tenantId)) return res.status(403).json({ error: 'Tenant scope mismatch' });
    }

    const body = req.body || {};
    const statusRaw = String(body.status || '').trim();
    if (!statusRaw) return res.status(400).json({ error: 'status required' });
    if (!['APPROVED', 'REJECTED'].includes(statusRaw)) return res.status(400).json({ error: 'Invalid status' });
    const notes = typeof body.notes === 'string' ? body.notes : undefined;
    const verifiedAadhar = typeof body.verifiedAadhar === 'boolean' ? body.verifiedAadhar : undefined;
    const verifiedPan = typeof body.verifiedPan === 'boolean' ? body.verifiedPan : undefined;
    const verifiedWorkProof = typeof body.verifiedWorkProof === 'boolean' ? body.verifiedWorkProof : undefined;

    const reporter = await (prisma as any).reporter
      .findFirst({ where: { id, tenantId }, select: { id: true, kycData: true } })
      .catch(() => null);
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    const prevKycData = reporter.kycData && typeof reporter.kycData === 'object' ? reporter.kycData : {};
    const nextKycData = {
      ...(prevKycData as any),
      verification: {
        ...(((prevKycData as any)?.verification as any) || {}),
        status: statusRaw,
        ...(notes ? { notes } : {}),
        ...(verifiedAadhar !== undefined ? { verifiedAadhar } : {}),
        ...(verifiedPan !== undefined ? { verifiedPan } : {}),
        ...(verifiedWorkProof !== undefined ? { verifiedWorkProof } : {}),
        verifiedAt: new Date().toISOString(),
        verifiedByUserId: user?.id ? String(user.id) : null,
      },
    };

    const updated = await (prisma as any).reporter.update({
      where: { id },
      data: {
        kycStatus: statusRaw,
        kycData: nextKycData,
      },
      select: { id: true, tenantId: true, kycStatus: true, kycData: true },
    });

    return res.status(200).json(updated);
  } catch (e) {
    console.error('tenant reporter kyc verify error', e);
    return res.status(500).json({ error: 'Failed to verify KYC' });
  }
});
/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card/pdf:
 *   patch:
 *     summary: Update ID card PDF URL and send via WhatsApp
 *     description: |
 *       Updates the PDF URL for an existing ID card and automatically sends it to the reporter via WhatsApp.
 *       Call this after generating/uploading the ID card PDF.
 *       
 *       **Access Control:**
 *       - Super Admin: Can update for any reporter
 *       - Tenant Admin: Can update for reporters in their tenant
 *       - Reporter: Can update their own ID card PDF
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
 *             required: [pdfUrl]
 *             properties:
 *               pdfUrl: { type: string }
 *               sendWhatsApp: { type: boolean, default: true, description: 'Send PDF via WhatsApp' }
 *     responses:
 *       200:
 *         description: PDF URL updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 cardNumber: { type: string }
 *                 pdfUrl: { type: string }
 *                 whatsappSent: { type: boolean }
 *                 whatsappMessageId: { type: string }
 *       400: { description: ID card not found or pdfUrl missing }
 *       403: { description: Not authorized }
 *       404: { description: Reporter not found }
 */
router.patch('/tenants/:tenantId/reporters/:id/id-card/pdf', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;
    const body = req.body || {};

    const pdfUrl = typeof body.pdfUrl === 'string' ? body.pdfUrl.trim() : '';
    const sendWhatsApp = body.sendWhatsApp !== false; // default true

    if (!pdfUrl) {
      return res.status(400).json({ error: 'pdfUrl is required' });
    }

    // Find reporter first to check ownership
    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: { idCard: true },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Access control - allow reporter to update their own ID card PDF
    const roleName = String(user?.role?.name || '').toUpperCase();
    const isSuperAdmin = roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN';
    const isTenantAdmin = roleName === 'TENANT_ADMIN' || roleName === 'ADMIN';
    const isOwnReporter = reporter.userId && reporter.userId === user?.id;

    let isAdminOfTenant = isSuperAdmin;
    if (!isAdminOfTenant && isTenantAdmin) {
      const adminReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id, tenantId }, select: { id: true } })
        .catch(() => null);
      isAdminOfTenant = !!adminReporter;
    }

    // Allow: super admin, tenant admin of this tenant, or own reporter
    if (!isSuperAdmin && !isAdminOfTenant && !isOwnReporter) {
      return res.status(403).json({ error: 'Not authorized to update ID card PDF' });
    }
    if (!reporter.idCard) return res.status(400).json({ error: 'ID card not found. Generate it first.' });

    // Update PDF URL
    const updated = await (prisma as any).reporterIDCard.update({
      where: { id: reporter.idCard.id },
      data: { pdfUrl },
      select: { id: true, cardNumber: true, pdfUrl: true, issuedAt: true, expiresAt: true },
    });

    // Send via WhatsApp
    let whatsappResult: { ok: boolean; messageId?: string; error?: string } = { ok: false };
    if (sendWhatsApp) {
      whatsappResult = await sendIdCardViaWhatsApp({
        reporterId: id,
        tenantId,
        pdfUrl,
        cardNumber: updated.cardNumber,
      });
    }

    return res.json({
      ...updated,
      whatsappSent: whatsappResult.ok,
      whatsappMessageId: whatsappResult.messageId || null,
      whatsappError: whatsappResult.error || null,
    });
  } catch (e: any) {
    console.error('update id-card pdf error', e);
    return res.status(500).json({ error: 'Failed to update ID card PDF' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/reporters/{id}/id-card/resend:
 *   post:
 *     summary: Resend ID card PDF via WhatsApp (✨ Auto-regenerates if missing)
 *     description: |
 *       Resends the existing ID card PDF to the reporter's registered mobile number via WhatsApp.
 *       
 *       **NEW FEATURE:** If the PDF URL is missing from the database, the system will automatically 
 *       regenerate the PDF and then send it via WhatsApp. This ensures reliable delivery even if 
 *       the PDF file was accidentally deleted.
 *       
 *       **Access Control:**
 *       - Super Admin: Can resend any reporter's ID card
 *       - Tenant Admin: Can resend ID cards for reporters in their tenant
 *       - Reporter: Can resend their own ID card
 *       
 *       **Requirements:**
 *       - ID card record must exist in database
 *       - Reporter must have a registered mobile number
 *     tags: [TenantReporters]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         example: "cmkh94g0s01eykb21toi1oucu"
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Reporter ID
 *         example: "cml54silw009bbzyjen9g7qf8"
 *     responses:
 *       200:
 *         description: WhatsApp message sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                   example: true
 *                 message: 
 *                   type: string
 *                   example: "ID card PDF sent via WhatsApp"
 *                 messageId: 
 *                   type: string
 *                   example: "wamid_HBgLOTE5MzQ3ODM5OTg3FQIAERgSQzc5RjE1QzBDMjk1OTlDNEI0AA=="
 *                 sentTo: 
 *                   type: string
 *                   example: "91******9987"
 *       400: 
 *         description: ID card not found or mobile number missing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "ID card not found. Generate it first." }
 *       403: 
 *         description: Not authorized to resend ID card
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Not authorized to resend ID card" }
 *       404: 
 *         description: Reporter not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Reporter not found" }
 *       500:
 *         description: PDF regeneration failed or WhatsApp send failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "ID card PDF not found and regeneration failed" }
 */
router.post('/tenants/:tenantId/reporters/:id/id-card/resend', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { tenantId, id } = req.params;
    const user: any = (req as any).user;

    const reporter = await (prisma as any).reporter.findFirst({
      where: { id, tenantId },
      include: {
        idCard: true,
        user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      },
    });
    if (!reporter) return res.status(404).json({ error: 'Reporter not found' });

    // Access control
    const roleName = String(user?.role?.name || '').toUpperCase();
    const isSuperAdmin = roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN';
    const isTenantAdmin = roleName === 'TENANT_ADMIN' || roleName === 'ADMIN';
    const isOwnReporter = reporter.userId && reporter.userId === user?.id;

    let isAdminOfTenant = isSuperAdmin;
    if (!isAdminOfTenant && isTenantAdmin) {
      const adminReporter = await (prisma as any).reporter
        .findFirst({ where: { userId: user.id, tenantId }, select: { id: true } })
        .catch(() => null);
      isAdminOfTenant = !!adminReporter;
    }

    if (!isSuperAdmin && !isAdminOfTenant && !isOwnReporter) {
      return res.status(403).json({ error: 'Not authorized to resend ID card' });
    }

    // Check ID card and PDF
    if (!reporter.idCard) {
      return res.status(400).json({ error: 'ID card not found. Generate it first.' });
    }
    if (!reporter.user?.mobileNumber) {
      return res.status(400).json({ error: 'Reporter mobile number not found' });
    }

    // Auto-regenerate PDF if missing
    let pdfUrl = reporter.idCard.pdfUrl;
    if (!pdfUrl) {
      console.log(`⚠️  ID card PDF URL missing for reporter ${id}, regenerating...`);
      try {
        const regenerated = await generateReporterIdCardPdf({
          reporterId: id,
          tenantId,
          forceRegenerate: true,
        });
        pdfUrl = regenerated.pdfUrl;
        console.log(`✓ PDF regenerated successfully: ${pdfUrl}`);
      } catch (regenerateErr) {
        console.error('Failed to regenerate PDF:', regenerateErr);
        return res.status(500).json({ error: 'ID card PDF not found and regeneration failed' });
      }
    }

    // Send via WhatsApp
    const result = await sendIdCardViaWhatsApp({
      reporterId: id,
      tenantId,
      pdfUrl,
      cardNumber: reporter.idCard.cardNumber,
    });

    if (result.ok) {
      return res.json({
        success: true,
        message: 'ID card PDF sent via WhatsApp',
        messageId: result.messageId,
        sentTo: reporter.user.mobileNumber.replace(/(\d{2})(\d+)(\d{4})/, '$1******$3'),
      });
    } else {
      return res.status(500).json({
        error: 'Failed to send WhatsApp message',
        details: result.error,
      });
    }
  } catch (e: any) {
    console.error('resend id-card error', e);
    return res.status(500).json({ error: 'Failed to resend ID card' });
  }
});