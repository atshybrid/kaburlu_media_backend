import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import { config } from '../../config/env';
import prisma from '../../lib/prisma';
import { toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import { buildNewsArticleJsonLd } from '../../lib/seo';
import { hasEpaperJpegColumns } from '../../lib/epaperDbFeatures';
import newsWebsiteRouter from './newsWebsite.routes';
// NEW: Public crop session imports
import {
  getPublicIssueWithClips,
  createCropSession,
  updateClipViaCropSession,
  createClipViaCropSession,
} from '../epaper/publicCropSession.controller';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();

// Apply resolver only to this public router
router.use(tenantResolver);

// Mount News Website API 2.0 routes
router.use(newsWebsiteRouter);

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

  /**
   * Helper: Ensure social sharing images are JPG format
   * Social platforms (Facebook, Twitter, WhatsApp) work best with JPG images.
   * PNG files can cause sharing issues on some platforms.
   */
  function ensureSocialImageFormat(imageUrl: string | null): string | null {
    if (!imageUrl) return null;
    
    // If it's a PNG, warn in development
    if (imageUrl.toLowerCase().endsWith('.png')) {
      console.warn(`[Social Image Warning] PNG detected for OG/Twitter image: ${imageUrl}. Consider using JPG for better social media compatibility.`);
    }
    
    return imageUrl;
  }

  // IMPORTANT: Social sharing images should be JPG for best compatibility
  const ogImageUrl = ensureSocialImageFormat(seoConfig.ogImageUrl);
  const twitterImageUrl = ensureSocialImageFormat((seoBase as any)?.twitterImageUrl);

  const seoOpenGraph = {
    url: seoConfig.canonicalBaseUrl,
    title: seoConfig.ogTitle,
    description: seoConfig.ogDescription,
    imageUrl: ogImageUrl,
    siteName: branding.siteName,
  };

  const seoTwitter = {
    card: (seoBase as any)?.twitterCard ?? null,
    handle: (seoBase as any)?.twitterHandle ?? null,
    title: (seoBase as any)?.twitterTitle ?? seoConfig.ogTitle,
    description: (seoBase as any)?.twitterDescription ?? seoConfig.ogDescription,
    imageUrl: twitterImageUrl ?? ogImageUrl,
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

  const jpegSupported = await hasEpaperJpegColumns(prisma);

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

  const pageSelect: any = {
    id: true,
    issueId: true,
    pageNumber: true,
    imageUrl: true,
    imageUrlWebp: true,
    createdAt: true,
    ...(jpegSupported ? { imageUrlJpeg: true } : {}),
  };

  const issueSelectBase: any = {
    id: true,
    tenantId: true,
    issueDate: true,
    editionId: true,
    subEditionId: true,
    pdfUrl: true,
    coverImageUrl: true,
    coverImageUrlWebp: true,
    ...(jpegSupported ? { coverImageUrlJpeg: true } : {}),
    pageCount: true,
    updatedAt: true,
    createdAt: true,
    pdfOnlyMode: true,
    pages: includePages
      ? { orderBy: { pageNumber: 'asc' }, select: pageSelect }
      : false,
  };

  let editionIssues: any[] = [];
  let subEditionIssues: any[] = [];

  if (hasDate) {
    const issues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, issueDate: issueDate as any },
      select: {
        ...issueSelectBase,
        edition: { select: { id: true, slug: true } },
        subEdition: { select: { id: true, slug: true } },
      },
    });
    editionIssues = issues.filter((it: any) => it.editionId && !it.subEditionId);
    subEditionIssues = issues.filter((it: any) => it.subEditionId && !it.editionId);
  } else {
    editionIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, editionId: { not: null }, subEditionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['editionId'],
      select: {
        ...issueSelectBase,
        edition: { select: { id: true, slug: true } },
      },
    });

    subEditionIssues = await p.epaperPdfIssue.findMany({
      where: { tenantId: tenant.id, subEditionId: { not: null }, editionId: null },
      orderBy: [{ issueDate: 'desc' }],
      distinct: ['subEditionId'],
      select: {
        ...issueSelectBase,
        subEdition: { select: { id: true, slug: true, edition: { select: { slug: true } } } },
      },
    });
  }

  const domain = (res.locals as any).domain;
  const baseUrl = `https://${domain?.domain || 'epaper.kaburlutoday.com'}`;

  // Prefer a non-WebP URL that actually exists. In our storage, coverImageUrl is typically PNG.
  // Prefer stored JPEG variants (generated at upload time) for social sharing.
  const pickOgImageJpeg = (issue: any): string | null => {
    if (!issue) return null;
    return issue.coverImageUrlJpeg || issue.coverImageUrl || issue.coverImageUrlWebp || null;
  };

  const pickPageImageJpeg = (pg: any): string | null => {
    if (!pg) return null;
    return pg.imageUrlJpeg || pg.imageUrl || pg.imageUrlWebp || null;
  };

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
            // Build ogImage with both WebP and JPEG formats
            const ogImageWebp = subIssue.coverImageUrlWebp || subIssue.coverImageUrl;
            const ogImageJpeg = pickOgImageJpeg(subIssue);
            issueMeta = {
              id: subIssue.id,
              issueDate: subIssue.issueDate,
              pdfUrl: subIssue.pdfUrl,
              coverImageUrl: subIssue.coverImageUrl,
              coverImageUrlWebp: subIssue.coverImageUrlWebp || null,
              coverImageUrlJpeg: subIssue.coverImageUrlJpeg || null,
              pageCount: subIssue.pageCount,
              pages: includePages
                ? (subIssue.pages || []).map((pg: any) => ({
                    ...pg,
                    imageUrlWebp: pg.imageUrlWebp || null,
                    imageUrlJpeg: pickPageImageJpeg(pg),
                  }))
                : undefined,
              updatedAt: subIssue.updatedAt,
              // SEO / Sharing metadata
              canonicalUrl: `${baseUrl}/epaper/${ed.slug}/${sub.slug}/${dateStr}/1`,
              metaTitle: `${sub.name} - ${ed.name} | ${displayDate}`,
              metaDescription: `Read ${sub.name} (${ed.name}) ePaper edition for ${displayDate}. ${subIssue.pageCount} pages available.`,
              ogImage: ogImageWebp,
              ogImageJpeg: ogImageJpeg,
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
        // Build ogImage with both WebP and JPEG formats
        const ogImageWebp = edIssue.coverImageUrlWebp || edIssue.coverImageUrl;
        const ogImageJpeg = pickOgImageJpeg(edIssue);
        editionIssueMeta = {
          id: edIssue.id,
          issueDate: edIssue.issueDate,
          pdfUrl: edIssue.pdfUrl,
          coverImageUrl: edIssue.coverImageUrl,
          coverImageUrlWebp: edIssue.coverImageUrlWebp || null,
          coverImageUrlJpeg: edIssue.coverImageUrlJpeg || null,
          pageCount: edIssue.pageCount,
          pages: includePages
            ? (edIssue.pages || []).map((pg: any) => ({
                ...pg,
                imageUrlWebp: pg.imageUrlWebp || null,
                imageUrlJpeg: pickPageImageJpeg(pg),
              }))
            : undefined,
          updatedAt: edIssue.updatedAt,
          // SEO / Sharing metadata
          canonicalUrl: `${baseUrl}/epaper/${ed.slug}/${dateStr}/1`,
          metaTitle: `${ed.name} | ${displayDate}`,
          metaDescription: ed.seoDescription || `Read ${ed.name} ePaper edition for ${displayDate}. ${edIssue.pageCount} pages available.`,
          ogImage: ogImageWebp,
          ogImageJpeg: ogImageJpeg,
        };
      }

      return {
        ...ed,
        // Edition-level cover images can be null in DB; fall back to issue cover image so clients always have a cover.
        coverImageUrl: ed.coverImageUrl || editionIssueMeta?.coverImageUrl || null,
        coverImageUrlWebp: (ed as any).coverImageUrlWebp || editionIssueMeta?.coverImageUrlWebp || null,
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

  const jpegSupported = await hasEpaperJpegColumns(prisma);

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

  const pageSelect: any = {
    id: true,
    issueId: true,
    pageNumber: true,
    imageUrl: true,
    imageUrlWebp: true,
    createdAt: true,
    ...(jpegSupported ? { imageUrlJpeg: true } : {}),
  };

  const issueSelect: any = {
    id: true,
    tenantId: true,
    issueDate: true,
    editionId: true,
    subEditionId: true,
    pdfUrl: true,
    coverImageUrl: true,
    coverImageUrlWebp: true,
    ...(jpegSupported ? { coverImageUrlJpeg: true } : {}),
    pageCount: true,
    updatedAt: true,
    createdAt: true,
    pdfOnlyMode: true,
    pages: { orderBy: { pageNumber: 'asc' }, select: pageSelect },
  };

  let issue: any = null;
  if (issueDateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(issueDateStr)) return res.status(400).json({ error: 'issueDate must be YYYY-MM-DD' });
    const issueDate = new Date(`${issueDateStr}T00:00:00.000Z`);
    issue = await p.epaperPdfIssue.findFirst({
      where: { ...whereTarget, issueDate },
      select: issueSelect,
    });
  } else {
    issue = await p.epaperPdfIssue.findFirst({
      where: { ...whereTarget },
      orderBy: { issueDate: 'desc' },
      select: issueSelect,
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

  // Build ogImage with both WebP and "JPEG" fallback.
  // Avoid synthesizing .jpg URLs from .webp; JPEG variants may not exist. Prefer the PNG coverImageUrl.
  const ogImageWebp = issue.coverImageUrlWebp || issue.coverImageUrl;
  const ogImageJpeg = issue.coverImageUrlJpeg || issue.coverImageUrl || ogImageWebp;

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
      coverImageUrlJpeg: issue.coverImageUrlJpeg || null,
      pageCount: issue.pageCount,
      pages: (issue.pages || []).map((pg: any) => ({
        ...pg,
        imageUrlWebp: pg.imageUrlWebp || null,
        imageUrlJpeg: pg.imageUrlJpeg || pg.imageUrl || pg.imageUrlWebp || null,
      })),
      // SEO / Sharing metadata
      canonicalUrl,
      metaTitle: `${targetName} | ${displayDate}`,
      metaDescription: `Read ${targetName} ePaper edition for ${displayDate}. ${issue.pageCount} pages available.`,
      ogImage: ogImageWebp,
      ogImageJpeg: ogImageJpeg,
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
 * LEGACY ENDPOINT - Swagger docs commented out
 * This endpoint is kept for backward compatibility but docs moved to News Website API 2.0
 * See: src/api/public/newsWebsite.routes.ts - GET /articles/:slug
 * 
 * @swagger-disabled
 * /public/articles/{slug}:
 *   get:
 *     summary: 🚀 Get complete article details with reporter info, trending & related articles
 *     description: |
 *       **ENHANCED ARTICLE DETAIL API** - Everything needed for article page in ONE call
 *       
 *       **Returns:**
 *       - ✅ Full article content (title, excerpt, highlights, blocks, HTML)
 *       - ✅ Publisher/Tenant details (name, logo, nativeName)
 *       - ✅ Reporter profile (name, photo, designation, location, total articles, last 10 articles)
 *       - ✅ Trending articles (top 15 by viewCount)
 *       - ✅ Related/Also-read articles (6 from same category)
 *       - ✅ SEO metadata (meta tags, JSON-LD)
 *       
 *       **Use Cases:**
 *       - Article detail page (complete data in 1 API call)
 *       - Reporter profile section
 *       - Trending/Related articles sidebar
 *       
 *       **Performance:** Single optimized query with parallel fetches
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
 *         description: Article slug (URL-friendly identifier)
 *       - in: query
 *         name: languageCode
 *         required: false
 *         description: Optional language code (useful when multiple locales publish the same slug).
 *         schema: { type: string, example: te }
 *     responses:
 *       200:
 *         description: Complete article details with enhanced data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 tenantId: { type: string }
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 subtitle: { type: string }
 *                 excerpt: { type: string, description: "Lead paragraph / summary" }
 *                 highlights: { type: array, items: { type: string }, description: "Key bullet points" }
 *                 tags: { type: array, items: { type: string } }
 *                 status: { type: string, enum: [published, draft, archived] }
 *                 publishedAt: { type: string, format: date-time, nullable: true }
 *                 updatedAt: { type: string, format: date-time }
 *                 isBreaking: { type: boolean, description: "Shows red BREAKING NEWS badge" }
 *                 isLive: { type: boolean, description: "Shows purple LIVE UPDATES badge" }
 *                 viewCount: { type: number, description: "Total article views with animated counter" }
 *                 shareCount: { type: number, description: "Total social media shares" }
 *                 coverImage:
 *                   type: object
 *                   nullable: true
 *                   description: |
 *                     Cover image with OG-safe URL for social sharing.
 *                     - `url`: Original image (may be WebP, for website rendering)
 *                     - `ogImageUrl`: CDN-transformed JPG/PNG (1200x630, for og:image meta tags)
 *                     - Use `ogImageUrl` for Facebook, WhatsApp, Twitter/X sharing
 *                   properties:
 *                     url: { type: string, description: "Original image URL (may be WebP)" }
 *                     ogImageUrl: { type: string, nullable: true, description: "CDN-transformed JPG/PNG URL (1200x630) for social sharing" }
 *                     alt: { type: string, description: "Alt text (article title)" }
 *                     caption: { type: string, description: "Image caption if available" }
 *                   example:
 *                     url: "https://cdn.example.com/images/article-cover.webp"
 *                     ogImageUrl: "https://cdn.example.com/images/article-cover.webp?format=jpg&width=1200&height=630&quality=85"
 *                     alt: "Top headline article"
 *                     caption: "Photo credit: News Agency"
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slug: { type: string }
 *                       name: { type: string }
 *                 blocks: { type: array, description: "Structured content sections" }
 *                 contentHtml: { type: string, description: "Full HTML content" }
 *                 plainText: { type: string, description: "Plain text version" }
 *                 readingTimeMin: { type: number }
 *                 languageCode: { type: string }
 *                 authors: { type: array }
 *                 meta:
 *                   type: object
 *                   properties:
 *                     seoTitle: { type: string }
 *                     metaDescription: { type: string }
 *                 jsonLd: { type: object, description: "Schema.org NewsArticle JSON-LD" }
 *                 audit:
 *                   type: object
 *                   properties:
 *                     createdAt: { type: string, format: date-time }
 *                     updatedAt: { type: string, format: date-time }
 *                     createdBy: { type: string }
 *                     updatedBy: { type: string }
 *                 media:
 *                   type: object
 *                   properties:
 *                     images: { type: array }
 *                     videos: { type: array }
 *                 publisher:
 *                   type: object
 *                   description: "Tenant/Publisher details"
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                     nativeName: { type: string, nullable: true }
 *                     publisherName: { type: string, nullable: true }
 *                     logoUrl: { type: string, nullable: true }
 *                 reporter:
 *                   type: object
 *                   nullable: true
 *                   description: "Reporter/Author profile details"
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string, nullable: true }
 *                     photoUrl: { type: string, nullable: true }
 *                     designation: { type: string, nullable: true }
 *                     location:
 *                       type: object
 *                       properties:
 *                         state: { type: string, nullable: true }
 *                         district: { type: string, nullable: true }
 *                         mandal: { type: string, nullable: true }
 *                     totalArticles: { type: number, description: "Total published articles by this reporter" }
 *                     recentArticles:
 *                       type: array
 *                       description: "Last 10 articles by this reporter (excluding current)"
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           slug: { type: string }
 *                           title: { type: string }
 *                           coverImageUrl: { type: string, nullable: true }
 *                           publishedAt: { type: string, format: date-time }
 *                           viewCount: { type: number }
 *                           category:
 *                             type: object
 *                             nullable: true
 *                             properties:
 *                               slug: { type: string }
 *                               name: { type: string }
 *                 mustRead:
 *                   type: object
 *                   nullable: true
 *                   description: "Top 1 must-read article (highest viewCount)"
 *                   properties:
 *                     id: { type: string }
 *                     slug: { type: string }
 *                     title: { type: string }
 *                     coverImageUrl: { type: string, nullable: true }
 *                     publishedAt: { type: string, format: date-time }
 *                     viewCount: { type: number }
 *                     category:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         slug: { type: string }
 *                         name: { type: string }
 *                 trending:
 *                   type: array
 *                   description: "Top 15 trending articles (by viewCount)"
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slug: { type: string }
 *                       title: { type: string }
 *                       coverImageUrl: { type: string, nullable: true }
 *                       publishedAt: { type: string, format: date-time }
 *                       viewCount: { type: number }
 *                       category:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           slug: { type: string }
 *                           name: { type: string }
 *                 related:
 *                   type: array
 *                   description: "Related articles (same category, up to 6)"
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       slug: { type: string }
 *                       title: { type: string }
 *                       coverImageUrl: { type: string, nullable: true }
 *                       publishedAt: { type: string, format: date-time }
 *                       viewCount: { type: number }
 *                 previousArticle:
 *                   type: object
 *                   nullable: true
 *                   description: "Previous article for navigation"
 *                   properties:
 *                     id: { type: string }
 *                     slug: { type: string }
 *                     title: { type: string }
 *                     coverImageUrl: { type: string, nullable: true }
 *                 nextArticle:
 *                   type: object
 *                   nullable: true
 *                   description: "Next article for navigation"
 *                   properties:
 *                     id: { type: string }
 *                     slug: { type: string }
 *                     title: { type: string }
 *                     coverImageUrl: { type: string, nullable: true }
 *             examples:
 *               complete:
 *                 summary: Complete article with all enhanced fields
 *                 value:
 *                   id: "cmkr68za101fnli1e8wd8sk0d"
 *                   tenantId: "cmk7e7tg401ezlp22wkz5rxky"
 *                   slug: "tech-skills-development-program"
 *                   title: "సాంకేతిక నైపుణ్యాల అభివృద్ధికి రాష్ట్ర ప్రభుత్వ చర్యలు"
 *                   subtitle: ""
 *                   excerpt: "సాంకేతిక నైపుణ్యాలను మెరుగుపర్చుకోవడం ద్వారా యువతకు ఉన్నత అవకాశాలు దక్కుతాయి"
 *                   highlights:
 *                     - "నిజామాబాద్ లో స్కిల్ డెవలప్‌మెంట్ ప్రోగ్రాం"
 *                     - "రాష్ట్ర సలహాదారులు పాల్గొన్నారు"
 *                     - "యువతకు ఉద్యోగ అవకాశాలు పెంపొందింపు"
 *                   tags: ["సాంకేతిక నైపుణ్యాలు", "రాష్ట్ర ప్రభుత్వం"]
 *                   status: "published"
 *                   publishedAt: "2026-01-23T17:45:40.247Z"
 *                   updatedAt: "2026-01-25T05:46:50.779Z"
 *                   isBreaking: false
 *                   isLive: false
 *                   viewCount: 5432
 *                   shareCount: 127
 *                   coverImage:
 *                     url: "https://kaburlu-news.b-cdn.net/example.webp"
 *                     alt: ""
 *                     caption: ""
 *                   categories:
 *                     - id: "cat123"
 *                       slug: "education"
 *                       name: "Education"
 *                   blocks: []
 *                   contentHtml: "<h1>Title</h1><p class=\"lead\">Lead...</p>"
 *                   plainText: "Title\nLead..."
 *                   readingTimeMin: 2
 *                   languageCode: "te"
 *                   authors: []
 *                   meta:
 *                     seoTitle: "Tech Skills Development"
 *                     metaDescription: "State government initiatives..."
 *                   jsonLd: {}
 *                   audit:
 *                     createdAt: "2026-01-23T17:45:40.250Z"
 *                     updatedAt: "2026-01-25T05:46:50.779Z"
 *                   media:
 *                     images: []
 *                     videos: []
 *                   publisher:
 *                     id: "cmk7e7tg401ezlp22wkz5rxky"
 *                     name: "Kaburlu Today"
 *                     nativeName: "కబుర్లు టుడే"
 *                     publisherName: "Kaburlu Media Pvt Ltd"
 *                     logoUrl: "https://kaburlu-news.b-cdn.net/logo.png"
 *                   mustRead:
 *                     id: "mustread1"
 *                     slug: "must-read-article"
 *                     title: "Top Trending Article"
 *                     coverImageUrl: "https://kaburlu-news.b-cdn.net/mustread.jpg"
 *                     publishedAt: "2026-01-25T08:00:00.000Z"
 *                     viewCount: 8542
 *                     category:
 *                       slug: "breaking"
 *                       name: "Breaking News"
 *                   reporter:
 *                     id: "cmk74muz0007jugy4h1t9xllm"
 *                     name: "రాజేష్ కుమార్"
 *                     photoUrl: "https://kaburlu-news.b-cdn.net/reporter.jpg"
 *                     designation: "Senior Reporter"
 *                     location:
 *                       state: "Telangana"
 *                       district: "Nizamabad"
 *                       mandal: "Nizamabad Urban"
 *                     totalArticles: 247
 *                     recentArticles:
 *                       - id: "abc123"
 *                         slug: "previous-article-1"
 *                         title: "Previous Article"
 *                         coverImageUrl: "https://..."
 *                         publishedAt: "2026-01-22T10:30:00.000Z"
 *                         viewCount: 1523
 *                         category:
 *                           slug: "politics"
 *                           name: "Politics"
 *                   trending:
 *                     - id: "trend1"
 *                       slug: "trending-1"
 *                       title: "Trending Article"
 *                       coverImageUrl: "https://..."
 *                       publishedAt: "2026-01-24T15:00:00.000Z"
 *                       viewCount: 5234
 *                       category:
 *                         slug: "news"
 *                         name: "News"
 *                   related:
 *                     - id: "rel1"
 *                       slug: "related-1"
 *                       title: "Related Article"
 *                       coverImageUrl: "https://..."
 *                       publishedAt: "2026-01-23T12:00:00.000Z"
 *                       viewCount: 823
 *                   previousArticle:
 *                     id: "prev-art-123"
 *                     slug: "previous-news-article"
 *                     title: "మునుపటి వార్త టైటిల్"
 *                     coverImageUrl: "https://cdn.example.com/prev.jpg"
 *                   nextArticle:
 *                     id: "next-art-456"
 *                     slug: "next-news-article"
 *                     title: "తరువాతి వార్త టైటిల్"
 *                     coverImageUrl: "https://cdn.example.com/next.jpg"
 *       404:
 *         description: Article not found
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

  const [a, tenantTheme, tenantEntity] = await Promise.all([
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
      viewCount: true,
      isBreaking: true,
      isLive: true,
      shareCount: true,
      previousArticleId: true,
      nextArticleId: true,
      category: { select: { id: true, slug: true, name: true } },
      author: {
        select: {
          id: true,
          mobileNumber: true,
          profile: {
            select: {
              fullName: true,
              profilePhotoUrl: true
            }
          }
        }
      }
    }
  }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.tenantEntity?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null)
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

  // ============================================================
  // OPTIMIZED: Fetch all additional data in parallel using Promise.all
  // This replaces the sequential queries that were causing slow response
  // ============================================================
  const authorId = (a as any)?.authorId;
  const categoryId = (a as any)?.category?.id;
  const articlePublishedAt = (a as any).publishedAt;

  // Define all parallel queries
  const parallelQueries = await Promise.all([
    // [0] Reporter details (if authorId exists)
    authorId
      ? p.reporter.findFirst({
          where: { userId: authorId, tenantId: tenant.id },
          select: {
            id: true,
            designation: true,
            state: { select: { name: true } },
            district: { select: { name: true } },
            mandal: { select: { name: true } },
            user: {
              select: {
                id: true,
                mobileNumber: true,
                profile: { select: { fullName: true, profilePhotoUrl: true } }
              }
            }
          }
        }).catch(() => null)
      : Promise.resolve(null),

    // [1] Reporter's total article count
    authorId
      ? p.tenantWebArticle.count({
          where: { tenantId: tenant.id, authorId, status: 'PUBLISHED' }
        }).catch(() => 0)
      : Promise.resolve(0),

    // [2] Reporter's last 10 articles
    authorId
      ? p.tenantWebArticle.findMany({
          where: { tenantId: tenant.id, authorId, status: 'PUBLISHED', id: { not: a.id } },
          orderBy: { publishedAt: 'desc' },
          take: 10,
          select: {
            id: true, slug: true, title: true, coverImageUrl: true,
            publishedAt: true, viewCount: true,
            category: { select: { slug: true, name: true } }
          }
        }).catch(() => [])
      : Promise.resolve([]),

    // [3] Trending articles (top 15 by viewCount) - includes mustRead as first item
    p.tenantWebArticle.findMany({
      where: { tenantId: tenant.id, status: 'PUBLISHED', id: { not: a.id }, ...domainScope },
      orderBy: { viewCount: 'desc' },
      take: 15,
      select: {
        id: true, slug: true, title: true, coverImageUrl: true,
        publishedAt: true, viewCount: true,
        category: { select: { slug: true, name: true } }
      }
    }).catch(() => []),

    // [4] Related articles (same category, recent)
    categoryId
      ? p.tenantWebArticle.findMany({
          where: { tenantId: tenant.id, categoryId, status: 'PUBLISHED', id: { not: a.id }, ...domainScope },
          orderBy: { publishedAt: 'desc' },
          take: 6,
          select: { id: true, slug: true, title: true, coverImageUrl: true, publishedAt: true, viewCount: true }
        }).catch(() => [])
      : Promise.resolve([]),

    // [5] Previous article (older, published before current)
    articlePublishedAt
      ? p.tenantWebArticle.findFirst({
          where: { tenantId: tenant.id, status: 'PUBLISHED', publishedAt: { lt: articlePublishedAt }, ...domainScope },
          orderBy: { publishedAt: 'desc' },
          select: { id: true, slug: true, title: true, coverImageUrl: true }
        }).catch(() => null)
      : Promise.resolve(null),

    // [6] Next article (newer, published after current)
    articlePublishedAt
      ? p.tenantWebArticle.findFirst({
          where: { tenantId: tenant.id, status: 'PUBLISHED', publishedAt: { gt: articlePublishedAt }, ...domainScope },
          orderBy: { publishedAt: 'asc' },
          select: { id: true, slug: true, title: true, coverImageUrl: true }
        }).catch(() => null)
      : Promise.resolve(null),
  ]);

  // Destructure parallel query results
  const [
    reporter,
    reporterTotalCount,
    reporterLastArticles,
    trendingRaw,
    relatedRaw,
    prevArt,
    nextArt
  ] = parallelQueries;

  // Build reporter details
  let reporterDetails = null;
  if (reporter) {
    reporterDetails = {
      id: (reporter as any).user?.id,
      name: (reporter as any).user?.profile?.fullName || null,
      photoUrl: (reporter as any).user?.profile?.profilePhotoUrl || null,
      designation: (reporter as any).designation || null,
      location: {
        state: (reporter as any).state?.name || null,
        district: (reporter as any).district?.name || null,
        mandal: (reporter as any).mandal?.name || null
      },
      totalArticles: reporterTotalCount || 0,
      recentArticles: ((reporterLastArticles || []) as any[]).map((art: any) => ({
        id: art.id,
        slug: art.slug,
        title: art.title,
        coverImageUrl: art.coverImageUrl,
        publishedAt: art.publishedAt,
        viewCount: art.viewCount || 0,
        category: art.category ? { slug: art.category.slug, name: art.category.name } : null
      }))
    };
  }

  // Format trending articles (first one is mustRead)
  const trendingArticles = ((trendingRaw || []) as any[]).map((art: any) => ({
    id: art.id,
    slug: art.slug,
    title: art.title,
    coverImageUrl: art.coverImageUrl,
    publishedAt: art.publishedAt,
    viewCount: art.viewCount || 0,
    category: art.category ? { slug: art.category.slug, name: art.category.name } : null
  }));

  // mustRead is the first trending article
  const mustReadArticle = trendingArticles.length > 0 ? trendingArticles[0] : null;

  // Format related articles
  const relatedArticles = ((relatedRaw || []) as any[]).map((art: any) => ({
    id: art.id,
    slug: art.slug,
    title: art.title,
    coverImageUrl: art.coverImageUrl,
    publishedAt: art.publishedAt,
    viewCount: art.viewCount || 0
  }));

  // Format previous/next articles
  const previousArticle = prevArt ? {
    id: (prevArt as any).id,
    slug: (prevArt as any).slug,
    title: (prevArt as any).title,
    coverImageUrl: (prevArt as any).coverImageUrl
  } : null;

  const nextArticle = nextArt ? {
    id: (nextArt as any).id,
    slug: (nextArt as any).slug,
    title: (nextArt as any).title,
    coverImageUrl: (nextArt as any).coverImageUrl
  } : null;

  // Publisher/Tenant details
  const publisher = {
    id: tenant.id,
    name: tenantDisplayName,
    nativeName: (tenantEntity as any)?.nativeName || null,
    publisherName: (tenantEntity as any)?.publisherName || null,
    logoUrl: publisherLogoUrl
  };

  // Add all enhanced fields to response
  detail.publisher = publisher;
  detail.reporter = reporterDetails;
  detail.mustRead = mustReadArticle;
  detail.trending = trendingArticles;
  detail.related = relatedArticles;
  detail.isBreaking = (a as any).isBreaking || false;
  detail.isLive = (a as any).isLive || false;
  detail.shareCount = (a as any).shareCount || 0;
  detail.previousArticle = previousArticle;
  detail.nextArticle = nextArticle;

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  res.json(detail);
});

