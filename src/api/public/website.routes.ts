import { Router } from 'express';
import { tenantResolver } from '../../middleware/tenantResolver';
import { buildEffectiveStyle1AdsResponse } from '../../lib/adsStyle1';
import { buildEffectiveStyle2AdsResponse } from '../../lib/adsStyle2';
import prisma from '../../lib/prisma';
import { buildNewsArticleJsonLd as buildLegacyNewsArticleJsonLd, toWebArticleCardDto, toWebArticleDetailDto } from '../../lib/tenantWebArticleView';
import { buildNewsArticleJsonLd } from '../../lib/seo';
import crypto from 'crypto';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router();
router.use(tenantResolver);

// Helper: build default navigation config if none set
function buildDefaultNavigation(tenant: any) {
  return {
    brand: { logoText: (tenant as any)?.displayName || tenant?.name || 'News', tagline: 'Latest updates', locale: 'en-IN' },
    sticky: { enabled: true, offsetPx: 0 },
    utilityLinks: [],
    primaryLinks: [ { label: 'Home', href: '/' } ],
    quickLinks: [],
    socialLinks: [],
    cta: { label: 'Subscribe', href: '/subscribe', variant: 'solid' },
    mobile: {
      featuredTag: null,
      quickActions: [],
      primaryLinks: [ { label: 'Home', href: '/', icon: 'home' } ],
      bottomNavLinks: [ { label: 'Home', href: '/', icon: 'home' } ],
      socialLinks: []
    }
  };
}

// Merge utility
const merge = (a: any, b: any) => ({ ...(a || {}), ...(b || {}) });

async function getEffectiveSettings(tenantId: string, domainId: string) {
  const [entity, tenantSet, domainSet] = await Promise.all([
    p.entitySettings.findFirst().catch(() => null),
    p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null),
    p.domainSettings.findUnique({ where: { domainId } }).catch(() => null)
  ]);
  return merge(merge(entity?.data, tenantSet?.data), domainSet?.data);
}

type HomepageSectionConfig = {
  key: string;
  title?: string;
  position?: number;
  style?: string;
  limit?: number;
  categorySlug?: string;
  tagsHas?: string;
};

/**
 * @swagger
 * /public/domain/settings:
 *   get:
 *     summary: Get effective Domain Settings for current Host
 *     description: Auto-detects tenant/domain using the Host header and returns effective website config.
 *     tags: [Public - Website]
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
 *         description: Effective settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   domain: "manachourasta.com"
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   effective:
 *                     branding:
 *                       logoUrl: "https://cdn.kaburlu.com/logos/domain.png"
 *                       faviconUrl: "https://cdn.kaburlu.com/favicons/domain.ico"
 *                     theme:
 *                       theme: "dark"
 *                       colors:
 *                         primary: "#0D47A1"
 *                         secondary: "#FFC107"
 *                     navigation:
 *                       menu:
 *                         - { label: "Home", href: "/" }
 *                     seo:
 *                       defaultMetaTitle: "Kaburlu News"
 *                       defaultMetaDescription: "Latest breaking news and updates."
 *                     homepage:
 *                       heroCount: 1
 *                       topStoriesCount: 5
 *                       sections:
 *                         - key: "politics"
 *                           title: "Politics"
 *                           position: 10
 *                           style: "grid"
 *                           categorySlug: "politics"
 *                           limit: 6
 *                         - key: "liveDesk"
 *                           title: "Live Desk"
 *                           position: 15
 *                           style: "ticker"
 *                           tagsHas: "breaking"
 *                           limit: 12
  *                     style1:
  *                       palette:
  *                         mode: "light"
  *                         primary: "#0D47A1"
  *                         secondary: "#FFC107"
  *                         accent: "#FF5722"
  *                         background: "#FFFFFF"
  *                         surface: "#F7F9FC"
  *                       typography:
  *                         fontFamilyBase: "Inter, system-ui, sans-serif"
  *                         baseFontSizeRem: 1
  *                         lineHeightBase: 1.5
  *                         weights:
  *                           regular: 400
  *                           medium: 500
  *                           bold: 700
  *                         sizes:
  *                           xs: "0.75rem"
  *                           sm: "0.875rem"
  *                           base: "1rem"
  *                           md: "1.125rem"
  *                           lg: "1.25rem"
  *                           xl: "1.5rem"
  *                           display: "2.25rem"
  *                       spacing:
  *                         unitRem: 0.5
  *                         scale:
  *                           xs: 0.5
  *                           sm: 1
  *                           md: 2
  *                           lg: 3
  *                           xl: 4
  *                       breakpoints:
  *                         mobile: 480
  *                         tablet: 768
  *                         desktop: 1024
  *                         wide: 1440
  *                       components:
  *                         button:
  *                           radius: 6
  *                           paddingYRem: 0.5
  *                           paddingXRem: 1
  *                           variants:
  *                             solid:
  *                               background: "#0D47A1"
  *                               color: "#FFFFFF"
  *                             outline:
  *                               borderColor: "#0D47A1"
  *                               color: "#0D47A1"
  *                         card:
  *                           radius: 8
  *                           shadow: "0 2px 6px rgba(0,0,0,0.08)"
  *                           headerFontSize: "1.125rem"
  *                           hoverLift: true
  *                       article:
  *                         heroLayout: "standard"
  *                         showAuthorAvatar: true
  *                         showCategoryPill: true
  *                         readingProgressBar: true
  *                       listing:
  *                         cardVariant: "highlight-first"
  *                         showExcerpt: true
  *                         imageAspectRatio: "16:9"
 */
router.get('/domain/settings', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const [effective, tenantTheme, tenantEntity, domainCats, domainLangs] = await Promise.all([
    getEffectiveSettings(tenant.id, domain.id),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.tenantEntity?.findUnique?.({ where: { tenantId: tenant.id }, include: { language: true } }).catch(() => null),
    p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }).catch(() => []),
    p.domainLanguage.findMany({ where: { domainId: domain.id }, include: { language: true } }).catch(() => [])
  ]);

  // Ensure stable public contract keys.
  // Keep defaults minimal and predictable; prefer configured values when present.
  const out: any = { ...(effective || {}) };
  out.seo = { ...(out.seo || {}) };
  if (!out.seo.canonicalBaseUrl) out.seo.canonicalBaseUrl = `https://${domain.domain}`;
  // Best practice for Google Discover large images (frontend should render as: <meta name="robots" content="max-image-preview:large">)
  if (!out.seo.robots) out.seo.robots = 'max-image-preview:large';

  out.branding = { ...(out.branding || {}) };
  if (!out.branding.siteName) out.branding.siteName = (tenant as any)?.displayName || tenant?.name || domain.domain;
  if (!out.branding.logoUrl) out.branding.logoUrl = (tenantTheme as any)?.logoUrl || null;

  out.contact = { ...(out.contact || {}) };
  if (!Object.prototype.hasOwnProperty.call(out.contact, 'email')) out.contact.email = null;
  if (!Object.prototype.hasOwnProperty.call(out.contact, 'phone')) out.contact.phone = null;
  if (!Object.prototype.hasOwnProperty.call(out.contact, 'city')) out.contact.city = null;
  if (!Object.prototype.hasOwnProperty.call(out.contact, 'region')) out.contact.region = null;
  if (!Object.prototype.hasOwnProperty.call(out.contact, 'country')) out.contact.country = null;

  out.social = { ...(out.social || {}) };
  if (!Object.prototype.hasOwnProperty.call(out.social, 'facebook')) out.social.facebook = null;
  if (!Object.prototype.hasOwnProperty.call(out.social, 'x')) out.social.x = null;
  if (!Object.prototype.hasOwnProperty.call(out.social, 'instagram')) out.social.instagram = null;
  if (!Object.prototype.hasOwnProperty.call(out.social, 'youtube')) out.social.youtube = null;
  if (!Object.prototype.hasOwnProperty.call(out.social, 'telegram')) out.social.telegram = null;

  // Resolve tenant default language from TenantEntity.language (authoritative default for website).
  const tenantDefaultLangCode = (tenantEntity as any)?.language?.code ? String((tenantEntity as any).language.code) : null;
  const supportedLanguageCodes = new Set<string>();
  for (const dl of (domainLangs || []) as any[]) {
    const code = dl?.language?.code ? String(dl.language.code) : null;
    if (code) supportedLanguageCodes.add(code);
  }
  if (tenantDefaultLangCode) supportedLanguageCodes.add(tenantDefaultLangCode);
  if (Array.isArray((out as any)?.content?.supportedLanguages)) {
    for (const c of (out as any).content.supportedLanguages) {
      if (typeof c === 'string' && c.trim()) supportedLanguageCodes.add(c.trim());
    }
  }

  out.content = { ...(out.content || {}) };
  out.content.supportedLanguages = Array.from(supportedLanguageCodes);
  if (tenantDefaultLangCode) {
    out.content.defaultLanguage = tenantDefaultLangCode;
  } else if (!out.content.defaultLanguage) {
    out.content.defaultLanguage = out.content.supportedLanguages?.[0] || 'en';
  }

  // Navigation: ensure domain-selected categories appear, and provide both base + translated names.
  // We keep existing items, but append any missing domain categories.
  const domainCategories = (domainCats || []).map((dc: any) => dc.category).filter(Boolean);
  const categoryIds = domainCategories.map((c: any) => c.id);
  const translations = tenantDefaultLangCode
    ? await p.categoryTranslation.findMany({ where: { language: tenantDefaultLangCode, categoryId: { in: categoryIds } } }).catch(() => [])
    : [];
  const translatedNameByCategoryId = new Map<string, string>((translations || []).map((t: any) => [t.categoryId, t.name]));
  const categoryBySlug = new Map<string, any>(domainCategories.map((c: any) => [c.slug, c]));

  out.navigation = { ...(out.navigation || {}) };
  const menu: any[] = Array.isArray(out.navigation.menu) ? [...out.navigation.menu] : [];
  const ensureHome = () => {
    const hasHome = menu.some((m: any) => String(m?.href || '') === '/');
    if (!hasHome) menu.unshift({ href: '/', label: 'Home' });
  };
  ensureHome();

  const extractCategorySlugFromHref = (href: string) => {
    const h = String(href || '');
    const m = h.match(/^\/category\/([^/?#]+)/i);
    return m?.[1] ? String(m[1]) : null;
  };

  const existingCategorySlugs = new Set<string>();
  for (const item of menu) {
    const slug = extractCategorySlugFromHref(String(item?.href || ''));
    if (slug) existingCategorySlugs.add(slug);
  }

  // Enrich existing menu items (category links) with base+translated labels.
  for (const item of menu) {
    const slug = extractCategorySlugFromHref(String(item?.href || ''));
    if (!slug) continue;
    const cat = categoryBySlug.get(slug);
    if (!cat) continue;
    const baseName = cat?.name ? String(cat.name) : slug;
    const translatedName = translatedNameByCategoryId.get(String(cat.id)) || null;
    item.categorySlug = slug;
    item.labels = { base: baseName, translated: translatedName };
    // Keep compatibility: label remains a string. Prefer tenant language label when available.
    item.labelEn = baseName;
    item.labelNative = translatedName;
    if (translatedName) item.label = translatedName;
    else if (!item.label) item.label = baseName;
  }

  // Append any missing domain categories.
  for (const cat of domainCategories) {
    const slug = String(cat.slug);
    if (!slug || existingCategorySlugs.has(slug)) continue;
    const baseName = cat?.name ? String(cat.name) : slug;
    const translatedName = translatedNameByCategoryId.get(String(cat.id)) || null;
    menu.push({
      href: `/category/${slug}`,
      label: translatedName || baseName,
      categorySlug: slug,
      labels: { base: baseName, translated: translatedName },
      labelEn: baseName,
      labelNative: translatedName
    });
    existingCategorySlugs.add(slug);
  }

  out.navigation.menu = menu;

  // Best practice: include footer/static page links here so homepage can avoid extra round-trips.
  // (Additive contract: safe for existing clients.)
  try {
    const specs: Array<{ slug: string; label: string; endpoint: string }> = [
      { slug: 'about-us', label: 'About Us', endpoint: '/public/about-us' },
      { slug: 'contact-us', label: 'Contact Us', endpoint: '/public/contact-us' },
      { slug: 'privacy-policy', label: 'Privacy Policy', endpoint: '/public/privacy-policy' },
      { slug: 'terms', label: 'Terms', endpoint: '/public/terms' },
      { slug: 'disclaimer', label: 'Disclaimer', endpoint: '/public/disclaimer' },
      { slug: 'editorial-policy', label: 'Editorial Policy', endpoint: '/public/editorial-policy' },
    ];

    const slugs = specs.map((s) => s.slug);
    const rows: any[] = (await p.tenantStaticPage
      ?.findMany?.({
        where: { tenantId: tenant.id, slug: { in: slugs }, published: true },
        select: { slug: true, title: true, updatedAt: true },
      })
      .catch(() => [])) ?? [];

    const bySlug = new Map<string, any>(rows.map((r: any) => [String(r.slug), r]));
    const pages = specs.map((spec) => {
      const row = bySlug.get(spec.slug);
      return {
        slug: spec.slug,
        label: spec.label,
        endpoint: spec.endpoint,
        available: Boolean(row),
        title: row?.title ?? null,
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
    });

    out.pages = { ...(out.pages || {}), static: pages };
  } catch {
    // Never fail the settings response due to optional static pages
  }

  // IMPORTANT: Remove secrets before sending to public (same as ePaper sanitization)
  // Domain settings can contain private keys (push.webPushVapidPrivateKey, fcmServerKey, google.serviceAccountJson, etc.)
  if (out.secrets) delete out.secrets;
  
  // Sanitize integrations to only include public IDs/tokens
  if (out.integrations && typeof out.integrations === 'object') {
    const integ = out.integrations;
    const safe: any = {};
    
    if (integ.analytics && typeof integ.analytics === 'object') {
      safe.analytics = {
        googleAnalyticsMeasurementId: integ.analytics.googleAnalyticsMeasurementId ?? integ.analytics.gaMeasurementId ?? null,
        googleTagManagerId: integ.analytics.googleTagManagerId ?? integ.analytics.gtmContainerId ?? null,
      };
    }
    if (integ.searchConsole && typeof integ.searchConsole === 'object') {
      safe.searchConsole = {
        googleSiteVerification: integ.searchConsole.googleSiteVerification ?? null,
        bingSiteVerification: integ.searchConsole.bingSiteVerification ?? null,
      };
    }
    if (integ.ads && typeof integ.ads === 'object') {
      safe.ads = {
        adsenseClientId: integ.ads.adsenseClientId ?? integ.ads.adsensePublisherId ?? null,
        googleAdsConversionId: integ.ads.googleAdsConversionId ?? integ.ads.googleAdsCustomerId ?? null,
        googleAdsConversionLabel: integ.ads.googleAdsConversionLabel ?? null,
        adManagerNetworkCode: integ.ads.adManagerNetworkCode ?? null,
        adManagerAppId: integ.ads.adManagerAppId ?? null,
      };
    }
    if (integ.push && typeof integ.push === 'object') {
      safe.push = {
        webPushVapidPublicKey: integ.push.webPushVapidPublicKey ?? integ.push.vapidPublicKey ?? null,
        fcmSenderId: integ.push.fcmSenderId ?? integ.push.firebaseSenderId ?? null,
      };
    }
    
    out.integrations = Object.keys(safe).length > 0 ? safe : undefined;
  }

  res.json({ domain: domain.domain, tenantId: tenant.id, effective: out });
});

/**
 * @swagger
 * /public/ads:
 *   get:
 *     summary: Get website ads for the resolved domain
 *     description: |
 *       Returns ads stored under TenantSettings.data.ads, filtered for the resolved domain.
 *
 *       By default, returns `visibility=PRIVATE` ads (tenant's own website placements).
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: placement
 *         required: false
 *         description: Filter by placement key (e.g. homepage_top)
 *         schema:
 *           type: string
 *       - in: query
 *         name: visibility
 *         required: false
 *         description: Filter by visibility (default PRIVATE)
 *         schema:
 *           type: string
 *           enum: [PRIVATE, PUBLIC, all]
 *     responses:
 *       200:
 *         description: Ads list
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   domain: "example.com"
 *                   tenantId: "TENANT_ID"
 *                   ads:
 *                     - id: "ad_1"
 *                       placement: "homepage_top"
 *                       title: "Sponsor"
 *                       imageUrl: "https://cdn.example.com/ad.webp"
 *                       clickUrl: "https://sponsor.example.com"
 *                       enabled: true
 *                       visibility: "PRIVATE"
 *                       domainId: null
 *                       startsAt: null
 *                       endsAt: null
 *                       priority: 10
 */
router.get('/ads', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  const placement = req.query.placement ? String(req.query.placement).trim() : null;
  const visibilityRaw = req.query.visibility ? String(req.query.visibility).trim() : 'PRIVATE';
  const visibility = String(visibilityRaw).toUpperCase();

  const row = await p.tenantSettings.findUnique({ where: { tenantId: tenant.id } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const ads: any[] = Array.isArray((data as any).ads) ? (data as any).ads : [];

  const now = Date.now();
  const filtered = ads
    .filter((a: any) => a && typeof a === 'object')
    .filter((a: any) => {
      if (placement && String(a.placement || '').trim() !== placement) return false;

      const enabled = Object.prototype.hasOwnProperty.call(a, 'enabled') ? !!a.enabled : true;
      if (!enabled) return false;

      const v = String(a.visibility || 'PRIVATE').toUpperCase();
      if (visibility !== 'ALL' && v !== visibility) return false;

      const adDomainId = Object.prototype.hasOwnProperty.call(a, 'domainId') ? (a.domainId ?? null) : null;
      if (adDomainId && String(adDomainId) !== String(domain.id)) return false;

      const startsAt = a.startsAt ? Date.parse(String(a.startsAt)) : NaN;
      const endsAt = a.endsAt ? Date.parse(String(a.endsAt)) : NaN;
      if (Number.isFinite(startsAt) && now < startsAt) return false;
      if (Number.isFinite(endsAt) && now > endsAt) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 0;
      const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 0;
      if (pb !== pa) return pb - pa;
      const ta = a.updatedAt ? Date.parse(String(a.updatedAt)) : 0;
      const tb = b.updatedAt ? Date.parse(String(b.updatedAt)) : 0;
      return tb - ta;
    });

  res.json({ domain: domain.domain, tenantId: tenant.id, ads: filtered });
});

/**
 * @swagger
 * /public/ads/style1:
 *   get:
 *     summary: Get style1 slot-based ads for the resolved domain
 *     description: |
 *       Returns slot-based ads stored under TenantSettings.data.adsStyle1.
 *       This response is designed for the website UI: it always returns ALL known slot keys with enabled=false defaults when not configured.
 *     tags: [Public - Website]
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
 *         description: Slot-based ads
 */
router.get('/ads/style1', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  const row = await p.tenantSettings.findUnique({ where: { tenantId: tenant.id } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const adsStyle1 = (data as any).adsStyle1 && typeof (data as any).adsStyle1 === 'object' ? (data as any).adsStyle1 : {};

  const effectiveAds = buildEffectiveStyle1AdsResponse(adsStyle1, { includeAllSlots: true });
  const domainBase = domain?.domain ? `https://${String(domain.domain)}` : null;

  res.json({
    domain: domain.domain,
    domainBase,
    tenantId: tenant.id,
    effective: { ads: effectiveAds }
  });
});

/**
 * @swagger
 * /public/ads/style2:
 *   get:
 *     summary: Get style2 slot-based ads for the resolved domain
 *     description: |
 *       Returns slot-based ads stored under TenantSettings.data.adsStyle2.
 *       This response is designed for the Style2 website UI: it always returns ALL known Style2 slot keys with enabled=false defaults when not configured.
 *     tags: [Public - Website]
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
 *         description: Slot-based ads
 */
router.get('/ads/style2', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  const row = await p.tenantSettings.findUnique({ where: { tenantId: tenant.id } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const adsStyle2 = (data as any).adsStyle2 && typeof (data as any).adsStyle2 === 'object' ? (data as any).adsStyle2 : {};

  const effectiveAds = buildEffectiveStyle2AdsResponse(adsStyle2, { includeAllSlots: true });
  const domainBase = domain?.domain ? `https://${String(domain.domain)}` : null;

  res.json({
    domain: domain.domain,
    domainBase,
    tenantId: tenant.id,
    effective: { ads: effectiveAds }
  });
});

/**
 * @swagger
 * /public/navigation:
 *   get:
 *     summary: Get tenant navigation config
 *     tags: [Public - Website]
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
  *         description: Navigation config JSON
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   brand:
  *                     logoText: "News"
  *                   primaryLinks:
  *                     - label: "Home"
  *                       href: "/"
  *       500:
  *         description: Domain context missing
  *         content:
  *           application/json:
  *             examples:
  *               error:
  *                 value:
  *                   error: "Domain context missing"
 */
router.get('/navigation', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const nav = await p.tenantNavigation.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  res.json(nav?.config || buildDefaultNavigation(tenant));
});

/**
 * @swagger
 * /public/features:
 *   get:
 *     summary: Get tenant feature flags
 *     tags: [Public - Website]
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
  *         description: Feature flags
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   enableMobileAppView: false
  *                   section2:
  *                     rows: 2
  *                     listCount: 4
  *                     forceCategoryName: null
  *       500:
  *         description: Domain context missing
  *         content:
  *           application/json:
  *             examples:
  *               error:
  *                 value:
  *                   error: "Domain context missing"
 */
router.get('/features', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const flags = await p.tenantFeatureFlags.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const out = flags ? {
    enableMobileAppView: flags.enableMobileAppView,
    section2: {
      rows: flags.section2Rows,
      listCount: flags.section2ListCount,
      forceCategoryName: flags.section2ForceCategoryName || null
    }
  } : {
    enableMobileAppView: false,
    section2: { rows: 2, listCount: 4, forceCategoryName: null }
  };
  res.json(out);
});

// TenantWebArticle -> card shape for website consumption
function toCard(a: any) {
  const card = toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null });
  // Best practice: Try multiple image sources for cover image
  // Priority: coverImageUrl > contentJson.coverImage.url > contentJson.media.images[0] > first image in images array
  const cj: any = a?.contentJson || {};
  const coverImage = card.coverImageUrl 
    || cj?.coverImage?.url 
    || cj?.media?.images?.[0]?.url 
    || cj?.media?.images?.[0]
    || (Array.isArray(a?.images) && a.images[0]) 
    || null;
  
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    image: coverImage,
    excerpt: card.excerpt,
    category: card.category ? { slug: card.category.slug, name: card.category.name } : null,
    publishedAt: card.publishedAt,
    tags: card.tags,
    languageCode: card.languageCode,
  };
}

