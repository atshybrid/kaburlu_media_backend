import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import { config } from '../../config/env';
import prisma from '../../lib/prisma';
import { toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import { buildNewsArticleJsonLd } from '../../lib/seo';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

// Apply resolver only to this public router
router.use(tenantResolver);

function requireVerifiedEpaperDomain(req: any, res: any, next: any) {
  // In non-multi-tenancy mode, tenantResolver is disabled; keep behavior flexible.
  if (process.env.MULTI_TENANCY !== 'true') return next();

  // Disallow bypassing domain verification for ePaper public APIs.
  if (req.headers['x-tenant-id'] || req.headers['x-tenant-slug']) {
    return res.status(400).json({
      code: 'EPAPER_DOMAIN_REQUIRED',
      message: 'ePaper public APIs require domain-based tenant resolution (use Host/X-Tenant-Domain).',
    });
  }

  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) {
    return res.status(404).json({
      code: 'EPAPER_DOMAIN_NOT_VERIFIED',
      message: 'ePaper domain not verified/active or not resolved.',
    });
  }

  // Ensure the domain is explicitly marked as EPAPER (feature gating).
  if (String(domain.kind || '').toUpperCase() !== 'EPAPER') {
    return res.status(404).json({
      code: 'EPAPER_DOMAIN_KIND_REQUIRED',
      message: 'Domain is not configured as an EPAPER domain.',
      domain: { domain: domain.domain, kind: domain.kind, status: domain.status },
    });
  }

  // Ensure it has been verified already (explicit verification signal).
  if (!domain.verifiedAt) {
    return res.status(404).json({
      code: 'EPAPER_DOMAIN_NOT_VERIFIED',
      message: 'EPAPER domain is not verified yet (verifiedAt is missing).',
      domain: { domain: domain.domain, kind: domain.kind, status: domain.status, verifiedAt: domain.verifiedAt || null },
    });
  }

  return next();
}

// Placeholder endpoints; real implementations added in next step
router.get('/_health', (_req, res) => {
  res.json({ ok: true, domain: (res.locals as any).domain?.domain, tenant: (res.locals as any).tenant?.slug });
});

/**
 * @swagger
 * /public/epaper/editions:
 *   get:
 *     summary: List ePaper publication editions for this tenant
 *     description: |
 *       Returns active (not deleted) editions and their sub-editions for the tenant resolved by domain.
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, these endpoints require a **verified EPAPER domain** (Domain.status=ACTIVE, kind=EPAPER, verifiedAt set).
 *       - Tenant resolution is domain-based (Host / X-Forwarded-Host). For local testing, use `X-Tenant-Domain`.
 *       - `X-Tenant-Id` / `X-Tenant-Slug` headers are rejected for EPAPER public APIs.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: includeSubEditions
 *         schema: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Editions with sub-editions
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenant: { id: "t_abc", slug: "kaburlu" }
 *                   editions:
 *                     - id: "ed_1"
 *                       name: "Telangana"
 *                       slug: "telangana"
 *                       stateId: null
 *                       coverImageUrl: null
 *                       seoTitle: null
 *                       seoDescription: null
 *                       seoKeywords: null
 *                       subEditions:
 *                         - id: "sub_1"
 *                           name: "Adilabad"
 *                           slug: "adilabad"
 *                           districtId: null
 *                           coverImageUrl: null
 *                           seoTitle: null
 *                           seoDescription: null
 *                           seoKeywords: null
 *       404:
 *         $ref: '#/components/responses/EpaperDomainNotVerified'
 */
router.get('/epaper/editions', requireVerifiedEpaperDomain, async (req, res) => {
  const tenant = (res.locals as any).tenant;

  const includeSubEditions = String((req.query as any).includeSubEditions ?? 'true').toLowerCase() === 'true';

  const editions = await p.epaperPublicationEdition.findMany({
    where: { tenantId: tenant.id, isDeleted: false, isActive: true },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      stateId: true,
      coverImageUrl: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      subEditions: includeSubEditions
        ? {
            where: { isDeleted: false, isActive: true },
            orderBy: [{ createdAt: 'desc' }],
            select: {
              id: true,
              name: true,
              slug: true,
              districtId: true,
              coverImageUrl: true,
              seoTitle: true,
              seoDescription: true,
              seoKeywords: true,
            },
          }
        : false,
    },
  });

  return res.json({ tenant: { id: tenant.id, slug: tenant.slug }, editions });
});

/**
 * @swagger
 * /public/epaper/verify-domain:
 *   get:
 *     summary: Verify ePaper domain/subdomain mapping
 *     description: |
 *       Confirms the request resolves to an active tenant/domain (via Host or X-Tenant-Domain).
 *
 *       Notes:
 *       - This endpoint does **not** require EPAPER verification middleware.
 *       - It always returns 200 with `verified=true|false` (frontend-friendly). Other public ePaper endpoints remain strict.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *     responses:
 *       200:
 *         description: Verified mapping (or details why not verified)
 *         content:
 *           application/json:
 *             examples:
 *               verified:
 *                 value:
 *                   verified: true
 *                   tenant: { id: "t_abc", slug: "kaburlu", name: "Kaburlu" }
 *                   domain: { id: "dom_1", domain: "epaper.kaburlu.com", kind: "EPAPER", status: "ACTIVE", verifiedAt: "2026-01-01T00:00:00.000Z" }
 */
router.get('/epaper/verify-domain', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;

  if (!tenant || !domain) {
    return res.status(200).json({
      verified: false,
      error: 'Domain/tenant not resolved (check Host/X-Tenant-Domain)',
      input: {
        host: req.headers.host,
        xTenantDomain: req.headers['x-tenant-domain'],
      },
    });
  }

  if (String(domain.kind || '').toUpperCase() !== 'EPAPER') {
    return res.status(200).json({
      verified: false,
      code: 'EPAPER_DOMAIN_KIND_REQUIRED',
      message: 'Domain is active but not configured as an EPAPER domain.',
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      domain: { id: domain.id, domain: domain.domain, kind: domain.kind, status: domain.status, verifiedAt: domain.verifiedAt || null },
    });
  }

  if (!domain.verifiedAt) {
    return res.status(200).json({
      verified: false,
      code: 'EPAPER_DOMAIN_NOT_VERIFIED',
      message: 'Domain is active but not verified yet (verifiedAt is missing).',
      tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
      domain: { id: domain.id, domain: domain.domain, kind: domain.kind, status: domain.status, verifiedAt: domain.verifiedAt || null },
    });
  }

  return res.json({
    verified: true,
    tenant: { id: tenant.id, slug: tenant.slug, name: tenant.name },
    domain: { id: domain.id, domain: domain.domain, kind: domain.kind, status: domain.status, verifiedAt: domain.verifiedAt },
  });
});