/**
 * @swagger
 * /public/article/{slug}:
 *   get:
 *     summary: Get SEO-optimized article with full reporter details and media
 *     description: |
 *       Returns a complete article with comprehensive SEO metadata, structured data,
 *       reporter/author profile with fallback to brand logo, and all media assets.
 *       Ideal for news website article detail pages.
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Article slug or ID
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *         description: Language code (e.g., te, en, hi)
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema:
 *           type: string
 *         description: Domain override for testing
 *     responses:
 *       200:
 *         description: Full SEO-optimized article response
 *         content:
 *           application/json:
 *             example:
 *               status: "ok"
 *               article:
 *                 id: "cmkr42x2t01fkli1xll9tqaxr"
 *                 slug: "hyderabad-metro-fare-hike"
 *                 headline: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు"
 *                 subheadline: "ఫిబ్రవరి 1 నుంచి అమలు"
 *                 content_html: "<p>హైదరాబాద్ మెట్రో రైలు ఛార్జీలు...</p>"
 *                 language: "te"
 *                 category:
 *                   id: "metro"
 *                   name: "మెట్రో న్యూస్"
 *                   slug: "metro-news"
 *                 dateline:
 *                   place: "హైదరాబాద్"
 *                   published_at: "2026-01-27T09:30:00+05:30"
 *                   updated_at: "2026-01-27T10:10:00+05:30"
 *                 author:
 *                   name: "స్టాఫ్ రిపోర్టర్"
 *                   designation: "Senior Reporter"
 *                   location: "హైదరాబాద్, తెలంగాణ"
 *                   photo_url: "https://cdn.site.com/reporter.webp"
 *                 images:
 *                   cover:
 *                     url: "https://cdn.site.com/articles/metro.webp"
 *                     width: 1200
 *                     height: 630
 *                     alt: "హైదరాబాద్ మెట్రో రైలు"
 *                   inline: []
 *                 seo:
 *                   title: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు | Aksharam Voice"
 *                   description: "ఫిబ్రవరి 1 నుంచి హైదరాబాద్ మెట్రో ఛార్జీల పెంపు అమలు"
 *                   keywords: ["Hyderabad Metro", "Metro Fare Hike"]
 *                 og:
 *                   title: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు"
 *                   description: "మెట్రో ప్రయాణికులకు కీలక సమాచారం"
 *                   image: "https://cdn.site.com/articles/metro-og.webp"
 *                 publisher:
 *                   name: "Aksharam Voice"
 *                   logo_url: "https://cdn.site.com/logo.webp"
 *               related_articles: []
 *       404:
 *         description: Article not found
 */