function getOrCreateRequestId(req: any): string {
  const existing = (req.headers['x-request-id'] || req.headers['x-correlation-id']) as string | undefined;
  if (existing && String(existing).trim()) return String(existing).trim();
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

async function resolveLanguageId(langCodeRaw: any): Promise<string | null> {
  const code = (langCodeRaw ? String(langCodeRaw) : '').trim();
  if (!code) return null;
  const lang = await p.language.findUnique({ where: { code } }).catch(() => null);
  return lang?.id || null;
}

function toV1Article(a: any, imageTarget?: { w: number; h: number }) {
  const card = toWebArticleCardDto(a, { category: a.category, languageCode: a.language?.code || null });
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    excerpt: card.excerpt,
    coverImage: card.coverImageUrl
      ? { url: card.coverImageUrl, w: imageTarget?.w || null, h: imageTarget?.h || null }
      : null,
    publishedAt: card.publishedAt,
  };
}

/**
 * @swagger
 * /public/homepage:
 *   get:
 *     summary: Aggregated homepage sections
 *     description: |
 *       Returns homepage content for the resolved tenant/domain.
 *
 *       - Default response (no query params): legacy shape `{ hero, topStories, sections, ... }`.
 *       - Style1 contract: pass `?v=1` (or `?shape=style1`) to get `{ version, tenant, theme, uiTokens, sections, data }`.
 *       - Style2: pass `?shape=style2` to use Style2 theme configuration with section types, categories, and theme colors.
 *
 *       Best practice (recommended flows):
 *
 *       Style1 (v=1):
 *       1) Admin config (JWT):
 *          - POST `/tenant-theme/{tenantId}/homepage/style1/apply-default`
 *          - PATCH `/tenant-theme/{tenantId}/homepage/style1/sections` to override labels/limits/categories
 *       2) Frontend load:
 *          - GET `/public/homepage?v=1` (or `/public/homepage?shape=style1`) with optional `lang=te`
 *
 *       Style2:
 *       1) Admin config (JWT):
 *          - POST `/tenant-theme/{tenantId}/style2-config/apply-default` to set up default sections
 *          - PUT `/tenant-theme/{tenantId}/style2-config` to customize sections
 *       2) Frontend load:
 *          - GET `/public/homepage?shape=style2` to get homepage data with configured sections
 *
 *       Style2 v4 (Theme Config - NEW):
 *       1) Admin config (JWT):
 *          - POST `/tenant-theme/{tenantId}/style2-config/apply-default` to apply default configuration
 *          - PUT `/tenant-theme/{tenantId}/style2-config` with sections array (section_type, categories, theme_color, position)
 *          - GET `/tenant-theme/{tenantId}/style2-config/section-types` to get available section types and theme colors
 *       2) Frontend load:
 *          - GET `/public/homepage?shape=style2&v=4` (returns sections with structured data based on theme configuration)
 *
 *       Notes:
 *       - `X-Tenant-Domain` header is the safest way to target a tenant/domain in local testing.
 *       - Style2 v2 TOI center is always latest; TOI rightMostRead uses `TenantWebArticle.viewCount`.
 *       - Style2 v3 uses HomepageSectionConfig table for structured, admin-managed sections with category FK and localized labels.
 *
 *       Best practice (Style2 website):
 *       1) Admin config (JWT):
 *          - POST `/tenant-theme/{tenantId}/homepage/style2/apply-default`
 *          - PATCH `/tenant-theme/{tenantId}/homepage/style2/sections` with `{ sections: [{ key, title, position, categorySlug, limit }] }`
 *       2) Frontend load:
 *          - GET `/public/homepage?shape=style2` (one call returns hero + topStories + each section items)
 *          - Optionally GET `/public/ads?placement=...` for ads
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: domain
 *         required: false
 *         description: Optional tenant/domain override (alternative to X-Tenant-Domain).
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: v
 *         required: false
 *         description: Set to 1 for Style1 contract, or 2 for Style2 theme configuration.
 *         schema:
 *           type: string
 *           enum: ['1','2']
 *           example: '2'
 *       - in: query
 *         name: shape
 *         required: false
 *         description: Alternative to `v=1`; set to `style1` for Style1 contract.
 *         schema:
 *           type: string
 *           enum: ['style1','style2']
 *           example: style1
 *       - in: query
 *         name: themeKey
 *         required: false
 *         description: Theme key for homepage composition (currently only `style1`).
 *         schema:
 *           type: string
 *           example: style1
 *       - in: query
 *         name: lang
 *         required: false
 *         description: Optional language code filter for homepage articles.
 *         schema:
 *           type: string
 *           example: en
 *     responses:
  *       200:
  *         description: Homepage JSON sections
  *         content:
  *           application/json:
  *             examples:
  *               legacy:
  *                 summary: Legacy response (default)
  *                 value:
  *                   hero:
  *                     - id: "wa_1"
  *                       slug: "top-headline-1"
  *                       title: "Top headline"
  *                       image: "https://cdn.example.com/cover.webp"
  *                       excerpt: "..."
  *                       category: { slug: "politics", name: "Politics" }
  *                       publishedAt: "2025-12-28T10:00:00.000Z"
  *                   topStories:
  *                     - id: "wa_2"
  *                       slug: "story-2"
  *                       title: "Story"
  *                       image: null
  *                       excerpt: null
  *                       category: null
  *                       publishedAt: null
  *                   sections:
  *                     - key: "politics"
  *                       title: "Politics"
  *                       position: 10
  *                       style: "grid"
  *                       limit: 6
  *                       categorySlug: "politics"
  *                       items: []
  *                   config:
  *                     heroCount: 1
  *                     topStoriesCount: 5
   *               style2:
   *                 summary: Style2 response (use ?shape=style2)
   *                 value:
   *                   hero:
   *                     - id: "wa_101"
   *                       slug: "headline-1"
   *                       title: "Top headline"
   *                       image: "https://cdn.example.com/cover.webp"
   *                       excerpt: "..."
   *                       category: { slug: "politics", name: "Politics" }
   *                       publishedAt: "2025-12-29T10:00:00.000Z"
   *                       tags: ["breaking"]
   *                       languageCode: "en"
   *                   topStories: []
   *                   sections:
   *                     - key: "politics"
   *                       title: "Politics"
   *                       position: 10
   *                       style: "grid"
   *                       limit: 6
   *                       categorySlug: "politics"
   *                       items: []
   *                   config:
   *                     heroCount: 1
   *                     topStoriesCount: 5
   *                     sections:
   *                       - key: "politics"
   *                         position: 10
   *                         limit: 6
   *                         categorySlug: "politics"
  *               style1V1:
  *                 summary: Style1 contract (use ?v=1)
  *                 value:
  *                   version: "1.0"
  *                   tenant: { id: "t1", slug: "demo", name: "Kaburlu Demo" }
  *                   theme: { key: "style1" }
  *                   uiTokens:
  *                     titleMaxLines: { hero: 2, cardMedium: 2, listRow: 2, ticker: 1 }
  *                     imageTargets:
  *                       hero16x9: { w: 1200, h: 675 }
  *                       card16x9: { w: 900, h: 506 }
  *                       thumbWide: { w: 320, h: 180 }
  *                       thumbSmall: { w: 240, h: 160 }
  *                   sections:
  *                     - id: "flashTicker"
  *                       type: "ticker"
  *                       label: "Flash News"
  *                       ui: { itemCount: 12, titleMaxLines: 1 }
  *                       query: { kind: "latest", limit: 12 }
   *                     - id: "categoryHub"
   *                       type: "categoryHub"
   *                       label: "Categories"
   *                       ui: { columns: 4, perCategoryCount: 5, image: "card16x9", titleMaxLines: 2 }
   *                       query: { kind: "navCategories", count: 4, perCategoryLimit: 5 }
   *                     - id: "hgBlock"
   *                       type: "HGBlock"
   *                       label: "Highlights"
   *                       ui: { categoryCount: 2, perCategoryCount: 5, image: "card16x9", titleMaxLines: 2 }
   *                       query: { kind: "navCategories", count: 2, perCategoryLimit: 5 }
  *                   data:
  *                     flashTicker:
  *                       - id: "a1"
  *                         slug: "..."
  *                         title: "..."
  *                         excerpt: "..."
  *                         coverImage: { url: "https://cdn.example.com/cover.webp", w: 320, h: 180 }
  *                         publishedAt: "2025-12-28T10:00:00.000Z"
   *                     categoryHub:
   *                       - category: { slug: "national", name: "జాతీయ" }
   *                         items:
   *                           - id: "a2"
   *                             slug: "..."
   *                             title: "..."
   *                             excerpt: "..."
   *                             coverImage: { url: "https://cdn.example.com/cover.webp", w: 900, h: 506 }
   *                             publishedAt: "2025-12-28T10:00:00.000Z"
  *               style2V2:
  *                 summary: Style2 v2.1 contract with analytics-based sections (use ?shape=style2&v=2)
  *                 value:
  *                   version: "2.1"
  *                   tenant: { id: "t1", slug: "demo", name: "Kaburlu Demo" }
  *                   theme: { key: "style2" }
  *                   feeds:
  *                     latest: { kind: "latest", limit: 20, items: [] }
  *                     mostRead: { kind: "mostRead", metric: "viewCount", limit: 5, items: [] }
  *                     ticker: { kind: "ticker", limit: 10, items: [] }
  *                     breaking: { kind: "breaking", limit: 10, items: [] }
  *                   adPlacements:
  *                     - { id: "ad_ticker_top", position: "ticker_top", type: "leaderboard", size: "728x90" }
  *                     - { id: "ad_hero_sidebar", position: "hero_sidebar", type: "rectangle", size: "300x250" }
  *                   sections:
  *                     - id: "flashTicker"
  *                       type: "flashTicker"
  *                       label: "Flash News"
  *                     - id: "heroFeature"
  *                       type: "heroFeature"
  *                       label: "Featured"
  *                     - id: "trendingWidget"
  *                       type: "trendingWidget"
  *                       label: "Trending News"
  *                     - id: "magazineGrid"
  *                       type: "magazineGrid"
  *                       themeColor: "emerald"
  *                   data:
  *                     flashTicker: []
  *                     heroFeature: { id: "...", title: "...", image: "..." }
  *                     secondaryCards: []
  *                     trendingWidget: []
  *                     latestNewsWidget: []
  *                     breaking: []
  *                     magazineGrid: { category: { slug: "politics", name: "Politics" }, items: [], analytics: { articleCount: 50, totalViews: 1200, score: 112 } }
  *                   analytics:
  *                     categoryRanking:
  *                       - { slug: "politics", name: "Politics", articleCount: 50, totalViews: 1200, score: 112, usedInSection: true }
  *                     totalCategoriesUsed: 8
  *                     totalArticlesDeduped: 45
 *       500:
 *         description: Domain context missing
 */
