import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

type ScopeResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

function parsePagination(query: any, defaults: { page?: number; pageSize?: number } = {}) {
  let page = parseInt(String(query?.page ?? defaults.page ?? 1), 10);
  let pageSize = parseInt(String(query?.pageSize ?? defaults.pageSize ?? 50), 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(pageSize) || pageSize < 1) pageSize = 50;
  if (pageSize > 200) pageSize = 200;
  return { page, pageSize };
}

async function requireTenantAdminDashboardScope(req: any): Promise<ScopeResult<{ tenantId: string; userId: string }>> {
  const tenantId = String(req.params?.tenantId || '').trim();
  if (!tenantId) return { ok: false, status: 400, error: 'tenantId param required' };

  const user: any = req.user;
  const userId = String(user?.id || '').trim();
  const roleName = String(user?.role?.name || '').trim();
  if (!userId || !roleName) return { ok: false, status: 401, error: 'Unauthorized' };

  if (roleName !== 'TENANT_ADMIN') return { ok: false, status: 403, error: 'Forbidden' };

  const rep = await (prisma as any).reporter.findFirst({ where: { userId }, select: { tenantId: true } }).catch(() => null);
  if (!rep?.tenantId) return { ok: false, status: 403, error: 'Reporter profile not linked to tenant' };
  if (String(rep.tenantId) !== tenantId) return { ok: false, status: 403, error: 'Tenant scope mismatch' };

  return { ok: true, value: { tenantId, userId } };
}

async function requireTenantAdminSelfScope(req: any): Promise<ScopeResult<{ tenantId: string; userId: string; reporter: any }>> {
  const user: any = req.user;
  const userId = String(user?.id || '').trim();
  const roleName = String(user?.role?.name || '').trim();
  if (!userId || !roleName) return { ok: false, status: 401, error: 'Unauthorized' };
  if (roleName !== 'TENANT_ADMIN') return { ok: false, status: 403, error: 'Forbidden' };

  const rep = await (prisma as any).reporter
    .findFirst({
      where: { userId },
      include: { tenant: { select: { id: true, name: true, slug: true } }, designation: true, idCard: true },
    })
    .catch(() => null);
  if (!rep?.tenantId) return { ok: false, status: 403, error: 'Reporter profile not linked to tenant' };

  return { ok: true, value: { tenantId: String(rep.tenantId), userId, reporter: rep } };
}

async function requireReporterDashboardScope(req: any): Promise<ScopeResult<{ reporter: any; userId: string }>> {
  const user: any = req.user;
  const userId = String(user?.id || '').trim();
  const roleName = String(user?.role?.name || '').trim();
  if (!userId || !roleName) return { ok: false, status: 401, error: 'Unauthorized' };
  if (roleName !== 'REPORTER') return { ok: false, status: 403, error: 'Forbidden' };

  const rep = await (prisma as any).reporter
    .findFirst({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        designation: true,
        idCard: true,
        user: { select: { id: true, mobileNumber: true, status: true, createdAt: true, updatedAt: true } },
      },
    })
    .catch(() => null);
  if (!rep) return { ok: false, status: 404, error: 'Reporter profile not found for user' };
  return { ok: true, value: { reporter: rep, userId } };
}

/**
 * @swagger
 * tags:
 *   - name: Dashboard
 *     description: Aggregated endpoints for Tenant Admin and Reporter dashboards
 */

/**
 * @swagger
 * /dashboard/me:
 *   get:
 *     summary: Get current principal (role + reporter + tenant)
 *     description: Returns minimal identity context for React Native dashboards.
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Principal context }
 *       401: { description: Unauthorized }
 */
router.get('/me', auth, async (req, res) => {
  const user: any = (req as any).user;
  const roleName = String(user?.role?.name || '').trim();

  if (roleName !== 'TENANT_ADMIN' && roleName !== 'REPORTER') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const reporter = await (prisma as any).reporter
    .findFirst({
      where: { userId: user?.id },
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        designation: true,
        idCard: true,
        user: { select: { id: true, mobileNumber: true, status: true, createdAt: true, updatedAt: true } },
      },
    })
    .catch(() => null);

  return res.json({
    user: { id: user?.id, roleName },
    reporter: reporter
      ? {
          id: reporter.id,
          tenantId: reporter.tenantId,
          tenant: reporter.tenant,
          designation: reporter.designation,
          level: reporter.level,
          active: reporter.active,
          kycStatus: reporter.kycStatus,
          subscriptionActive: reporter.subscriptionActive,
          monthlySubscriptionAmount: reporter.monthlySubscriptionAmount,
          idCard: reporter.idCard,
        }
      : null,
  });
});