router.get('/article/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slugRaw = String(req.params.slug);
  const slug = (() => {
    try { return decodeURIComponent(slugRaw); } catch { return slugRaw; }
  })();
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  // Fetch domain configuration
  const [domainCats, domainLangs] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));
  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };

  // Language filter
  let languageIdFilter: string | undefined;
  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!match) return res.status(404).json({ error: 'Language not supported for this domain' });
    languageIdFilter = match.languageId;
  }

  const and: any[] = [domainScope];
  if (languageIdFilter) {
    and.push({ languageId: languageIdFilter });
  } else if (allowedLanguageIds.size) {
    and.push({ OR: [{ languageId: { in: Array.from(allowedLanguageIds) } }, { languageId: null }] });
  }
  if (allowedCategoryIds.size) {
    and.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
    OR: [{ slug }, { id: slug }]
  };

  // Fetch article with all relations
  const [article, tenantTheme, tenantEntity] = await Promise.all([
    p.tenantWebArticle.findFirst({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        language: { select: { code: true, name: true } },
        category: { select: { id: true, slug: true, name: true } },
        author: {
          select: {
            id: true,
            mobileNumber: true,
            profile: { select: { fullName: true, profilePhotoUrl: true } },
            reporterProfile: {
              select: {
                id: true,
                profilePhotoUrl: true,
                designation: { select: { id: true, name: true, nativeName: true } },
                state: { select: { id: true, name: true } },
                district: { select: { id: true, name: true } },
                mandal: { select: { id: true, name: true } },
              }
            }
          }
        }
      }
    }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.tenantEntity?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  if (!article) return res.status(404).json({ error: 'Not found' });

  // Fire-and-forget view count increment
  void p.tenantWebArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => null);

  // Extract content and images from contentJson
  const contentJson = article.contentJson || {};
  const coverImage = (contentJson as any).coverImage || null;
  const inlineMedia = Array.isArray((contentJson as any).media) ? (contentJson as any).media : [];
  const contentHtml = (contentJson as any).html || (contentJson as any).content || '';
  const subheadline = (contentJson as any).subheadline || (contentJson as any).subtitle || null;

  // Build author/reporter details with fallback to brand logo
  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;
  const tenantNativeName = (tenantEntity as any)?.nativeName || null;

  const authorUser = article.author;
  const reporter = authorUser?.reporterProfile;
  
  let authorDetails: any = {
    name: `${tenantDisplayName} Reporter`,
    slug: 'staff-reporter',
    designation: null,
    location: null,
    photo_url: brandLogoUrl, // fallback to brand logo
  };

  if (authorUser) {
    const reporterName = authorUser.profile?.fullName || null;
    const reporterPhoto = reporter?.profilePhotoUrl || authorUser.profile?.profilePhotoUrl || null;
    const designation = reporter?.designation;
    
    // Build location string
    const locationParts: string[] = [];
    if (reporter?.mandal?.name) locationParts.push(reporter.mandal.name);
    if (reporter?.district?.name) locationParts.push(reporter.district.name);
    if (reporter?.state?.name) locationParts.push(reporter.state.name);
    const locationStr = locationParts.length > 0 ? locationParts.join(', ') : null;

    authorDetails = {
      name: reporterName || `${tenantDisplayName} Reporter`,
      slug: reporterName ? reporterName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : 'staff-reporter',
      designation: designation ? (designation.nativeName || designation.name) : null,
      location: locationStr,
      photo_url: reporterPhoto || brandLogoUrl, // fallback to brand logo if no profile photo
    };
  }

  // Build images object
  const images: any = {
    cover: coverImage ? {
      url: coverImage.url || article.coverImageUrl,
      width: coverImage.w || coverImage.width || 1200,
      height: coverImage.h || coverImage.height || 630,
      alt: coverImage.alt || article.title,
    } : (article.coverImageUrl ? {
      url: article.coverImageUrl,
      width: 1200,
      height: 630,
      alt: article.title,
    } : null),
    inline: inlineMedia.map((m: any) => ({
      url: m.url,
      alt: m.alt || m.caption || article.title,
      caption: m.caption || null,
      type: m.type || 'image',
    })),
  };

  // Build SEO object
  const canonicalUrl = `https://${domain.domain}/${article.language?.code || 'te'}/article/${article.slug}`;
  const seo = {
    title: article.seoTitle || `${article.title} | ${tenantDisplayName}`,
    description: article.metaDescription || article.title,
    keywords: Array.isArray(article.tags) ? article.tags : [],
    canonical_url: canonicalUrl,
  };

  // Build Open Graph object
  const og = {
    title: article.seoTitle || article.title,
    description: article.metaDescription || article.title,
    image: images.cover?.url || brandLogoUrl,
    type: 'article',
    url: canonicalUrl,
  };

  // Build dateline
  const dateline = {
    place: authorDetails.location?.split(',')[0]?.trim() || null,
    published_at: article.publishedAt?.toISOString() || article.createdAt.toISOString(),
    updated_at: article.updatedAt.toISOString(),
  };

  // Fetch related articles (same category, excluding current)
  const relatedArticles = article.categoryId
    ? await p.tenantWebArticle.findMany({
        where: {
          tenantId: tenant.id,
          categoryId: article.categoryId,
          status: 'PUBLISHED',
          id: { not: article.id },
          ...domainScope,
        },
        orderBy: { publishedAt: 'desc' },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          publishedAt: true,
        },
      }).catch(() => [])
    : [];

  // Build JSON-LD structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: seo.description,
    image: images.cover?.url ? [images.cover.url] : [],
    datePublished: dateline.published_at,
    dateModified: dateline.updated_at,
    author: {
      '@type': 'Person',
      name: authorDetails.name,
      image: authorDetails.photo_url,
    },
    publisher: {
      '@type': 'Organization',
      name: tenantDisplayName,
      logo: {
        '@type': 'ImageObject',
        url: brandLogoUrl,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    articleSection: article.category?.name || null,
    keywords: seo.keywords.join(', '),
    inLanguage: article.language?.code || 'te',
  };

  // Build response in reference format
  const response = {
    status: 'ok',
    article: {
      id: article.id,
      slug: article.slug,
      headline: article.title,
      subheadline,
      content_html: contentHtml,
      language: article.language?.code || 'te',
      category: article.category ? {
        id: article.category.id,
        name: article.category.name,
        slug: article.category.slug,
      } : null,
      dateline,
      author: authorDetails,
      images,
      seo,
      og,
      jsonLd,
      viewCount: article.viewCount || 0,
      shareCount: article.shareCount || 0,
      isBreaking: article.isBreaking || false,
      isLive: article.isLive || false,
      tags: article.tags || [],
    },
    publisher: {
      id: tenant.id,
      name: tenantDisplayName,
      native_name: tenantNativeName,
      logo_url: brandLogoUrl,
    },
    related_articles: relatedArticles.map((ra: any) => ({
      id: ra.id,
      slug: ra.slug,
      headline: ra.title,
      cover_image_url: ra.coverImageUrl,
      published_at: ra.publishedAt?.toISOString(),
    })),
  };

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  res.json(response);
});