/**
 * @swagger
 * /public/epaper/settings:
 *   get:
 *     summary: Get public ePaper settings for this tenant
 *     description: |
 *       Public endpoint for ePaper app boot.
 *       - Verifies domain/subdomain via tenantResolver.
 *       - Returns public-safe ePaper settings and PDF conversion limits.
 *
 *       Security notes:
 *       - Any sensitive keys (FCM server key, VAPID private key, service-account JSON, etc.) must NEVER be returned here.
 *       - `domainSettings.data` and `domainSettings.effective` are sanitized to exclude secrets.
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, requires a verified EPAPER domain.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *     responses:
 *       200:
 *         description: Settings for tenant
 *         content:
 *           application/json:
 *             examples:
 *               complete:
 *                 summary: Complete settings including branding and SEO
 *                 value:
 *                   verified: true
 *                   tenant: { id: "t_abc", slug: "kaburlu", name: "Kaburlu", nativeName: "కబుర్లు" }
 *                   domain: { id: "dom_1", domain: "epaper.kaburlu.com", kind: "EPAPER", status: "ACTIVE", verifiedAt: "2026-01-01T00:00:00.000Z" }
 *                   epaper: { type: "PDF", multiEditionEnabled: false }
 *                   settings:
 *                     tenantId: "t_abc"
 *                     showPrinterInfoOnLastPage: true
 *                     printerName: "Kaburlu Printers"
 *                     printerAddress: "Industrial Area, Adilabad"
 *                     printerCity: "Adilabad"
 *                     publisherName: "Publisher Name"
 *                     editorName: "Editor Name"
 *                     ownerName: null
 *                     rniNumber: null
 *                     lastPageFooterTemplate: null
 *                     generationConfig:
 *                       publicEpaper: { type: "PDF", multiEditionEnabled: false }
 *                     updatedAt: "2026-01-12T20:07:20.515Z"
 *                   branding:
 *                     logoUrl: "https://cdn.example.com/branding/logo.png"
 *                     faviconUrl: "https://cdn.example.com/branding/favicon.ico"
 *                     primaryColor: "#3F51B5"
 *                     secondaryColor: "#CDDC39"
 *                     headerBgColor: "#FFFFFF"
 *                     footerBgColor: "#0D47A1"
 *                     fontFamily: "Inter, Arial, sans-serif"
 *                   seo:
 *                     config:
 *                       defaultMetaTitle: "Kaburlu ePaper – Latest PDF Issues"
 *                       defaultMetaDescription: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       keywords: "kaburlu,epaper,adilabad"
 *                       homepageH1: "Kaburlu ePaper"
 *                       tagline: "Latest PDF ePaper issues"
 *                       ogTitle: "Kaburlu ePaper – Latest PDF Issues"
 *                       ogDescription: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       ogImageUrl: "https://cdn.example.com/seo/default-og.png"
 *                       canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                       robots: "index,follow"
 *                       sitemapEnabled: true
 *                       organization: { name: "Kaburlu", logoUrl: "https://cdn.example.com/branding/logo.png" }
 *                       socialLinks: ["https://facebook.com/kaburlu", "https://x.com/kaburlu"]
 *                     meta:
 *                       title: "Kaburlu ePaper – Latest PDF Issues"
 *                       description: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       keywords: "kaburlu,epaper,adilabad"
 *                       canonicalUrl: "https://epaper.kaburlu.com"
 *                       robots: "index,follow"
 *                     openGraph:
 *                       url: "https://epaper.kaburlu.com"
 *                       title: "Kaburlu ePaper – Latest PDF Issues"
 *                       description: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       imageUrl: "https://cdn.example.com/seo/default-og.png"
 *                       siteName: "Kaburlu"
 *                     twitter:
 *                       card: "summary_large_image"
 *                       handle: "@kaburlu"
 *                       title: "Kaburlu ePaper – Latest PDF Issues"
 *                       description: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                       imageUrl: "https://cdn.example.com/seo/default-og.png"
 *                     urls:
 *                       baseUrl: "https://epaper.kaburlu.com"
 *                       robotsTxt: "https://epaper.kaburlu.com/robots.txt"
 *                       sitemapXml: "https://epaper.kaburlu.com/sitemap.xml"
 *                   tenantAdmin:
 *                     name: "Prashna Admin"
 *                     mobile: "9876543210"
 *                   domainSettings:
 *                     updatedAt: "2026-01-12T20:07:20.515Z"
 *                     data:
 *                       branding:
 *                         logoUrl: "https://cdn.example.com/branding/logo.png"
 *                         faviconUrl: "https://cdn.example.com/branding/favicon.ico"
 *                       theme:
 *                         colors: { primary: "#3F51B5", secondary: "#CDDC39" }
 *                         typography: { fontFamily: "Inter, Arial, sans-serif" }
 *                       seo:
 *                         defaultMetaTitle: "Kaburlu ePaper – Latest PDF Issues"
 *                         defaultMetaDescription: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                         ogImageUrl: "https://cdn.example.com/seo/default-og.png"
 *                         canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                     effective:
 *                       branding: { logoUrl: "https://cdn.example.com/branding/logo.png", faviconUrl: "https://cdn.example.com/branding/favicon.ico" }
 *                       theme:
 *                         colors: { primary: "#3F51B5", secondary: "#CDDC39" }
 *                         typography: { fontFamily: "Inter, Arial, sans-serif" }
 *                       seo:
 *                         defaultMetaTitle: "Kaburlu ePaper – Latest PDF Issues"
 *                         defaultMetaDescription: "Read the latest Kaburlu ePaper PDF issues by edition and date."
 *                         ogImageUrl: "https://cdn.example.com/seo/default-og.png"
 *                         canonicalBaseUrl: "https://epaper.kaburlu.com"
 *                   pdf: { dpi: 150, maxMb: 30, maxPages: 0 }
 *       404:
 *         description: Tenant not resolved
 */