router.get('/homepage', async (_req, res) => {
  const req: any = _req;
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });

  const requestId = getOrCreateRequestId(req);
  res.setHeader('X-Request-Id', requestId);

  // Fetch domain settings to check themeStyle
  const domainSettings = domain?.id
    ? await p.domainSettings.findUnique({ where: { domainId: domain.id } }).catch(() => null)
    : null;
  const domainThemeStyle = (domainSettings?.data as any)?.themeStyle || null;

  const shape = String((req.query as any)?.shape || '').toLowerCase().trim();
  const versionParam = String((req.query as any)?.v || '').trim();
  
  // Auto-detect style from domain settings if not explicitly provided in query
  // Priority: query params > domain settings > default (style1)
  const autoShape = shape || (domainThemeStyle === 'style2' ? 'style2' : domainThemeStyle === 'style1' ? 'style1' : '');
  
  const wantsV1 = versionParam === '1' || autoShape === 'style1';
  const wantsStyle2 = autoShape === 'style2' || versionParam === '2';
  // Style2 variants:
  // - v2 is the default for Style2 unless explicitly requesting v3.
  // - v3 is requested by ?v=3.
  const wantsStyle2V3 = versionParam === '3';
  const wantsStyle2V2 = wantsStyle2 && !wantsStyle2V3;
  // Convenience: allow `shape=style2` to behave like `themeKey=style2` for Style2 homepage.
  const themeKey = String((req.query as any)?.themeKey || (autoShape && autoShape !== 'style1' ? autoShape : 'style1'));
  const langCode = String((req.query as any)?.lang || '').trim() || null;
  if (wantsV1 && themeKey !== 'style1') {
    return res.status(400).json({ code: 'UNSUPPORTED_THEME', message: 'Only themeKey=style1 is supported currently' });
  }
  if (wantsStyle2 && themeKey !== 'style2') {
    return res.status(400).json({ code: 'UNSUPPORTED_THEME', message: 'Use shape=style2 for Style2' });
  }


  const [domainCats, activeDomainCount, effective, languageId, tenantTheme, tenantEntity, dbHomepageSections] = await Promise.all([
    domain?.id ? p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } }) : Promise.resolve([]),
    p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0),
    domain?.id ? getEffectiveSettings(tenant.id, domain.id) : Promise.resolve({}),
    resolveLanguageId(langCode),
    p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null),
    p.tenantEntity?.findUnique?.({ where: { tenantId: tenant.id }, include: { language: true } }).catch(() => null),
    // Fetch HomepageSectionConfig for this tenant/domain (used by Style2 v3)
    // Include all new fields: sectionType, queryKind, secondary/tertiary categories, categorySlugs
    (p.homepageSectionConfig?.findMany?.({
      where: { tenantId: tenant.id, domainId: domain?.id || null, isActive: true },
      orderBy: { position: 'asc' },
      include: {
        category: { select: { id: true, slug: true, name: true, iconUrl: true } },
        secondaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } },
        tertiaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } }
      }
    }) ?? Promise.resolve([])).catch(() => [])
  ]);

  if (wantsV1 && langCode && !languageId) {
    return res.status(400).json({ code: 'INVALID_LANG', message: 'Unknown lang code' });
  }

  const allowedCategoryIds = new Set((domainCats || []).map((d: any) => d.categoryId));
  // Homepage should show both domain-specific and tenant-shared articles.
  // If a tenant has multiple domains, many existing articles may have domainId=null (shared);
  // excluding them makes the homepage appear empty.
  const domainScope: any = domain?.id
    ? { OR: [{ domainId: domain.id }, { domainId: null }] }
    : {};

  const categoryBySlug = new Map<string, any>((domainCats || []).map((d: any) => [d.category?.slug, d.category]));

  // Best practice: choose a preferred language for labels/translations.
  // - If caller provides ?lang=xx, use it (already validated when wantsV1).
  // - Otherwise, use TenantEntity.language.code as the tenant's default website language (when available).
  const tenantDefaultLangCode = (tenantEntity as any)?.language?.code ? String((tenantEntity as any).language.code) : null;
  const preferredLangCodeForLabels = (langCode || tenantDefaultLangCode || null) as string | null;
  const categoryTranslations = preferredLangCodeForLabels
    ? await p.categoryTranslation
        .findMany({ where: { language: preferredLangCodeForLabels, categoryId: { in: (domainCats || []).map((d: any) => d.categoryId) } } })
        .catch(() => [])
    : [];
  const translatedNameByCategoryId = new Map<string, string>((categoryTranslations || []).map((t: any) => [t.categoryId, t.name]));

  // Helper to create default extra sections
  const createDefaultExtraSections = () => [
    { key: 'trending-news', title: 'Trending News', position: 1000, style: 'cards', limit: 20, queryType: 'trending' },
    { key: 'must-read', title: 'Must Read', position: 1001, style: 'list', limit: 10, queryType: 'most-viewed' },
    { key: 'most-read', title: 'Most Read', position: 1002, style: 'compact', limit: 15, queryType: 'most-viewed' }
  ];

  const defaultSections: HomepageSectionConfig[] = [
    { key: 'politics', title: 'Politics', position: 10, style: 'grid', limit: 6, categorySlug: 'politics' },
    { key: 'technology', title: 'Technology', position: 20, style: 'grid', limit: 6, categorySlug: 'technology' },
    { key: 'sports', title: 'Sports', position: 30, style: 'grid', limit: 6, categorySlug: 'sports' },
  ];

  const buildDomainCategorySections = (opts?: { limit?: number; style?: string; perSectionLimit?: number }) => {
    const maxSections = Math.min(Math.max(Number(opts?.limit || 8), 1), 25);
    const style = String(opts?.style || 'grid');
    const perLimit = Math.min(Math.max(Number(opts?.perSectionLimit || 6), 1), 50);
    const cats = (domainCats || [])
      .map((d: any) => d.category)
      .filter(Boolean)
      .slice()
      .sort((a: any, b: any) => String(a?.name || '').localeCompare(String(b?.name || '')));
    const outSections: HomepageSectionConfig[] = [];
    let pos = 10;
    for (const c of cats) {
      if (!c?.slug) continue;
      const translated = translatedNameByCategoryId.get(String(c.id)) || null;
      outSections.push({
        key: String(c.slug),
        title: translated || String(c.name || c.slug),
        position: pos,
        style,
        limit: perLimit,
        categorySlug: String(c.slug)
      });
      pos += 10;
      if (outSections.length >= maxSections) break;
    }
    return outSections;
  };

  // Helper to fetch extra sections (trending, most read, etc.)
  // Uses global `seen` set for deduplication to avoid repeating articles across sections
  async function fetchExtraSection(section: any, globalSeen: Set<string>) {
    const out: any = {
      key: section.key,
      title: section.title,
      position: section.position,
      style: section.style,
      limit: section.limit,
      items: []
    };

    if (section.queryType === 'trending' || section.queryType === 'most-viewed') {
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take: Math.min(section.limit * 2, 100), // Fetch extra to allow for deduplication
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      // Apply deduplication: skip articles already in feeds/sections
      const dedupedItems: any[] = [];
      for (const r of rows) {
        if (!r?.id) continue;
        if (globalSeen.has(String(r.id))) continue; // Skip if already shown elsewhere
        globalSeen.add(String(r.id)); // Mark as seen
        dedupedItems.push(toCard(r));
        if (dedupedItems.length >= section.limit) break;
      }
      out.items = dedupedItems;
    }

    return out;
  }

  // Prefer homepage config stored in TenantTheme (per style) to avoid touching global settings JSON.
  const themeHome: any = (tenantTheme as any)?.homepageConfig || null;
  const themeHomeForStyle = themeHome && typeof themeHome === 'object'
    ? (themeHome[themeKey] ?? themeHome)
    : null;
  const cfg: any = themeHomeForStyle || (effective as any)?.homepage || {};
  const heroCount = Math.min(Math.max(parseInt(String(cfg.heroCount || '1'), 10) || 1, 1), 10);
  const topStoriesCount = Math.min(Math.max(parseInt(String(cfg.topStoriesCount || '5'), 10) || 5, 1), 20);
  // Sections selection best practices:
  // - If sections are missing entirely => fall back to demo defaults.
  // - For style2, if sections are present but empty => auto-fill using domain-selected categories
  //   to avoid an "empty homepage" on fresh tenants.
  let sectionsCfg: HomepageSectionConfig[];
  if (Array.isArray(cfg.sections)) {
    if (themeKey === 'style2' && cfg.sections.length === 0) {
      sectionsCfg = buildDomainCategorySections({ limit: 8, style: 'grid', perSectionLimit: 6 });
    } else {
      sectionsCfg = cfg.sections;
    }
  } else {
    sectionsCfg = defaultSections;
  }

  // Base pool for hero/topStories (latest)
  // Best practice:
  // - Always include shared domain content (domainId=null)
  // - When a language is requested, also include rows with languageId=null (legacy/unknown language)
  // - Include articles where aiApprovalStatus is null (not reviewed), AI_APPROVED, or author is admin/superadmin
  const baseAnd: any[] = [];
  if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) baseAnd.push(domainScope);
  if (languageId) baseAnd.push({ OR: [{ languageId }, { languageId: null }] });
  // Some ingested TenantWebArticle rows may be uncategorized (categoryId=null).
  // When the domain restricts categories, still allow uncategorized rows so the homepage doesn't go empty.
  if (allowedCategoryIds.size) {
    baseAnd.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
  }
  // AI Approval filter: include articles that are:
  // 1. Not yet reviewed (aiApprovalStatus = null) - superadmin/editor manual posts
  // 2. Approved by AI (aiApprovalStatus = 'AI_APPROVED')
  // 3. Posted by SUPERADMIN/ADMIN/EDITOR (auto-approve their posts)
  baseAnd.push({
    OR: [
      { aiApprovalStatus: null },
      { aiApprovalStatus: 'AI_APPROVED' },
      { author: { role: { name: { in: ['SUPERADMIN', 'ADMIN', 'EDITOR'] } } } }
    ]
  });
  const baseWhere: any = { tenantId: tenant.id, status: 'PUBLISHED' };
  if (baseAnd.length) baseWhere.AND = baseAnd;

  const baseRows = await p.tenantWebArticle.findMany({
    where: baseWhere,
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(20, heroCount + topStoriesCount + 10),
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  const baseCards = baseRows.map(toCard);
  const hero = baseCards.slice(0, heroCount);
  const topStories: any[] = baseCards.slice(heroCount, heroCount + topStoriesCount);
  // Best practice: if the tenant has too few published articles, fill topStories with repeats
  // rather than returning an empty array (frontend usually expects a populated rail).
  if (topStoriesCount > 0 && topStories.length < topStoriesCount) {
    const seenTop = new Set<string>();
    for (const c of topStories) if (c?.id) seenTop.add(String(c.id));
    for (const c of baseCards) {
      if (topStories.length >= topStoriesCount) break;
      if (!c?.id) continue;
      if (seenTop.has(String(c.id))) continue;
      seenTop.add(String(c.id));
      topStories.push(c);
    }
  }

  // ============================================================
  // Best-practice unified homepage feeds (used by Style1 + Style2)
  // ============================================================
  function extractCategorySlugFromHrefForHomepage(href: string) {
    const h = String(href || '');
    const m = h.match(/^\/category\/([^/?#]+)/i);
    return m?.[1] ? String(m[1]) : null;
  }

  function resolveHomepageCategorySlugs(maxCount: number) {
    const want = Math.min(Math.max(Number(maxCount) || 0, 0), 50);
    const navMenu: any[] = Array.isArray((effective as any)?.navigation?.menu) ? (effective as any).navigation.menu : [];
    const seenSlugs = new Set<string>();
    const out: string[] = [];

    // 1) Navigation order first (if configured)
    for (const item of navMenu) {
      const slug = extractCategorySlugFromHrefForHomepage(String(item?.href || ''));
      if (!slug) continue;
      if (seenSlugs.has(slug)) continue;
      // Prefer domain-mapped categories
      if (!categoryBySlug.get(slug)) continue;
      seenSlugs.add(slug);
      out.push(slug);
      if (out.length >= want) return out;
    }

    // 2) Append remaining domain categories deterministically
    const domainCatsSorted = (domainCats || [])
      .map((d: any) => d.category)
      .filter(Boolean)
      .slice()
      .sort((a: any, b: any) => {
        const an = (translatedNameByCategoryId.get(String(a?.id)) || a?.name || a?.slug || '').toString();
        const bn = (translatedNameByCategoryId.get(String(b?.id)) || b?.name || b?.slug || '').toString();
        return an.localeCompare(bn);
      });

    for (const c of domainCatsSorted) {
      const slug = c?.slug ? String(c.slug) : '';
      if (!slug) continue;
      if (seenSlugs.has(slug)) continue;
      seenSlugs.add(slug);
      out.push(slug);
      if (out.length >= want) return out;
    }

    return out;
  }

  const makeHomepageCategoryInfo = (slugRaw: string, cat: any | null) => {
    const slug = String(slugRaw || '').trim();
    const name = cat?.id
      ? (translatedNameByCategoryId.get(String(cat.id)) || String(cat?.name || slug))
      : String(slug);
    const href = slug ? `/category/${encodeURIComponent(slug)}` : null;
    return { slug, name, href };
  };

  async function fetchMostReadCardsForHomepage(limit: number) {
    const want = Math.min(Math.max(limit, 1), 50);
    const take = Math.min(want + 25, 75);
    const rows = await p.tenantWebArticle.findMany({
      where: baseWhere,
      orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
    const out: any[] = [];
    const seen = new Set<string>();
    for (const r of rows) {
      if (!r?.id) continue;
      if (seen.has(String(r.id))) continue;
      seen.add(String(r.id));
      out.push(toCard(r));
      if (out.length >= want) break;
    }
    return out;
  }

  async function fetchBreakingCardsForHomepage(limit: number) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await p.tenantWebArticle.findMany({
      where: { ...baseWhere, OR: [{ isBreaking: true }, { tags: { has: 'breaking' } }] },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take,
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
    return rows.map(toCard);
  }

  async function fetchCategoryCardsForHomepage(categorySlug: string, limit: number) {
    const slug = String(categorySlug || '').trim();
    if (!slug) return [];
    const resolvedCategory = categoryBySlug.get(slug) || null;
    // Best practice: only serve domain-mapped categories in homepage category feeds.
    if (!resolvedCategory) return [];

    const and: any[] = [];
    if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
    if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });
    const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId: resolvedCategory.id };
    if (and.length) where.AND = and;

    const rows = await p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(limit, 1), 50),
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
    return rows.map(toCard);
  }

  const bestPracticeLatest = baseCards.slice(0, 20);
  const bestPracticeTicker = baseCards.slice(0, 10);
  const [bestPracticeMostRead, bestPracticeBreaking] = await Promise.all([
    fetchMostReadCardsForHomepage(5),
    fetchBreakingCardsForHomepage(10)
  ]);

  const homepageCategorySlugs = resolveHomepageCategorySlugs(25);
  const homepageCategories = await Promise.all(
    homepageCategorySlugs.map(async (slug) => {
      const cat = categoryBySlug.get(slug) || null;
      const items = await fetchCategoryCardsForHomepage(slug, 10);
      return {
        category: makeHomepageCategoryInfo(slug, cat),
        items,
        message: items.length ? null : 'No articles posted yet in this category.'
      };
    })
  );

  const feeds = {
    latest: { kind: 'latest', limit: 20, items: bestPracticeLatest },
    mostRead: { kind: 'mostRead', metric: 'viewCount', limit: 5, items: bestPracticeMostRead },
    ticker: { kind: 'ticker', limit: 10, items: bestPracticeTicker },
    breaking: { kind: 'breaking', limit: 10, items: bestPracticeBreaking },
    categories: { kind: 'categories', perCategoryLimit: 10, items: homepageCategories }
  };

  // Style1 one-API response (opt-in)
  if (wantsV1) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    const uiTokens = {
      titleMaxLines: { hero: 2, cardMedium: 2, listRow: 2, ticker: 1 },
      imageTargets: {
        hero16x9: { w: 1200, h: 675 },
        card16x9: { w: 900, h: 506 },
        thumbWide: { w: 320, h: 180 },
        thumbSmall: { w: 240, h: 160 }
      }
    };

    type V1Section = {
      id: string;
      // Some helper sections refer to the same identifier as `key`.
      key?: string;
      type: string;
      label: string;
      ui: any;
      query: any;
    };

    const sections: V1Section[] = [
      { id: 'flashTicker', type: 'ticker', label: 'Flash News', ui: { itemCount: 10, titleMaxLines: 1 }, query: { kind: 'latest', limit: 10 } },
      {
        id: 'heroStack',
        type: 'heroStack',
        label: 'Top Stories',
        ui: {
          hero: { count: 1, image: 'hero16x9', titleMaxLines: 2 },
          medium: { count: 2, image: 'card16x9', titleMaxLines: 2 },
          rows: { count: 3, image: 'thumbWide', titleMaxLines: 2 }
        },
        query: { kind: 'latest', limit: 12, dedupeKey: 'heroStack' }
      },
      // Style1 category blocks (tenant/domain-driven):
      // - categoryHub uses the first 4 category items from navigation.menu (or domain categories fallback)
      // - hgBlock uses the first 2 category items from navigation.menu (or domain categories fallback)
      { id: 'categoryHub', type: 'categoryHub', label: 'Categories', ui: { columns: 4, perCategoryCount: 5, image: 'card16x9', titleMaxLines: 2 }, query: { kind: 'navCategories', count: 4, perCategoryLimit: 5 } },
      { id: 'hgBlock', type: 'HGBlock', label: 'Highlights', ui: { categoryCount: 2, perCategoryCount: 5, image: 'card16x9', titleMaxLines: 2 }, query: { kind: 'navCategories', count: 2, perCategoryLimit: 5 } },
      { id: 'lastNews', type: 'listWithThumb', label: 'Last News', ui: { count: 7, image: 'thumbWide', titleMaxLines: 2 }, query: { kind: 'category', categorySlug: 'politics', limit: 8 } },
      { id: 'trendingCategory', type: 'twoColRows', label: 'Trending News', ui: { count: 6, image: 'thumbWide', titleMaxLines: 2 }, query: { kind: 'category', categorySlug: 'sports', limit: 6, sort: 'latest' } },
      { id: 'rightRailTrendingTitles', type: 'titlesOnly', label: 'Trending News', ui: { count: 8, titleMaxLines: 2 }, query: { kind: 'latest', limit: 8 } }
    ];

    // Allow tenant-configured overrides for Style1 sections.
    // Source: TenantTheme.homepageConfig.style1.sections[] where key maps to section id.
    const sectionOverrides: Record<string, any> = {};
    if (Array.isArray((cfg as any)?.sections)) {
      for (const s of (cfg as any).sections) {
        const k = String(s?.key || '').trim();
        if (!k) continue;
        sectionOverrides[k] = s;
      }
    }

    const clampInt = (value: any, min: number, max: number) => {
      const n = parseInt(String(value), 10);
      if (!Number.isFinite(n)) return null;
      return Math.min(Math.max(n, min), max);
    };

    for (const s of sections) {
      const ov = sectionOverrides[s.id];
      if (!ov) continue;

      const newLabel = (Object.prototype.hasOwnProperty.call(ov, 'label') ? ov.label : ov.title);
      if (typeof newLabel === 'string' && newLabel.trim()) s.label = newLabel.trim();

      if (typeof ov?.categorySlug === 'string' && ov.categorySlug.trim()) {
        if (s.query?.kind === 'category') s.query.categorySlug = ov.categorySlug.trim();
      }

      const limit = clampInt(ov?.limit, 1, 50);
      if (limit) {
        if (s.type === 'ticker') {
          s.ui.itemCount = limit;
          s.query.limit = limit;
        } else if (s.type === 'titlesOnly' || s.type === 'listWithThumb' || s.type === 'twoColRows') {
          s.ui.count = limit;
          s.query.limit = limit;
        } else if (s.type === 'categoryHub' || s.type === 'HGBlock') {
          s.ui.perCategoryCount = limit;
          s.query.perCategoryLimit = limit;
        }
      }

      // Optional overrides for nav-category based sections
      // Example (TenantTheme.homepageConfig.style1.sections):
      // { key: 'categoryHub', categorySlugs: ['national','international',...], limit: 5 }
      if ((s.type === 'categoryHub' || s.type === 'HGBlock') && Array.isArray(ov?.categorySlugs)) {
        const slugs = (ov.categorySlugs as any[])
          .map((x) => (typeof x === 'string' ? x.trim() : ''))
          .filter(Boolean)
          .slice(0, 25);
        if (slugs.length) s.query.categorySlugs = slugs;
      }
    }

    const seen = new Set<string>();
    const data: Record<string, any[]> = {};

    const timers: Record<string, number> = {};

    async function fetchLatest(limit: number) {
      const t0 = Date.now();
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      timers.latest = (timers.latest || 0) + (Date.now() - t0);
      return rows;
    }

    async function fetchCategory(categorySlug: string, limit: number) {
      const t0 = Date.now();
      const resolvedCategory = categoryBySlug.get(categorySlug) || null;
      if (!resolvedCategory) {
        timers.category = (timers.category || 0) + (Date.now() - t0);
        return [];
      }
      const and: any[] = [];
      if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
      if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });

      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId: resolvedCategory.id };
      if (and.length) where.AND = and;
      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      timers.category = (timers.category || 0) + (Date.now() - t0);
      return rows;
    }

    function extractCategorySlugFromHref(href: string) {
      const h = String(href || '');
      const m = h.match(/^\/category\/([^/?#]+)/i);
      return m?.[1] ? String(m[1]) : null;
    }

    function resolveNavCategorySlugs(count: number) {
      const want = Math.min(Math.max(Number(count) || 0, 0), 25);
      const navMenu: any[] = Array.isArray((effective as any)?.navigation?.menu) ? (effective as any).navigation.menu : [];
      const seenSlugs = new Set<string>();
      const out: string[] = [];

      // 1) Keep configured navigation order (if any)
      for (const item of navMenu) {
        const slug = extractCategorySlugFromHref(String(item?.href || ''));
        if (!slug) continue;
        if (seenSlugs.has(slug)) continue;
        // Only include categories that exist for this domain (DomainCategory)
        if (!categoryBySlug.get(slug)) continue;
        seenSlugs.add(slug);
        out.push(slug);
        if (out.length >= want) return out;
      }

      // 2) Append missing domain categories deterministically
      const domainCatsSorted = (domainCats || [])
        .map((d: any) => d.category)
        .filter(Boolean)
        .slice()
        .sort((a: any, b: any) => {
          const an = (translatedNameByCategoryId.get(String(a?.id)) || a?.name || a?.slug || '').toString();
          const bn = (translatedNameByCategoryId.get(String(b?.id)) || b?.name || b?.slug || '').toString();
          return an.localeCompare(bn);
        });

      for (const c of domainCatsSorted) {
        const slug = c?.slug ? String(c.slug) : '';
        if (!slug) continue;
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        out.push(slug);
        if (out.length >= want) return out;
      }

      return out;
    }

    async function buildSection(s: V1Section) {
      const t0 = Date.now();
      let rows: any[] = [];

      // Nav-category hub sections return an array of category blocks:
      // [{ category: { slug, name }, items: V1Article[] }]
      if (s.query?.kind === 'navCategories') {
        const count = Math.min(Math.max(Number(s.query?.count ?? s.ui?.categoryCount ?? s.ui?.columns ?? 0) || 0, 0), 25);
        const perCategoryLimit = Math.min(Math.max(Number(s.query?.perCategoryLimit ?? s.ui?.perCategoryCount ?? 5) || 5, 1), 50);
        const explicitSlugs = Array.isArray(s.query?.categorySlugs)
          ? (s.query.categorySlugs as any[]).map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean)
          : [];
        const slugs = explicitSlugs.length ? explicitSlugs.slice(0, count) : resolveNavCategorySlugs(count);

        const targetKey = String(s.ui?.image || '') as keyof typeof uiTokens.imageTargets;
        const target = (uiTokens.imageTargets as any)[targetKey] || null;

        const blocks: any[] = [];
        for (const slug of slugs) {
          // eslint-disable-next-line no-await-in-loop
          const catRows = await fetchCategory(String(slug), perCategoryLimit);
          const cat = categoryBySlug.get(String(slug)) || null;
          const catName = cat?.id
            ? (translatedNameByCategoryId.get(String(cat.id)) || String(cat?.name || slug))
            : String(slug);
          blocks.push({
            category: { slug: String(slug), name: catName },
            items: (catRows || []).slice(0, perCategoryLimit).map((r: any) => toV1Article(r, target || undefined)),
            message: (catRows || []).length ? null : 'No articles posted yet in this category.'
          });
        }

        timers[s.id] = Date.now() - t0;
        data[s.id] = blocks;
        return;
      }

      if (s.query?.kind === 'latest') {
        rows = await fetchLatest(Number(s.query.limit || 10) + 25);
      } else if (s.query?.kind === 'category') {
        rows = await fetchCategory(String(s.query.categorySlug || ''), Number(s.query.limit || 10) + 25);
      }

      const targetKey = String(s.ui?.image || s.ui?.hero?.image || s.ui?.rows?.image || s.ui?.medium?.image || '') as keyof typeof uiTokens.imageTargets;
      const target = (uiTokens.imageTargets as any)[targetKey] || null;

      const out: any[] = [];
      const outIds = new Set<string>();
      let want = 10;
      if (s.type === 'heroStack') {
        const heroN = Number(s.ui?.hero?.count || 0) || 0;
        const mediumN = Number(s.ui?.medium?.count || 0) || 0;
        const rowsN = Number(s.ui?.rows?.count || 0) || 0;
        want = heroN + mediumN + rowsN;
        if (!want) want = Number(s.query?.limit || 10) || 10;
      } else {
        want = Number(s.ui?.itemCount ?? s.ui?.count ?? s.query?.limit ?? 10) || 10;
      }
      want = Math.min(Math.max(want, 1), 50);

      const pushRow = (r: any, opts?: { allowSeen?: boolean }) => {
        if (!r?.id) return;
        if (outIds.has(r.id)) return;
        const allowSeen = Boolean(opts?.allowSeen);
        if (!allowSeen && seen.has(r.id)) return;
        if (!allowSeen) seen.add(r.id);
        outIds.add(r.id);
        out.push(toV1Article(r, target || undefined));
      };

      // Phase 1: fill with unseen items from the section's primary query.
      for (const r of rows) {
        pushRow(r, { allowSeen: false });
        if (out.length >= want) break;
      }

      // Phase 2: if category slug is missing/empty (or category has low volume), backfill from latest.
      // Keep global de-dupe semantics in this phase.
      let latestPool: any[] | null = null;
      if (out.length < want && s.query?.kind !== 'latest') {
        latestPool = await fetchLatest(Number(s.query?.limit || 10) + 25);
        for (const r of (latestPool ?? [])) {
          pushRow(r, { allowSeen: false });
          if (out.length >= want) break;
        }
      }

      // Phase 3 (last resort): if the tenant has too few published articles after global de-dupe,
      // allow repeats from latest so the UI isn't empty.
      if (out.length < want) {
        if (!latestPool) latestPool = s.query?.kind === 'latest' ? rows : await fetchLatest(Number(s.query?.limit || 10) + 25);
        for (const r of (latestPool ?? [])) {
          pushRow(r, { allowSeen: true });
          if (out.length >= want) break;
        }
      }

      timers[s.id] = Date.now() - t0;
      data[s.id] = out;
    }

    // Deterministic ordering is important because we dedupe across sections.
    // We also prioritize the main story stack before less critical rails/tickers.
    const sectionPriority = (s: V1Section) => {
      if (s.type === 'heroStack') return 0;
      if (s.type === 'ticker') return 1;
      if (s.type === 'titlesOnly') return 3;
      return 2;
    };

    const buildOrder = [...sections].sort((a, b) => sectionPriority(a) - sectionPriority(b));
    for (const s of buildOrder) {
      // eslint-disable-next-line no-await-in-loop
      await buildSection(s);
    }

    // Add default extra sections if not already configured
    const extraSections = createDefaultExtraSections();
    // V1 sections are keyed by `id`; some helper sections use `key`.
    const configuredKeys = new Set(sections.map(s => (s as any).key || (s as any).id));
    const additionalSections = [];

    // Also add articles from feeds to the global 'seen' set to avoid duplication in extra sections
    for (const item of feeds.latest.items) if (item?.id) seen.add(String(item.id));
    for (const item of feeds.mostRead.items) if (item?.id) seen.add(String(item.id));
    for (const item of feeds.ticker.items) if (item?.id) seen.add(String(item.id));

    for (const extraSection of extraSections) {
      if (!configuredKeys.has(extraSection.key)) {
        const sectionData = await fetchExtraSection(extraSection, seen);
        sections.push(sectionData);
        data[extraSection.key] = sectionData.items;
        additionalSections.push(sectionData);
      }
    }

    console.log('[homepage:v1]', { requestId, tenant: tenant.slug, domain: domain?.domain, langCode, timingsMs: timers, extraSectionsAdded: additionalSections.length });

    return res.json({
      version: '1.0',
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        displayName: (tenant as any).displayName || tenant.name,
        nativeName: (tenant as any).nativeName || null,
        language: (tenant as any).primaryLanguage || null,
      },
      theme: { key: 'style1' },
      uiTokens,
      feeds,
      sections,
      data
    });
  }

  // Style2 v2: one-API response that matches the common "Style2 sections" (flashTicker, toiGrid3, topStoriesGrid, section3, section4)
  // Controlled by TenantTheme.homepageConfig.style2.v2.sections[] and fetched from the same backend DB.
  // 
  // ENHANCED (v2.1): Analytics-based category ranking
  // - Categories are ranked by: article count + total views
  // - Each category is used only once across all sections
  // - Sections: FlashTicker, HeroFeature, SecondaryCards, TrendingWidget, LatestNewsWidget,
  //             MagazineGrid, HorizontalCards, Spotlight, NewspaperColumns, PhotoGallery, Timeline, CompactLists
  if (wantsStyle2V2) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    // ============================================================
    // ANALYTICS-BASED CATEGORY RANKING
    // Rank categories by: (articleCount * 2) + (totalViews / 100)
    // This prioritizes categories with both high content volume and engagement
    // ============================================================
    type CategoryAnalytics = {
      categoryId: string;
      slug: string;
      name: string;
      translatedName: string | null;
      articleCount: number;
      totalViews: number;
      score: number;
    };

    const categoryAnalyticsMap = new Map<string, CategoryAnalytics>();
    
    // OPTIMIZED: Fetch analytics for all categories in a single groupBy query
    // This replaces the slow sequential aggregate() calls
    const domainCategoryIds = (domainCats || [])
      .map((dc: any) => dc?.category?.id)
      .filter(Boolean) as string[];

    if (domainCategoryIds.length > 0) {
      // Single query to get article count and view sum per category
      const categoryStats = await p.tenantWebArticle.groupBy({
        by: ['categoryId'],
        where: {
          tenantId: tenant.id,
          status: 'PUBLISHED',
          categoryId: { in: domainCategoryIds },
          ...(domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length ? domainScope : {}),
          ...(languageId ? { OR: [{ languageId }, { languageId: null }] } : {})
        },
        _count: { id: true },
        _sum: { viewCount: true }
      }).catch(() => []);

      // Build a lookup map from the groupBy results
      const statsMap = new Map<string, { count: number; views: number }>();
      for (const stat of categoryStats) {
        if (stat.categoryId) {
          statsMap.set(stat.categoryId, {
            count: stat._count?.id || 0,
            views: stat._sum?.viewCount || 0
          });
        }
      }

      // Now populate categoryAnalyticsMap using the pre-fetched stats
      for (const dc of (domainCats || []) as any[]) {
        const cat = dc?.category;
        if (!cat?.id || !cat?.slug) continue;
        
        const catId = String(cat.id);
        const slug = String(cat.slug);
        const name = String(cat.name || slug);
        const translatedName = translatedNameByCategoryId.get(catId) || null;

        const stats = statsMap.get(catId) || { count: 0, views: 0 };
        const articleCount = stats.count;
        const totalViews = stats.views;
        // Score formula: prioritize categories with content volume + engagement
        const score = (articleCount * 2) + Math.floor(totalViews / 100);

        categoryAnalyticsMap.set(slug, {
          categoryId: catId,
          slug,
          name,
          translatedName,
          articleCount,
          totalViews,
          score
        });
      }
    }

    // Sort categories by score (highest first)
    const rankedCategories = Array.from(categoryAnalyticsMap.values())
      .filter(c => c.articleCount > 0) // Only include categories with content
      .sort((a, b) => b.score - a.score);

    // Track used categories to ensure each is used only once
    const usedCategorySlugs = new Set<string>();
    
    // Helper to get next best available category
    function getNextBestCategory(): CategoryAnalytics | null {
      for (const cat of rankedCategories) {
        if (!usedCategorySlugs.has(cat.slug)) {
          return cat;
        }
      }
      return null;
    }

    // Helper to mark category as used
    function markCategoryUsed(slug: string) {
      usedCategorySlugs.add(slug);
    }

    // Helper to get multiple categories (for multi-category sections)
    function getNextBestCategories(count: number): CategoryAnalytics[] {
      const result: CategoryAnalytics[] = [];
      for (const cat of rankedCategories) {
        if (result.length >= count) break;
        if (!usedCategorySlugs.has(cat.slug)) {
          result.push(cat);
        }
      }
      return result;
    }

    const defaultV2Sections: any[] = [
      { key: 'flashTicker', label: 'Flash News', limit: 10 },
      { key: 'toiGrid3', label: 'Top Stories', leftCategorySlug: null, centerLimit: 6, rightLatestLimit: 8, rightMostReadLimit: 8 },
      { key: 'topStoriesGrid', label: 'Top Stories', limit: 9 },
      { key: 'section3', label: 'More News', categorySlugs: ['technology', 'education', 'also-in-news'], perCategoryLimit: 5 },
      { key: 'section4', label: 'Categories', rows: 3, cols: 3, perCategoryLimit: 5 }
    ];

    const v2Cfg = (cfg as any)?.v2;
    const cfgSections = Array.isArray(v2Cfg?.sections) ? v2Cfg.sections : defaultV2Sections;
    const byKey = new Map<string, any>();
    for (const s of cfgSections) {
      const key = String(s?.key || '').trim();
      if (!key) continue;
      byKey.set(key, s);
    }

    const clampInt = (value: any, min: number, max: number, fallback: number) => {
      const n = parseInt(String(value), 10);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(Math.max(n, min), max);
    };

    function extractCategorySlugFromHref(href: string) {
      const h = String(href || '');
      const m = h.match(/^\/category\/([^/?#]+)/i);
      return m?.[1] ? String(m[1]) : null;
    }

    function resolveNavCategorySlugs(count: number) {
      const want = Math.min(Math.max(Number(count) || 0, 0), 25);
      const navMenu: any[] = Array.isArray((effective as any)?.navigation?.menu) ? (effective as any).navigation.menu : [];
      const seenSlugs = new Set<string>();
      const out: string[] = [];

      for (const item of navMenu) {
        const slug = extractCategorySlugFromHref(String(item?.href || ''));
        if (!slug) continue;
        if (seenSlugs.has(slug)) continue;
        if (!categoryBySlug.get(slug)) continue;
        seenSlugs.add(slug);
        out.push(slug);
        if (out.length >= want) return out;
      }

      const domainCatsSorted = (domainCats || [])
        .map((d: any) => d.category)
        .filter(Boolean)
        .slice()
        .sort((a: any, b: any) => {
          const an = (translatedNameByCategoryId.get(String(a?.id)) || a?.name || a?.slug || '').toString();
          const bn = (translatedNameByCategoryId.get(String(b?.id)) || b?.name || b?.slug || '').toString();
          return an.localeCompare(bn);
        });

      for (const c of domainCatsSorted) {
        const slug = c?.slug ? String(c.slug) : '';
        if (!slug) continue;
        if (seenSlugs.has(slug)) continue;
        seenSlugs.add(slug);
        out.push(slug);
        if (out.length >= want) return out;
      }

      return out;
    }

    async function fetchLatestCards(limit: number, offset = 0) {
      const take = Math.min(Math.max(limit, 1), 50);
      const skip = Math.max(parseInt(String(offset || 0), 10) || 0, 0);
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    async function fetchMostReadCards(limit: number, excludeIds?: Set<string>) {
      const want = Math.min(Math.max(limit, 1), 50);
      const take = Math.min(want + 25, 75);
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });

      const out: any[] = [];
      const seen = excludeIds ?? new Set<string>();
      for (const r of rows) {
        if (!r?.id) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(toCard(r));
        if (out.length >= want) break;
      }
      return out;
    }

    async function fetchCategoryCards(categorySlug: string, limit: number) {
      const slug = String(categorySlug || '').trim();
      if (!slug) return [];
      const resolvedCategory = categoryBySlug.get(slug) || null;
      if (!resolvedCategory) return [];

      const and: any[] = [];
      if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
      if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });
      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId: resolvedCategory.id };
      if (and.length) where.AND = and;

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    const flashTicker = byKey.get('flashTicker') ?? defaultV2Sections[0];
    const toiGrid3 = byKey.get('toiGrid3') ?? defaultV2Sections[1];
    const topStoriesGrid = byKey.get('topStoriesGrid') ?? defaultV2Sections[2];
    const section3 = byKey.get('section3') ?? defaultV2Sections[3];
    const section4 = byKey.get('section4') ?? defaultV2Sections[4];

    const makeCategoryInfo = (slugRaw: string, cat: any | null) => {
      const slug = String(slugRaw || '').trim();
      const name = cat?.id
        ? (translatedNameByCategoryId.get(String(cat.id)) || String(cat?.name || slug))
        : String(slug);
      // Backend stays frontend-agnostic: give a canonical website path.
      // Frontend can prefix tenant route if needed.
      const href = slug ? `/category/${encodeURIComponent(slug)}` : null;
      return { slug, name, href };
    };

    const flashTickerLimit = clampInt(flashTicker?.limit, 1, 50, 10);
    const centerLimit = clampInt(toiGrid3?.centerLimit, 1, 50, 6);
    const rightLatestLimit = clampInt(toiGrid3?.rightLatestLimit, 1, 50, 8);
    const rightMostReadLimit = clampInt(toiGrid3?.rightMostReadLimit, 1, 50, 8);

    const rightLatestLabel =
      typeof (toiGrid3 as any)?.rightLatestLabel === 'string' && String((toiGrid3 as any).rightLatestLabel).trim()
        ? String((toiGrid3 as any).rightLatestLabel).trim()
        : 'Latest News';
    const rightMostReadLabel =
      typeof (toiGrid3 as any)?.rightMostReadLabel === 'string' && String((toiGrid3 as any).rightMostReadLabel).trim()
        ? String((toiGrid3 as any).rightMostReadLabel).trim()
        : 'Most Read';

    // Use analytics-based category ranking instead of nav order
    const navSlugs = rankedCategories.map(c => c.slug);
    
    // Select best category for left panel (highest ranked)
    const topCategory = getNextBestCategory();
    const leftCategorySlug = topCategory?.slug || 
      (typeof toiGrid3?.leftCategorySlug === 'string' && toiGrid3.leftCategorySlug.trim()
        ? toiGrid3.leftCategorySlug.trim()
        : (navSlugs[0] || null));
    if (leftCategorySlug) markCategoryUsed(leftCategorySlug);

    const topStoriesLimit = clampInt(topStoriesGrid?.limit, 1, 50, 9);

    // Get next 3 best categories for section3 (category boxes)
    const section3PerCategoryLimit = clampInt(section3?.perCategoryLimit, 1, 50, 5);
    const section3Categories = getNextBestCategories(3);
    const section3Slugs = section3Categories.map(c => c.slug);
    section3Slugs.forEach(markCategoryUsed);

    // Get remaining categories for section4 grid
    const rows = clampInt(section4?.rows, 1, 10, 3);
    const cols = clampInt(section4?.cols, 1, 10, 3);
    const section4PerCategoryLimit = clampInt(section4?.perCategoryLimit, 1, 50, 5);
    const gridCount = Math.min(rows * cols, 25);
    const section4Categories = getNextBestCategories(gridCount);
    const gridSlugs = section4Categories.map(c => c.slug);
    gridSlugs.forEach(markCategoryUsed);

    // ============================================================
    // STYLE2 LAYOUT SECTIONS (matching frontend theme components)
    // ============================================================
    
    // Global article deduplication
    const globalUsedArticleIds = new Set<string>();
    
    // Helper to deduplicate articles
    function dedupeCards(cards: any[], limit: number): any[] {
      const result: any[] = [];
      for (const card of cards) {
        if (result.length >= limit) break;
        if (!card?.id) continue;
        if (globalUsedArticleIds.has(String(card.id))) continue;
        globalUsedArticleIds.add(String(card.id));
        result.push(card);
      }
      return result;
    }

    // 1. FLASH TICKER (breaking + latest news scroll)
    const tickerItems = await fetchLatestCards(flashTickerLimit + 10, 0);
    const dedupedTickerItems = dedupeCards(tickerItems, flashTickerLimit);

    // 2. HERO FEATURE (1 main article) + SECONDARY CARDS (4 articles)
    const heroItems = await fetchLatestCards(10, 0);
    const dedupedHeroItems = dedupeCards(heroItems, 1);
    const secondaryItems = await fetchLatestCards(15, 1);
    const dedupedSecondaryItems = dedupeCards(secondaryItems, 4);

    // 3. TRENDING WIDGET (sidebar - most viewed)
    const trendingItems = await fetchMostReadCards(10, globalUsedArticleIds);
    const dedupedTrendingItems = dedupeCards(trendingItems, 5);

    // 4. LATEST NEWS WIDGET (sidebar)
    const latestWidgetItems = await fetchLatestCards(20, 10);
    const dedupedLatestWidgetItems = dedupeCards(latestWidgetItems, 6);

    // 5. BREAKING NEWS
    const breakingItems = bestPracticeBreaking.filter((item: any) => 
      !globalUsedArticleIds.has(String(item?.id))
    ).slice(0, 5);
    breakingItems.forEach((item: any) => { if (item?.id) globalUsedArticleIds.add(String(item.id)); });

    // 6. TOI GRID (center latest + most read)
    const toiCenter = await fetchLatestCards(centerLimit + 5, 0);
    const dedupedToiCenter = dedupeCards(toiCenter, centerLimit);
    
    const toiRightLatest = await fetchLatestCards(rightLatestLimit + 5, centerLimit);
    const dedupedToiRightLatest = dedupeCards(toiRightLatest, rightLatestLimit);
    
    const toiRightMostRead = await fetchMostReadCards(rightMostReadLimit + 5, globalUsedArticleIds);
    const dedupedToiRightMostRead = dedupeCards(toiRightMostRead, rightMostReadLimit);

    // 7. LEFT CATEGORY PANEL (best category)
    const leftCategory = leftCategorySlug ? categoryBySlug.get(leftCategorySlug) || null : null;
    const toiLeftItems = leftCategorySlug
      ? await fetchCategoryCards(leftCategorySlug, 15)
      : [];
    const dedupedToiLeftItems = dedupeCards(toiLeftItems, 12);

    // 8. TOP STORIES GRID
    const topStoriesItems = await fetchLatestCards(topStoriesLimit + 5, 0);
    const dedupedTopStoriesItems = dedupeCards(topStoriesItems, topStoriesLimit);

    // ============================================================
    // STYLE2 CATEGORY SECTIONS (using analytics-ranked categories)
    // OPTIMIZED: Fetch all category articles in parallel using Promise.all
    // ============================================================

    // Collect all category slugs we need to fetch
    const allCategorySlugsToFetch = [
      ...section3Slugs,
      ...gridSlugs
    ];

    // Fetch all category items in parallel
    const categoryItemsResults = await Promise.all(
      allCategorySlugsToFetch.map(async (slug) => {
        const cat = categoryBySlug.get(slug) || null;
        if (!cat) return { slug, items: [] };
        const items = await fetchCategoryCards(slug, Math.max(section3PerCategoryLimit, section4PerCategoryLimit) + 3);
        return { slug, items };
      })
    );

    // Build lookup map for fetched items
    const categoryItemsMap = new Map<string, any[]>();
    for (const result of categoryItemsResults) {
      categoryItemsMap.set(result.slug, result.items);
    }

    // Section 3: Category Boxes (3 columns)
    const section3Blocks: any[] = [];
    for (const slug of section3Slugs) {
      const cat = categoryBySlug.get(slug) || null;
      const analytics = categoryAnalyticsMap.get(slug);
      if (!cat) continue;
      const items = categoryItemsMap.get(slug) || [];
      const dedupedItems = dedupeCards(items, section3PerCategoryLimit);
      section3Blocks.push({ 
        category: makeCategoryInfo(slug, cat),
        analytics: analytics ? { articleCount: analytics.articleCount, totalViews: analytics.totalViews, score: analytics.score } : null,
        items: dedupedItems 
      });
    }

    // Section 4: Category Grid (remaining categories) - use pre-fetched items
    const section4Cards: any[] = [];
    for (const slug of gridSlugs) {
      const cat = categoryBySlug.get(slug) || null;
      const analytics = categoryAnalyticsMap.get(slug);
      if (!cat) continue;
      const items = categoryItemsMap.get(slug) || [];
      const dedupedItems = dedupeCards(items, section4PerCategoryLimit);
      section4Cards.push({ 
        category: makeCategoryInfo(slug, cat),
        analytics: analytics ? { articleCount: analytics.articleCount, totalViews: analytics.totalViews, score: analytics.score } : null,
        items: dedupedItems 
      });
    }

    // ============================================================
    // ADDITIONAL STYLE2 SECTIONS (Magazine, Spotlight, Timeline, etc.)
    // ============================================================
    
    // Get more categories for additional sections
    const magazineCategory = getNextBestCategory();
    if (magazineCategory) markCategoryUsed(magazineCategory.slug);
    
    const spotlightCategory = getNextBestCategory();
    if (spotlightCategory) markCategoryUsed(spotlightCategory.slug);
    
    const timelineCategory = getNextBestCategory();
    if (timelineCategory) markCategoryUsed(timelineCategory.slug);
    
    const photoGalleryCategory = getNextBestCategory();
    if (photoGalleryCategory) markCategoryUsed(photoGalleryCategory.slug);

    // Compact Lists (2 columns with remaining categories)
    const compactListCategories = getNextBestCategories(2);
    compactListCategories.forEach(c => markCategoryUsed(c.slug));

    // OPTIMIZED: Fetch all additional section items in parallel
    const additionalSlugs = [
      magazineCategory?.slug,
      spotlightCategory?.slug,
      timelineCategory?.slug,
      photoGalleryCategory?.slug,
      ...compactListCategories.map(c => c.slug)
    ].filter(Boolean) as string[];

    const additionalItemsResults = await Promise.all(
      additionalSlugs.map(async (slug) => {
        const items = await fetchCategoryCards(slug, 12);
        return { slug, items };
      })
    );

    const additionalItemsMap = new Map<string, any[]>();
    for (const result of additionalItemsResults) {
      additionalItemsMap.set(result.slug, result.items);
    }

    // Magazine Grid Section
    let magazineGridData: any = null;
    if (magazineCategory) {
      const items = additionalItemsMap.get(magazineCategory.slug) || [];
      const dedupedItems = dedupeCards(items, 6);
      magazineGridData = {
        category: makeCategoryInfo(magazineCategory.slug, categoryBySlug.get(magazineCategory.slug)),
        analytics: { articleCount: magazineCategory.articleCount, totalViews: magazineCategory.totalViews, score: magazineCategory.score },
        themeColor: 'emerald',
        items: dedupedItems
      };
    }

    // Spotlight Section
    let spotlightData: any = null;
    if (spotlightCategory) {
      const items = additionalItemsMap.get(spotlightCategory.slug) || [];
      const dedupedItems = dedupeCards(items, 5);
      spotlightData = {
        category: makeCategoryInfo(spotlightCategory.slug, categoryBySlug.get(spotlightCategory.slug)),
        analytics: { articleCount: spotlightCategory.articleCount, totalViews: spotlightCategory.totalViews, score: spotlightCategory.score },
        themeColor: 'amber',
        items: dedupedItems
      };
    }

    // Timeline Section
    let timelineData: any = null;
    if (timelineCategory) {
      const items = additionalItemsMap.get(timelineCategory.slug) || [];
      const dedupedItems = dedupeCards(items, 8);
      timelineData = {
        category: makeCategoryInfo(timelineCategory.slug, categoryBySlug.get(timelineCategory.slug)),
        analytics: { articleCount: timelineCategory.articleCount, totalViews: timelineCategory.totalViews, score: timelineCategory.score },
        themeColor: 'indigo',
        items: dedupedItems
      };
    }

    // Photo Gallery Section  
    let photoGalleryData: any = null;
    if (photoGalleryCategory) {
      const items = additionalItemsMap.get(photoGalleryCategory.slug) || [];
      const dedupedItems = dedupeCards(items, 9);
      photoGalleryData = {
        category: makeCategoryInfo(photoGalleryCategory.slug, categoryBySlug.get(photoGalleryCategory.slug)),
        analytics: { articleCount: photoGalleryCategory.articleCount, totalViews: photoGalleryCategory.totalViews, score: photoGalleryCategory.score },
        themeColor: 'rose',
        items: dedupedItems
      };
    }

    // Compact Lists Data
    const compactListsData: any[] = [];
    for (const cat of compactListCategories) {
      const items = additionalItemsMap.get(cat.slug) || [];
      const dedupedItems = dedupeCards(items, 6);
      compactListsData.push({
        category: makeCategoryInfo(cat.slug, categoryBySlug.get(cat.slug)),
        analytics: { articleCount: cat.articleCount, totalViews: cat.totalViews, score: cat.score },
        items: dedupedItems
      });
    }

    // ============================================================
    // AD PLACEMENTS (Style2 layout positions)
    // ============================================================
    const adPlacements = [
      { id: 'ad_ticker_top', position: 'ticker_top', type: 'leaderboard', size: '728x90', description: 'Above flash ticker' },
      { id: 'ad_hero_sidebar', position: 'hero_sidebar', type: 'rectangle', size: '300x250', description: 'Right sidebar next to hero' },
      { id: 'ad_between_sections_1', position: 'after_hero', type: 'leaderboard', size: '728x90', description: 'After hero section' },
      { id: 'ad_sidebar_sticky', position: 'sidebar_sticky', type: 'rectangle', size: '300x600', description: 'Sticky sidebar ad' },
      { id: 'ad_between_sections_2', position: 'after_section3', type: 'leaderboard', size: '728x90', description: 'After category boxes' },
      { id: 'ad_inline_content', position: 'inline_content', type: 'native', size: 'fluid', description: 'Within article cards' },
      { id: 'ad_footer_banner', position: 'footer', type: 'leaderboard', size: '728x90', description: 'Above footer' },
      { id: 'ad_mobile_sticky', position: 'mobile_sticky', type: 'mobile_banner', size: '320x50', description: 'Mobile sticky bottom' }
    ];

    // ============================================================
    // BUILD RESPONSE - STYLE2 LAYOUT STRUCTURE
    // ============================================================
    const sections = [
      { id: 'flashTicker', type: 'flashTicker', label: String(flashTicker?.label || 'Flash News'), query: { kind: 'latest', limit: flashTickerLimit } },
      { id: 'heroFeature', type: 'heroFeature', label: 'Featured', query: { kind: 'latest', limit: 1 } },
      { id: 'secondaryCards', type: 'secondaryCards', label: 'Top Stories', query: { kind: 'latest', limit: 4 } },
      { id: 'trendingWidget', type: 'trendingWidget', label: 'ట్రెండింగ్ వార్తలు', labelEn: 'Trending News', query: { kind: 'mostRead', limit: 5 } },
      { id: 'latestNewsWidget', type: 'latestNewsWidget', label: 'తాజా వార్తలు', labelEn: 'Latest News', query: { kind: 'latest', limit: 6 } },
      {
        id: 'toiGrid3',
        type: 'toiGrid3',
        label: String(toiGrid3?.label || 'Top Stories'),
        query: {
          kind: 'toiGrid3',
          left: { kind: 'category', categorySlug: leftCategorySlug, limit: 12 },
          center: { kind: 'latest', limit: centerLimit },
          rightLatest: { kind: 'latest', label: rightLatestLabel, limit: rightLatestLimit, offset: centerLimit },
          rightMostRead: { kind: 'mostRead', label: rightMostReadLabel, limit: rightMostReadLimit, metric: 'viewCount' }
        }
      },
      { id: 'topStoriesGrid', type: 'topStoriesGrid', label: String(topStoriesGrid?.label || 'Top Stories'), query: { kind: 'latest', limit: topStoriesLimit } },
      { id: 'categoryBoxes3Col', type: 'categoryBoxes3Col', label: 'Categories', query: { kind: 'categories', categorySlugs: section3Slugs, perCategoryLimit: section3PerCategoryLimit } },
      { id: 'magazineGrid', type: 'magazineGrid', label: magazineCategory?.translatedName || magazineCategory?.name || 'Magazine', themeColor: 'emerald', categorySlug: magazineCategory?.slug },
      { id: 'spotlight', type: 'spotlight', label: spotlightCategory?.translatedName || spotlightCategory?.name || 'Spotlight', themeColor: 'amber', categorySlug: spotlightCategory?.slug },
      { id: 'timeline', type: 'timeline', label: timelineCategory?.translatedName || timelineCategory?.name || 'Timeline', themeColor: 'indigo', categorySlug: timelineCategory?.slug },
      { id: 'photoGallery', type: 'photoGallery', label: photoGalleryCategory?.translatedName || photoGalleryCategory?.name || 'Photo Gallery', themeColor: 'rose', categorySlug: photoGalleryCategory?.slug },
      { id: 'categoryGrid', type: 'categoryGrid', label: String(section4?.label || 'Categories'), query: { kind: 'categoriesGrid', rows, cols, categorySlugs: gridSlugs, perCategoryLimit: section4PerCategoryLimit } },
      { id: 'compactLists2Col', type: 'compactLists2Col', label: 'More News', categorySlugs: compactListCategories.map(c => c.slug) }
    ].filter(s => {
      // Filter out sections that don't have data
      if (s.id === 'magazineGrid' && !magazineGridData) return false;
      if (s.id === 'spotlight' && !spotlightData) return false;
      if (s.id === 'timeline' && !timelineData) return false;
      if (s.id === 'photoGallery' && !photoGalleryData) return false;
      if (s.id === 'compactLists2Col' && compactListsData.length === 0) return false;
      return true;
    });

    const data = {
      flashTicker: dedupedTickerItems,
      heroFeature: dedupedHeroItems[0] || null,
      secondaryCards: dedupedSecondaryItems,
      trendingWidget: dedupedTrendingItems,
      latestNewsWidget: dedupedLatestWidgetItems,
      breaking: breakingItems,
      toiGrid3: {
        left: leftCategorySlug
          ? {
              category: makeCategoryInfo(leftCategorySlug, leftCategory),
              analytics: categoryAnalyticsMap.get(leftCategorySlug) ? {
                articleCount: categoryAnalyticsMap.get(leftCategorySlug)!.articleCount,
                totalViews: categoryAnalyticsMap.get(leftCategorySlug)!.totalViews,
                score: categoryAnalyticsMap.get(leftCategorySlug)!.score
              } : null,
              items: dedupedToiLeftItems
            }
          : { category: null, items: [] },
        center: dedupedToiCenter,
        right: {
          latest: { label: rightLatestLabel, kind: 'latest', items: dedupedToiRightLatest },
          mostRead: { label: rightMostReadLabel, kind: 'mostRead', metric: 'viewCount', items: dedupedToiRightMostRead }
        }
      },
      topStoriesGrid: dedupedTopStoriesItems,
      categoryBoxes3Col: section3Blocks,
      magazineGrid: magazineGridData,
      spotlight: spotlightData,
      timeline: timelineData,
      photoGallery: photoGalleryData,
      categoryGrid: { rows, cols, cards: section4Cards },
      compactLists2Col: compactListsData
    };

    // Category analytics summary for debugging/insights
    const categoryAnalyticsSummary = rankedCategories.slice(0, 15).map(c => ({
      slug: c.slug,
      name: c.translatedName || c.name,
      articleCount: c.articleCount,
      totalViews: c.totalViews,
      score: c.score,
      usedInSection: usedCategorySlugs.has(c.slug)
    }));

    return res.json({
      version: '2.1',
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        displayName: (tenant as any).displayName || tenant.name,
        nativeName: (tenant as any).nativeName || null,
        language: (tenant as any).primaryLanguage || null,
      },
      theme: { key: 'style2' },
      feeds,
      adPlacements,
      sections,
      data,
      analytics: {
        categoryRanking: categoryAnalyticsSummary,
        totalCategoriesUsed: usedCategorySlugs.size,
        totalArticlesDeduped: globalUsedArticleIds.size
      }
    });
  }

  // ============================================================
  // Style2: Unified Theme Configuration
  // - Uses Style2 theme configuration stored in TenantTheme
  // - Sections defined with section_type, categories, and theme_colors
  // - Advanced section types with structured configuration
  // ============================================================
  if (wantsStyle2) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    // Get Style2 theme configuration from TenantTheme
    const homepageConfig = (tenantTheme as any)?.homepageConfig || {};
    const style2Config = homepageConfig.style2 || {};
    const themeConfig = style2Config.themeConfig || { sections: [] };

    // Best practice: do not fail the public homepage when theme config is missing.
    // Instead, derive a reasonable, domain-driven default so new tenants don't see an empty site.
    let effectiveThemeConfig: any = themeConfig;
    let usedFallbackThemeConfig = false;
    if (!Array.isArray(themeConfig.sections) || themeConfig.sections.length === 0) {
      usedFallbackThemeConfig = true;
      const slugs = resolveHomepageCategorySlugs(12);
      const c1 = slugs.slice(0, 3);
      const c2 = slugs.slice(3, 6);
      const c3 = slugs.slice(6, 9);

      effectiveThemeConfig = {
        sections: [
          {
            id: 1,
            position: 1,
            section_type: 'hero_sidebar',
            hero_category: 'latest',
            sidebar_category: 'trending',
            bottom_category: 'latest'
          },
          {
            id: 2,
            position: 2,
            section_type: 'spotlight',
            category: 'breaking',
            theme_color: 'amber'
          },
          ...(c1.length
            ? [
                {
                  id: 3,
                  position: 3,
                  section_type: 'category_boxes_3col',
                  categories: c1
                }
              ]
            : []),
          ...(c2.length
            ? [
                {
                  id: 4,
                  position: 4,
                  section_type: 'small_cards_3col',
                  categories: c2
                }
              ]
            : []),
          ...(c3.length
            ? [
                {
                  id: 5,
                  position: 5,
                  section_type: 'newspaper_columns',
                  categories: c3,
                  theme_color: 'blue'
                }
              ]
            : []),
          {
            id: 6,
            position: 6,
            section_type: 'timeline',
            category: 'latest',
            theme_color: 'indigo'
          }
        ]
      };
    }

    // Helper to fetch articles based on section configuration
    async function fetchSectionData(section: any) {
      const sectionData: any = {
        id: section.id,
        position: section.position,
        section_type: section.section_type,
        ...(section.theme_color && { theme_color: section.theme_color }),
      };

      // Handle different section types and their data requirements
      switch (section.section_type) {
        case 'hero_sidebar': {
          // Fetch hero, sidebar, and bottom content
          const heroCategory = section.hero_category || 'latest';
          const sidebarCategory = section.sidebar_category || 'trending';
          const bottomCategory = section.bottom_category || 'latest';

          const [heroItems, sidebarItems, bottomItems] = await Promise.all([
            fetchCategoryItems(heroCategory, 3),
            fetchCategoryItems(sidebarCategory, 5),
            fetchCategoryItems(bottomCategory, 8)
          ]);

          sectionData.hero_category = heroCategory;
          sectionData.sidebar_category = sidebarCategory;
          sectionData.bottom_category = bottomCategory;
          sectionData.data = {
            hero: heroItems,
            sidebar: sidebarItems,
            bottom: bottomItems
          };
          break;
        }

        case 'category_boxes_3col':
        case 'small_cards_3col':
        case 'newspaper_columns':
        case 'compact_lists_2col': {
          // Multi-category sections
          if (Array.isArray(section.categories) && section.categories.length > 0) {
            const categoryData = await Promise.all(
              section.categories.map(async (catSlug: string) => {
                const items = await fetchCategoryItems(catSlug, 6);
                const category = categoryBySlug.get(catSlug) || null;
                return {
                  category: makeHomepageCategoryInfo(catSlug, category),
                  items,
                  message: items.length ? null : 'No articles posted yet in this category.'
                };
              })
            );
            sectionData.categories = section.categories;
            sectionData.data = categoryData;
          } else {
            sectionData.categories = [];
            sectionData.data = [];
          }
          break;
        }

        case 'magazine_grid':
        case 'horizontal_scroll':
        case 'spotlight':
        case 'horizontal_cards':
        case 'photo_gallery':
        case 'timeline':
        case 'featured_banner': {
          // Single-category sections
          if (section.category) {
            const items = await fetchCategoryItems(section.category, 12);
            const category = categoryBySlug.get(section.category) || null;
            sectionData.category = section.category;
            sectionData.data = {
              category: makeHomepageCategoryInfo(section.category, category),
              items,
              message: items.length ? null : 'No articles posted yet in this category.'
            };
          } else {
            sectionData.category = null;
            sectionData.data = { category: null, items: [] };
          }
          break;
        }

        default:
          sectionData.data = [];
          break;
      }

      return sectionData;
    }

    // Helper to fetch category items or special feeds
    async function fetchCategoryItems(categoryOrType: string, limit: number) {
      const take = Math.min(Math.max(limit, 1), 50);
      
      if (categoryOrType === 'latest') {
        const rows = await p.tenantWebArticle.findMany({
          where: baseWhere,
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take,
          include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
        });
        return rows.map(toCard);
      }

      if (categoryOrType === 'trending' || categoryOrType === 'popular') {
        const rows = await p.tenantWebArticle.findMany({
          where: baseWhere,
          orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
          take,
          include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
        });
        return rows.map(toCard);
      }

      if (categoryOrType === 'breaking') {
        const rows = await p.tenantWebArticle.findMany({
          where: { ...baseWhere, isBreaking: true },
          orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
          take,
          include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
        });
        return rows.map(toCard);
      }

      // Regular category
      const category = categoryBySlug.get(categoryOrType) || null;
      if (!category) return [];

      const and: any[] = [];
      if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
      if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });
      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId: category.id };
      if (and.length) where.AND = and;

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    // Fetch data for all sections
    const sectionsWithData = await Promise.all(
      effectiveThemeConfig.sections.map(fetchSectionData)
    );

    // Add default extra sections if not already configured
    const extraSections = createDefaultExtraSections();
    const configuredKeys = new Set((effectiveThemeConfig.sections || []).map((s: any) => s.section_type));
    const additionalSections = [];

    for (const extraSection of extraSections) {
      // Check if this type of section is already configured
      const sectionKey = extraSection.key.replace('-', '_');
      if (!configuredKeys.has(sectionKey) && !sectionsWithData.some((s: any) => s.section_type === sectionKey)) {
        const sectionData: any = {
          id: sectionsWithData.length + additionalSections.length + 1,
          position: extraSection.position,
          section_type: sectionKey,
          theme_color: 'slate'
        };

        // Fetch data based on section type
        if (extraSection.queryType === 'trending' || extraSection.queryType === 'most-viewed') {
          const items = await fetchCategoryItems('trending', extraSection.limit);
          sectionData.data = {
            category: { slug: 'trending', name: extraSection.title, href: '/trending' },
            items
          };
        }

        sectionsWithData.push(sectionData);
        additionalSections.push(sectionData);
      }
    }

    // Sort sections by position
    sectionsWithData.sort((a: any, b: any) => (a.position || 999) - (b.position || 999));

    return res.json({
      success: true,
      data: {
        feeds,
        sections: sectionsWithData,
        meta: usedFallbackThemeConfig
          ? { fallbackUsed: true, message: 'No Style2 theme configuration found; using domain-driven fallback sections.' }
          : { fallbackUsed: false }
      }
    });
  }

  // ============================================================
  // Legacy Shape (Default): Fallback for backward compatibility
  // ============================================================
  if (wantsStyle2V3) {
    res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');

    // Helper to clamp integer values
    const clampInt = (value: any, min: number, max: number, fallback: number) => {
      const n = parseInt(String(value), 10);
      if (!Number.isFinite(n)) return fallback;
      return Math.min(Math.max(n, min), max);
    };

    // Fetch articles for a category
    async function fetchCategoryCardsV3(categorySlug: string, limit: number) {
      const slug = String(categorySlug || '').trim();
      if (!slug) return [];
      const resolvedCategory = categoryBySlug.get(slug) || null;
      // Fall back to global Category if not in domain categories
      const cat = resolvedCategory || await p.category.findUnique({ where: { slug } }).catch(() => null);
      if (!cat || cat.isDeleted) return [];

      const and: any[] = [];
      if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
      if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });
      const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId: cat.id };
      if (and.length) where.AND = and;

      const rows = await p.tenantWebArticle.findMany({
        where,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: Math.min(Math.max(limit, 1), 50),
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    // Fetch latest articles with offset
    async function fetchLatestCardsV3(limit: number, offset = 0) {
      const take = Math.min(Math.max(limit, 1), 50);
      const skip = Math.max(parseInt(String(offset || 0), 10) || 0, 0);
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take,
        skip,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    // Fetch most read articles (by readCount or viewCount)
    async function fetchMostReadCardsV3(limit: number, excludeIds?: Set<string>) {
      const want = Math.min(Math.max(limit, 1), 50);
      const take = want + 30; // fetch extra to exclude already shown
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      const out: any[] = [];
      const seen = excludeIds ?? new Set<string>();
      for (const r of rows) {
        if (!r?.id) continue;
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        out.push(toCard(r));
        if (out.length >= want) break;
      }
      return out;
    }

    // Use DB sections if available
    const dbSections = (dbHomepageSections || []) as any[];

    // If no sections configured in DB, return an informative response
    if (!dbSections.length) {
      return res.json({
        version: '3.0',
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          displayName: (tenant as any).displayName || tenant.name,
          nativeName: (tenant as any).nativeName || null,
          language: (tenant as any).primaryLanguage || null,
        },
        theme: { key: 'style2' },
        message: 'No HomepageSectionConfig records found for this tenant/domain. Use admin API to configure sections.',
        sections: [],
        data: { hero: { center: [], right: { latest: [], mostRead: [] } }, sections: [] }
      });
    }

    // ========================================
    // HERO SECTION:
    // - Supports both legacy 'hero' style and new 'hero_sidebar' sectionType
    // - center: Latest articles (based on queryKind)
    // - right.latest: Latest articles (offset)
    // - right.mostRead: Top by viewCount
    // ========================================
    const heroConfig = dbSections.find((s: any) => 
      String(s.style || '').toLowerCase() === 'hero' || 
      String(s.sectionType || '').toLowerCase() === 'hero_sidebar'
    ) || null;
    const heroCenterLimit = clampInt(heroConfig?.articleLimit, 1, 30, 15);

    // Hero center: latest articles (or configured limit)
    const heroCenter = await fetchLatestCardsV3(heroCenterLimit, 0);

    // Hero right latest: next 15 articles
    const heroRightLatest = await fetchLatestCardsV3(15, heroCenterLimit);

    // Collect IDs already shown to exclude from most read
    const shownIds = new Set<string>();
    for (const c of heroCenter) if (c?.id) shownIds.add(String(c.id));
    for (const c of heroRightLatest) if (c?.id) shownIds.add(String(c.id));

    // Hero right most read: top by viewCount
    let heroRightMostRead = await fetchMostReadCardsV3(3, new Set(shownIds));

    // If most read has fewer than 3 visible, fill with fallback latest
    if (heroRightMostRead.length < 3) {
      const needed = 3 - heroRightMostRead.length;
      const fallbackOffset = heroCenterLimit + 15;
      const fallbackItems = await fetchLatestCardsV3(needed + 5, fallbackOffset);
      for (const item of fallbackItems) {
        if (heroRightMostRead.length >= 3) break;
        if (!item?.id) continue;
        if (shownIds.has(String(item.id))) continue;
        heroRightMostRead.push(item);
        shownIds.add(String(item.id));
      }
    }

    // ========================================
    // Fetch trending articles (for sections with queryKind='trending')
    // ========================================
    async function fetchTrendingCardsV3(limit: number) {
      const take = Math.min(Math.max(limit, 1), 50);
      const rows = await p.tenantWebArticle.findMany({
        where: baseWhere,
        orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
        take,
        include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
      });
      return rows.map(toCard);
    }

    // ========================================
    // Fetch articles for multi-category sections
    // ========================================
    async function fetchMultiCategoryCardsV3(categorySlugsArr: string[], limitPerCategory: number) {
      const results: { slug: string; name: string | null; items: any[] }[] = [];
      for (const slug of categorySlugsArr) {
        if (!slug) continue;
        const cat = categoryBySlug.get(slug) || await p.category.findUnique({ where: { slug } }).catch(() => null);
        if (!cat || cat.isDeleted) continue;
        const items = await fetchCategoryCardsV3(slug, limitPerCategory);
        const translatedName = translatedNameByCategoryId.get(cat.id) || cat.name || slug;
        results.push({ slug, name: translatedName, items });
      }
      return results;
    }

    // ========================================
    // CATEGORY SECTIONS (non-hero)
    // - Supports new sectionType and queryKind fields
    // - Label = category translation (tenant language)
    // ========================================
    const regularSections = dbSections.filter((s: any) => 
      String(s.style || '').toLowerCase() !== 'hero' && 
      String(s.sectionType || '').toLowerCase() !== 'hero_sidebar'
    );
    const sectionsData: any[] = [];

    for (const sec of regularSections) {
      const key = String(sec.key || '');
      if (!key) continue;

      const limit = clampInt(sec.articleLimit, 1, 50, 6);
      const sectionType = String(sec.sectionType || 'category_cards');
      const queryKind = String(sec.queryKind || 'category');
      const slug = sec.categorySlug ? String(sec.categorySlug) : null;

      // Get translated category name (tenant language) - this becomes the section label
      let categoryName: string | null = null;
      let categoryHref: string | null = null;
      if (sec.category) {
        const catId = String(sec.category.id || '');
        categoryName = translatedNameByCategoryId.get(catId) || sec.category.name || slug;
        categoryHref = slug ? `/category/${encodeURIComponent(slug)}` : null;
      }

      // Label priority: DB label > category translation > labelEn > key
      const label = sec.label && sec.label.trim()
        ? sec.label.trim()
        : (categoryName || sec.labelEn || key);

      let items: any[] = [];
      let multiCategoryData: { slug: string; name: string | null; items: any[] }[] | null = null;

      // Determine which fetch method to use based on queryKind
      if (queryKind === 'latest') {
        items = await fetchLatestCardsV3(limit, 0);
      } else if (queryKind === 'trending' || queryKind === 'most_viewed') {
        items = await fetchTrendingCardsV3(limit);
      } else if (queryKind === 'category') {
        // Check for multi-category section types
        const multiCatTypes = ['category_boxes_3col', 'small_cards_3col', 'newspaper_columns', 'compact_lists_2col'];
        if (multiCatTypes.includes(sectionType) && Array.isArray(sec.categorySlugs) && sec.categorySlugs.length > 0) {
          // Multi-category section: fetch from each category
          multiCategoryData = await fetchMultiCategoryCardsV3(sec.categorySlugs as string[], Math.ceil(limit / sec.categorySlugs.length) || 6);
          items = multiCategoryData.flatMap(c => c.items);
        } else if (slug) {
          items = await fetchCategoryCardsV3(slug, limit);
        } else {
          // No category = show latest articles as fallback
          items = await fetchLatestCardsV3(limit, 0);
        }
      }

      const sectionData: any = {
        key,
        title: label,
        titleEn: sec.labelEn || null,
        style: sec.style || 'cards',
        sectionType,
        queryKind,
        position: sec.position || 0,
        category: slug ? { slug, name: categoryName, href: categoryHref, iconUrl: sec.category?.iconUrl || null } : null,
        items
      };

      // Add multi-category data if applicable
      if (multiCategoryData) {
        sectionData.categories = multiCategoryData.map(c => ({
          slug: c.slug,
          name: c.name,
          href: `/category/${encodeURIComponent(c.slug)}`,
          items: c.items
        }));
      }

      // Add secondary/tertiary category info for hero_sidebar type (if used on non-hero sections)
      if (sec.secondaryCategory) {
        const secCatId = String(sec.secondaryCategory.id || '');
        sectionData.secondaryCategory = {
          slug: sec.secondaryCategorySlug,
          name: translatedNameByCategoryId.get(secCatId) || sec.secondaryCategory.name,
          iconUrl: sec.secondaryCategory.iconUrl || null
        };
      }
      if (sec.tertiaryCategory) {
        const terCatId = String(sec.tertiaryCategory.id || '');
        sectionData.tertiaryCategory = {
          slug: sec.tertiaryCategorySlug,
          name: translatedNameByCategoryId.get(terCatId) || sec.tertiaryCategory.name,
          iconUrl: sec.tertiaryCategory.iconUrl || null
        };
      }

      sectionsData.push(sectionData);
    }

    // Sort sections by position
    sectionsData.sort((a, b) => (a.position || 0) - (b.position || 0));

    // Build section metadata for frontend
    const sectionsMeta = dbSections.map((s: any) => {
      // For category-linked sections, use category translation as label
      let displayLabel = s.label || s.labelEn || s.key;
      if (s.category?.id) {
        const catTranslation = translatedNameByCategoryId.get(String(s.category.id));
        if (catTranslation) displayLabel = catTranslation;
      }
      return {
        key: s.key,
        label: displayLabel,
        labelEn: s.labelEn || null,
        style: s.style || 'cards',
        sectionType: s.sectionType || 'category_cards',
        queryKind: s.queryKind || 'category',
        position: s.position || 0,
        categorySlug: s.categorySlug || null,
        secondaryCategorySlug: s.secondaryCategorySlug || null,
        tertiaryCategorySlug: s.tertiaryCategorySlug || null,
        categorySlugs: Array.isArray(s.categorySlugs) ? s.categorySlugs : null,
        articleLimit: s.articleLimit || 6
      };
    });

    return res.json({
      version: '3.0',
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        displayName: (tenant as any).displayName || tenant.name,
        nativeName: (tenant as any).nativeName || null,
        language: (tenant as any).primaryLanguage || null,
      },
      theme: { key: 'style2', style: domainThemeStyle || 'style2' },
      feeds,
      sections: sectionsMeta,
      data: {
        hero: {
          center: heroCenter,
          right: {
            latest: heroRightLatest,
            mostRead: heroRightMostRead
          }
        },
        sections: sectionsData
      }
    });
  }

  const normalized = sectionsCfg
    .map((s: any) => ({
      key: String(s.key || ''),
      title: s.title ? String(s.title) : undefined,
      position: typeof s.position === 'number' ? s.position : (parseInt(String(s.position || '999'), 10) || 999),
      style: s.style ? String(s.style) : undefined,
      limit: Math.min(Math.max(parseInt(String(s.limit || '6'), 10) || 6, 1), 50),
      categorySlug: s.categorySlug ? String(s.categorySlug) : undefined,
      tagsHas: s.tagsHas ? String(s.tagsHas) : undefined,
    }))
    .filter((s: any) => s.key);

  const sortedSections = normalized.sort((a: any, b: any) => a.position - b.position);

  const usedArticleIds = new Set<string>();
  for (const c of [...hero, ...topStories]) if (c?.id) usedArticleIds.add(String(c.id));
  const usedCategorySlugs = new Set<string>();

  // When DomainCategory is not configured for a domain, fall back to global Category lookup.
  const hasDomainCategoryConfig = (domainCats || []).length > 0;
  const globalCategoryCache = new Map<string, any>();
  async function resolveCategoryBySlug(slug: string) {
    const s = String(slug || '').trim();
    if (!s) return null;
    const fromDomain = categoryBySlug.get(s) || null;
    if (fromDomain) return fromDomain;
    if (hasDomainCategoryConfig) return null;
    if (globalCategoryCache.has(s)) return globalCategoryCache.get(s);
    const row = await p.category.findUnique({ where: { slug: s } }).catch(() => null);
    const safe = row && !row.isDeleted ? row : null;
    globalCategoryCache.set(s, safe);
    return safe;
  }

  const candidateCategorySlugs: string[] = [];
  const seenCandidate = new Set<string>();
  // Prefer domain categories when available.
  for (const d of (domainCats || [])) {
    const slug = d?.category?.slug ? String(d.category.slug) : '';
    if (!slug || seenCandidate.has(slug)) continue;
    seenCandidate.add(slug);
    candidateCategorySlugs.push(slug);
  }
  // Otherwise, infer from latest content.
  if (!candidateCategorySlugs.length) {
    for (const r of baseRows) {
      const slug = r?.category?.slug ? String(r.category.slug) : '';
      if (!slug || seenCandidate.has(slug)) continue;
      seenCandidate.add(slug);
      candidateCategorySlugs.push(slug);
      if (candidateCategorySlugs.length >= 25) break;
    }
  }

  function pushCardsDedup(out: any[], rows: any[], want: number, opts?: { allowSeen?: boolean }) {
    const allowSeen = Boolean(opts?.allowSeen);
    for (const r of rows) {
      if (out.length >= want) break;
      if (!r?.id) continue;
      const id = String(r.id);
      if (!allowSeen && usedArticleIds.has(id)) continue;
      if (!allowSeen) usedArticleIds.add(id);
      out.push(toCard(r));
    }
  }

  async function fetchLatestRows(take: number, tagsHas?: string | null) {
    const where: any = { ...baseWhere };
    if (tagsHas) where.tags = { has: tagsHas };
    return p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(take, 1), 100),
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
  }

  async function fetchCategoryRows(categoryId: string, take: number, tagsHas?: string | null) {
    const and: any[] = [];
    if (domainScope && typeof domainScope === 'object' && Object.keys(domainScope).length) and.push(domainScope);
    if (languageId) and.push({ OR: [{ languageId }, { languageId: null }] });
    if (allowedCategoryIds.size) {
      and.push({ OR: [{ categoryId: { in: Array.from(allowedCategoryIds) } }, { categoryId: null }] });
    }

    const where: any = { tenantId: tenant.id, status: 'PUBLISHED', categoryId };
    if (and.length) where.AND = and;
    if (tagsHas) where.tags = { has: tagsHas };

    return p.tenantWebArticle.findMany({
      where,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: Math.min(Math.max(take, 1), 100),
      include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
    });
  }

  const sectionRows: any[] = [];
  for (const s of sortedSections as any[]) {
    const want = Math.min(Math.max(Number((s as any).limit || 6) || 6, 1), 50);

    let effectiveSlug = (s as any).categorySlug ? String((s as any).categorySlug) : '';
    let resolvedCategory = effectiveSlug ? await resolveCategoryBySlug(effectiveSlug) : null;

    // Phase 1: primary category (if configured)
    let primaryRows: any[] = [];
    if (resolvedCategory?.id) {
      primaryRows = await fetchCategoryRows(String(resolvedCategory.id), want + 25, (s as any).tagsHas || null);
    }

    const items: any[] = [];
    pushCardsDedup(items, primaryRows, want, { allowSeen: false });

    // Phase 2: if configured category is missing or has no volume, pick a fallback category that exists and has content.
    if (!items.length) {
      for (const slug of candidateCategorySlugs) {
        if (!slug || usedCategorySlugs.has(slug)) continue;
        // eslint-disable-next-line no-await-in-loop
        const cat = await resolveCategoryBySlug(slug);
        if (!cat?.id) continue;
        // eslint-disable-next-line no-await-in-loop
        const rows = await fetchCategoryRows(String(cat.id), want + 25, (s as any).tagsHas || null);
        const tmp: any[] = [];
        pushCardsDedup(tmp, rows, want, { allowSeen: false });
        if (tmp.length) {
          effectiveSlug = slug;
          resolvedCategory = cat;
          items.push(...tmp);
          break;
        }
      }
    }

    // Phase 3: backfill from latest if still short.
    if (items.length < want) {
      const latestRows = await fetchLatestRows(want + 50, (s as any).tagsHas || null);
      pushCardsDedup(items, latestRows, want, { allowSeen: false });
    }

    // Phase 4 (last resort): allow repeats so UI never goes empty.
    if (items.length < want) {
      const latestRows = await fetchLatestRows(want + 50, (s as any).tagsHas || null);
      pushCardsDedup(items, latestRows, want, { allowSeen: true });
    }

    if (effectiveSlug) usedCategorySlugs.add(effectiveSlug);

    const translatedTitle = resolvedCategory?.id ? (translatedNameByCategoryId.get(String(resolvedCategory.id)) || null) : null;
    sectionRows.push({
      ...s,
      title: (s as any).title || translatedTitle || (resolvedCategory?.name || (s as any).key),
      categorySlug: effectiveSlug || null,
      items
    });
  }

  // Add default extra sections if not already configured
  const extraSections = createDefaultExtraSections();
  const configuredKeys = new Set(sectionRows.map((s: any) => s.key));

  for (const extraSection of extraSections) {
    if (!configuredKeys.has(extraSection.key)) {
      const sectionData = await fetchExtraSection(extraSection, usedArticleIds);
      sectionRows.push({
        key: sectionData.key,
        title: sectionData.title,
        position: sectionData.position,
        style: sectionData.style,
        limit: sectionData.limit,
        categorySlug: null,
        items: sectionData.items
      });
    }
  }

  // Sort sections by position
  sectionRows.sort((a: any, b: any) => (a.position || 999) - (b.position || 999));

  // Backward-compat: expose section items also at top-level by key
  const sectionsByKey: any = {};
  for (const s of sectionRows as any[]) {
    sectionsByKey[s.key] = s.items;
  }

  res.json({
    hero,
    topStories,
    sections: sectionRows,
    ...sectionsByKey,
    feeds,
    config: {
      heroCount,
      topStoriesCount,
      sections: normalized
    }
  });
});