/**
 * @swagger
 * /dashboard/admin/overview:
 *   get:
 *     summary: Tenant Admin dashboard overview (single API, card-wise)
 *     description: Returns a compact set of cards for the tenant admin home screen.
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Admin overview cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   kind: tenant_admin_overview
 *                   tenant:
 *                     id: ten_01HABC
 *                     name: Kaburlu Adilabad
 *                     slug: kaburlu-adilabad
 *                   domain:
 *                     id: dmn_01HXYZ
 *                     domain: adilabad.kaburlu.com
 *                   branding:
 *                     logoUrl: https://cdn.kaburlu.com/logos/tenant.png
 *                     primaryColor: "#0D47A1"
 *                     secondaryColor: "#FFC107"
 *                   cards:
 *                     - key: web_articles
 *                       title: Web Articles
 *                       primary: { label: Published (30d), value: 38 }
 *                       secondary:
 *                         - { label: Draft, value: 12 }
 *                         - { label: Pending, value: 3 }
 *                       drilldown: { href: /api/v1/dashboard/tenants/ten_01HABC/web-articles }
 *                     - key: newspaper_articles
 *                       title: Newspaper Articles
 *                       primary: { label: Published (30d), value: 12 }
 *                       secondary:
 *                         - { label: Draft, value: 4 }
 *                       drilldown: { href: /api/v1/dashboard/tenants/ten_01HABC/newspaper-articles }
 *                     - key: reporters
 *                       title: Reporters
 *                       primary: { label: Total, value: 58 }
 *                       secondary:
 *                         - { label: KYC Pending, value: 2 }
 *                         - { label: KYC Submitted, value: 5 }
 *                       drilldown: { href: /api/v1/dashboard/tenants/ten_01HABC/reporters }
 *                     - key: id_cards
 *                       title: ID Cards
 *                       primary: { label: Issued, value: 40 }
 *                       secondary:
 *                         - { label: Expiring (30d), value: 3 }
 *                       drilldown: { href: /api/v1/dashboard/tenants/ten_01HABC/id-cards?expiringInDays=30 }
 *                     - key: payments
 *                       title: Payments
 *                       primary: { label: Pending, value: 4 }
 *                       secondary: []
 *                       drilldown: { href: /api/v1/reporter-payments?tenantId=ten_01HABC }
 *                     - key: ads
 *                       title: Ads
 *                       primary: { label: Configured, value: 5 }
 *                       secondary: []
 *                       drilldown: { href: /api/v1/tenants/ten_01HABC/ads }
 *                   generatedAt: 2025-12-31T09:00:00.000Z
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/admin/overview', auth, async (req, res) => {
  const scope = await requireTenantAdminSelfScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  const { tenantId, reporter } = scope.value;
  const now = new Date();
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days30Ahead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const p: any = prisma;

  const [
    reportersTotal,
    kycPending,
    kycSubmitted,
    paymentsPending,
    webDraft,
    webPending,
    webPublished30d,
    newspaperDraft,
    newspaperPublished30d,
    reportersWithIdCard,
    idCardsExpiring30d,
    tenantSettingsRow,
    tenantThemeRow,
    idCardSettingsRow,
    domainRow,
    entitySettingsRow,
    tenantWebsiteSettingsRow,
  ] = await Promise.all([
    p.reporter.count({ where: { tenantId } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'PENDING' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'SUBMITTED' } }).catch(() => 0),
    p.reporterPayment.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, status: 'DRAFT' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, status: 'PUBLISHED', publishedAt: { gte: days30 } } }).catch(() => 0),
    p.newspaperArticle.count({ where: { tenantId, status: 'DRAFT' } }).catch(() => 0),
    p.newspaperArticle.count({ where: { tenantId, status: 'PUBLISHED', createdAt: { gte: days30 } } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, idCard: { isNot: null } } }).catch(() => 0),
    p.reporterIDCard.count({ where: { expiresAt: { gte: now, lte: days30Ahead }, reporter: { tenantId } } }).catch(() => 0),
    p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null),
    p.tenantTheme.findUnique({ where: { tenantId }, select: { logoUrl: true, faviconUrl: true, primaryColor: true } }).catch(() => null),
    p.tenantIdCardSettings.findUnique({ where: { tenantId }, select: { frontLogoUrl: true, primaryColor: true, secondaryColor: true } }).catch(() => null),
    p.domain
      .findFirst({ where: { tenantId, status: 'ACTIVE' }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }], select: { id: true, domain: true, isPrimary: true, status: true } })
      .catch(() => null),
    p.entitySettings.findFirst({ select: { data: true } }).catch(() => null),
    p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null),
  ]);

  const adsRaw = (tenantSettingsRow as any)?.data?.ads;
  const adsCount = Array.isArray(adsRaw) ? adsRaw.length : 0;

  const domainSettingsRow = domainRow?.id
    ? await p.domainSettings.findUnique({ where: { domainId: domainRow.id }, select: { data: true } }).catch(() => null)
    : null;

  const effectiveWebsiteSettings = {
    ...((entitySettingsRow as any)?.data || {}),
    ...((tenantWebsiteSettingsRow as any)?.data || {}),
    ...((domainSettingsRow as any)?.data || {}),
  };

  const effectiveLogoUrl =
    (effectiveWebsiteSettings as any)?.branding?.logoUrl ||
    (effectiveWebsiteSettings as any)?.logoUrl ||
    (tenantThemeRow as any)?.logoUrl ||
    (idCardSettingsRow as any)?.frontLogoUrl ||
    null;

  const effectivePrimaryColor =
    (effectiveWebsiteSettings as any)?.theme?.colors?.primary ||
    (effectiveWebsiteSettings as any)?.primaryColor ||
    (tenantThemeRow as any)?.primaryColor ||
    (idCardSettingsRow as any)?.primaryColor ||
    null;

  const effectiveSecondaryColor =
    (effectiveWebsiteSettings as any)?.theme?.colors?.secondary ||
    (effectiveWebsiteSettings as any)?.secondaryColor ||
    (idCardSettingsRow as any)?.secondaryColor ||
    null;

  return res.json({
    kind: 'tenant_admin_overview',
    tenant: reporter?.tenant || { id: tenantId },
    domain: domainRow ? { id: domainRow.id, domain: domainRow.domain } : null,
    branding: {
      logoUrl: effectiveLogoUrl,
      primaryColor: effectivePrimaryColor,
      secondaryColor: effectiveSecondaryColor,
    },
    cards: [
      {
        key: 'web_articles',
        title: 'Web Articles',
        primary: { label: 'Published (30d)', value: webPublished30d },
        secondary: [
          { label: 'Draft', value: webDraft },
          { label: 'Pending', value: webPending },
        ],
        drilldown: { href: `/api/v1/dashboard/tenants/${tenantId}/web-articles` },
      },
      {
        key: 'newspaper_articles',
        title: 'Newspaper Articles',
        primary: { label: 'Published (30d)', value: newspaperPublished30d },
        secondary: [{ label: 'Draft', value: newspaperDraft }],
        drilldown: { href: `/api/v1/dashboard/tenants/${tenantId}/newspaper-articles` },
      },
      {
        key: 'reporters',
        title: 'Reporters',
        primary: { label: 'Total', value: reportersTotal },
        secondary: [
          { label: 'KYC Pending', value: kycPending },
          { label: 'KYC Submitted', value: kycSubmitted },
        ],
        drilldown: { href: `/api/v1/dashboard/tenants/${tenantId}/reporters` },
      },
      {
        key: 'id_cards',
        title: 'ID Cards',
        primary: { label: 'Issued', value: reportersWithIdCard },
        secondary: [{ label: 'Expiring (30d)', value: idCardsExpiring30d }],
        drilldown: { href: `/api/v1/dashboard/tenants/${tenantId}/id-cards?expiringInDays=30` },
      },
      {
        key: 'payments',
        title: 'Payments',
        primary: { label: 'Pending', value: paymentsPending },
        secondary: [],
        drilldown: { href: `/api/v1/reporter-payments?tenantId=${tenantId}` },
      },
      {
        key: 'ads',
        title: 'Ads',
        primary: { label: 'Configured', value: adsCount },
        secondary: [],
        drilldown: { href: `/api/v1/tenants/${tenantId}/ads` },
      },
    ],
    generatedAt: now.toISOString(),
  });
});

/**
 * @swagger
 * /dashboard/admin/full:
 *   get:
 *     summary: Comprehensive Tenant Admin dashboard (all sections)
 *     description: |
 *       Returns a complete dashboard payload suitable for advanced admin UIs.
 *       Includes: profile, branding, domains, reporters breakdown, articles stats,
 *       payments, ID cards, billing/subscription, AI usage, quick actions, and recent activity.
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Full admin dashboard payload
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 kind: { type: string, example: tenant_admin_full }
 *                 profile: { type: object }
 *                 tenant: { type: object }
 *                 branding: { type: object }
 *                 domains: { type: object }
 *                 reporters: { type: object }
 *                 articles: { type: object }
 *                 payments: { type: object }
 *                 idCards: { type: object }
 *                 billing: { type: object }
 *                 aiUsage: { type: object }
 *                 featureFlags: { type: object }
 *                 quickActions: { type: array }
 *                 recentActivity: { type: array }
 *                 generatedAt: { type: string }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/admin/full', auth, async (req, res) => {
  const scope = await requireTenantAdminSelfScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  const { tenantId, userId, reporter } = scope.value;
  const now = new Date();
  const days7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days30Ahead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const p: any = prisma;

  // ─── Parallel data fetch ───
  const [
    // Tenant core
    tenantRow,
    tenantEntity,
    tenantTheme,
    tenantSettings,
    tenantFeatureFlags,
    tenantIdCardSettings,
    // Domains
    domainsAll,
    // Reporters
    reportersTotal,
    reportersActive,
    reportersInactive,
    kycPending,
    kycSubmitted,
    kycApproved,
    kycRejected,
    reportersByLevel,
    recentReporters,
    // ID Cards
    reportersWithIdCard,
    idCardsIssuedThisMonth,
    idCardsExpiring30d,
    // Payments
    paymentsPending,
    paymentsPaid30d,
    paymentsTotal30d,
    // Articles
    webByStatus,
    webPublished7d,
    webPublished30d,
    webViewsTotal,
    webTopViewed,
    newspaperByStatus,
    newspaperCreated30d,
    // Raw articles (reporter submissions)
    rawArticlesNew,
    rawArticlesPending,
    // Billing
    activeSub,
    // AI Usage (this month)
    aiEventsThisMonth,
    aiTokensThisMonth,
    // Recent activity
    recentWebArticles,
    recentPayments,
  ] = await Promise.all([
    // Tenant core
    p.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true, prgiNumber: true, prgiStatus: true, stateId: true, createdAt: true } }).catch(() => null),
    p.tenantEntity.findUnique({ where: { tenantId }, select: { prgiNumber: true, registrationTitle: true, nativeName: true, periodicity: true, registrationDate: true, ownerName: true, publisherName: true, editorName: true, address: true } }).catch(() => null),
    p.tenantTheme.findUnique({ where: { tenantId }, select: { logoUrl: true, faviconUrl: true, primaryColor: true, headerHtml: true, homepageConfig: true } }).catch(() => null),
    p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null),
    p.tenantFeatureFlags.findUnique({ where: { tenantId }, select: { enableMobileAppView: true, aiArticleRewriteEnabled: true, aiBillingEnabled: true, aiMonthlyTokenLimit: true, section2Rows: true, section2ListCount: true } }).catch(() => null),
    p.tenantIdCardSettings.findUnique({ where: { tenantId }, select: { templateId: true, frontLogoUrl: true, roundStampUrl: true, signUrl: true, primaryColor: true, secondaryColor: true, validityType: true, validityDays: true, fixedValidUntil: true, idPrefix: true, idDigits: true, officeAddress: true, helpLine1: true, helpLine2: true } }).catch(() => null),
    // Domains
    p.domain.findMany({ where: { tenantId }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }], select: { id: true, domain: true, isPrimary: true, kind: true, status: true, verifiedAt: true, createdAt: true } }).catch(() => []),
    // Reporters
    p.reporter.count({ where: { tenantId } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, active: true } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, active: false } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'PENDING' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'SUBMITTED' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'APPROVED' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'REJECTED' } }).catch(() => 0),
    p.reporter.groupBy({ by: ['level'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
    p.reporter.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, level: true, kycStatus: true, active: true, createdAt: true, user: { select: { id: true, mobileNumber: true } }, designation: { select: { code: true, name: true } } } }).catch(() => []),
    // ID Cards
    p.reporter.count({ where: { tenantId, idCard: { isNot: null } } }).catch(() => 0),
    p.reporterIDCard.count({ where: { issuedAt: { gte: monthStart }, reporter: { tenantId } } }).catch(() => 0),
    p.reporterIDCard.count({ where: { expiresAt: { gte: now, lte: days30Ahead }, reporter: { tenantId } } }).catch(() => 0),
    // Payments
    p.reporterPayment.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
    p.reporterPayment.count({ where: { tenantId, status: 'PAID', paidAt: { gte: days30 } } }).catch(() => 0),
    p.reporterPayment.aggregate({ where: { tenantId, status: 'PAID', paidAt: { gte: days30 } }, _sum: { amountMinor: true } }).catch(() => ({ _sum: { amountMinor: 0 } })),
    // Articles
    p.tenantWebArticle.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
    p.tenantWebArticle.count({ where: { tenantId, status: 'PUBLISHED', publishedAt: { gte: days7 } } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, status: 'PUBLISHED', publishedAt: { gte: days30 } } }).catch(() => 0),
    p.tenantWebArticle.aggregate({ where: { tenantId }, _sum: { viewCount: true } }).catch(() => ({ _sum: { viewCount: 0 } })),
    p.tenantWebArticle.findMany({ where: { tenantId, status: 'PUBLISHED' }, orderBy: { viewCount: 'desc' }, take: 5, select: { id: true, title: true, slug: true, viewCount: true, publishedAt: true } }).catch(() => []),
    p.newspaperArticle.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
    p.newspaperArticle.count({ where: { tenantId, createdAt: { gte: days30 } } }).catch(() => 0),
    // Raw articles
    p.rawArticle.count({ where: { tenantId, status: 'NEW' } }).catch(() => 0),
    p.rawArticle.count({ where: { tenantId, status: 'PENDING_REVIEW' } }).catch(() => 0),
    // Billing
    p.tenantSubscription.findFirst({ where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, plan: { select: { id: true, name: true, cycle: true, baseAmountMinor: true } } } }).catch(() => null),
    // AI Usage
    p.aiUsageEvent.count({ where: { tenantId, createdAt: { gte: monthStart } } }).catch(() => 0),
    p.aiUsageEvent.aggregate({ where: { tenantId, createdAt: { gte: monthStart } }, _sum: { totalTokens: true } }).catch(() => ({ _sum: { totalTokens: 0 } })),
    // Recent activity
    p.tenantWebArticle.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, status: true, createdAt: true, author: { select: { id: true, mobileNumber: true } } } }).catch(() => []),
    p.reporterPayment.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, amountMinor: true, createdAt: true, reporter: { select: { id: true, user: { select: { mobileNumber: true } } } } } }).catch(() => []),
  ]);

  // ─── Transform groupBy results ───
  const webStatusMap: Record<string, number> = {};
  for (const row of webByStatus || []) {
    webStatusMap[String(row.status)] = Number(row?._count?._all ?? 0);
  }
  const newspaperStatusMap: Record<string, number> = {};
  for (const row of newspaperByStatus || []) {
    newspaperStatusMap[String(row.status)] = Number(row?._count?._all ?? 0);
  }
  const levelBreakdown: Record<string, number> = {};
  for (const row of reportersByLevel || []) {
    levelBreakdown[String(row.level || 'UNKNOWN')] = Number(row?._count?._all ?? 0);
  }

  // ─── Ads from settings ───
  const adsRaw = (tenantSettings as any)?.data?.ads;
  const adsCount = Array.isArray(adsRaw) ? adsRaw.length : 0;

  // ─── Build domain summary ───
  const domainSummary = {
    total: (domainsAll || []).length,
    active: (domainsAll || []).filter((d: any) => d.status === 'ACTIVE').length,
    pending: (domainsAll || []).filter((d: any) => d.status === 'PENDING' || d.status === 'VERIFYING').length,
    primary: (domainsAll || []).find((d: any) => d.isPrimary) || null,
    list: domainsAll,
  };

  // ─── Quick actions ───
  const quickActions = [];
  if (kycSubmitted > 0) {
    quickActions.push({ key: 'review_kyc', label: `Review KYC (${kycSubmitted} pending)`, href: `/api/v1/dashboard/tenants/${tenantId}/reporters?kycStatus=SUBMITTED`, priority: 'high' });
  }
  if (rawArticlesPending > 0) {
    quickActions.push({ key: 'review_articles', label: `Review Articles (${rawArticlesPending} pending)`, href: `/api/v1/raw-articles?tenantId=${tenantId}&status=PENDING_REVIEW`, priority: 'high' });
  }
  if (idCardsExpiring30d > 0) {
    quickActions.push({ key: 'renew_id_cards', label: `Renew ID Cards (${idCardsExpiring30d} expiring)`, href: `/api/v1/dashboard/tenants/${tenantId}/id-cards?expiringInDays=30`, priority: 'medium' });
  }
  if (paymentsPending > 0) {
    quickActions.push({ key: 'collect_payments', label: `Collect Payments (${paymentsPending} pending)`, href: `/api/v1/reporter-payments?tenantId=${tenantId}&status=PENDING`, priority: 'medium' });
  }
  quickActions.push({ key: 'add_reporter', label: 'Add New Reporter', href: `/api/v1/reporters`, priority: 'low' });
  quickActions.push({ key: 'create_article', label: 'Create Web Article', href: `/api/v1/web-articles`, priority: 'low' });

  // ─── Build response ───
  return res.json({
    kind: 'tenant_admin_full',

    // Admin profile
    profile: {
      userId,
      reporterId: reporter?.id,
      designation: reporter?.designation,
      level: reporter?.level,
      active: reporter?.active,
      kycStatus: reporter?.kycStatus,
    },

    // Tenant info
    tenant: {
      id: tenantRow?.id || tenantId,
      name: tenantRow?.name,
      slug: tenantRow?.slug,
      prgiNumber: tenantRow?.prgiNumber,
      prgiStatus: tenantRow?.prgiStatus,
      stateId: tenantRow?.stateId,
      createdAt: tenantRow?.createdAt,
      entity: tenantEntity ? {
        registrationTitle: tenantEntity.registrationTitle,
        nativeName: tenantEntity.nativeName,
        periodicity: tenantEntity.periodicity,
        ownerName: tenantEntity.ownerName,
        publisherName: tenantEntity.publisherName,
        editorName: tenantEntity.editorName,
        address: tenantEntity.address,
      } : null,
    },

    // Branding
    branding: {
      logoUrl: tenantTheme?.logoUrl || tenantIdCardSettings?.frontLogoUrl || null,
      faviconUrl: tenantTheme?.faviconUrl || null,
      primaryColor: tenantTheme?.primaryColor || tenantIdCardSettings?.primaryColor || null,
      secondaryColor: tenantIdCardSettings?.secondaryColor || null,
      headerHtml: tenantTheme?.headerHtml || null,
    },

    // Domains
    domains: domainSummary,

    // Reporters section
    reporters: {
      total: reportersTotal,
      active: reportersActive,
      inactive: reportersInactive,
      kyc: {
        pending: kycPending,
        submitted: kycSubmitted,
        approved: kycApproved,
        rejected: kycRejected,
      },
      byLevel: levelBreakdown,
      recentlyAdded: recentReporters,
    },

    // Articles section
    articles: {
      web: {
        byStatus: webStatusMap,
        published7d: webPublished7d,
        published30d: webPublished30d,
        totalViews: webViewsTotal?._sum?.viewCount || 0,
        topViewed: webTopViewed,
      },
      newspaper: {
        byStatus: newspaperStatusMap,
        created30d: newspaperCreated30d,
      },
      raw: {
        newSubmissions: rawArticlesNew,
        pendingReview: rawArticlesPending,
      },
    },

    // Payments section
    payments: {
      pending: paymentsPending,
      paid30d: paymentsPaid30d,
      revenue30d: paymentsTotal30d?._sum?.amountMinor || 0,
      recentPayments: recentPayments.map((p: any) => ({
        id: p.id,
        status: p.status,
        amountMinor: p.amountMinor,
        mobile: p.reporter?.user?.mobileNumber,
        createdAt: p.createdAt,
      })),
    },

    // ID Cards section
    idCards: {
      issued: reportersWithIdCard,
      issuedThisMonth: idCardsIssuedThisMonth,
      expiring30d: idCardsExpiring30d,
      settings: tenantIdCardSettings ? {
        templateId: tenantIdCardSettings.templateId,
        validityType: tenantIdCardSettings.validityType,
        validityDays: tenantIdCardSettings.validityDays,
        fixedValidUntil: tenantIdCardSettings.fixedValidUntil,
        idPrefix: tenantIdCardSettings.idPrefix,
        idDigits: tenantIdCardSettings.idDigits,
      } : null,
    },

    // Billing section
    billing: {
      subscription: activeSub ? {
        id: activeSub.id,
        status: activeSub.status,
        plan: activeSub.plan,
        currentPeriodStart: activeSub.currentPeriodStart,
        currentPeriodEnd: activeSub.currentPeriodEnd,
        cancelAtPeriodEnd: activeSub.cancelAtPeriodEnd,
      } : null,
      hasActiveSubscription: !!activeSub,
    },

    // AI Usage section
    aiUsage: {
      eventsThisMonth: aiEventsThisMonth,
      tokensThisMonth: aiTokensThisMonth?._sum?.totalTokens || 0,
      limitThisMonth: tenantFeatureFlags?.aiMonthlyTokenLimit || null,
      limitReached: tenantFeatureFlags?.aiMonthlyTokenLimit
        ? (aiTokensThisMonth?._sum?.totalTokens || 0) >= tenantFeatureFlags.aiMonthlyTokenLimit
        : false,
    },

    // Feature flags
    featureFlags: tenantFeatureFlags || {
      enableMobileAppView: false,
      aiArticleRewriteEnabled: true,
      aiBillingEnabled: false,
      aiMonthlyTokenLimit: null,
    },

    // Ads
    ads: { configured: adsCount, list: adsRaw || [] },

    // Quick actions (sorted by priority)
    quickActions,

    // Recent activity feed
    recentActivity: [
      ...recentWebArticles.map((a: any) => ({
        type: 'article',
        id: a.id,
        title: a.title,
        status: a.status,
        authorMobile: a.author?.mobileNumber,
        at: a.createdAt,
      })),
      ...recentPayments.map((p: any) => ({
        type: 'payment',
        id: p.id,
        status: p.status,
        amountMinor: p.amountMinor,
        reporterMobile: p.reporter?.user?.mobileNumber,
        at: p.createdAt,
      })),
    ].sort((a: any, b: any) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 10),

    generatedAt: now.toISOString(),
  });
});

/**
 * @swagger
 * /dashboard/reporter/overview:
 *   get:
 *     summary: Reporter dashboard overview (single API, card-wise)
 *     description: Returns a compact set of cards for the reporter home screen.
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Reporter overview cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   kind: reporter_overview
 *                   tenant:
 *                     id: ten_01HABC
 *                     name: Kaburlu Adilabad
 *                     slug: kaburlu-adilabad
 *                   reporter:
 *                     id: rep_01HREP1
 *                     tenantId: ten_01HABC
 *                     designation: { id: des_01H2, code: REPORTER, name: Reporter, level: MANDAL, tenantId: ten_01HABC }
 *                     level: MANDAL
 *                     active: true
 *                     kycStatus: APPROVED
 *                     subscriptionActive: true
 *                     monthlySubscriptionAmount: 19900
 *                   cards:
 *                     - key: my_web_articles
 *                       title: My Web Articles
 *                       primary: { label: Published (30d), value: 6 }
 *                       secondary:
 *                         - { label: Draft, value: 2 }
 *                         - { label: Pending, value: 1 }
 *                       drilldown: { href: /api/v1/dashboard/my/web-articles }
 *                     - key: my_newspaper_articles
 *                       title: My Newspaper Articles
 *                       primary: { label: Published (30d), value: 3 }
 *                       secondary:
 *                         - { label: Draft, value: 1 }
 *                       drilldown: { href: /api/v1/dashboard/my/newspaper-articles }
 *                     - key: payments
 *                       title: Payments
 *                       primary: { label: Pending, value: 1 }
 *                       secondary: []
 *                       drilldown: { href: /api/v1/dashboard/my/payments?status=PENDING }
 *                     - key: id_card
 *                       title: My ID Card
 *                       primary: { label: Status, value: ACTIVE }
 *                       secondary:
 *                         - { label: Expires At, value: 2026-12-01T00:00:00.000Z }
 *                       drilldown: { href: /api/v1/dashboard/my/id-card }
 *                     - key: profile
 *                       title: My Profile
 *                       primary: { label: KYC, value: APPROVED }
 *                       secondary:
 *                         - { label: Active, value: true }
 *                       drilldown: { href: /api/v1/dashboard/my/profile }
 *                   generatedAt: 2025-12-31T09:00:00.000Z
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get('/reporter/overview', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });

  const now = new Date();
  const userId = me.value.userId;
  const reporter = me.value.reporter;
  const tenantId = String(reporter.tenantId);
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const p: any = prisma;
  const [
    myWebDraft,
    myWebPending,
    myWebPublished30d,
    myNewsDraft,
    myNewsPublished30d,
    paymentsPending,
  ] = await Promise.all([
    p.tenantWebArticle.count({ where: { tenantId, authorId: userId, status: 'DRAFT' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, authorId: userId, status: 'PENDING' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, authorId: userId, status: 'PUBLISHED', publishedAt: { gte: days30 } } }).catch(() => 0),
    p.newspaperArticle.count({ where: { tenantId, authorId: userId, status: 'DRAFT' } }).catch(() => 0),
    p.newspaperArticle.count({ where: { tenantId, authorId: userId, status: 'PUBLISHED', createdAt: { gte: days30 } } }).catch(() => 0),
    p.reporterPayment.count({ where: { reporterId: reporter.id, tenantId, status: 'PENDING' } }).catch(() => 0),
  ]);

  let idCardStatus: 'NOT_ISSUED' | 'ACTIVE' | 'EXPIRED' = 'NOT_ISSUED';
  let idCardExpiresAt: string | null = null;
  if (reporter?.idCard?.expiresAt) {
    const exp = new Date(reporter.idCard.expiresAt);
    idCardExpiresAt = exp.toISOString();
    idCardStatus = exp.getTime() >= now.getTime() ? 'ACTIVE' : 'EXPIRED';
  }

  return res.json({
    kind: 'reporter_overview',
    tenant: reporter?.tenant || { id: tenantId },
    reporter: {
      id: reporter.id,
      tenantId,
      designation: reporter.designation,
      level: reporter.level,
      active: reporter.active,
      kycStatus: reporter.kycStatus,
      subscriptionActive: reporter.subscriptionActive,
      monthlySubscriptionAmount: reporter.monthlySubscriptionAmount,
    },
    cards: [
      {
        key: 'my_web_articles',
        title: 'My Web Articles',
        primary: { label: 'Published (30d)', value: myWebPublished30d },
        secondary: [
          { label: 'Draft', value: myWebDraft },
          { label: 'Pending', value: myWebPending },
        ],
        drilldown: { href: `/api/v1/dashboard/my/web-articles` },
      },
      {
        key: 'my_newspaper_articles',
        title: 'My Newspaper Articles',
        primary: { label: 'Published (30d)', value: myNewsPublished30d },
        secondary: [{ label: 'Draft', value: myNewsDraft }],
        drilldown: { href: `/api/v1/dashboard/my/newspaper-articles` },
      },
      {
        key: 'payments',
        title: 'Payments',
        primary: { label: 'Pending', value: paymentsPending },
        secondary: [],
        drilldown: { href: `/api/v1/dashboard/my/payments?status=PENDING` },
      },
      {
        key: 'id_card',
        title: 'My ID Card',
        primary: { label: 'Status', value: idCardStatus },
        secondary: idCardExpiresAt ? [{ label: 'Expires At', value: idCardExpiresAt }] : [],
        drilldown: { href: `/api/v1/dashboard/my/id-card` },
      },
      {
        key: 'profile',
        title: 'My Profile',
        primary: { label: 'KYC', value: reporter.kycStatus },
        secondary: [{ label: 'Active', value: reporter.active }],
        drilldown: { href: `/api/v1/dashboard/my/profile` },
      },
    ],
    generatedAt: now.toISOString(),
  });
});

/**
 * @swagger
 * /dashboard/tenants/{tenantId}/summary:
 *   get:
 *     summary: Tenant dashboard summary (counts)
 *     description: Aggregates key counts for Tenant Admin / News Moderator dashboards.
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Summary counts }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/tenants/:tenantId/summary', auth, async (req, res) => {
  const scope = await requireTenantAdminDashboardScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });

  const { tenantId } = scope.value;
  const now = new Date();
  const days30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const days30Ahead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const p: any = prisma;

  const [
    tenant,
    domainsCount,
    reportersTotal,
    reportersActive,
    kycPending,
    kycSubmitted,
    kycApproved,
    kycRejected,
    paymentsPending,
    webPublished30d,
    webByStatus,
    newspaperByStatus,
    newspaperCreated30d,
    reportersWithIdCard,
    idCardsIssued30d,
    idCardsExpiring30d,
    tenantSettings,
  ] = await Promise.all([
    p.tenant.findUnique({ where: { id: tenantId }, select: { id: true, name: true, slug: true } }).catch(() => null),
    p.domain.count({ where: { tenantId } }).catch(() => 0),
    p.reporter.count({ where: { tenantId } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, active: true } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'PENDING' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'SUBMITTED' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'APPROVED' } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, kycStatus: 'REJECTED' } }).catch(() => 0),
    p.reporterPayment.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
    p.tenantWebArticle.count({ where: { tenantId, status: 'PUBLISHED', publishedAt: { gte: days30 } } }).catch(() => 0),
    p.tenantWebArticle.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
    p.newspaperArticle.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
    p.newspaperArticle.count({ where: { tenantId, createdAt: { gte: days30 } } }).catch(() => 0),
    p.reporter.count({ where: { tenantId, idCard: { isNot: null } } }).catch(() => 0),
    p.reporterIDCard.count({ where: { issuedAt: { gte: days30 }, reporter: { tenantId } } }).catch(() => 0),
    p.reporterIDCard.count({ where: { expiresAt: { gte: now, lte: days30Ahead }, reporter: { tenantId } } }).catch(() => 0),
    p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null),
  ]);

  if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

  const webStatusMap: Record<string, number> = {};
  for (const row of webByStatus || []) {
    webStatusMap[String(row.status)] = Number(row?._count?._all ?? 0);
  }
  const newspaperStatusMap: Record<string, number> = {};
  for (const row of newspaperByStatus || []) {
    newspaperStatusMap[String(row.status)] = Number(row?._count?._all ?? 0);
  }

  const adsRaw = (tenantSettings as any)?.data?.ads;
  const adsCount = Array.isArray(adsRaw) ? adsRaw.length : 0;

  return res.json({
    tenant,
    domains: { count: domainsCount },
    reporters: {
      total: reportersTotal,
      active: reportersActive,
      kyc: { pending: kycPending, submitted: kycSubmitted, approved: kycApproved, rejected: kycRejected },
      idCards: {
        withIdCard: reportersWithIdCard,
        issuedLast30Days: idCardsIssued30d,
        expiringNext30Days: idCardsExpiring30d,
      },
    },
    payments: { pending: paymentsPending },
    webArticles: {
      byStatus: webStatusMap,
      publishedLast30Days: webPublished30d,
    },
    newspaperArticles: {
      byStatus: newspaperStatusMap,
      createdLast30Days: newspaperCreated30d,
    },
    ads: { count: adsCount, configured: adsCount > 0 },
    generatedAt: now.toISOString(),
  });
});

/**
 * @swagger
 * /dashboard/tenants/{tenantId}/web-articles:
 *   get:
 *     summary: List tenant web articles (TENANT_ADMIN only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tenants/:tenantId/web-articles', auth, async (req, res) => {
  const scope = await requireTenantAdminDashboardScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
  const { tenantId } = scope.value;

  const status = String((req.query as any).status || '').trim();
  const domainId = String((req.query as any).domainId || '').trim();
  const languageId = String((req.query as any).languageId || '').trim();
  const { page, pageSize } = parsePagination(req.query);

  const where: any = { tenantId };
  if (status) where.status = status;
  if (domainId) where.domainId = domainId;
  if (languageId) where.languageId = languageId;

  const p: any = prisma;
  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }).catch(() => 0),
    p.tenantWebArticle
      .findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          domainId: true,
          languageId: true,
          authorId: true,
          title: true,
          slug: true,
          status: true,
          coverImageUrl: true,
          viewCount: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  return res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
});

/**
 * @swagger
 * /dashboard/tenants/{tenantId}/newspaper-articles:
 *   get:
 *     summary: List tenant newspaper articles (TENANT_ADMIN only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tenants/:tenantId/newspaper-articles', auth, async (req, res) => {
  const scope = await requireTenantAdminDashboardScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
  const { tenantId } = scope.value;

  const status = String((req.query as any).status || '').trim();
  const languageId = String((req.query as any).languageId || '').trim();
  const { page, pageSize } = parsePagination(req.query);

  const where: any = { tenantId };
  if (status) where.status = status;
  if (languageId) where.languageId = languageId;

  const p: any = prisma;
  const [total, rows] = await Promise.all([
    p.newspaperArticle.count({ where }).catch(() => 0),
    p.newspaperArticle
      .findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          authorId: true,
          languageId: true,
          categoryId: true,
          baseArticleId: true,
          title: true,
          subTitle: true,
          heading: true,
          dateline: true,
          placeName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  return res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
});

/**
 * @swagger
 * /dashboard/tenants/{tenantId}/reporters:
 *   get:
 *     summary: List tenant reporters (TENANT_ADMIN only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tenants/:tenantId/reporters', auth, async (req, res) => {
  const scope = await requireTenantAdminDashboardScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
  const { tenantId } = scope.value;

  const kycStatus = String((req.query as any).kycStatus || '').trim();
  const activeRaw = String((req.query as any).active || '').trim();
  const hasIdCardRaw = String((req.query as any).hasIdCard || '').trim();
  const { page, pageSize } = parsePagination(req.query);

  const where: any = { tenantId };
  if (kycStatus) where.kycStatus = kycStatus;
  if (activeRaw === 'true') where.active = true;
  if (activeRaw === 'false') where.active = false;
  if (hasIdCardRaw === 'true') where.idCard = { isNot: null };
  if (hasIdCardRaw === 'false') where.idCard = { is: null };

  const p: any = prisma;
  const [total, rows] = await Promise.all([
    p.reporter.count({ where }).catch(() => 0),
    p.reporter
      .findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          userId: true,
          level: true,
          designation: true,
          active: true,
          kycStatus: true,
          subscriptionActive: true,
          monthlySubscriptionAmount: true,
          profilePhotoUrl: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { id: true, mobileNumber: true, status: true } },
          idCard: { select: { id: true, cardNumber: true, issuedAt: true, expiresAt: true, pdfUrl: true } },
        },
      })
      .catch(() => []),
  ]);

  return res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
});

/**
 * @swagger
 * /dashboard/tenants/{tenantId}/id-cards:
 *   get:
 *     summary: List tenant reporter ID cards (TENANT_ADMIN only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/tenants/:tenantId/id-cards', auth, async (req, res) => {
  const scope = await requireTenantAdminDashboardScope(req);
  if (!scope.ok) return res.status(scope.status).json({ error: scope.error });
  const { tenantId } = scope.value;

  const expiringInDaysRaw = String((req.query as any).expiringInDays || '').trim();
  const expiringInDays = expiringInDaysRaw ? parseInt(expiringInDaysRaw, 10) : null;
  const now = new Date();
  const where: any = { reporter: { tenantId } };
  if (Number.isFinite(expiringInDays as any) && (expiringInDays as any) >= 0) {
    const until = new Date(now.getTime() + (expiringInDays as number) * 24 * 60 * 60 * 1000);
    where.expiresAt = { gte: now, lte: until };
  }

  const takeRaw = parseInt(String((req.query as any).take || '200'), 10);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 200;

  const rows = await (prisma as any).reporterIDCard
    .findMany({
      where,
      orderBy: { expiresAt: 'asc' },
      take,
      select: {
        id: true,
        reporterId: true,
        cardNumber: true,
        issuedAt: true,
        expiresAt: true,
        pdfUrl: true,
        createdAt: true,
        updatedAt: true,
        reporter: {
          select: {
            id: true,
            userId: true,
            tenantId: true,
            kycStatus: true,
            active: true,
            designation: true,
            user: { select: { id: true, mobileNumber: true, status: true } },
          },
        },
      },
    })
    .catch(() => []);

  return res.json({ tenantId, count: rows.length, items: rows });
});

/**
 * @swagger
 * /dashboard/my/summary:
 *   get:
 *     summary: Reporter dashboard summary (for logged-in reporter)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Reporter summary }
 */