router.get('/epaper/settings', requireVerifiedEpaperDomain, async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;

  const asObject = (v: any) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
  const normalizeType = (v: any) => {
    const s = String(v ?? '').trim().toUpperCase();
    if (s === 'PDF') return 'PDF';
    if (s === 'BLOCK' || s === 'BLOCK_BASED' || s === 'BLOCKBASED') return 'BLOCK';
    return null;
  };

  const [settings, tenantTheme, domainSettings, entitySettings, tenantSettings, tenantEntity, domainLanguages] = await Promise.all([
    p.epaperSettings
      .findUnique({
        where: { tenantId: tenant.id },
        select: {
          tenantId: true,
          pageWidthInches: true,
          pageHeightInches: true,
          gridColumns: true,
          paddingTop: true,
          paddingRight: true,
          paddingBottom: true,
          paddingLeft: true,
          defaultPageCount: true,
          mainHeaderHeightInches: true,
          innerHeaderHeightInches: true,
          footerHeightInches: true,
          footerStyle: true,
          showPrinterInfoOnLastPage: true,
          printerName: true,
          printerAddress: true,
          printerCity: true,
          publisherName: true,
          editorName: true,
          ownerName: true,
          rniNumber: true,
          lastPageFooterTemplate: true,
          generationConfig: true,
          updatedAt: true,
        },
      })
      .catch(() => null),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.domainSettings?.findUnique?.({ where: { domainId: domain.id } }).catch(() => null),
    p.entitySettings?.findFirst?.().catch(() => null),
    p.tenantSettings?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.tenantEntity?.findUnique?.({ where: { tenantId: tenant.id }, include: { language: true } }).catch(() => null),
    p.domainLanguage?.findMany?.({ where: { domainId: domain.id }, include: { language: true } }).catch(() => []),
  ]);

  const gen = asObject(settings?.generationConfig);
  const pub = asObject(gen.publicEpaper);
  const epaperType = normalizeType(pub.type) || 'PDF';
  const multiEditionEnabled = pub.multiEditionEnabled === undefined ? true : Boolean(pub.multiEditionEnabled);

  // For PDF mode, hide block-layout-specific settings fields from the public contract.
  // Those settings apply to BLOCK-based generation and confuse PDF-only clients.
  const sanitizeSettingsForPublic = (row: any, type: 'PDF' | 'BLOCK') => {
    if (!row || typeof row !== 'object') return row;
    if (type !== 'PDF') return row;

    const hiddenKeys = new Set<string>([
      'pageWidthInches',
      'pageHeightInches',
      'gridColumns',
      'paddingTop',
      'paddingRight',
      'paddingBottom',
      'paddingLeft',
      'defaultPageCount',
      'mainHeaderHeightInches',
      'innerHeaderHeightInches',
      'footerHeightInches',
      'footerStyle',
    ]);

    const out: any = {};
    for (const [k, v] of Object.entries(row)) {
      if (!hiddenKeys.has(k)) out[k] = v;
    }
    return out;
  };

  const publicSettings = sanitizeSettingsForPublic(settings, epaperType);

  // Compute effective domain settings (entity -> tenant -> domain)
  const mergeSettings = (a: any, b: any) => ({ ...(a || {}), ...(b || {}) });
  const effectiveDomainSettings = mergeSettings(
    mergeSettings(entitySettings?.data, tenantSettings?.data),
    domainSettings?.data
  );

  // IMPORTANT: domainSettings can contain private secrets (push keys, API keys, etc.).
  // Public endpoint must never return secrets.
  const isPlainObject = (v: any) => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  const sanitizeDomainSettingsForPublic = (input: any) => {
    const src = isPlainObject(input) ? (input as any) : {};
    const out: any = {};

    // Allowed top-level keys
    if (isPlainObject(src.branding)) out.branding = src.branding;
    if (isPlainObject(src.theme)) out.theme = src.theme;
    if (isPlainObject(src.seo)) out.seo = src.seo;
    if (isPlainObject(src.layout)) out.layout = src.layout;
    if (typeof src.themeStyle === 'string') out.themeStyle = src.themeStyle;

    // integrations: allow only public IDs/tokens (never secret keys)
    if (isPlainObject(src.integrations)) {
      const integ = src.integrations;
      const safe: any = {};

      if (isPlainObject(integ.analytics)) {
        safe.analytics = {
          googleAnalyticsMeasurementId: integ.analytics.googleAnalyticsMeasurementId ?? integ.analytics.gaMeasurementId ?? null,
          googleTagManagerId: integ.analytics.googleTagManagerId ?? integ.analytics.gtmContainerId ?? null,
        };
      }
      if (isPlainObject(integ.searchConsole)) {
        safe.searchConsole = {
          googleSiteVerification: integ.searchConsole.googleSiteVerification ?? null,
          bingSiteVerification: integ.searchConsole.bingSiteVerification ?? null,
        };
      }
      if (isPlainObject(integ.ads)) {
        safe.ads = {
          // AdSense
          adsenseClientId: integ.ads.adsenseClientId ?? integ.ads.adsensePublisherId ?? null,

          // Google Ads (conversion / remarketing). These are public identifiers (not secrets).
          googleAdsConversionId: integ.ads.googleAdsConversionId ?? integ.ads.googleAdsCustomerId ?? null,
          googleAdsConversionLabel: integ.ads.googleAdsConversionLabel ?? null,

          // Google Ad Manager (GAM) public identifiers
          adManagerNetworkCode: integ.ads.adManagerNetworkCode ?? null,
          adManagerAppId: integ.ads.adManagerAppId ?? null,
        };
      }
      if (isPlainObject(integ.push)) {
        safe.push = {
          // Public key is safe to expose; private key must NOT be stored here for public.
          webPushVapidPublicKey: integ.push.webPushVapidPublicKey ?? integ.push.vapidPublicKey ?? null,
          fcmSenderId: integ.push.fcmSenderId ?? integ.push.firebaseSenderId ?? null,
        };
      }

      // Only include integrations if at least one section exists
      if (Object.keys(safe).length) out.integrations = safe;
    }

    return out;
  };

  const publicDomainSettingsData = domainSettings ? sanitizeDomainSettingsForPublic((domainSettings as any).data) : null;
  const publicEffectiveDomainSettings = sanitizeDomainSettingsForPublic(effectiveDomainSettings);

  const baseUrl = `https://${domain.domain}`;

  // Branding (prefer domain settings, fallback to tenant theme)
  const branding = {
    logoUrl: (effectiveDomainSettings as any)?.branding?.logoUrl ?? (tenantTheme as any)?.logoUrl ?? null,
    faviconUrl: (effectiveDomainSettings as any)?.branding?.faviconUrl ?? (tenantTheme as any)?.faviconUrl ?? null,
    primaryColor: (tenantTheme as any)?.primaryColor ?? (effectiveDomainSettings as any)?.theme?.colors?.primary ?? null,
    secondaryColor: (tenantTheme as any)?.secondaryColor ?? (effectiveDomainSettings as any)?.theme?.colors?.secondary ?? null,
    headerBgColor: (tenantTheme as any)?.headerBgColor ?? null,
    footerBgColor: (tenantTheme as any)?.footerBgColor ?? null,
    fontFamily: (tenantTheme as any)?.fontFamily ?? (effectiveDomainSettings as any)?.theme?.typography?.fontFamily ?? null,
    siteName: (effectiveDomainSettings as any)?.branding?.siteName ?? tenant.name ?? null,
  };

  // SEO config (prefer domain settings seo)
  const seoBase = (effectiveDomainSettings as any)?.seo || (tenantTheme as any)?.seoConfig || {};
  const seoConfig = {
    defaultMetaTitle: (seoBase as any)?.defaultMetaTitle ?? null,
    defaultMetaDescription: (seoBase as any)?.defaultMetaDescription ?? null,
    keywords: (seoBase as any)?.keywords ?? null,
    homepageH1: (seoBase as any)?.homepageH1 ?? null,
    tagline: (seoBase as any)?.tagline ?? null,
    ogTitle: (seoBase as any)?.ogTitle ?? (seoBase as any)?.defaultMetaTitle ?? null,
    ogDescription: (seoBase as any)?.ogDescription ?? (seoBase as any)?.defaultMetaDescription ?? null,
    ogImageUrl: (seoBase as any)?.ogImageUrl ?? null,
    canonicalBaseUrl: (seoBase as any)?.canonicalBaseUrl ?? baseUrl,
    // SEO controls (optional)
    robots: (seoBase as any)?.robots ?? null,
    sitemapEnabled: (seoBase as any)?.sitemapEnabled ?? null,
    // Structured data helpers (optional). Frontend can use this to render Organization/WebSite JSON-LD.
    organization: (seoBase as any)?.organization ?? null,
    socialLinks: (seoBase as any)?.socialLinks ?? null,
    colors: {
      primary: (effectiveDomainSettings as any)?.theme?.colors?.primary ?? (tenantTheme as any)?.primaryColor ?? null,
      secondary: (effectiveDomainSettings as any)?.theme?.colors?.secondary ?? (tenantTheme as any)?.secondaryColor ?? null,
      accent: (effectiveDomainSettings as any)?.theme?.colors?.accent ?? null,
    },
    layout: {
      header: (effectiveDomainSettings as any)?.layout?.header ?? null,
      footer: (effectiveDomainSettings as any)?.layout?.footer ?? null,
      showTicker: (effectiveDomainSettings as any)?.layout?.showTicker ?? null,
      showTopBar: (effectiveDomainSettings as any)?.layout?.showTopBar ?? null,
    },
    typography: {
      fontFamily: branding.fontFamily,
      baseSize: (effectiveDomainSettings as any)?.theme?.typography?.baseSize ?? null,
    },
  };

  // Extra SEO meta bundles for frontend convenience (optional; backward compatible)
  const seoMeta = {
    title: seoConfig.defaultMetaTitle,
    description: seoConfig.defaultMetaDescription,
    keywords: seoConfig.keywords,
    canonicalUrl: seoConfig.canonicalBaseUrl,
    robots: seoConfig.robots,
  };

  const seoOpenGraph = {
    url: seoConfig.canonicalBaseUrl,
    title: seoConfig.ogTitle,
    description: seoConfig.ogDescription,
    imageUrl: seoConfig.ogImageUrl,
    siteName: branding.siteName,
  };

  const seoTwitter = {
    card: (seoBase as any)?.twitterCard ?? null,
    handle: (seoBase as any)?.twitterHandle ?? null,
    title: (seoBase as any)?.twitterTitle ?? seoConfig.ogTitle,
    description: (seoBase as any)?.twitterDescription ?? seoConfig.ogDescription,
    imageUrl: (seoBase as any)?.twitterImageUrl ?? seoConfig.ogImageUrl,
  };

  const contentConfig = {
    defaultLanguage: (tenantEntity as any)?.language?.code ?? null,
    supportedLanguages: Array.from(new Set((domainLanguages as any[]).map(dl => dl?.language?.code).filter(Boolean))),
  };

  // Tenant admin contact (name + mobile)
  // Prefer TENANT_ADMIN user mapped via Reporter → User.role. Fallback to entity publisher/editor name.
  let tenantAdmin: { name: string | null; mobile: string | null } = { name: null, mobile: null };
  try {
    const adminReporter = await p.reporter.findFirst({
      where: { tenantId: tenant.id, user: { role: { name: 'TENANT_ADMIN' } } },
      include: {
        user: {
          select: {
            mobileNumber: true,
            role: { select: { name: true } },
            profile: { select: { fullName: true } },
          },
        },
      },
    });
    if ((adminReporter as any)?.user) {
      const u: any = (adminReporter as any).user;
      tenantAdmin = {
        name: u?.profile?.fullName || (tenantEntity as any)?.publisherName || (tenantEntity as any)?.editorName || null,
        mobile: u?.mobileNumber || null,
      };
    } else {
      tenantAdmin = {
        name: (tenantEntity as any)?.publisherName || (tenantEntity as any)?.editorName || null,
        mobile: null,
      };
    }
  } catch {}

  return res.json({
    verified: true,
    tenant: { 
      id: tenant.id, 
      slug: tenant.slug, 
      name: tenant.name,
      nativeName: (tenantEntity as any)?.nativeName ?? null,
    },
    domain: {
      id: domain.id,
      domain: domain.domain,
      kind: domain.kind,
      status: domain.status,
      verifiedAt: domain.verifiedAt,
    },
    epaper: {
      type: epaperType,
      multiEditionEnabled,
    },
    settings: publicSettings,
    branding,
    seo: {
      // Prefer domain-level SEO config enriched with theme/layout; fallback values merged
      config: seoConfig,
      meta: seoMeta,
      openGraph: seoOpenGraph,
      twitter: seoTwitter,
      urls: {
        baseUrl,
        robotsTxt: `${baseUrl}/robots.txt`,
        sitemapXml: `${baseUrl}/sitemap.xml`,
      },
    },
    content: contentConfig,
    tenantAdmin,
    domainSettings: domainSettings
      ? {
          updatedAt: (domainSettings as any).updatedAt,
          data: publicDomainSettingsData,
          effective: publicEffectiveDomainSettings,
        }
      : { updatedAt: null, data: null, effective: publicEffectiveDomainSettings || null },
    pdf: {
      dpi: Number((config as any)?.epaper?.pdfDpi || 150),
      maxMb: Number((config as any)?.epaper?.pdfMaxMb || 30),
      maxPages: Number((config as any)?.epaper?.pdfMaxPages || 0),
    },
  });
});

/**
 * @swagger
 * /public/epaper/ticker:
 *   get:
 *     summary: Latest ticker news (title + cover image)
 *     description: |
 *       Returns the latest published website news items for the tenant resolved by EPAPER domain.
 *       Intended for lightweight header/footer tickers on the ePaper site.
 *
 *       Notes:
 *       - Source is `TenantWebArticle` scoped by tenant, status=PUBLISHED.
 *       - Use `limit` to control item count (default 15).
 *       - Optional `lang` filters by article language code.
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, requires a verified EPAPER domain.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 15, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: lang
 *         required: false
 *         schema: { type: string, example: 'te' }
 *     responses:
 *       200:
 *         description: Latest ticker items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenant: { id: "t_abc", slug: "kaburlu" }
 *                   count: 2
 *                   items:
 *                     - id: "wa_1"
 *                       slug: "headline-1"
 *                       title: "Top headline"
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2026-01-12T10:00:00.000Z"
 *                     - id: "wa_2"
 *                       slug: "breaking-news"
 *                       title: "Breaking news"
 *                       coverImageUrl: null
 *                       publishedAt: null
 */