/**
 * @swagger
 * /public/live-desk:
 *   get:
 *     summary: Latest brief/live desk items
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Live desk cards
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
   *                   - id: "wa_10"
   *                     slug: "breaking-10"
  *                     title: "Breaking"
   *                     image: "https://cdn.example.com/cover.webp"
   *                     excerpt: "Short summary..."
 */
router.get('/live-desk', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '12'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = domain?.id
    ? (activeDomainCount <= 1 ? { OR: [{ domainId: domain.id }, { domainId: null }] } : { domainId: domain.id })
    : {};

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', tags: { has: 'breaking' }, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  res.json(rows.map(toCard));
});

/**
 * @swagger
 * /public/webstories:
 *   get:
 *     summary: Web story style articles
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Web story cards
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
   *                   - id: "wa_ws1"
   *                     slug: "webstory-1"
  *                     title: "Story"
   *                     image: "https://cdn.example.com/poster.webp"
 */
router.get('/webstories', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10), 1), 50);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = domain?.id
    ? (activeDomainCount <= 1 ? { OR: [{ domainId: domain.id }, { domainId: null }] } : { domainId: domain.id })
    : {};

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', tags: { has: 'web_story' }, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: limit,
    include: { category: { select: { id: true, slug: true, name: true } }, language: { select: { code: true } } }
  });
  res.json(rows.map(toCard));
});