/**
 * @swagger
 * /dashboard/my/profile:
 *   get:
 *     summary: Reporter profile details (REPORTER only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/my/profile', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });
  return res.json({ reporter: me.value.reporter });
});

/**
 * @swagger
 * /dashboard/my/web-articles:
 *   get:
 *     summary: List my web articles (REPORTER only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/my/web-articles', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });

  const userId = me.value.userId;
  const tenantId = String(me.value.reporter.tenantId);
  const status = String((req.query as any).status || '').trim();
  const { page, pageSize } = parsePagination(req.query);

  const where: any = { tenantId, authorId: userId };
  if (status) where.status = status;

  const p: any = prisma;
  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }).catch(() => 0),
    p.tenantWebArticle
      .findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          domainId: true,
          languageId: true,
          authorId: true,
          title: true,
          slug: true,
          status: true,
          coverImageUrl: true,
          viewCount: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  return res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
});

/**
 * @swagger
 * /dashboard/my/newspaper-articles:
 *   get:
 *     summary: List my newspaper articles (REPORTER only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/my/newspaper-articles', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });

  const userId = me.value.userId;
  const tenantId = String(me.value.reporter.tenantId);
  const status = String((req.query as any).status || '').trim();
  const { page, pageSize } = parsePagination(req.query);

  const where: any = { tenantId, authorId: userId };
  if (status) where.status = status;

  const p: any = prisma;
  const [total, rows] = await Promise.all([
    p.newspaperArticle.count({ where }).catch(() => 0),
    p.newspaperArticle
      .findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          tenantId: true,
          authorId: true,
          languageId: true,
          categoryId: true,
          baseArticleId: true,
          title: true,
          subTitle: true,
          heading: true,
          dateline: true,
          placeName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  return res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
});

/**
 * @swagger
 * /dashboard/my/id-card:
 *   get:
 *     summary: My ID card details (REPORTER only)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 */