router.get('/epaper/ticker', requireVerifiedEpaperDomain, async (req, res) => {
  const tenant = (res.locals as any).tenant;

  const rawLimit = Number((req.query as any).limit ?? 15);
  const limit = Math.min(Math.max(isFinite(rawLimit) ? rawLimit : 15, 1), 50);
  const langCode = String((req.query as any).lang || '').trim() || null;

  let languageId: string | null = null;
  if (langCode) {
    const lang = await p.language.findUnique({ where: { code: langCode } }).catch(() => null);
    if (!lang) return res.status(400).json({ code: 'INVALID_LANG', message: 'Unknown lang code' });
    languageId = (lang as any).id;
  }

  const itemsRaw = await p.tenantWebArticle.findMany({
    where: {
      tenantId: tenant.id,
      status: 'PUBLISHED',
      ...(languageId ? { languageId } : {}),
      OR: [{ publishedAt: { not: null } }, { publishedAt: null }],
    },
    orderBy: [
      { publishedAt: 'desc' },
      { createdAt: 'desc' },
    ],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      contentJson: true,
      category: { select: { id: true, slug: true, name: true } },
      language: { select: { code: true } },
      tags: true,
      metaDescription: true,
    },
  });

  const items = itemsRaw.map((a: any) => {
    const card = toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null });
    return {
      id: card.id,
      slug: card.slug,
      title: card.title,
      coverImageUrl: card.coverImageUrl,
      publishedAt: card.publishedAt,
    };
  });

  return res.json({ tenant: { id: tenant.id, slug: tenant.slug }, count: items.length, items });
});

/**
 * @swagger
 * /public/epaper/issues:
 *   get:
 *     summary: List PDF-based ePaper issues for a date (all editions/sub-editions)
 *     description: |
 *       Public endpoint.
 *       - If issueDate is omitted, uses today's date (UTC).
 *       - Returns all issues uploaded for the tenant on that date.
 *       - Use includePages=true only when you really need all PNG URLs.
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, requires a verified EPAPER domain.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: issueDate
 *         schema: { type: string, example: "2026-01-12" }
 *       - in: query
 *         name: includePages
 *         schema: { type: boolean, default: false }
 *     responses:
 *       200:
 *         description: List of issues
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenant: { id: "t_abc", slug: "kaburlu" }
 *                   issueDate: "2026-01-12"
 *                   count: 1
 *                   issues:
 *                     - id: "iss_1"
 *                       target: { kind: "edition", editionSlug: "telangana" }
 *                       edition: { id: "ed_1", name: "Telangana", slug: "telangana" }
 *                       subEdition: null
 *                       pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                       coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                       pageCount: 12
 *                       updatedAt: "2026-01-12T06:00:00.000Z"
 */
router.get('/epaper/issues', requireVerifiedEpaperDomain, async (req, res) => {
  const tenant = (res.locals as any).tenant;

  const includePages = String((req.query as any).includePages ?? 'false').toLowerCase() === 'true';
  const issueDateStrRaw = (req.query as any).issueDate ? String((req.query as any).issueDate).trim() : '';
  const issueDateStr = issueDateStrRaw || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDateStr)) return res.status(400).json({ error: 'issueDate must be YYYY-MM-DD' });
  const issueDate = new Date(`${issueDateStr}T00:00:00.000Z`);

  const issues = await p.epaperPdfIssue.findMany({
    where: { tenantId: tenant.id, issueDate },
    orderBy: [{ updatedAt: 'desc' }],
    include: {
      edition: { select: { id: true, name: true, slug: true } },
      subEdition: { select: { id: true, name: true, slug: true, edition: { select: { slug: true } } } },
      pages: includePages ? { orderBy: { pageNumber: 'asc' } } : false,
    },
  });

  return res.json({
    tenant: { id: tenant.id, slug: tenant.slug },
    issueDate: issueDateStr,
    count: issues.length,
    issues: issues.map((it: any) => ({
      id: it.id,
      target: it.subEdition
        ? { kind: 'subEdition', editionSlug: it.subEdition.edition?.slug, subEditionSlug: it.subEdition.slug }
        : { kind: 'edition', editionSlug: it.edition?.slug },
      edition: it.edition,
      subEdition: it.subEdition,
      pdfUrl: it.pdfUrl,
      coverImageUrl: it.coverImageUrl,
      pageCount: it.pageCount,
      pages: includePages ? it.pages : undefined,
      updatedAt: it.updatedAt,
    })),
  });
});

/**
 * @swagger
 * /public/epaper/latest:
 *   get:
 *     summary: Get latest ePaper issues for all editions/sub-editions
 *     description: |
 *       Public endpoint.
 *       - If issueDate is provided, returns issues for that date.
 *       - If issueDate is omitted, returns the latest issue for each edition and sub-edition.
 *       - Uses the tenant resolved by epaper subdomain (Host) or X-Tenant-Domain.
 *
 *       Notes:
 *       - includePages=true can be heavy; use only when needed.
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, requires a verified EPAPER domain.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: issueDate
 *         schema: { type: string, example: "2026-01-12" }
 *       - in: query
 *         name: includePages
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: includeEmpty
 *         description: Include editions/sub-editions even if no issue exists.
 *         schema: { type: boolean, default: true }
 *     responses:
 *       200:
 *         description: Editions with their latest/date issues
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenant: { id: "t_abc", slug: "kaburlu" }
 *                   mode: "latest"
 *                   includePages: false
 *                   includeEmpty: true
 *                   editions:
 *                     - id: "ed_1"
 *                       name: "Telangana"
 *                       slug: "telangana"
 *                       stateId: null
 *                       coverImageUrl: null
 *                       seoTitle: null
 *                       seoDescription: null
 *                       seoKeywords: null
 *                       issue:
 *                         id: "iss_1"
 *                         issueDate: "2026-01-12T00:00:00.000Z"
 *                         pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                         coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                         pageCount: 12
 *                         updatedAt: "2026-01-12T06:00:00.000Z"
 *                       subEditions: []
 */