/**
 * @swagger
 * /public/tags/popular:
 *   get:
 *     summary: Popular tags for tenant
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
  *       200:
  *         description: Array of tag strings
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - "politics"
  *                   - "sports"
  *                   - "technology"
 */
router.get('/tags/popular', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10), 1), 50);
  const articles = await p.article.findMany({ where: { tenantId: tenant.id, status: 'PUBLISHED' }, select: { tags: true } });
  const freq: Record<string, number> = {};
  articles.forEach((a: any) => (a.tags || []).forEach((t: string) => { freq[t] = (freq[t] || 0) + 1; }));
  const popular = Object.entries(freq).sort((a,b) => b[1]-a[1]).map(e => e[0]).slice(0, limit);
  res.json(popular);
});

/**
 * @swagger
 * /public/cities:
 *   get:
 *     summary: List of cities (placeholder derived from categories with slug prefix city-)
 *     tags: [Public - Website]
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
  *         description: Array of city names
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - "Hyderabad"
  *                   - "Warangal"
 */
router.get('/cities', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  // Attempt to infer city categories (slug starts with city-)
  const categories = await p.category.findMany({ where: { slug: { startsWith: 'city-' } } });
  const cities = categories.map((c: any) => c.name);
  res.json(cities.slice(0, 50));
});