/**
 * @swagger
 * /public/webarticle/{slug}:
 *   get:
 *     summary: Get full SEO-optimized article by slug (alias endpoint)
 *     description: |
 *       Returns a complete article with SEO metadata, author info, related articles, and structured data.
 *       This is an alias for /public/article/:slug for frontend convenience.
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Article slug or ID
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema:
 *           type: string
 *         description: Domain override for testing
 *     responses:
 *       200:
 *         description: Full SEO-optimized article response
 *         content:
 *           application/json:
 *             example:
 *               status: "ok"
 *               article:
 *                 id: "cmkr42x2t01fkli1xll9tqaxr"
 *                 slug: "hyderabad-metro-fare-hike"
 *                 headline: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు"
 *                 subheadline: "ఫిబ్రవరి 1 నుంచి అమలు"
 *                 content_html: "<p>హైదరాబాద్ మెట్రో రైలు ఛార్జీలు...</p>"
 *                 language: "te"
 *                 category:
 *                   id: "metro"
 *                   name: "మెట్రో న్యూస్"
 *                   slug: "metro-news"
 *                 dateline:
 *                   place: "హైదరాబాద్"
 *                   published_at: "2026-01-27T09:30:00+05:30"
 *                   updated_at: "2026-01-27T10:10:00+05:30"
 *                 author:
 *                   name: "స్టాఫ్ రిపోర్టర్"
 *                   designation: "Senior Reporter"
 *                   location: "హైదరాబాద్, తెలంగాణ"
 *                   photo_url: "https://cdn.site.com/reporter.webp"
 *                 images:
 *                   cover:
 *                     url: "https://cdn.site.com/articles/metro.webp"
 *                     width: 1200
 *                     height: 630
 *                     alt: "హైదరాబాద్ మెట్రో రైలు"
 *                   inline: []
 *                 seo:
 *                   title: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు | Aksharam Voice"
 *                   description: "ఫిబ్రవరి 1 నుంచి హైదరాబాద్ మెట్రో ఛార్జీల పెంపు అమలు"
 *                   keywords: ["Hyderabad Metro", "Metro Fare Hike"]
 *                 og:
 *                   title: "హైదరాబాద్ మెట్రో ఛార్జీల పెంపు"
 *                   description: "మెట్రో ప్రయాణికులకు కీలక సమాచారం"
 *                   image: "https://cdn.site.com/articles/metro-og.webp"
 *                 publisher:
 *                   name: "Aksharam Voice"
 *                   logo_url: "https://cdn.site.com/logo.webp"
 *               related_articles: []
 *       404:
 *         description: Article not found
 */