router.get('/epaper/latest', requireVerifiedEpaperDomain, async (req, res) => {
  const tenant = (res.locals as any).tenant;

  const includePages = String((req.query as any).includePages ?? 'false').toLowerCase() === 'true';
  const includeEmpty = String((req.query as any).includeEmpty ?? 'true').toLowerCase() === 'true';
  const issueDateStr = (req.query as any).issueDate ? String((req.query as any).issueDate).trim() : '';
  const hasDate = Boolean(issueDateStr);
  if (hasDate && !/^\d{4}-\d{2}-\d{2}$/.test(issueDateStr)) return res.status(400).json({ error: 'issueDate must be YYYY-MM-DD' });
  const issueDate = hasDate ? new Date(`${issueDateStr}T00:00:00.000Z`) : null;

  const editions = await p.epaperPublicationEdition.findMany({
    where: { tenantId: tenant.id, isDeleted: false, isActive: true },
    orderBy: [{ createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      stateId: true,
      coverImageUrl: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      subEditions: {
        where: { isDeleted: false, isActive: true },
        orderBy: [{ createdAt: 'desc' }],
        select: { id: true, name: true, slug: true },
      },
    },
  });

  const issueInclude: any = {
    pages: includePages ? { orderBy: { pageNumber: 'asc' } } : false,
  };

  let editionIssues: any[] = [];
  let subEditionIssues: any[] = [];

  if (hasDate) {
    const issues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, issueDate: issueDate as any },
      include: {
        edition: { select: { id: true, slug: true } },
        subEdition: { select: { id: true, slug: true } },
        ...issueInclude,
      },
    });
    editionIssues = issues.filter((it: any) => it.editionId && !it.subEditionId);
    subEditionIssues = issues.filter((it: any) => it.subEditionId && !it.editionId);
  } else {
    editionIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, editionId: { not: null }, subEditionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['editionId'],
      include: {
        edition: { select: { id: true, slug: true } },
        ...issueInclude,
      },
    });

    subEditionIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, subEditionId: { not: null }, editionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['subEditionId'],
      include: {
        subEdition: { select: { id: true, slug: true, edition: { select: { slug: true } } } },
        ...issueInclude,
      },
    });
  }

  const domain = (res.locals as any).domain;
  const baseUrl = `https://${domain?.domain || 'epaper.kaburlutoday.com'}`;

  const byEditionId = new Map<string, any>();
  for (const it of editionIssues) if (it.editionId) byEditionId.set(String(it.editionId), it);
  const bySubEditionId = new Map<string, any>();
  for (const it of subEditionIssues) if (it.subEditionId) bySubEditionId.set(String(it.subEditionId), it);

  // Helper to format issue date for display
  const formatIssueDate = (d: Date) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Helper to format date for URL (YYYY-MM-DD)
  const formatDateForUrl = (d: Date) => {
    const date = new Date(d);
    return date.toISOString().split('T')[0];
  };

  const out = editions
    .map((ed: any) => {
      const edIssue = byEditionId.get(ed.id);
      const mappedSub = (ed.subEditions || [])
        .map((sub: any) => {
          const subIssue = bySubEditionId.get(sub.id);
          if (!includeEmpty && !subIssue) return null;

          // Build SEO metadata for sub-edition issue
          let issueMeta = null;
          if (subIssue) {
            const dateStr = formatDateForUrl(subIssue.issueDate);
            const displayDate = formatIssueDate(subIssue.issueDate);
            issueMeta = {
              id: subIssue.id,
              issueDate: subIssue.issueDate,
              pdfUrl: subIssue.pdfUrl,
              coverImageUrl: subIssue.coverImageUrl,
              coverImageUrlWebp: subIssue.coverImageUrlWebp || null,
              pageCount: subIssue.pageCount,
              pages: includePages
                ? (subIssue.pages || []).map((pg: any) => ({
                    ...pg,
                    imageUrlWebp: pg.imageUrlWebp || null,
                  }))
                : undefined,
              updatedAt: subIssue.updatedAt,
              // SEO / Sharing metadata
              canonicalUrl: `${baseUrl}/epaper/${ed.slug}/${sub.slug}/${dateStr}/1`,
              metaTitle: `${sub.name} - ${ed.name} | ${displayDate}`,
              metaDescription: `Read ${sub.name} (${ed.name}) ePaper edition for ${displayDate}. ${subIssue.pageCount} pages available.`,
              ogImage: subIssue.coverImageUrlWebp || subIssue.coverImageUrl,
            };
          }

          return {
            ...sub,
            issue: issueMeta,
          };
        })
        .filter(Boolean);

      if (!includeEmpty && !edIssue && mappedSub.length === 0) return null;

      // Build SEO metadata for edition issue
      let editionIssueMeta = null;
      if (edIssue) {
        const dateStr = formatDateForUrl(edIssue.issueDate);
        const displayDate = formatIssueDate(edIssue.issueDate);
        editionIssueMeta = {
          id: edIssue.id,
          issueDate: edIssue.issueDate,
          pdfUrl: edIssue.pdfUrl,
          coverImageUrl: edIssue.coverImageUrl,
          coverImageUrlWebp: edIssue.coverImageUrlWebp || null,
          pageCount: edIssue.pageCount,
          pages: includePages
            ? (edIssue.pages || []).map((pg: any) => ({
                ...pg,
                imageUrlWebp: pg.imageUrlWebp || null,
              }))
            : undefined,
          updatedAt: edIssue.updatedAt,
          // SEO / Sharing metadata
          canonicalUrl: `${baseUrl}/epaper/${ed.slug}/${dateStr}/1`,
          metaTitle: `${ed.name} | ${displayDate}`,
          metaDescription: ed.seoDescription || `Read ${ed.name} ePaper edition for ${displayDate}. ${edIssue.pageCount} pages available.`,
          ogImage: edIssue.coverImageUrlWebp || edIssue.coverImageUrl,
        };
      }

      return {
        ...ed,
        issue: editionIssueMeta,
        subEditions: mappedSub,
      };
    })
    .filter(Boolean);

  return res.json({
    tenant: { id: tenant.id, slug: tenant.slug },
    mode: hasDate ? 'date' : 'latest',
    issueDate: hasDate ? issueDateStr : undefined,
    includePages,
    includeEmpty,
    editions: out,
  });
});

/**
 * @swagger
 * /public/epaper/issue:
 *   get:
 *     summary: Get a PDF-based ePaper issue (pages as PNG URLs)
 *     description: |
 *       Public endpoint.
 *       - Provide issueDate (YYYY-MM-DD) to fetch a specific date, or omit to fetch latest available.
 *       - Provide either editionSlug OR (editionSlug + subEditionSlug).
 *
 *       EPAPER domain verification:
 *       - When `MULTI_TENANCY=true`, requires a verified EPAPER domain.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: issueDate
 *         schema: { type: string, example: "2026-01-12" }
 *       - in: query
 *         name: editionSlug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: subEditionSlug
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Issue with pages
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenant: { id: "t_abc", slug: "kaburlu" }
 *                   edition: { id: "ed_1", name: "Telangana", slug: "telangana" }
 *                   subEdition: null
 *                   issue:
 *                     id: "iss_1"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *                     pages:
 *                       - id: "pg_1"
 *                         issueId: "iss_1"
 *                         pageNumber: 1
 *                         imageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *       404:
 *         description: Not found
 */
router.get('/epaper/issue', requireVerifiedEpaperDomain, async (req, res) => {
  const tenant = (res.locals as any).tenant;

  const issueDateStr = (req.query as any).issueDate ? String((req.query as any).issueDate).trim() : undefined;
  const editionSlug = (req.query as any).editionSlug ? String((req.query as any).editionSlug).trim() : '';
  const subEditionSlug = (req.query as any).subEditionSlug ? String((req.query as any).subEditionSlug).trim() : undefined;

  if (!editionSlug) return res.status(400).json({ error: 'editionSlug is required' });

  const edition = await p.epaperPublicationEdition.findFirst({
    where: { tenantId: tenant.id, slug: editionSlug, isDeleted: false, isActive: true },
    select: { id: true, name: true, slug: true },
  });
  if (!edition) return res.status(404).json({ error: 'Edition not found' });

  let subEdition: any = null;
  if (subEditionSlug) {
    subEdition = await p.epaperPublicationSubEdition.findFirst({
      where: { tenantId: tenant.id, editionId: edition.id, slug: subEditionSlug, isDeleted: false, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!subEdition) return res.status(404).json({ error: 'Sub-edition not found' });
  }

  const whereTarget = subEdition
    ? { tenantId: tenant.id, subEditionId: subEdition.id, editionId: null }
    : { tenantId: tenant.id, editionId: edition.id, subEditionId: null };

  let issue: any = null;
  if (issueDateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDateStr)) return res.status(400).json({ error: 'issueDate must be YYYY-MM-DD' });
    const issueDate = new Date(`${issueDateStr}T00:00:00.000Z`);
    issue = await p.epaperPdfIssue.findFirst({
      where: { ...whereTarget, issueDate },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
  } else {
    issue = await p.epaperPdfIssue.findFirst({
      where: { ...whereTarget },
      orderBy: { issueDate: 'desc' },
      include: { pages: { orderBy: { pageNumber: 'asc' } } },
    });
  }

  if (!issue) return res.status(404).json({ error: 'Issue not found' });

  // Build SEO / sharing metadata
  const domain = (res.locals as any).domain;
  const baseUrl = `https://${domain?.domain || 'epaper.kaburlutoday.com'}`;
  const dateStr = new Date(issue.issueDate).toISOString().split('T')[0];
  const displayDate = new Date(issue.issueDate).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const targetName = subEdition ? `${subEdition.name} - ${edition.name}` : edition.name;
  const canonicalUrl = subEdition
    ? `${baseUrl}/epaper/${edition.slug}/${subEdition.slug}/${dateStr}/1`
    : `${baseUrl}/epaper/${edition.slug}/${dateStr}/1`;

  return res.json({
    tenant: { id: tenant.id, slug: tenant.slug },
    edition,
    subEdition,
    issue: {
      id: issue.id,
      issueDate: issue.issueDate,
      pdfUrl: issue.pdfUrl,
      coverImageUrl: issue.coverImageUrl,
      coverImageUrlWebp: issue.coverImageUrlWebp || null,
      pageCount: issue.pageCount,
      pages: (issue.pages || []).map((pg: any) => ({
        ...pg,
        imageUrlWebp: pg.imageUrlWebp || null,
      })),
      // SEO / Sharing metadata
      canonicalUrl,
      metaTitle: `${targetName} | ${displayDate}`,
      metaDescription: `Read ${targetName} ePaper edition for ${displayDate}. ${issue.pageCount} pages available.`,
      ogImage: issue.coverImageUrlWebp || issue.coverImageUrl,
    },
  });
});

/**
 * @swagger
 * /public/theme:
 *   get:
 *     summary: Get website theme for this domain's tenant
 *     description: Returns branding assets and colors configured for the tenant resolved from the request domain.
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
 *       200:
 *         description: Theme or null
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   logoUrl: "https://cdn.kaburlu.com/logo.png"
 *                   faviconUrl: "https://cdn.kaburlu.com/favicon.ico"
 *                   primaryColor: "#0D47A1"
 */
router.get('/theme', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const theme = await p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } });
  // If no theme found, return null so the frontend can fall back to defaults
  res.json(theme || null);
});

/**
 * @swagger
 * /public/languages:
 *   get:
 *     summary: List languages allowed for this domain
 *     description: Returns languages explicitly enabled for the resolved domain. Marks which one is the tenant default.
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
 *       200:
 *         description: Allowed languages
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - code: 'en'
 *                     name: 'English'
 *                     nativeName: 'English'
 *                     direction: 'ltr'
 *                     defaultForTenant: true
 *                   - code: 'te'
 *                     name: 'Telugu'
 *                     nativeName: 'తెలుగు'
 *                     direction: 'ltr'
 *                     defaultForTenant: false
 */