/**
 * @swagger
 * /public/newsletter:
 *   post:
 *     summary: Subscribe to newsletter
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema:
 *           type: string
 *           example: news.kaburlu.com
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string }
 *               source: { type: string }
 *             required: [email]
 *     responses:
  *       200:
  *         description: Subscription result
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   success: true
 */
router.post('/newsletter', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const { email, source } = req.body || {};
  if (!email || typeof email !== 'string') return res.status(400).json({ success: false, error: 'Email required' });
  const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  if (!emailRegex.test(email)) return res.status(400).json({ success: false, error: 'Invalid email' });
  await p.newsletterSubscription.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email } },
    update: { source },
    create: { tenantId: tenant.id, email, source }
  });
  res.json({ success: true });
});

/**
 * @swagger
 * /public/reporters:
 *   get:
 *     summary: Public reporter directory
 *     tags: [Public - Website]
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
  *         description: Reporter list
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   - id: "rep1"
  *                     name: "John"
  *                     level: "SENIOR"
 */
router.get('/reporters', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const reporters = await p.reporter.findMany({ where: { tenantId: tenant.id }, select: { id: true, name: true, level: true, role: true, createdAt: true } }).catch(()=>[]);
  res.json(reporters);
});

// ---------- SEO Endpoints ----------