router.get('/webarticle/:slug', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slugRaw = String(req.params.slug);
  const slug = (() => {
    try { return decodeURIComponent(slugRaw); } catch { return slugRaw; }
  })();

  // Fetch domain configuration
  const [domainCats, domainLangs] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
  ]);
  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  const allowedLanguageIds = new Set(domainLangs.map((d: any) => d.languageId));
  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };

  const and: any[] = [domainScope];
  if (allowedLanguageIds.size) {
    and.push({ OR: [{ languageId: { in: Array.from(allowedLanguageIds) } }, { languageId: null }] });
  }
  if (allowedCategoryIds.size) {
    and.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
    OR: [{ slug }, { id: slug }],
  };

  const article = await p.tenantWebArticle.findFirst({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: {
      category: { select: { id: true, slug: true, name: true } },
      language: { select: { code: true } },
      author: {
        select: {
          id: true,
          profile: { select: { fullName: true, profilePhotoUrl: true, bio: true } },
        },
      },
    },
  });

  if (!article) return res.status(404).json({ error: 'Not found' });

  // Increment view count (fire and forget)
  p.tenantWebArticle.update({ where: { id: article.id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  // Extract content
  const contentJson = article.contentJson || {};
  const contentHtml = (contentJson as any).contentHtml || (contentJson as any).content || '';
  const subheadline = (contentJson as any).subheadline || (contentJson as any).subtitle || (contentJson as any).excerpt || null;

  // Author details
  const authorName = article.author?.profile?.fullName || 'Staff Reporter';
  const authorPhotoUrl = article.author?.profile?.profilePhotoUrl || null;
  const authorBio = article.author?.profile?.bio || null;

  // Dateline
  const dateline = {
    place: (contentJson as any).placeName || null,
    published_at: article.publishedAt?.toISOString() || article.createdAt.toISOString(),
    updated_at: article.updatedAt.toISOString(),
  };

  // Helper: Convert WebP URL to JPG for better OG sharing compatibility
  const getOgImageUrl = (url: string | null): string | null => {
    if (!url) return null;
    // Replace .webp extension with .jpg for OG images (better platform compatibility)
    if (url.toLowerCase().endsWith('.webp')) {
      return url.replace(/\.webp$/i, '.jpg');
    }
    return url;
  };

  // Images
  const coverImage = article.coverImageUrl ? {
    url: article.coverImageUrl,
    width: 1200,
    height: 630,
    alt: article.title,
  } : null;
  const inlineImages = Array.isArray((contentJson as any).images) ? (contentJson as any).images : [];

  // SEO
  const seo = {
    title: article.seoTitle || article.title,
    description: article.metaDescription || subheadline || '',
    keywords: article.tags || [],
  };

  // OG (use JPG for better sharing compatibility)
  const og = {
    title: article.seoTitle || article.title,
    description: article.metaDescription || subheadline || '',
    image: getOgImageUrl(article.coverImageUrl),
  };

  // Tenant branding
  const tenantEntity = await p.tenant.findUnique({
    where: { id: tenant.id },
    select: { 
      name: true, 
      settings: { select: { data: true } },
      theme: { select: { logoUrl: true } },
      entity: { select: { nativeName: true } }
    },
  });
  const settingsData = (tenantEntity?.settings?.data as any) || {};
  const tenantDisplayName = settingsData.displayName || tenantEntity?.name || 'News';
  const tenantNativeName = tenantEntity?.entity?.nativeName || settingsData.nativeName || tenantDisplayName;
  const brandLogoUrl = tenantEntity?.theme?.logoUrl || settingsData.logoUrl || null;

  // Related articles
  const relatedArticles = article.categoryId
    ? await p.tenantWebArticle.findMany({
        where: {
          tenantId: tenant.id,
          categoryId: article.categoryId,
          status: 'PUBLISHED',
          id: { not: article.id },
        },
        take: 5,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          slug: true,
          title: true,
          coverImageUrl: true,
          publishedAt: true,
        },
      }).catch(() => [])
    : [];

  // Build response
  const response = {
    status: 'ok',
    article: {
      id: article.id,
      slug: article.slug,
      headline: article.title,
      subheadline,
      content_html: contentHtml,
      language: article.language?.code || 'te',
      category: article.category ? {
        id: article.category.id,
        name: article.category.name,
        slug: article.category.slug,
      } : null,
      dateline,
      author: {
        name: authorName,
        photo_url: authorPhotoUrl,
        bio: authorBio,
      },
      images: {
        cover: coverImage,
        inline: inlineImages,
      },
      seo,
      og,
      viewCount: article.viewCount || 0,
      shareCount: article.shareCount || 0,
      isBreaking: article.isBreaking || false,
      isLive: article.isLive || false,
      tags: article.tags || [],
    },
    publisher: {
      id: tenant.id,
      name: tenantDisplayName,
      native_name: tenantNativeName,
      logo_url: brandLogoUrl,
    },
    related_articles: relatedArticles.map((ra: any) => ({
      id: ra.id,
      slug: ra.slug,
      headline: ra.title,
      cover_image_url: ra.coverImageUrl,
      published_at: ra.publishedAt?.toISOString(),
    })),
  };

  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
  res.json(response);
});