router.get('/languages', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const [allowed, entity] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } })
  ]);
  const tenantDefaultCode = entity?.language?.code;
  const shaped = allowed.map((dl: any) => ({
    code: dl.language.code,
    name: dl.language.name,
    nativeName: dl.language.nativeName,
    direction: dl.language.direction,
    defaultForTenant: dl.language.code === tenantDefaultCode
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /public/categories:
 *   get:
 *     summary: List categories allowed for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: includeChildren
 *         schema: { type: boolean }
 *         description: Include immediate children categories (filtered to allowed set)
 *       - in: query
 *         name: languageCode
 *         schema: { type: string }
  *         description: Optional ISO code (must be allowed for domain). If omitted, defaults to tenant's language when available.
 *     responses:
  *       200:
  *         description: Category list
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - id: "cat1"
  *                     name: "రాజకీయాలు"
  *                     nameDefault: "Politics"
  *                     nameLocalized: "రాజకీయాలు"
  *                     slug: "politics"
 */
router.get('/categories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const includeChildren = String(req.query.includeChildren).toLowerCase() === 'true';
  let languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  // Determine default language from tenant if not explicitly requested
  if (!languageCode) {
    const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } }).catch(() => null);
    const tenantLangCode = entity?.language?.code || undefined;
    if (tenantLangCode) languageCode = tenantLangCode;
  }

  // Fetch allowed categories for this domain
  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const allowedIds = new Set(domainCats.map((dc: any) => dc.categoryId));
  let categories = domainCats.map((dc: any) => dc.category);

  if (includeChildren) {
    const parentIds: string[] = [];
    categories.forEach((c: any) => parentIds.push(c.id));
    const children = await p.category.findMany({ where: { parentId: { in: Array.from(parentIds) } } });
    // Only include children if explicitly allowed for the domain
    categories = categories.concat(children.filter((ch: any) => allowedIds.has(ch.id)));
  }

  // Optional: apply translations. Allow if domain explicitly enables language OR if it matches tenant default.
  let translationsByCategory: Map<string, string> | undefined;
  if (languageCode) {
    const lang = await p.language.findUnique({ where: { code: languageCode } });
    if (lang) {
      // Check domain gating
      const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } } });
      // Get tenant default language code (we might have loaded earlier; reload if needed)
      let tenantDefaultLangCode: string | undefined;
      try {
        const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } });
        tenantDefaultLangCode = entity?.language?.code;
      } catch (_) { /* ignore */ }
      const languageAllowed = !!domLang || (tenantDefaultLangCode && tenantDefaultLangCode === languageCode);
      if (languageAllowed) {
        const ids = Array.from(new Set(categories.map((c: any) => c.id)));
        const translations = await p.categoryTranslation.findMany({ where: { categoryId: { in: ids }, language: languageCode } });
        translationsByCategory = new Map(translations.map((t: any) => [t.categoryId, t.name]));
      }
    }
  }

  // Deduplicate and shape response, include default and localized name
  const map = new Map<string, any>();
  categories.forEach((c: any) => {
    const localized = translationsByCategory?.get(c.id) || null;
    const name = localized || c.name;
    map.set(c.id, {
      id: c.id,
      name,
      nameDefault: c.name,
      nameLocalized: localized,
      slug: c.slug,
      parentId: c.parentId,
      iconUrl: c.iconUrl
    });
  });
  res.json(Array.from(map.values()));
});

/**
 * @swagger
 * /public/category-translations:
 *   get:
 *     summary: Debug listing of categories with raw translation (NOT for production use)
 *     description: Returns categories plus their translation for a requested language without domain-language gating. Use only for diagnostics.
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: app.kaburlumedia.com
 *       - in: query
 *         name: languageCode
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Categories with translation status
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - id: 'cat1'
 *                     baseName: 'NATIONAL'
 *                     translated: 'జాతీయ'
 *                     hasTranslation: true
 */
router.get('/category-translations', async (req, res) => {
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;
  if (!languageCode) return res.status(400).json({ error: 'languageCode required' });
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
  const categories = domainCats.map((dc: any) => dc.category);

  const langRow = await p.language.findUnique({ where: { code: languageCode } });
  let domainLanguageEnabled = false;
  let tenantDefaultLangCode: string | undefined;
  try {
    const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id }, include: { language: true } });
    tenantDefaultLangCode = entity?.language?.code;
  } catch (_) { /* ignore */ }
  if (langRow) {
    const domLang = await p.domainLanguage.findUnique({ where: { domainId_languageId: { domainId: domain.id, languageId: langRow.id } } });
    domainLanguageEnabled = !!domLang || (tenantDefaultLangCode === languageCode);
  }

  let translationsMap = new Map<string, string>();
  if (domainLanguageEnabled) {
    const translations = await p.categoryTranslation.findMany({ where: { language: languageCode, categoryId: { in: categories.map((c: any) => c.id) } } });
    translationsMap = new Map(translations.map((t: any) => [t.categoryId, t.name]));
  }

  const shaped = categories.map((c: any) => ({
    id: c.id,
    baseName: c.name,
    slug: c.slug,
    translated: domainLanguageEnabled ? (translationsMap.get(c.id) || null) : null,
    hasTranslation: domainLanguageEnabled && translationsMap.has(c.id),
    domainLanguageEnabled,
    tenantDefaultLanguage: tenantDefaultLangCode
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /public/articles:
 *   get:
 *     summary: List published website articles (TenantWebArticle) for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *       - in: query
 *         name: categorySlug
 *         schema: { type: string }
 *       - in: query
 *         name: languageCode
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated article cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 100
 *                   items:
 *                     - id: "wa_1"
 *                       slug: "sangareddy-patancheru-december-27"
 *                       title: "Headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-27T10:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: ["breaking", "telangana"]
 */
router.get('/articles', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10), 1), 100);
  const categorySlug = req.query.categorySlug ? String(req.query.categorySlug) : undefined;
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  // Allowed categories & languages for domain
  const [domainCats, domainLangs, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));

  // Domain scoping: strict to current domain; optionally include orphaned (domainId null) only when tenant has a single active domain.
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  let categoryIdFilter: string | undefined;
  if (categorySlug) {
    const match = domainCats.find((d: any) => d.category?.slug === categorySlug);
    if (!match) return res.json({ page, pageSize, total: 0, items: [] });
    categoryIdFilter = match.categoryId;
  }

  let languageIdFilter: string | undefined;
  if (languageCode) {
    const lang = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!lang) return res.json({ page, pageSize, total: 0, items: [] });
    languageIdFilter = lang.languageId;
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    ...domainScope,
  };
  if (categoryIdFilter) {
    where.categoryId = categoryIdFilter;
  } else if (allowedCategoryIds.size) {
    where.categoryId = { in: Array.from(allowedCategoryIds) };
  }
  if (languageIdFilter) {
    where.languageId = languageIdFilter;
  } else if (allowedLanguageIds.size) {
    where.languageId = { in: Array.from(allowedLanguageIds) };
  }

  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }),
    p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        language: { select: { code: true } }
      }
    })
  ]);

  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/home:
 *   get:
 *     summary: Latest website articles for homepage (TenantWebArticle)
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: manachourasta.com
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         example: 30
 *       - in: query
 *         name: shape
 *         required: false
 *         description: Optional response shape. `homepage` returns hero/topStories + section-wise data driven by tenant theme homepage settings.
 *         schema:
 *           type: string
 *           enum: ['flat', 'homepage']
 *         example: homepage
 *       - in: query
 *         name: themeKey
 *         required: false
 *         description: Theme key used to read TenantTheme.homepageConfig (e.g. style1). Defaults to style1.
 *         schema:
 *           type: string
 *           example: style1
 *       - in: query
 *         name: lang
 *         required: false
 *         description: Optional language code filter (must be allowed for domain).
 *         schema:
 *           type: string
 *           example: te
 *     responses:
 *       200:
 *         description: Latest card items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "wa_1"
 *                       slug: "sangareddy-patancheru-december-27"
 *                       title: "Headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-27T10:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: ["telangana"]
 *               homepage:
 *                 summary: Section-wise homepage response (use ?shape=homepage)
 *                 value:
 *                   hero: []
 *                   topStories: []
 *                   sections:
 *                     - key: "politics"
 *                       title: "Politics"
 *                       position: 10
 *                       limit: 6
 *                       categorySlug: "politics"
 *                       items: []
 *                   config:
 *                     heroCount: 1
 *                     topStoriesCount: 5
 *                     themeKey: "style1"
 */