/**
 * @swagger
 * /public/seo/site:
 *   get:
 *     summary: Site-level JSON-LD (WebSite + Organization)
 *     tags: [Public - Website]
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
  *         description: JSON-LD objects
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   website:
  *                     "@type": "WebSite"
  *                   organization:
  *                     "@type": "NewsMediaOrganization"
 */
router.get('/seo/site', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain?.domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });
  const theme = await p.tenantTheme.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const entity = await p.tenantEntity.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);
  const base = `https://${domain}`;
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: base,
    name: tenant.name,
    inLanguage: entity?.languageId ? entity.languageId : 'en-IN'
  };
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    name: tenant.name,
    url: base,
    logo: theme?.logoUrl || null,
    publisher: entity?.publisherName || null,
    foundingDate: tenant.createdAt,
  };
  res.json({ website, organization });
});

/**
 * @swagger
 * /public/seo/article/{slug}:
 *   get:
 *     summary: Article JSON-LD
 *     tags: [Public - Website]
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
 *     responses:
  *       200:
  *         description: NewsArticle JSON-LD
  *         content:
  *           application/json:
  *             examples:
  *               sample:
  *                 value:
  *                   "@type": "NewsArticle"
  *                   headline: "Title"
 *       404: { description: Not found }
 */
router.get('/seo/article/:slug', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  const domain = (res.locals as any).domain?.domain;
  if (!tenant || !domain) return res.status(500).json({ error: 'Domain context missing' });

  const slug = String(req.params.slug);

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: (res.locals as any).domain?.id }, { domainId: null }] }
    : { domainId: (res.locals as any).domain?.id };

  const row = await p.tenantWebArticle.findFirst({
    where: { tenantId: tenant.id, status: 'PUBLISHED', slug, ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    include: { category: { select: { slug: true, name: true } }, language: { select: { code: true } } }
  });
  if (!row) return res.status(404).json({ error: 'Not found' });

  const detail = toWebArticleDetailDto(row);
  const imageUrls = [detail.coverImage?.url].filter(Boolean) as string[];
  const authorNameRaw = Array.isArray(detail.authors) && detail.authors.length ? (detail.authors[0]?.name || null) : null;
  const authorName = (authorNameRaw && String(authorNameRaw).trim()) ? String(authorNameRaw).trim() : `${tenant.name} Reporter`;
  const lang = String(row.language?.code || detail.languageCode || 'en').trim().toLowerCase() || 'en';
  const canonicalUrl = `https://${domain}/${encodeURIComponent(lang)}/articles/${encodeURIComponent(detail.slug)}`;
  const publisherLogoUrl = (await p.tenantTheme?.findUnique?.({ where: { tenantId: tenant.id } }).catch(() => null) as any)?.logoUrl || null;
  const keywords = Array.isArray(detail.tags) ? detail.tags.filter((t: any) => typeof t === 'string' && t.trim()).slice(0, 15) : undefined;
  const sectionName = row.category?.name || row.category?.slug || null;
  const cover: any = (row as any)?.contentJson?.coverImage || (detail as any)?.coverImage || null;
  const imageWidth = cover && Number.isFinite(Number(cover.w)) ? Number(cover.w) : undefined;
  const imageHeight = cover && Number.isFinite(Number(cover.h)) ? Number(cover.h) : undefined;

  const generated = buildNewsArticleJsonLd({
    headline: detail.title,
    description: detail.meta.metaDescription || detail.excerpt || undefined,
    canonicalUrl,
    imageUrls,
    imageWidth,
    imageHeight,
    languageCode: row.language?.code || detail.languageCode || undefined,
    datePublished: detail.publishedAt || undefined,
    dateModified: row.updatedAt ? new Date(row.updatedAt).toISOString() : (detail.publishedAt || undefined),
    authorName: authorName || undefined,
    publisherName: tenant.name,
    publisherLogoUrl: publisherLogoUrl || undefined,
    keywords,
    articleSection: sectionName || undefined,
    isAccessibleForFree: true,
  });

  // Preserve any stored jsonLd fields from the article, but fill missing from generated.
  const existing = (detail as any).jsonLd && typeof (detail as any).jsonLd === 'object' ? (detail as any).jsonLd : {};
  const out: any = { ...generated };
  const preferGenerated = new Set(['headline', 'image', 'author', 'articleSection']);
  const looksLikeInternalId = (value: any) => {
    const s = String(value || '').trim();
    if (!s) return false;
    if (/^c[a-z0-9]{20,}$/i.test(s)) return true;
    if (/^[a-f0-9]{24,}$/i.test(s)) return true;
    if (/^[a-f0-9-]{32,}$/i.test(s) && s.includes('-')) return true;
    return false;
  };
  for (const [k, v] of Object.entries(existing)) {
    if (preferGenerated.has(k)) continue;
    if (k === 'articleSection' && looksLikeInternalId(v)) continue;
    const isEmpty = v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as any).length === 0);
    if (!isEmpty) out[k] = v;
  }
  if (out.publisher && typeof out.publisher === 'object' && existing && (existing as any).publisher && typeof (existing as any).publisher === 'object') {
    out.publisher = { ...out.publisher, ...(existing as any).publisher };
    if ((existing as any).publisher.logo && typeof (existing as any).publisher.logo === 'object') {
      out.publisher.logo = { ...(out.publisher.logo || {}), ...(existing as any).publisher.logo };
    }
  }

  res.json(out);
});