/**
 * @swagger
 * /public/category/{categorySlug}/articles:
 *   get:
 *     summary: Get articles by category slug with SEO-friendly format
 *     description: Returns paginated articles for a specific category with full metadata
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: path
 *         name: categorySlug
 *         required: true
 *         schema:
 *           type: string
 *         description: Category slug
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *         description: Language code (e.g., te, en, hi)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Items per page (max 50)
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema:
 *           type: string
 *         description: Domain override for testing
 *     responses:
 *       200:
 *         description: Category articles with pagination
 *       404:
 *         description: Category not found
 */
router.get('/category/:categorySlug/articles', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const categorySlug = String(req.params.categorySlug);
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));
  const skip = (page - 1) * limit;

  // Find category by slug
  const category = await p.category.findFirst({
    where: { slug: categorySlug },
    select: { id: true, slug: true, name: true },
  });
  if (!category) return res.status(404).json({ error: 'Category not found' });

  // Get domain configuration
  const [domainCats, domainLangs, tenantTheme] = await Promise.all([
    p.domainCategory.findMany({ where: { domainId: domain.id } }),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  const allowedCategoryIds = new Set(domainCats.map((d: any) => d.categoryId));
  
  // Check if category is allowed for this domain
  if (allowedCategoryIds.size > 0 && !allowedCategoryIds.has(category.id)) {
    return res.status(404).json({ error: 'Category not available for this domain' });
  }

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };

  // Language filter
  let languageIdFilter: string | undefined;
  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (!match) return res.status(404).json({ error: 'Language not supported for this domain' });
    languageIdFilter = match.languageId;
  }

  const and: any[] = [domainScope];
  if (languageIdFilter) {
    and.push({ languageId: languageIdFilter });
  }

  const where: any = {
    tenantId: tenant.id,
    categoryId: category.id,
    status: 'PUBLISHED',
    AND: and,
  };

  // Fetch articles and count
  const [articles, totalCount] = await Promise.all([
    p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      include: {
        language: { select: { code: true } },
        author: {
          select: {
            profile: { select: { fullName: true, profilePhotoUrl: true } },
            reporterProfile: {
              select: {
                profilePhotoUrl: true,
                designation: { select: { name: true, nativeName: true } },
              }
            }
          }
        }
      }
    }),
    p.tenantWebArticle.count({ where }),
  ]);

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;

  // Format articles
  const formattedArticles = articles.map((a: any) => {
    const authorUser = a.author;
    const reporter = authorUser?.reporterProfile;
    const reporterName = authorUser?.profile?.fullName || null;
    const reporterPhoto = reporter?.profilePhotoUrl || authorUser?.profile?.profilePhotoUrl || brandLogoUrl;
    const designation = reporter?.designation;

    return {
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl,
      published_at: a.publishedAt?.toISOString() || a.createdAt.toISOString(),
      language: a.language?.code || 'te',
      author: {
        name: reporterName || `${tenantDisplayName} Reporter`,
        photo_url: reporterPhoto,
        designation: designation ? (designation.nativeName || designation.name) : null,
      },
      view_count: a.viewCount || 0,
      is_breaking: a.isBreaking || false,
    };
  });

  const totalPages = Math.ceil(totalCount / limit);

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json({
    status: 'ok',
    category: {
      id: category.id,
      slug: category.slug,
      name: category.name,
    },
    articles: formattedArticles,
    pagination: {
      page,
      limit,
      total_count: totalCount,
      total_pages: totalPages,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
    publisher: {
      id: tenant.id,
      name: tenantDisplayName,
      logo_url: brandLogoUrl,
    },
  });
});

// ============================================================
// ARTICLE PAGE LAYOUT APIs
// Side Column: Latest, Must Read
// Bottom Section: Related, By Location, Trending
// ============================================================

/**
 * @swagger
 * /public/articles/latest:
 *   get:
 *     summary: Get latest articles for sidebar (freshness signal)
 *     description: |
 *       Returns the most recent published articles for the sidebar.
 *       Ideal for "Latest News" section on article pages.
 *       Position: Side column - TOP
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 7
 *         description: Number of articles (5-10 recommended)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *         description: Language code (e.g., te, en)
 *       - in: query
 *         name: excludeSlug
 *         schema:
 *           type: string
 *         description: Exclude current article by slug
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Latest articles list
 */
router.get('/articles/latest', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const limit = Math.min(15, Math.max(1, parseInt(String(req.query.limit || '7'), 10)));
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;
  const excludeSlug = req.query.excludeSlug ? String(req.query.excludeSlug) : undefined;

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
  };

  if (excludeSlug) {
    where.slug = { not: excludeSlug };
  }

  const articles = await p.tenantWebArticle.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      createdAt: true,
      viewCount: true,
      isBreaking: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
  res.json({
    status: 'ok',
    section: 'latest',
    position: 'side-top',
    articles: articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl || brandLogoUrl,
      published_at: (a.publishedAt || a.createdAt)?.toISOString(),
      view_count: a.viewCount || 0,
      is_breaking: a.isBreaking || false,
      category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
    })),
  });
});

/**
 * @swagger
 * /public/articles/must-read:
 *   get:
 *     summary: Get must-read / editor picks for sidebar
 *     description: |
 *       Returns high-engagement articles (by view count) for editor picks.
 *       Ideal for "Must Read" section on article pages.
 *       Position: Side column - MIDDLE
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of articles (3-5 recommended)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *       - in: query
 *         name: excludeSlug
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Must-read articles list
 */
router.get('/articles/must-read', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit || '5'), 10)));
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;
  const excludeSlug = req.query.excludeSlug ? String(req.query.excludeSlug) : undefined;

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  // Must-read: High view count articles from last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    publishedAt: { gte: sevenDaysAgo },
    viewCount: { gte: 10 }, // Minimum engagement threshold
    AND: and,
  };

  if (excludeSlug) {
    where.slug = { not: excludeSlug };
  }

  const articles = await p.tenantWebArticle.findMany({
    where,
    orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      viewCount: true,
      isBreaking: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;

  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  res.json({
    status: 'ok',
    section: 'must-read',
    position: 'side-middle',
    articles: articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl || brandLogoUrl,
      published_at: a.publishedAt?.toISOString(),
      view_count: a.viewCount || 0,
      is_breaking: a.isBreaking || false,
      category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
    })),
  });
});

/**
 * @swagger
 * /public/articles/related:
 *   get:
 *     summary: Get related articles for bottom section (same category/topic)
 *     description: |
 *       Returns articles from the same category as the current article.
 *       Ideal for "Related Articles" / "ఇంకా ఈ వార్తలు" section.
 *       Position: Bottom section - TOP
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Current article slug to find related articles
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 6
 *         description: Number of articles (4-6 recommended)
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Related articles list
 */
router.get('/articles/related', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slug = req.query.slug ? String(req.query.slug) : null;
  if (!slug) return res.status(400).json({ error: 'slug parameter is required' });

  const limit = Math.min(12, Math.max(1, parseInt(String(req.query.limit || '6'), 10)));
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  // Find the current article to get its category and tags
  const currentArticle = await p.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id, OR: [{ slug }, { id: slug }] },
    select: { id: true, categoryId: true, tags: true },
  });

  if (!currentArticle) return res.status(404).json({ error: 'Article not found' });

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  // Related: Same category, excluding current article
  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    id: { not: currentArticle.id },
    AND: and,
  };

  // Prioritize same category
  if (currentArticle.categoryId) {
    where.categoryId = currentArticle.categoryId;
  }

  const articles = await p.tenantWebArticle.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      viewCount: true,
      category: { select: { slug: true, name: true } },
      author: {
        select: {
          profile: { select: { fullName: true, profilePhotoUrl: true } },
        },
      },
    },
  });

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json({
    status: 'ok',
    section: 'related',
    position: 'bottom-top',
    articles: articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl || brandLogoUrl,
      published_at: a.publishedAt?.toISOString(),
      view_count: a.viewCount || 0,
      category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
      author: {
        name: a.author?.profile?.fullName || `${tenantDisplayName} Reporter`,
        photo_url: a.author?.profile?.profilePhotoUrl || brandLogoUrl,
      },
    })),
  });
});

/**
 * @swagger
 * /public/articles/by-location:
 *   get:
 *     summary: Get articles by location (district/mandal) for local news
 *     description: |
 *       Returns articles from the same district or mandal.
 *       Ideal for "Hyderabad lo inka ee vaarthalu" section.
 *       Position: Bottom section - MIDDLE
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *         description: District ID
 *       - in: query
 *         name: districtName
 *         schema:
 *           type: string
 *         description: District name (alternative to ID)
 *       - in: query
 *         name: mandalId
 *         schema:
 *           type: string
 *         description: Mandal ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *       - in: query
 *         name: excludeSlug
 *         schema:
 *           type: string
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Location-based articles
 */