router.get('/articles/home', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10), 1), 100);

  const shape = String(req.query.shape || 'flat').toLowerCase();
  const themeKey = String(req.query.themeKey || 'style1').trim() || 'style1';
  const langCode = (req.query.lang ? String(req.query.lang) : '').trim() || null;

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  // Resolve optional language filter (must be allowed for domain)
  let languageId: string | null = null;
  if (langCode) {
    const domainLangs = await p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }).catch(() => []);
    const match = (domainLangs || []).find((dl: any) => dl.language?.code === langCode);
    if (!match) {
      // Unknown/disabled language => empty result (safe)
      return res.json(shape === 'homepage'
        ? { hero: [], topStories: [], sections: [], config: { heroCount: 1, topStoriesCount: 5, themeKey, lang: langCode } }
        : { items: [] }
      );
    }
    languageId = match.languageId;
  }

  // Default/legacy response: flat list
  if (shape !== 'homepage') {
    const rows = await p.tenantWebArticle.findMany({
      where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope, ...(languageId ? { languageId } : {}) },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
    const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
    return res.json({ items });
  }

  // Homepage response: hero/topStories + configurable sections
  type HomepageSectionCfg = {
    key: string;
    title?: string;
    label?: string;
    position?: number;
    limit?: number;
    categorySlug?: string;
    tagsHas?: string;
  };

  const [domainCats, tenantTheme] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }).catch(() => []),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
  ]);
  const categoryBySlug = new Map<string, any>((domainCats || []).map((d: any) => [d.category?.slug, d.category]));
  const allowedCategoryIds = new Set((domainCats || []).map((d: any) => d.categoryId));

  const themeHomeAny: any = (tenantTheme as any)?.homepageConfig || null;
  const themeCfg: any = themeHomeAny && typeof themeHomeAny === 'object'
    ? (themeHomeAny[themeKey] ?? themeHomeAny)
    : null;

  const cfg: any = themeCfg || {};
  const clampInt = (value: any, min: number, max: number, fallback: number) => {
    const n = parseInt(String(value), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  };
  const heroCount = clampInt(cfg.heroCount, 1, 10, 1);
  const topStoriesCount = clampInt(cfg.topStoriesCount, 1, 20, 5);

  const defaultSections: HomepageSectionCfg[] = [
    { key: 'politics', title: 'Politics', position: 10, limit: 6, categorySlug: 'politics' },
    { key: 'technology', title: 'Technology', position: 20, limit: 6, categorySlug: 'technology' },
    { key: 'sports', title: 'Sports', position: 30, limit: 6, categorySlug: 'sports' }
  ];
  const rawSections: HomepageSectionCfg[] = Array.isArray(cfg.sections) && cfg.sections.length ? cfg.sections : defaultSections;
  const sectionsCfg: HomepageSectionCfg[] = rawSections
    .map((s: any) => ({
      key: String(s?.key || '').trim(),
      title: typeof s?.title === 'string' ? s.title : undefined,
      label: typeof s?.label === 'string' ? s.label : undefined,
      position: typeof s?.position === 'number' ? s.position : (parseInt(String(s?.position || '999'), 10) || 999),
      limit: clampInt(s?.limit, 1, 50, 6),
      categorySlug: typeof s?.categorySlug === 'string' ? s.categorySlug : undefined,
      tagsHas: typeof s?.tagsHas === 'string' ? s.tagsHas : undefined,
    }))
    .filter((s: any) => s.key)
    .sort((a: any, b: any) => a.position - b.position)
    .slice(0, 25);

  const baseWhere: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope };
  if (allowedCategoryIds.size) baseWhere.categoryId = { in: Array.from(allowedCategoryIds) };
  if (languageId) baseWhere.languageId = languageId;

  // Pull a pool of latest articles once, to build hero/topStories + dedupe
  const poolTake = Math.min(
    100,
    Math.max(limit, heroCount + topStoriesCount + sectionsCfg.reduce((sum, s) => sum + (s.limit || 0), 0) + 25)
  );
  const latestPoolRows = await p.tenantWebArticle.findMany({
    where: baseWhere,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: poolTake,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const latestPool = latestPoolRows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));

  const hero = latestPool.slice(0, heroCount);
  const topStories = latestPool.slice(heroCount, heroCount + topStoriesCount);
  const seen = new Set<string>();
  for (const c of [...hero, ...topStories]) {
    if (c?.id) seen.add(String(c.id));
  }

  async function fetchSectionItems(s: HomepageSectionCfg) {
    const want = Math.min(Math.max(Number(s.limit || 6), 1), 50);

    // Prefer category-specific query when categorySlug is provided.
    if (s.categorySlug) {
      const resolvedCategory = categoryBySlug.get(s.categorySlug) || null;
      if (!resolvedCategory) {
        return {
          key: s.key,
          title: s.label || s.title || s.key,
          position: s.position,
          limit: want,
          categorySlug: s.categorySlug,
          items: []
        };
      }

      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope, categoryId: resolvedCategory.id };
      if (languageId) where.languageId = languageId;
      if (s.tagsHas) where.tags = { has: s.tagsHas };

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(want + 25, 75),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      const cards = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
      const items: any[] = [];
      for (const c of cards) {
        if (!c?.id) continue;
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        items.push(c);
        if (items.length >= want) break;
      }
      return {
        key: s.key,
        title: s.label || s.title || resolvedCategory.name || s.key,
        position: s.position,
        limit: want,
        categorySlug: s.categorySlug,
        items
      };
    }

    // Otherwise: latest pool (optionally filtered by tagsHas)
    const items: any[] = [];
    for (const c of latestPool) {
      if (!c?.id) continue;
      if (seen.has(c.id)) continue;
      if (s.tagsHas) {
        const tags = Array.isArray((c as any).tags) ? (c as any).tags : [];
        if (!tags.includes(s.tagsHas)) continue;
      }
      seen.add(c.id);
      items.push(c);
      if (items.length >= want) break;
    }
    return {
      key: s.key,
      title: s.label || s.title || s.key,
      position: s.position,
      limit: want,
      categorySlug: s.categorySlug || null,
      items
    };
  }

  const sections = await Promise.all(sectionsCfg.map(fetchSectionItems));

  // Frontend convenience: also expose a map keyed by section key.
  const data: Record<string, any[]> = {};
  for (const s of sections as any[]) {
    if (s?.key) data[String(s.key)] = Array.isArray(s.items) ? s.items : [];
  }

  const out: any = {
    hero,
    topStories,
    sections,
    data,
    config: {
      heroCount,
      topStoriesCount,
      themeKey,
      lang: langCode
    }
  };

  // Optional convenience fields if configured by section keys.
  if (data.latest) out.latest = data.latest;
  if (data.trending) out.trending = data.trending;
  if (data.breaking) out.breaking = data.breaking;

  return res.json(out);
});

/**
 * @swagger
 * /public/articles/by-category/{slug}:
 *   get:
 *     summary: Website articles by category slug (domain-allowed)
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100 }
 *     responses:
 *       200:
 *         description: Paginated items
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   page: 1
 *                   pageSize: 20
 *                   total: 10
 *                   items:
 *                     - id: "wa_2"
 *                       slug: "politics-headline-1"
 *                       title: "Category headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: null
 *                       publishedAt: "2025-12-28T08:00:00.000Z"
 *                       category: { id: "cat_1", slug: "politics", name: "రాజకీయాలు" }
 *                       languageCode: "te"
 *                       tags: []
 */
router.get('/articles/by-category/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
  const pageSize = Math.min(Math.max(parseInt(String(req.query.pageSize || '20'), 10), 1), 100);
  const slug = String(req.params.slug);

  const [domainCats, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const match = domainCats.find((d: any) => d.category?.slug === slug);
  if (!match) return res.json({ page, pageSize, total: 0, items: [] });

  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    categoryId: match.categoryId,
    ...domainScope
  };

  const [total, rows] = await Promise.all([
    p.tenantWebArticle.count({ where }),
    p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    })
  ]);
  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ page, pageSize, total, items });
});

/**
 * @swagger
 * /public/articles/latest:
 *   get:
 *     summary: Latest website article cards
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *         example: 8
 *     responses:
 *       200:
 *         description: Latest short list of cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "wa_3"
 *                       slug: "latest-headline-1"
 *                       title: "Latest headline"
 *                       excerpt: "Short summary..."
 *                       coverImageUrl: "https://cdn.example.com/cover.webp"
 *                       publishedAt: "2025-12-28T10:00:00.000Z"
 *                       category: { id: "cat_9", slug: "national", name: "జాతీయ" }
 *                       languageCode: "te"
 *                       tags: ["breaking"]
 */
router.get('/articles/latest', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : { domainId: domain.id };

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const items = rows.map((a: any) => toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null }));
  res.json({ items });
});

/**
 * @swagger
 * /public/stories:
 *   get:
 *     summary: Web stories (alias of /public/webstories)
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *         example: 8
 *     responses:
 *       200:
 *         description: Story cards
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   items:
 *                     - id: "ws1"
 *                       title: "Story"
 */
router.get('/stories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '8'), 10), 1), 50);
  const stories = await p.article.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', type: 'web_story' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, title: true, images: true }
  });
  const items = stories.map((s: any) => ({ id: s.id, title: s.title, posterUrl: s.images?.[0] || null }));
  res.json({ items });
});

/**
 * @swagger
 * /public/tenants/by-domain/{domain}:
 *   get:
 *     summary: Resolve tenant by domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: path
 *         name: domain
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant basic info
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "tenant1"
 *                   slug: "manachourasta"
 *                   name: "Mana Chourasta"
 *       404:
 *         description: Not found
 */