/**
 * @swagger
 * /public/sitemap.xml:
 *   get:
 *     summary: Sitemap XML for this domain
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: XML sitemap
 *         content:
 *           application/xml:
 *             examples:
 *               sample:
 *                 value: "<?xml version=\"1.0\" encoding=\"UTF-8\"?><urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">..."
 */
router.get('/sitemap.xml', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  const domainRow = (res.locals as any).domain;
  if (!tenant || !domainRow) return res.status(500).send('Domain context missing');

  const activeDomainCount = await p.domain.count({ where: { tenantId: tenant.id, status: 'ACTIVE' } }).catch(() => 0);
  const domainScope: any = activeDomainCount <= 1
    ? { OR: [{ domainId: domainRow.id }, { domainId: null }] }
    : { domainId: domainRow.id };

  const rows = await p.tenantWebArticle.findMany({
    where: { tenantId: tenant.id, status: 'PUBLISHED', ...domainScope },
    orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    take: 5000,
    select: { slug: true, updatedAt: true, publishedAt: true }
  });
  const base = `https://${domainRow.domain}`;
  const urls = rows.map((r: any) => {
    const lastMod = r.updatedAt ? new Date(r.updatedAt).toISOString() : (r.publishedAt ? new Date(r.publishedAt).toISOString() : null);
    return { loc: `${base}/articles/${encodeURIComponent(r.slug)}`, lastMod };
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url><loc>${base}/</loc></url>\n` +
    urls.map((u: any) => `  <url><loc>${u.loc}</loc>${u.lastMod ? `<lastmod>${u.lastMod}</lastmod>` : ''}</url>`).join('\n') +
    `\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

/**
 * @swagger
 * /public/robots.txt:
 *   get:
 *     summary: Robots.txt for this domain
 *     tags: [Public - Website]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: robots.txt
 *         content:
 *           text/plain:
 *             examples:
 *               sample:
 *                 value: "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n"
 */
router.get('/robots.txt', async (_req, res) => {
  const domainRow = (res.locals as any).domain;
  if (!domainRow) return res.status(500).send('Domain context missing');
  const base = `https://${domainRow.domain}`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.send(`User-agent: *\nAllow: /\nSitemap: ${base}/sitemap.xml\n`);
});

async function getStaticPageForTenant(tenantId: string, slug: string) {
  return p.tenantStaticPage
    ?.findFirst?.({ where: { tenantId, slug, published: true }, select: { slug: true, title: true, contentHtml: true, meta: true, updatedAt: true } })
    .catch(() => null);
}

/**
 * @swagger
 * /public/about-us:
 *   get:
 *     summary: Get About Us page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: About Us page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "about-us"
 *                   title: "About Us"
 *                   contentHtml: "<h1>About Kaburlu News</h1><p>We are committed to quality journalism...</p>"
 *                   meta: { keywords: "about, news, journalism" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/about-us', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'about-us');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

/**
 * @swagger
 * /public/contact-us:
 *   get:
 *     summary: Get Contact Us page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Contact Us page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "contact-us"
 *                   title: "Contact Us"
 *                   contentHtml: "<h1>Contact Kaburlu News</h1><p>Email: contact@kaburlu.com</p>"
 *                   meta: { keywords: "contact, support, email" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/contact-us', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'contact-us');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

/**
 * @swagger
 * /public/privacy-policy:
 *   get:
 *     summary: Get Privacy Policy page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Privacy Policy page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "privacy-policy"
 *                   title: "Privacy Policy"
 *                   contentHtml: "<h1>Privacy Policy</h1><p>We collect and protect your data...</p>"
 *                   meta: { keywords: "privacy, data protection, GDPR" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/privacy-policy', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'privacy-policy');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

/**
 * @swagger
 * /public/terms:
 *   get:
 *     summary: Get Terms of Service page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Terms of Service page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "terms"
 *                   title: "Terms of Service"
 *                   contentHtml: "<h1>Terms of Service</h1><p>By using our website, you agree...</p>"
 *                   meta: { keywords: "terms, conditions, legal" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/terms', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'terms');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

/**
 * @swagger
 * /public/disclaimer:
 *   get:
 *     summary: Get Disclaimer page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Disclaimer page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "disclaimer"
 *                   title: "Disclaimer"
 *                   contentHtml: "<h1>Disclaimer</h1><p>Information provided is for general purposes...</p>"
 *                   meta: { keywords: "disclaimer, liability, legal" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/disclaimer', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'disclaimer');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

/**
 * @swagger
 * /public/editorial-policy:
 *   get:
 *     summary: Get Editorial Policy page for this domain
 *     tags: [Public - Website, Legal Pages]
 *     parameters:
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         description: Optional override for tenant/domain detection when testing locally.
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Editorial Policy page content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slug: { type: string }
 *                 title: { type: string }
 *                 contentHtml: { type: string }
 *                 meta: { type: object }
 *                 updatedAt: { type: string, format: date-time }
 *             examples:
 *               sample:
 *                 value:
 *                   slug: "editorial-policy"
 *                   title: "Editorial Policy"
 *                   contentHtml: "<h1>Editorial Policy</h1><p>We maintain the highest standards of journalism...</p>"
 *                   meta: { keywords: "editorial, journalism, ethics" }
 *                   updatedAt: "2026-01-18T10:00:00.000Z"
 *       404: { description: Page not found or not published }
 *       500: { description: Domain context missing }
 */
router.get('/editorial-policy', async (_req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).json({ error: 'Domain context missing' });
  const page = await getStaticPageForTenant(tenant.id, 'editorial-policy');
  if (!page) return res.status(404).json({ error: 'Not found' });
  res.json(page);
});

export default router;

/**
 * @swagger
 * /api/public/idcard:
 *   get:
 *     summary: Public - Render Reporter ID Card (HTML)
 *     description: Renders HTML ID card by reporterId OR mobile OR fullName. One of these query params is required.
 *     tags: [ID Cards]
 *     parameters:
 *       - in: query
 *         name: reporterId
 *         schema: { type: string }
 *       - in: query
 *         name: mobile
 *         schema: { type: string }
 *       - in: query
 *         name: fullName
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: HTML view
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400: { description: Validation error }
 *       404: { description: Reporter or ID card not found }
 */
router.get('/idcard', async (req, res) => {
  const tenant = (res.locals as any).tenant;
  if (!tenant) return res.status(500).send('Domain context missing');
  const reporterId = req.query.reporterId ? String(req.query.reporterId) : undefined;
  const mobile = req.query.mobile ? String(req.query.mobile) : undefined;
  const fullName = req.query.fullName ? String(req.query.fullName) : undefined;
  if (!reporterId && !mobile && !fullName) {
    return res.status(400).send('Provide reporterId or mobile or fullName');
  }
  // Resolve reporter by given query within tenant
  const pAny: any = prisma;
  let reporter = null;
  if (reporterId) {
    reporter = await pAny.reporter.findFirst({ where: { id: reporterId, tenantId: tenant.id } });
  }
  if (!reporter && mobile) {
    const user = await pAny.user.findFirst({ where: { mobileNumber: mobile } });
    if (user) reporter = await pAny.reporter.findFirst({ where: { userId: user.id, tenantId: tenant.id } });
  }
  if (!reporter && fullName) {
    const profile = await pAny.userProfile.findFirst({ where: { fullName: { equals: String(fullName), mode: 'insensitive' } } });
    if (profile) reporter = await pAny.reporter.findFirst({ where: { userId: profile.userId, tenantId: tenant.id } });
  }
  if (!reporter) return res.status(404).send('Reporter not found');
  const reporterWithCard = await pAny.reporter.findUnique({ where: { id: reporter.id }, include: { idCard: true, designation: true, user: true } });
  if (!reporterWithCard?.idCard) return res.status(404).send('ID card not found for reporter');

  // Pull settings
  const settings = await pAny.tenantIdCardSettings.findUnique({ where: { tenantId: tenant.id } }).catch(()=>null);

  // Place of work
  const parts: string[] = [];
  if (reporterWithCard.stateId) {
    const s = await pAny.state.findUnique({ where: { id: reporterWithCard.stateId } }).catch(()=>null);
    if (s?.name) parts.push(s.name);
  }
  if (reporterWithCard.districtId) {
    const d = await pAny.district.findUnique({ where: { id: reporterWithCard.districtId } }).catch(()=>null);
    if (d?.name) parts.push(d.name);
  }
  if (reporterWithCard.mandalId) {
    const m = await pAny.mandal.findUnique({ where: { id: reporterWithCard.mandalId } }).catch(()=>null);
    if (m?.name) parts.push(m.name);
  }
  const placeOfWork = parts.length ? parts.join(', ') : null;

  // Photo
  let photoUrl: string | null = reporterWithCard.profilePhotoUrl || null;
  if (!photoUrl && reporterWithCard.userId) {
    const profile = await pAny.userProfile.findUnique({ where: { userId: reporterWithCard.userId } }).catch(() => null);
    photoUrl = profile?.profilePhotoUrl || null;
  }

  const issuedAtIso: string = new Date(reporterWithCard.idCard.issuedAt).toISOString();
  const expiresAtIso: string = new Date(reporterWithCard.idCard.expiresAt).toISOString();
  const exp = new Date(reporterWithCard.idCard.expiresAt);
  const validityLabel = `Valid up to ${String(exp.getUTCDate()).padStart(2, '0')}-${String(exp.getUTCMonth() + 1).padStart(2, '0')}-${exp.getUTCFullYear()}`;

  const primary = settings?.primaryColor || '#004f9f';
  const secondary = settings?.secondaryColor || '#ff0000';
  const logo = settings?.frontLogoUrl || '';
  const sign = settings?.signUrl || '';
  const stamp = settings?.roundStampUrl || '';
  const terms = Array.isArray(settings?.termsJson) ? (settings?.termsJson as string[]) : [];
  const office = settings?.officeAddress || '';
  const help1 = settings?.helpLine1 || '';
  const help2 = settings?.helpLine2 || '';

  const html = `<!DOCTYPE html>
  <html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Reporter ID Card</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f7fa; }
    .card-wrap { display: flex; gap: 24px; }
    .card { width: 380px; height: 600px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; overflow: hidden; background: #fff; }
    .header { display: flex; align-items: center; padding: 12px; }
    .header img.logo { height: 32px; margin-right: 8px; }
    .title { font-weight: bold; color: #333; }
    .band { background: ${primary}; color: #fff; text-align: center; padding: 8px; font-weight: 700; letter-spacing: 1px; }
    .content { padding: 16px; }
    .row { display: flex; gap: 12px; }
    .photo { width: 140px; height: 180px; border: 2px solid ${primary}; }
    .photo img { width: 100%; height: 100%; object-fit: cover; }
    .details { flex: 1; }
    .label { font-size: 12px; color: #666; }
    .value { font-size: 14px; color: #111; font-weight: 600; }
    .qr { width: 120px; height: 120px; background: #eee; border: 1px dashed #ccc; display:flex; align-items:center; justify-content:center; color:#999; }
    .footer { border-top: 4px solid ${secondary}; padding: 8px; }
    .press { font-size: 26px; font-weight: 800; color: ${secondary}; text-align: center; letter-spacing: 2px; }
    .terms { padding: 12px 16px; font-size: 12px; color: #333; }
    .terms li { margin-bottom: 6px; }
    .sign-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 16px; }
    .sign-row img { height: 42px; }
    .stamp { position: absolute; right: 16px; bottom: 80px; width: 80px; height: 80px; opacity: 0.7; }
  </style></head>
  <body>
    <div class="card-wrap">
      <div class="card">
        <div class="header">${logo ? `<img class=\"logo\" src=\"${logo}\" alt=\"logo\" />` : ''}<div class="title">${tenant.name}</div></div>
        <div class="band">MEDIA</div>
        <div class="content">
          <div class="row">
            <div class="photo">${photoUrl ? `<img src=\"${photoUrl}\" alt=\"photo\" />` : ''}</div>
            <div class="details">
              <div class="value" style="font-size:18px;">${reporterWithCard.user?.name || ''}</div>
              <div class="label">Designation</div>
              <div class="value">${reporterWithCard.designation?.name || ''}</div>
              <div class="label">ID No</div>
              <div class="value">${reporterWithCard.idCard.cardNumber}</div>
              <div class="label">Mobile</div>
              <div class="value">${reporterWithCard.user?.mobileNumber || ''}</div>
              <div class="label">Place</div>
              <div class="value">${placeOfWork || ''}</div>
            </div>
          </div>
          <div class="row" style="margin-top:12px; align-items:center;">
            <div class="qr">QR</div>
            <div style="flex:1; text-align:right; font-size:12px; color:#666;">${validityLabel}</div>
          </div>
        </div>
        <div class="footer"></div>
      </div>

      <div class="card" style="position:relative;">
        <div class="header">${logo ? `<img class=\"logo\" src=\"${logo}\" alt=\"logo\" />` : ''}<div class="title">${tenant.name}</div></div>
        <div class="content">
          <div class="terms">${terms.length ? `<ul>${terms.map(t => `<li>${t}</li>`).join('')}</ul>` : '<div>No terms provided.</div>'}
            <div style="margin-top:10px; font-size:12px; color:#333;">${office}</div>
            <div style="margin-top:4px; font-size:12px; color:#333;">Help: ${help1} ${help2 ? ' / ' + help2 : ''}</div>
          </div>
        </div>
        <div class="sign-row"><div>Director</div>${sign ? `<img src=\"${sign}\" alt=\"sign\" />` : ''}</div>
        ${stamp ? `<img class=\"stamp\" src=\"${stamp}\" alt=\"stamp\" />` : ''}
        <div class="press">PRESS</div>
      </div>
    </div>
  </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Allow cross-origin images (logo, stamp, sign) to load in browser
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  return res.send(html);
});