router.get('/my/id-card', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });

  const idCard = me.value.reporter?.idCard || null;
  return res.json({ reporterId: me.value.reporter.id, tenantId: me.value.reporter.tenantId, idCard });
});

/**
 * @swagger
 * /dashboard/my/payments:
 *   get:
 *     summary: List my reporter payments (logged-in reporter)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, PAID, EXPIRED, REFUNDED] }
 *       - in: query
 *         name: take
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *     responses:
 *       200: { description: Array of payment rows }
 */
router.get('/my/payments', auth, async (req, res) => {
  const me = await requireReporterDashboardScope(req);
  if (!me.ok) return res.status(me.status).json({ error: me.error });

  const reporterId = String(me.value.reporter.id);
  const tenantId = String(me.value.reporter.tenantId);

  const status = String((req.query as any).status || '').trim();
  const takeRaw = parseInt(String((req.query as any).take || '50'), 10);
  const take = Number.isFinite(takeRaw) ? Math.min(Math.max(takeRaw, 1), 200) : 50;

  const where: any = { reporterId, tenantId };
  if (status) where.status = status;

  const rows = await (prisma as any).reporterPayment
    .findMany({ where, orderBy: { createdAt: 'desc' }, take })
    .catch(() => []);

  return res.json({ reporterId, tenantId, count: rows.length, items: rows });
});

export default router;