router.get('/tenants/by-domain/:domain', async (req, res) => {
  const dom = await p.domain.findUnique({ where: { domain: String(req.params.domain) }, include: { tenant: true } });
  if (!dom || dom.status !== 'ACTIVE' || !dom.tenant) return res.status(404).json({ error: 'Not found' });
  const { id, slug, name } = dom.tenant;
  res.json({ id, slug, name });
});

/**
 * @swagger
 * /public/articles/{slug}:
 *   get:
 *     summary: Get a single published website article by slug for this domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: languageCode
 *         required: false
 *         description: Optional language code (useful when multiple locales publish the same slug).
 *         schema: { type: string, example: te }
 *     responses:
 *       200:
 *         description: Website article detail
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "wa_1"
 *                   tenantId: "t_abc"
 *                   slug: "sangareddy-patancheru-december-27"
 *                   title: "Headline"
 *                   subtitle: ""
 *                   excerpt: "Short summary..."
 *                   tags: ["telangana"]
 *                   status: "published"
 *                   publishedAt: "2025-12-27T10:00:00.000Z"
 *                   coverImage: { alt: "", url: "https://cdn.example.com/cover.webp", caption: "" }
 *                   categories: []
 *                   blocks: []
 *                   contentHtml: ""
 *                   plainText: ""
 *                   readingTimeMin: 2
 *                   languageCode: "te"
 *                   authors: []
 *                   meta: { seoTitle: "Headline", metaDescription: "Short summary..." }
 *                   jsonLd: {}
 */
router.get('/articles/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slugRaw = String(req.params.slug);
  const slug = (() => {
    try {
      return decodeURIComponent(slugRaw);
    } catch {
      return slugRaw;
    }
  })();
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  const [domainCats, domainLangs, activeDomainCount] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0)
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));
  // Best practice: always include shared tenant website articles (domainId=null)
  // so multi-domain tenants still see the content they published as shared.
  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };

  let languageIdFilter: string | undefined;
  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!match) return res.status(404).json({ error: 'Not found' });
    languageIdFilter = match.languageId;
  }

  const and: any[] = [domainScope];

  // Language filters:
  // - If languageCode is explicitly provided, match exactly that language.
  // - Otherwise, restrict to allowed languages, but also include legacy rows where languageId is null.
  if (languageIdFilter) {
    and.push({ languageId: languageIdFilter });
  } else if (allowedLanguageIds.size) {
    and.push({ OR: [{ languageId: { in: Array.from(allowedLanguageIds) } }, { languageId: null }] });
  }

  // Category filters: if domain has an allowed list, allow uncategorized rows too
  // (many ingested TenantWebArticle rows can have categoryId=null).
  if (allowedCategoryIds.size) {
    and.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
    OR: [{ slug }, { id: slug }]
  };

  const [a, tenantTheme] = await Promise.all([
    p.tenantWebArticle.findFirst({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      tenantId: true,
      domainId: true,
      languageId: true,
      language: { select: { code: true } },
      title: true,
      slug: true,
      status: true,
      coverImageUrl: true,
      contentJson: true,
      seoTitle: true,
      metaDescription: true,
      jsonLd: true,
      tags: true,
      publishedAt: true,
      authorId: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } }
    }
  }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
  ]);

  if (!a) return res.status(404).json({ error: 'Not found' });

  // Best-effort view tracking for website analytics.
  // This is intentionally fire-and-forget to avoid slowing down article detail responses.
  void p.tenantWebArticle
    .update({ where: { id: a.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => null);

  const detail: any = toWebArticleDetailDto(a);

  const lang = String((a as any)?.language?.code || detail?.languageCode || 'en').trim().toLowerCase() || 'en';
  const canonicalUrl = `https://${domain.domain}/${encodeURIComponent(lang)}/articles/${encodeURIComponent(detail.slug)}`;
  const imageUrls = [detail?.coverImage?.url].filter(Boolean) as string[];
  const authorNameRaw = Array.isArray(detail.authors) && detail.authors.length ? (detail.authors[0]?.name || null) : null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;
  const authorName = (authorNameRaw && String(authorNameRaw).trim()) ? String(authorNameRaw).trim() : `${tenantDisplayName} Reporter`;
  const sectionName = (a as any)?.category?.name || (a as any)?.category?.slug || null;
  const resolvedLanguageCode = (a as any)?.language?.code || detail?.languageCode || undefined;
  const keywords = Array.isArray(detail?.tags) ? detail.tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 15) : undefined;
  const publisherLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const cover = (a as any)?.contentJson?.coverImage || (detail as any)?.coverImage || null;
  const imageWidth = cover && Number.isFinite(Number(cover.w)) ? Number(cover.w) : undefined;
  const imageHeight = cover && Number.isFinite(Number(cover.h)) ? Number(cover.h) : undefined;

  const generated = buildNewsArticleJsonLd({
    // Use the full article title for JSON-LD headline (avoid shortened SEO title).
    headline: detail.title,
    description: detail.meta?.metaDescription || detail.excerpt || undefined,
    canonicalUrl,
    imageUrls,
    imageWidth,
    imageHeight,
    languageCode: resolvedLanguageCode || undefined,
    datePublished: detail.publishedAt || undefined,
    dateModified: (a as any)?.updatedAt ? new Date((a as any).updatedAt).toISOString() : (detail.publishedAt || undefined),
    authorName: authorName || undefined,
    publisherName: tenantDisplayName,
    publisherLogoUrl: publisherLogoUrl || undefined,
    keywords,
    articleSection: sectionName || undefined,
    isAccessibleForFree: true,
  });

  // Merge: keep stored jsonLd values when they are meaningful, but fill missing bits from generated.
  const existing = detail.jsonLd && typeof detail.jsonLd === 'object' ? detail.jsonLd : {};
  const merged: any = { ...generated };
  const preferGenerated = new Set(['headline', 'image', 'author', 'articleSection']);
  const looksLikeInternalId = (value: any) => {
    const s = String(value || '').trim();
    if (!s) return false;
    // cuid/uuid-like or long opaque ids
    if (/^c[a-z0-9]{20,}$/i.test(s)) return true;
    if (/^[a-f0-9]{24,}$/i.test(s)) return true;
    if (/^[a-f0-9-]{32,}$/i.test(s) && s.includes('-')) return true;
    return false;
  };

  for (const [k, v] of Object.entries(existing)) {
    if (preferGenerated.has(k)) continue;
    if (k === 'articleSection' && looksLikeInternalId(v)) continue;
    const isEmpty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as any).length === 0);
    if (!isEmpty) merged[k] = v;
  }
  // Nested fill: publisher.logo
  if (merged.publisher && typeof merged.publisher === 'object') {
    const existingPublisher = (existing as any).publisher;
    if (existingPublisher && typeof existingPublisher === 'object') {
      merged.publisher = { ...merged.publisher, ...existingPublisher };
      if ((existingPublisher as any).logo && typeof (existingPublisher as any).logo === 'object') {
        merged.publisher.logo = { ...(merged.publisher.logo || {}), ...(existingPublisher as any).logo };
      }
    }
  }

  detail.jsonLd = merged;
  res.json(detail);
});

/**
 * @swagger
 * /public/entity:
 *   get:
 *     summary: Get public PRGI/entity details for this domain's tenant
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     responses:
 *       200:
 *         description: Entity details
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   prgiNumber: "PRGI-1234"
 *                   registrationTitle: "Kaburlu News"
 *       404: { description: Not found }
 */
router.get('/entity', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;
  const row = await p.tenantEntity.findUnique({
    where: { tenantId: tenant.id },
    include: {
      language: true,
      publicationCountry: true,
      publicationState: true,
      publicationDistrict: true,
      publicationMandal: true,
      printingDistrict: true,
      printingMandal: true,
    }
  });
  if (!row) return res.status(404).json({ error: 'Not found' });
  // Only expose safe public fields
  const { prgiNumber, registrationTitle, periodicity, registrationDate, language, ownerName, publisherName, editorName,
    publicationCountry, publicationState, publicationDistrict, publicationMandal, printingPressName, printingDistrict, printingMandal, printingCityName, address } = row;
  res.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      displayName: tenantDisplayName,
      nativeName: (tenant as any).nativeName || null,
      language: (tenant as any).primaryLanguage || null,
    },
    prgiNumber, registrationTitle, periodicity, registrationDate,
    language,
    ownerName, publisherName, editorName,
    publicationCountry, publicationState, publicationDistrict, publicationMandal,
    printingPressName, printingDistrict, printingMandal, printingCityName,
    address,
  });
});

export default router;
/**
 * @swagger
 * /public/tenant:
 *   get:
 *     summary: Resolve current tenant by Host/X-Tenant-Domain
 *     tags: [Public - Website, Public - Tenant]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override to resolve tenant when testing locally.
 *         schema:
 *           type: string
 *           example: manachourasta.com
 *     responses:
 *       200:
 *         description: Current tenant basic info
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   id: "tenant1"
 *                   slug: "manachourasta"
 *                   name: "Mana Chourasta"
 *                   domain: "manachourasta.com"
 *       500:
 *         description: Domain context missing
 */
router.get('/tenant', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const { id, slug, name } = tenant;
  res.json({ id, slug, name, domain: domain.domain });
});