router.get('/articles/by-location', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const districtId = req.query.districtId ? String(req.query.districtId) : undefined;
  const districtName = req.query.districtName ? String(req.query.districtName) : undefined;
  const mandalId = req.query.mandalId ? String(req.query.mandalId) : undefined;
  const excludeSlug = req.query.excludeSlug ? String(req.query.excludeSlug) : undefined;
  const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit || '4'), 10)));
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  if (!districtId && !districtName && !mandalId) {
    return res.status(400).json({ error: 'districtId, districtName, or mandalId is required' });
  }

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  // Resolve district if name provided
  let resolvedDistrictId = districtId;
  let resolvedDistrictName = districtName;
  if (districtName && !districtId) {
    const district = await p.district.findFirst({
      where: { name: { contains: districtName, mode: 'insensitive' } },
      select: { id: true, name: true },
    });
    if (district) {
      resolvedDistrictId = district.id;
      resolvedDistrictName = district.name;
    }
  } else if (districtId) {
    const district = await p.district.findUnique({
      where: { id: districtId },
      select: { name: true },
    });
    resolvedDistrictName = district?.name || districtName;
  }

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  // Search articles by location in contentJson or tags
  // Articles typically store location info in contentJson.location or tags
  const locationFilter: any[] = [];

  if (resolvedDistrictId) {
    locationFilter.push({
      contentJson: { path: ['location', 'districtId'], equals: resolvedDistrictId },
    });
  }
  if (resolvedDistrictName) {
    locationFilter.push({
      tags: { has: resolvedDistrictName },
    });
    locationFilter.push({
      tags: { has: resolvedDistrictName.toLowerCase() },
    });
  }
  if (mandalId) {
    locationFilter.push({
      contentJson: { path: ['location', 'mandalId'], equals: mandalId },
    });
  }

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    AND: and,
  };

  if (locationFilter.length > 0) {
    where.OR = locationFilter;
  }

  if (excludeSlug) {
    where.slug = { not: excludeSlug };
  }

  const articles = await p.tenantWebArticle.findMany({
    where,
    orderBy: [{ publishedAt: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      viewCount: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;

  res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
  res.json({
    status: 'ok',
    section: 'by-location',
    position: 'bottom-middle',
    location: {
      district_id: resolvedDistrictId || null,
      district_name: resolvedDistrictName || null,
      mandal_id: mandalId || null,
    },
    articles: articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl || brandLogoUrl,
      published_at: a.publishedAt?.toISOString(),
      view_count: a.viewCount || 0,
      category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
    })),
  });
});

/**
 * @swagger
 * /public/articles/trending:
 *   get:
 *     summary: Get trending articles (traffic-based)
 *     description: |
 *       Returns articles sorted by view count (real engagement).
 *       Use carefully - only for high-traffic sites.
 *       Position: Bottom section - LAST (optional)
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 4
 *         description: Number of articles (4 recommended)
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Trending window in hours (24-72 recommended)
 *       - in: query
 *         name: excludeSlug
 *         schema:
 *           type: string
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Trending articles list
 */
router.get('/articles/trending', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const limit = Math.min(10, Math.max(1, parseInt(String(req.query.limit || '4'), 10)));
  const hours = Math.min(168, Math.max(1, parseInt(String(req.query.hours || '24'), 10)));
  const excludeSlug = req.query.excludeSlug ? String(req.query.excludeSlug) : undefined;
  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  // Trending: High views within the time window
  const windowStart = new Date();
  windowStart.setHours(windowStart.getHours() - hours);

  const where: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    publishedAt: { gte: windowStart },
    AND: and,
  };

  if (excludeSlug) {
    where.slug = { not: excludeSlug };
  }

  const articles = await p.tenantWebArticle.findMany({
    where,
    orderBy: [{ viewCount: 'desc' }, { shareCount: 'desc' }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      coverImageUrl: true,
      publishedAt: true,
      viewCount: true,
      shareCount: true,
      isBreaking: true,
      category: { select: { slug: true, name: true } },
    },
  });

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.json({
    status: 'ok',
    section: 'trending',
    position: 'bottom-last',
    window_hours: hours,
    articles: articles.map((a: any) => ({
      id: a.id,
      slug: a.slug,
      headline: a.title,
      cover_image_url: a.coverImageUrl || brandLogoUrl,
      published_at: a.publishedAt?.toISOString(),
      view_count: a.viewCount || 0,
      share_count: a.shareCount || 0,
      is_breaking: a.isBreaking || false,
      category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
    })),
  });
});

/**
 * @swagger
 * /public/articles/page-layout:
 *   get:
 *     summary: Get all article page layout sections in one call
 *     description: |
 *       Returns all sections needed for article page layout in a single API call.
 *       Optimized for performance - fetches latest, must-read, related, and trending in parallel.
 *       
 *       Layout positions:
 *       - side.latest: Side column TOP
 *       - side.mustRead: Side column MIDDLE
 *       - bottom.related: Bottom section TOP
 *       - bottom.trending: Bottom section LAST
 *     tags: [Public - Website, Public - Articles]
 *     parameters:
 *       - in: query
 *         name: slug
 *         required: true
 *         schema:
 *           type: string
 *         description: Current article slug
 *       - in: query
 *         name: languageCode
 *         schema:
 *           type: string
 *       - in: header
 *         name: X-Tenant-Domain
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Complete article page layout data
 */
router.get('/articles/page-layout', async (req, res) => {
  const domain = (res.locals as any).domain;
  const tenant = (res.locals as any).tenant;
  if (!domain || !tenant) return res.status(500).json({ error: 'Domain context missing' });

  const slug = req.query.slug ? String(req.query.slug) : null;
  if (!slug) return res.status(400).json({ error: 'slug parameter is required' });

  const languageCode = req.query.languageCode ? String(req.query.languageCode) : undefined;

  const [domainLangs, tenantTheme] = await Promise.all([
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
  ]);

  // Find current article
  const currentArticle = await p.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id, OR: [{ slug }, { id: slug }] },
    select: { id: true, categoryId: true, tags: true },
  });

  if (!currentArticle) return res.status(404).json({ error: 'Article not found' });

  const domainScope: any = { OR: [{ domainId: domain.id }, { domainId: null }] };
  const and: any[] = [domainScope];

  if (languageCode) {
    const match = domainLangs.find((d: any) => d.language?.code === languageCode);
    if (match) and.push({ languageId: match.languageId });
  }

  const baseWhere: any = {
    tenantId: tenant.id,
    status: 'PUBLISHED',
    id: { not: currentArticle.id },
    AND: and,
  };

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  // Fetch all sections in parallel
  const [latest, mustRead, related, trending] = await Promise.all([
    // Latest (7 items)
    p.tenantWebArticle.findMany({
      where: baseWhere,
      orderBy: [{ publishedAt: 'desc' }],
      take: 7,
      select: {
        id: true, slug: true, title: true, coverImageUrl: true,
        publishedAt: true, viewCount: true, isBreaking: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    // Must Read (5 items, high views in last 7 days)
    p.tenantWebArticle.findMany({
      where: { ...baseWhere, publishedAt: { gte: sevenDaysAgo }, viewCount: { gte: 5 } },
      orderBy: [{ viewCount: 'desc' }],
      take: 5,
      select: {
        id: true, slug: true, title: true, coverImageUrl: true,
        publishedAt: true, viewCount: true, isBreaking: true,
        category: { select: { slug: true, name: true } },
      },
    }),
    // Related (6 items, same category)
    currentArticle.categoryId
      ? p.tenantWebArticle.findMany({
          where: { ...baseWhere, categoryId: currentArticle.categoryId },
          orderBy: [{ publishedAt: 'desc' }],
          take: 6,
          select: {
            id: true, slug: true, title: true, coverImageUrl: true,
            publishedAt: true, viewCount: true,
            category: { select: { slug: true, name: true } },
            author: { select: { profile: { select: { fullName: true, profilePhotoUrl: true } } } },
          },
        })
      : Promise.resolve([]),
    // Trending (4 items, last 24 hours)
    p.tenantWebArticle.findMany({
      where: { ...baseWhere, publishedAt: { gte: twentyFourHoursAgo } },
      orderBy: [{ viewCount: 'desc' }],
      take: 4,
      select: {
        id: true, slug: true, title: true, coverImageUrl: true,
        publishedAt: true, viewCount: true, shareCount: true, isBreaking: true,
        category: { select: { slug: true, name: true } },
      },
    }),
  ]);

  const brandLogoUrl = (tenantTheme as any)?.logoUrl || null;
  const tenantDisplayName = (tenant as any)?.displayName || tenant.name;

  const formatArticle = (a: any, includeAuthor = false) => ({
    id: a.id,
    slug: a.slug,
    headline: a.title,
    cover_image_url: a.coverImageUrl || brandLogoUrl,
    published_at: a.publishedAt?.toISOString(),
    view_count: a.viewCount || 0,
    share_count: a.shareCount || 0,
    is_breaking: a.isBreaking || false,
    category: a.category ? { slug: a.category.slug, name: a.category.name } : null,
    ...(includeAuthor && {
      author: {
        name: a.author?.profile?.fullName || `${tenantDisplayName} Reporter`,
        photo_url: a.author?.profile?.profilePhotoUrl || brandLogoUrl,
      },
    }),
  });

  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  res.json({
    status: 'ok',
    layout: {
      side: {
        latest: {
          position: 'top',
          articles: latest.map((a: any) => formatArticle(a)),
        },
        mustRead: {
          position: 'middle',
          articles: mustRead.map((a: any) => formatArticle(a)),
        },
      },
      bottom: {
        related: {
          position: 'top',
          articles: related.map((a: any) => formatArticle(a, true)),
        },
        trending: {
          position: 'last',
          articles: trending.map((a: any) => formatArticle(a)),
        },
      },
    },
    publisher: {
      id: tenant.id,
      name: tenantDisplayName,
      logo_url: brandLogoUrl,
    },
  });
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

// ============================================================================
// PUBLIC CROP SESSION APIs (NEW PDF-ONLY CLIP SYSTEM)
// ============================================================================

/**
 * @swagger
 * /public/epaper/issue-with-clips:
 *   get:
 *     summary: Get ePaper issue with article clips (public read-only)
 *     description: |
 *       Returns a PDF issue with all its article clip coordinates.
 *       This is the primary endpoint for the new PDF-only clip system.
 *       
 *       **Clip coordinates are in PDF points** (1/72 inch, origin bottom-left).
 *       Frontend should use pdf.js or similar to render clips on the PDF.
 *       
 *       **Lookup options**:
 *       - By `issueId` directly
 *       - By `editionSlug` + `date`
 *       - By `editionSlug` + `subEditionSlug` + `date`
 *       
 *       **Note**: Only active clips are returned. Public-created suggestions
 *       (source='public', isActive=false) are NOT included.
 *       
 *       EPAPER domain verification applies.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: query
 *         name: issueId
 *         schema: { type: string }
 *         description: Direct issue ID lookup
 *       - in: query
 *         name: editionSlug
 *         schema: { type: string }
 *         description: Edition slug (requires date)
 *       - in: query
 *         name: subEditionSlug
 *         schema: { type: string }
 *         description: Sub-edition slug (optional, with editionSlug)
 *       - in: query
 *         name: date
 *         schema: { type: string, example: "2026-01-21" }
 *         description: Issue date YYYY-MM-DD (required with editionSlug)
 *       - in: query
 *         name: pageNumber
 *         schema: { type: integer }
 *         description: Filter clips by page number (1-based)
 *     responses:
 *       200:
 *         description: Issue with clips
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 issue:
 *                   type: object
 *                   properties:
 *                     id: { type: string, example: "clz123abc" }
 *                     issueDate: { type: string, format: date-time }
 *                     dateDisplay: { type: string, example: "2026-01-21" }
 *                     pdfUrl: { type: string, example: "https://r2.example.com/.../issue.pdf" }
 *                     pageCount: { type: integer, example: 12 }
 *                     pdfOnlyMode: { type: boolean, example: true }
 *                     edition: { type: object }
 *                     subEdition: { type: object, nullable: true }
 *                     coverImageUrl: { type: string, nullable: true }
 *                     coverImageUrlWebp: { type: string, nullable: true }
 *                 clips:
 *                   type: object
 *                   properties:
 *                     count: { type: integer, example: 24 }
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: string }
 *                           pageNumber: { type: integer }
 *                           x: { type: number, description: "PDF points" }
 *                           y: { type: number, description: "PDF points" }
 *                           width: { type: number }
 *                           height: { type: number }
 *                           column: { type: string, enum: [left, right, full], nullable: true }
 *                           title: { type: string, nullable: true }
 *                           source: { type: string, enum: [manual, auto] }
 *                           confidence: { type: number, nullable: true }
 *                           assets: { type: array }
 *       400:
 *         description: Missing required params (issueId or editionSlug+date)
 *       404:
 *         description: Issue not found
 */
router.get('/epaper/issue-with-clips', requireVerifiedEpaperDomain, getPublicIssueWithClips);

/**
 * @swagger
 * /public/epaper/crop-session:
 *   post:
 *     summary: Create a crop session for clip updates (public)
 *     description: |
 *       Creates a temporary session key that allows public users to update clip coordinates.
 *       
 *       **Security**:
 *       - Session expires in **5 minutes**
 *       - Rate limited to **max 3 operations** per session
 *       - Can be scoped to specific clipId or issue-wide
 *       - IP is hashed for audit (not blocking)
 *       
 *       **Use case**: Public reader adjusts article boundaries for better sharing,
 *       or suggests a new article region.
 *       
 *       EPAPER domain verification applies.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [issueId]
 *             properties:
 *               issueId:
 *                 type: string
 *                 description: PDF issue ID
 *               clipId:
 *                 type: string
 *                 nullable: true
 *                 description: "Optional: scope session to specific clip only"
 *     responses:
 *       201:
 *         description: Crop session created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean, example: true }
 *                 cropSessionKey: { type: string, example: "abc123xyz789..." }
 *                 expiresAt: { type: string, format: date-time, example: "2026-01-21T10:05:00.000Z" }
 *                 expiresIn: { type: integer, example: 300, description: "Seconds until expiry" }
 *                 issueId: { type: string }
 *                 clipId: { type: string, nullable: true }
 *       404:
 *         description: Issue or clip not found
 */
router.post('/epaper/crop-session', requireVerifiedEpaperDomain, createCropSession);

/**
 * @swagger
 * /public/epaper/clips/{clipId}/update:
 *   put:
 *     summary: Update clip via crop session (public)
 *     description: |
 *       Update a clip's coordinates using a valid crop session key.
 *       
 *       **Required header**: `X-Crop-Session: <sessionKey>`
 *       
 *       **Security checks**:
 *       - Session must be valid and not expired (5-min TTL)
 *       - Session must not exceed rate limit (max 3 operations)
 *       - Session must match clipId (if scoped) or issue
 *       
 *       **Validation**:
 *       - x, y >= 0
 *       - width, height > 0
 *       - x + width <= 2000, y + height <= 3000
 *       
 *       **Auditing**:
 *       - Sets `updatedBy='public'`, `confidence=null`
 *       - Previous coordinates saved to `EpaperClipHistory` table
 *       - IP hash recorded for audit
 *       
 *       If coordinates change, cached clip assets are invalidated.
 *       
 *       EPAPER domain verification applies.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: path
 *         name: clipId
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Crop-Session
 *         required: true
 *         schema: { type: string }
 *         description: Session key from POST /crop-session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               x: { type: number, minimum: 0, description: "X coordinate (PDF points)" }
 *               y: { type: number, minimum: 0, description: "Y coordinate (PDF points)" }
 *               width: { type: number, minimum: 1 }
 *               height: { type: number, minimum: 1 }
 *               column: { type: string, enum: [left, right, full] }
 *               title: { type: string }
 *     responses:
 *       200:
 *         description: Clip updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 message: { type: string, example: "Clip updated successfully" }
 *                 clip: { type: object }
 *                 sessionUpdatesRemaining: { type: integer, example: 2 }
 *       400:
 *         description: Invalid coordinates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 code: { type: string, example: "INVALID_COORDINATES" }
 *       401:
 *         description: Invalid, expired session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 code: { type: string, enum: [SESSION_REQUIRED, INVALID_SESSION, SESSION_EXPIRED] }
 *       403:
 *         description: Session not authorized for this clip
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 code: { type: string, example: "CLIP_MISMATCH" }
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Session rate limit exceeded (max 3 updates)" }
 *                 code: { type: string, example: "RATE_LIMIT_EXCEEDED" }
 *                 maxUpdates: { type: integer, example: 3 }
 *                 currentCount: { type: integer }
 */
router.put('/epaper/clips/:clipId/update', requireVerifiedEpaperDomain, updateClipViaCropSession);

/**
 * @swagger
 * /public/epaper/clips/create:
 *   post:
 *     summary: Create new clip via crop session (public suggestion)
 *     description: |
 *       Create a new article clip using a valid crop session key.
 *       Session must NOT be scoped to a specific clipId.
 *       
 *       **Required header**: `X-Crop-Session: <sessionKey>`
 *       
 *       **IMPORTANT - PUBLIC CLIP POLICY**:
 *       - Public-created clips are **SUGGESTIONS ONLY**
 *       - `source = 'public'`, `isActive = false`
 *       - **NOT visible** in public responses until admin activates
 *       - Counts toward session rate limit (max 3 operations)
 *       
 *       **Validation**:
 *       - x, y >= 0
 *       - width, height > 0
 *       - x + width <= 2000, y + height <= 3000
 *       - pageNumber must be within issue page count
 *       
 *       EPAPER domain verification applies.
 *     tags: [EPF ePaper - Public]
 *     parameters:
 *       - $ref: '#/components/parameters/XTenantDomain'
 *       - in: header
 *         name: X-Crop-Session
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pageNumber, x, y, width, height]
 *             properties:
 *               pageNumber: { type: integer, example: 1, minimum: 1 }
 *               x: { type: number, example: 100, minimum: 0 }
 *               y: { type: number, example: 200, minimum: 0 }
 *               width: { type: number, example: 400, minimum: 1 }
 *               height: { type: number, example: 300, minimum: 1 }
 *               column: { type: string, enum: [left, right, full] }
 *               title: { type: string, example: "Article I found" }
 *     responses:
 *       201:
 *         description: Clip suggestion created (pending admin review)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok: { type: boolean }
 *                 message: { type: string, example: "Clip suggestion created successfully (pending admin review)" }
 *                 clip:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     source: { type: string, example: "public" }
 *                     isActive: { type: boolean, example: false }
 *                 isPendingReview: { type: boolean, example: true }
 *                 sessionUpdatesRemaining: { type: integer, example: 2 }
 *       400:
 *         description: Invalid coordinates or page number
 *       401:
 *         description: Invalid or expired session
 *       403:
 *         description: Session is scoped to existing clip (cannot create new)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 code: { type: string, example: "SCOPED_SESSION" }
 *       429:
 *         description: Rate limit exceeded (max 3 operations per session)
 */
router.post('/epaper/clips/create', requireVerifiedEpaperDomain, createClipViaCropSession);

export default router;