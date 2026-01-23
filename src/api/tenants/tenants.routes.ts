import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import crypto from 'crypto';
import { requireSuperAdmin, requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import * as bcrypt from 'bcrypt';
import { backfillTenantNameTranslationForTenant, backfillTenantNameTranslationsAllTenants } from './tenantNameTranslations.service';
import { aiGenerateText } from '../../lib/aiProvider';
const router = Router();
const auth = passport.authenticate('jwt', { session: false });
/**
 * @swagger
 * /tenants:
 *   get:
 *     summary: List tenants
 *     description: |
 *       Returns basic tenants by default. Pass `full=true` to include domains and entity details for each tenant.
 *     tags: [Tenants]
 *     parameters:
 *       - in: query
 *         name: full
 *         schema: { type: boolean, default: false }
 *         description: Include domains (status, primary) and full PRGI entity details.
 *     responses:
 *       200:
 *         description: List of tenants (optionally enriched with domains and entity)
 */
router.get('/', async (req, res) => {
  const full = ['1','true','yes','full','all'].includes(String(req.query.full || '').toLowerCase());
  const tenants = await (prisma as any).tenant.findMany({ take: 100, orderBy: { createdAt: 'desc' } });
  if (!full || !tenants.length) return res.json(tenants);

  const ids = tenants.map((t: any) => t.id);
  const [domains, entities] = await Promise.all([
    (prisma as any).domain.findMany({
      where: { tenantId: { in: ids } },
      orderBy: [{ isPrimary: 'desc' }, { domain: 'asc' }]
    }),
    (prisma as any).tenantEntity.findMany({
      where: { tenantId: { in: ids } },
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
      }
    })
  ]);

  const domainsByTenant: Record<string, any[]> = {};
  for (const d of domains) {
    const list = domainsByTenant[d.tenantId] || (domainsByTenant[d.tenantId] = []);
    // Expose non-sensitive domain fields only
    list.push({
      id: d.id,
      domain: d.domain,
      isPrimary: d.isPrimary,
      status: d.status,
      verifiedAt: d.verifiedAt,
      lastCheckAt: d.lastCheckAt,
      lastCheckStatus: d.lastCheckStatus
    });
  }
  const entityByTenant: Record<string, any> = {};
  for (const e of entities) entityByTenant[e.tenantId] = e;

  const shaped = tenants.map((t: any) => ({
    ...t,
    domains: domainsByTenant[t.id] || [],
    entity: entityByTenant[t.id] || null
  }));
  res.json(shaped);
});

/**
 * @swagger
 * /tenants:
 *   post:
 *     summary: Create tenant (SUPER_ADMIN)
 *     tags: [Tenants]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, prgiNumber]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               prgiNumber: { type: string }
 *               stateId: { type: string }
 *           examples:
 *             minimal:
 *               summary: Minimal tenant
 *               value:
 *                 name: "Kaburlu Media"
 *                 slug: "kaburlu-media"
 *                 prgiNumber: "PRGI-2025-001"
 *             withState:
 *               summary: With state linkage
 *               value:
 *                 name: "Prashna News"
 *                 slug: "prashna"
 *                 prgiNumber: "PRGI-2025-010"
 *                 stateId: "cmstate123"
 *     responses:
 *       201:
 *         description: Tenant created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 name: { type: string }
 *                 slug: { type: string }
 *                 prgiNumber: { type: string }
 *                 stateId: { type: string, nullable: true }
 *                 createdAt: { type: string }
 *                 updatedAt: { type: string }
 *             examples:
 *               created:
 *                 summary: Created tenant
 *                 value:
 *                   id: "cuid123"
 *                   name: "Kaburlu Media"
 *                   slug: "kaburlu-media"
 *                   prgiNumber: "PRGI-2025-001"
 *                   stateId: null
 *                   createdAt: "2025-12-05T05:00:00.000Z"
 *                   updatedAt: "2025-12-05T05:00:00.000Z"
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate slug or PRGI number
 */
router.post('/', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { name, slug, prgiNumber, stateId } = req.body || {};
    if (!name || !slug || !prgiNumber) {
      return res.status(400).json({ error: 'name, slug and prgiNumber are required' });
    }
    const existsSlug = await (prisma as any).tenant.findFirst({ where: { slug: { equals: String(slug), mode: 'insensitive' } } });
    if (existsSlug) return res.status(409).json({ error: 'Slug already exists' });
    const existsPrgi = await (prisma as any).tenant.findFirst({ where: { prgiNumber: { equals: String(prgiNumber), mode: 'insensitive' } } });
    if (existsPrgi) return res.status(409).json({ error: 'PRGI number already exists' });

    const data: any = { name: String(name), slug: String(slug), prgiNumber: String(prgiNumber) };
    if (stateId) data.stateId = String(stateId);

    const created = await (prisma as any).tenant.create({ data });
    return res.status(201).json(created);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate field (slug or prgiNumber)' });
    }
    console.error('tenant create error', e);
    return res.status(500).json({ error: 'Failed to create tenant' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/backfill-name-translation:
 *   post:
 *     summary: Backfill tenant localized name for its primary language (SUPER_ADMIN)
 *     description: |
 *       Uses Google Translate (via `GOOGLE_TRANSLATE_API_KEY`) to translate the tenant's base name
 *       into the tenant's primary language (from TenantEntity.language).
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Backfill result }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 */
router.post('/:tenantId/backfill-name-translation', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const result = await backfillTenantNameTranslationForTenant(String(tenantId));
    if (!result.ok && result.error === 'TENANT_NOT_FOUND') return res.status(404).json(result);
    return res.json(result);
  } catch (e) {
    console.error('backfill tenant name translation error', e);
    return res.status(500).json({ ok: false, error: 'FAILED_TO_BACKFILL_TENANT_NAME_TRANSLATION' });
  }
});

/**
 * @swagger
 * /tenants/backfill-name-translations:
 *   post:
 *     summary: Backfill tenant localized names for all tenants (SUPER_ADMIN)
 *     description: |
 *       Iterates tenants and backfills each tenant's localized name using Google Translate.
 *       Runs sequentially to reduce the chance of rate-limits.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Backfill results }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.post('/backfill-name-translations', auth, requireSuperAdmin, async (req, res) => {
  try {
    const out = await backfillTenantNameTranslationsAllTenants();
    return res.json(out);
  } catch (e) {
    console.error('backfill all tenant name translations error', e);
    return res.status(500).json({ ok: false, error: 'FAILED_TO_BACKFILL_ALL_TENANT_NAME_TRANSLATIONS' });
  }
});

/**
 * @swagger
 * /tenants/id-card-settings:
 *   get:
 *     summary: List ID card settings for all tenants (SUPER_ADMIN)
 *     tags: [ID Cards]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         required: false
 *         description: Items per page (default 50, max 200)
 *     responses:
 *       200: { description: Paginated settings with tenant info }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.get('/id-card-settings', auth, requireSuperAdmin, async (req, res) => {
  try {
    const pageRaw = req.query.page as string | undefined;
    const pageSizeRaw = req.query.pageSize as string | undefined;
    let page = pageRaw ? parseInt(pageRaw, 10) : 1;
    let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
    if (pageSize > 200) pageSize = 200;

    const total = await (prisma as any).tenantIdCardSettings.count();
    const skip = (page - 1) * pageSize;
    const rows = await (prisma as any).tenantIdCardSettings.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { tenant: { select: { id: true, name: true } } }
    });
    res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
  } catch (e) {
    console.error('tenant id-card-settings list error', e);
    res.status(500).json({ error: 'Failed to list ID card settings' });
  }
});

/**
 * @swagger
 * /tenants/razorpay-configs:
 *   get:
 *     summary: List all tenants' Razorpay configs (SUPER_ADMIN)
 *     description: Returns Razorpay config entries with minimal tenant info. Secrets are masked.
 *     tags: [Razorpay Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         required: false
 *         description: Items per page (default 50, max 200)
 *       - in: query
 *         name: active
 *         schema: { type: boolean }
 *         required: false
 *         description: Filter by active status when provided
 *       - in: query
 *         name: tenantName
 *         schema: { type: string }
 *         required: false
 *         description: Case-insensitive contains filter on tenant name
 *     responses:
 *       200: { description: Paginated Razorpay configs with tenant info }
 */
router.get('/razorpay-configs', auth, requireSuperAdmin, async (req, res) => {
  try {
    const pageRaw = req.query.page as string | undefined;
    const pageSizeRaw = req.query.pageSize as string | undefined;
    let page = pageRaw ? parseInt(pageRaw, 10) : 1;
    let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
    if (pageSize > 200) pageSize = 200;

    const activeFilter = req.query.active as string | undefined;
    const tenantName = req.query.tenantName as string | undefined;

    const where: any = {};
    if (typeof activeFilter === 'string') {
      const v = activeFilter.toLowerCase();
      if (v === 'true' || v === 'false') where.active = v === 'true';
    }

    const total = await (prisma as any).razorpayConfig.count({ where });
    const skip = (page - 1) * pageSize;
    const rows = await (prisma as any).razorpayConfig.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { tenant: { select: { id: true, name: true } } }
    });

    let data = rows.map((r: any) => ({
      id: r.id,
      tenant: r.tenant,
      keyId: r.keyId,
      keySecretMasked: r.keySecret ? `${String(r.keySecret).slice(0,4)}***${String(r.keySecret).slice(-2)}` : null,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    if (tenantName) {
      const q = tenantName.toLowerCase();
      data = data.filter((d: any) => String(d.tenant?.name || '').toLowerCase().includes(q));
    }

    res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data });
  } catch (e) {
    console.error('list razorpay-configs error', e);
    res.status(500).json({ error: 'Failed to list Razorpay configs' });
  }
});

/**
 * @swagger
 * /tenants/{id}:
 *   get:
 *     summary: Get tenant by id
 *     tags: [Tenants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant }
 *       404: { description: Not found }
 */
router.get('/:id', async (req, res) => {
  const t = await (prisma as any).tenant.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

// Default feature flags for response normalization
const DEFAULT_FEATURE_FLAGS = {
  enableMobileAppView: false,
  aiArticleRewriteEnabled: true,
  aiBillingEnabled: false,
  aiMonthlyTokenLimit: null,
  section2Rows: 2,
  section2ListCount: 4,
  section2ForceCategoryName: null,
  enableEpaper: false,
  enableAds: true,
  enableComments: false,
  enableSocialShare: true,
  enablePushNotifications: false,
  enableNewsletter: true,
  enableSearch: true,
  enableRelatedArticles: true,
  enableTrending: true,
  enableBreakingNews: false,
  enableVideo: true,
  enableGallery: true,
  enablePolls: false,
  enableLiveTv: false,
  enableDarkMode: true,
  enableMultiLang: false,
  enableReporterBylines: true,
  enableLocationFilter: false,
};

/**
 * @swagger
 * /tenants/{tenantId}/feature-flags:
 *   get:
 *     summary: Get tenant feature flags
 *     tags: [Tenants, Feature Flags]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Feature flags
 */
router.get('/:tenantId/feature-flags', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const flags = await (prisma as any).tenantFeatureFlags.findUnique({ where: { tenantId } }).catch(() => null);
    // Merge with defaults to ensure all fields are present
    const merged = { ...DEFAULT_FEATURE_FLAGS, ...(flags || {}), tenantId };
    return res.json(merged);
  } catch (e: any) {
    console.error('get tenant feature-flags error', e);
    return res.status(500).json({ error: 'Failed to get feature flags' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/feature-flags:
 *   patch:
 *     summary: Update tenant feature flags
 *     description: Update any tenant feature flags. Partial update - only provided fields are updated.
 *     tags: [Tenants, Feature Flags]
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
 *             properties:
 *               enableEpaper: { type: boolean }
 *               enableAds: { type: boolean }
 *               enableComments: { type: boolean }
 *               enableSocialShare: { type: boolean }
 *               enablePushNotifications: { type: boolean }
 *               enableNewsletter: { type: boolean }
 *               enableSearch: { type: boolean }
 *               enableRelatedArticles: { type: boolean }
 *               enableTrending: { type: boolean }
 *               enableBreakingNews: { type: boolean }
 *               enableVideo: { type: boolean }
 *               enableGallery: { type: boolean }
 *               enablePolls: { type: boolean }
 *               enableLiveTv: { type: boolean }
 *               enableDarkMode: { type: boolean }
 *               enableMultiLang: { type: boolean }
 *               enableReporterBylines: { type: boolean }
 *               enableLocationFilter: { type: boolean }
 *               aiArticleRewriteEnabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated feature flags
 */
router.patch('/:tenantId/feature-flags', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};

    // Build update data from provided boolean fields
    const updateData: any = {};
    const booleanFields = [
      'enableMobileAppView', 'aiArticleRewriteEnabled', 'aiBillingEnabled',
      'enableEpaper', 'enableAds', 'enableComments', 'enableSocialShare',
      'enablePushNotifications', 'enableNewsletter', 'enableSearch',
      'enableRelatedArticles', 'enableTrending', 'enableBreakingNews',
      'enableVideo', 'enableGallery', 'enablePolls', 'enableLiveTv',
      'enableDarkMode', 'enableMultiLang', 'enableReporterBylines', 'enableLocationFilter'
    ];
    for (const field of booleanFields) {
      if (typeof body[field] === 'boolean') {
        updateData[field] = body[field];
      }
    }
    // Handle integer fields
    if (typeof body.section2Rows === 'number') updateData.section2Rows = body.section2Rows;
    if (typeof body.section2ListCount === 'number') updateData.section2ListCount = body.section2ListCount;
    if (typeof body.aiMonthlyTokenLimit === 'number' || body.aiMonthlyTokenLimit === null) {
      updateData.aiMonthlyTokenLimit = body.aiMonthlyTokenLimit;
    }
    // Handle string fields
    if (typeof body.section2ForceCategoryName === 'string' || body.section2ForceCategoryName === null) {
      updateData.section2ForceCategoryName = body.section2ForceCategoryName;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update' });
    }

    const upserted = await (prisma as any).tenantFeatureFlags.upsert({
      where: { tenantId },
      update: updateData,
      create: { tenantId, ...updateData },
    });
    // Merge with defaults for response
    const merged = { ...DEFAULT_FEATURE_FLAGS, ...upserted };
    return res.json(merged);
  } catch (e: any) {
    console.error('patch tenant feature-flags error', e);
    return res.status(500).json({ error: 'Failed to update feature flags' });
  }
});
/**
 * @swagger
 * /tenants/{id}:
 *   patch:
 *     summary: Update tenant (SUPER_ADMIN)
 *     tags: [Tenants]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
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
 *               name: { type: string }
 *               slug: { type: string }
 *               prgiNumber: { type: string }
 *               stateId: { type: string }
 *           examples:
 *             updateNameState:
 *               summary: Update name and stateId
 *               value:
 *                 name: "Kaburlu Media Pvt Ltd"
 *                 stateId: "cmstate123"
 *     responses:
 *       200:
 *         description: Tenant updated
 *       404:
 *         description: Not found
 *       409:
 *         description: Duplicate slug or PRGI number
 */
router.patch('/:id', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).tenant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, slug, prgiNumber, stateId } = req.body || {};
    const data: any = {};
    if (typeof name === 'string' && name.trim()) data.name = String(name);
    if (typeof slug === 'string' && slug.trim()) {
      const dupSlug = await (prisma as any).tenant.findFirst({ where: { slug: { equals: String(slug), mode: 'insensitive' }, id: { not: id } } });
      if (dupSlug) return res.status(409).json({ error: 'Slug already exists' });
      data.slug = String(slug);
    }
    if (typeof prgiNumber === 'string' && prgiNumber.trim()) {
      const dupPrgi = await (prisma as any).tenant.findFirst({ where: { prgiNumber: { equals: String(prgiNumber), mode: 'insensitive' }, id: { not: id } } });
      if (dupPrgi) return res.status(409).json({ error: 'PRGI number already exists' });
      data.prgiNumber = String(prgiNumber);
    }
    if (typeof stateId === 'string') data.stateId = stateId || null;

    const updated = await (prisma as any).tenant.update({ where: { id }, data });
    return res.json(updated);
  } catch (e: any) {
    console.error('tenant update error', e);
    return res.status(500).json({ error: 'Failed to update tenant' });
  }
});
// (corrupted duplicate tenant creation block removed)

// [corrupted block removed: duplicate tenant creation snippet]

/**
 * @swagger
 * /tenants/{tenantId}/domains:
 *   post:
 *     summary: Add a domain to an entity (link domain) [Superadmin]
 *     tags: [Domains]
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
 *             required: [domain]
 *             properties:
 *               domain: { type: string }
 *               isPrimary: { type: boolean, default: false }
 *     description: |
 *       Allows at most one primary domain and one epaper subdomain per tenant.
 *
 *       EPAPER automation:
 *       - If the `domain` starts with `epaper.`, the domain is created with kind=EPAPER.
 *       - The backend will auto-seed DomainSettings (logo/colors) from the primary domain/tenantTheme.
 *       - The backend will also auto-generate basic SEO for the EPAPER domain using AI.
 *     responses:
 *       200: { description: Created }
 */
router.post('/:tenantId/domains', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domain, isPrimary = false } = req.body || {};
    if (!domain) return res.status(400).json({ error: 'domain required' });
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const existing = await (prisma as any).domain.findMany({ where: { tenantId } });
    const isEpaper = String(domain).toLowerCase().startsWith('epaper.');
    const primaryExists = existing.some((d: any) => d.isPrimary === true);
    const epaperExists = existing.some((d: any) => String(d.domain).toLowerCase().startsWith('epaper.'));
    if (existing.length >= 2) {
      return res.status(409).json({ error: 'Only one primary domain and one epaper subdomain allowed per tenant' });
    }
    if (isEpaper && epaperExists) {
      return res.status(409).json({ error: 'Epaper subdomain already exists for tenant' });
    }
    if (!isEpaper && Boolean(isPrimary) && primaryExists) {
      return res.status(409).json({ error: 'Primary domain already exists for tenant' });
    }
    const token = crypto.randomBytes(12).toString('hex');
    const row = await (prisma as any).domain.create({
      data: {
        tenantId,
        domain,
        isPrimary: Boolean(isPrimary),
        kind: isEpaper ? 'EPAPER' : 'NEWS',
        status: 'PENDING',
        verificationToken: token,
        verificationMethod: 'DNS_TXT'
      }
    });

    // Auto-seed EPAPER domain settings (branding/theme) and backfill SEO via AI.
    // Fire-and-forget so domain creation stays fast.
    if (isEpaper) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { ensureEpaperDomainSettings } = require('../../lib/epaperDomainSettingsAuto');
        Promise.resolve(ensureEpaperDomainSettings(tenantId, row.id)).catch(() => null);
      } catch {
        // ignore
      }
    }
    res.json({ domain: row, verifyInstruction: { type: 'DNS_TXT', name: `_kaburlu-verify.${domain}`, value: token } });
  } catch (e: any) {
    if (String(e.message).includes('Unique constraint') || String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Domain already linked' });
    }
    console.error('add domain error', e);
    res.status(500).json({ error: 'Failed to add domain' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/razorpay-config:
 *   post:
 *     summary: Create Razorpay keys for a tenant
 *     description: Fails if a config already exists for the tenant. Use PUT to update/replace.
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
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
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 *       409: { description: Already exists }
 *   put:
 *     summary: Upsert Razorpay keys for a tenant
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId:
 *                 type: string
 *                 description: Razorpay key_id
 *               keySecret:
 *                 type: string
 *                 description: Razorpay key_secret
 *               active:
 *                 type: boolean
 *                 description: Whether these keys are active for this tenant
 *                 default: true
 *     responses:
 *       200: { description: Tenant Razorpay config upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 */
router.put('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { keyId, keySecret, active = true } = req.body || {};

    if (!keyId || !keySecret) {
      return res.status(400).json({ error: 'keyId and keySecret are required' });
    }

    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });

    const config = await (prisma as any).razorpayConfig.upsert({
      where: { tenantId },
      update: { keyId, keySecret, active: Boolean(active) },
      create: { tenantId, keyId, keySecret, active: Boolean(active) },
    });

    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    });
  } catch (e) {
    console.error('tenant razorpay-config upsert error', e);
    res.status(500).json({ error: 'Failed to upsert tenant Razorpay config' });
  }
});

router.post('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const existing = await (prisma as any).razorpayConfig.findUnique({ where: { tenantId } });
    if (existing) return res.status(409).json({ error: 'Tenant Razorpay config already exists. Use PUT to update.' });
    const created = await (prisma as any).razorpayConfig.create({ data: { tenantId, keyId, keySecret, active: Boolean(active) } });
    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      keyId: created.keyId,
      active: created.active,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch (e) {
    console.error('tenant razorpay-config create error', e);
    res.status(500).json({ error: 'Failed to create tenant Razorpay config' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/razorpay-config:
 *   get:
 *     summary: Get tenant Razorpay config
 *     tags: [Razorpay Config]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant Razorpay config (masked secret) }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */
router.get('/:tenantId/razorpay-config', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const t = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!t) return res.status(404).json({ error: 'Tenant not found' });
    const config = await (prisma as any).razorpayConfig.findUnique({ where: { tenantId } });
    if (!config) return res.status(404).json({ error: 'Tenant Razorpay config not set' });
    const maskedSecret = config.keySecret ? `${config.keySecret.slice(0,4)}***${config.keySecret.slice(-2)}` : null;
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      keySecretMasked: maskedSecret,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e) {
    console.error('tenant razorpay-config get error', e);
    res.status(500).json({ error: 'Failed to fetch tenant Razorpay config' });
  }
});

// Utilities: resolve references and parse date
function parseDateDDMMYYYY(input?: string): Date | null {
  if (!input) return null;
  // Accept DD/MM/YYYY or YYYY-MM-DD
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    const [d, m, y] = input.split('/').map(Number);
    const iso = new Date(Date.UTC(y, m - 1, d));
    return isNaN(iso.getTime()) ? null : iso;
  }
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

async function resolveLanguageId(body: any) {
  const { languageId, languageCode, language } = body || {};
  if (languageId) {
    const row = await (prisma as any).language.findUnique({ where: { id: languageId } });
    return row?.id || null;
  }
  if (languageCode) {
    const row = await (prisma as any).language.findFirst({ where: { code: languageCode } });
    return row?.id || null;
  }
  if (language) {
    const row = await (prisma as any).language.findFirst({ where: { name: { equals: String(language), mode: 'insensitive' } } });
    return row?.id || null;
  }
  return null;
}

async function resolveByIdOrName(model: any, value?: string) {
  if (!value) return null;
  // If looks like cuid/uuid, try id; else try name case-insensitive
  const byId = await model.findUnique?.({ where: { id: value } }).catch(() => null);
  if (byId) return byId.id;
  const byName = await model.findFirst?.({ where: { name: { equals: String(value), mode: 'insensitive' } } }).catch(() => null);
  return byName?.id || null;
}

function looksNonLatin(text: string): boolean {
  // If string contains any non-ASCII, treat as already native.
  return /[^\u0000-\u007f]/.test(text);
}

async function autoGenerateTenantNativeName(params: {
  tenantName: string;
  languageCode?: string | null;
}): Promise<string> {
  const tenantName = String(params.tenantName || '').trim();
  const languageCode = params.languageCode ? String(params.languageCode).trim().toLowerCase() : '';
  if (!tenantName) return '';
  if (!languageCode || languageCode === 'en') return '';
  if (looksNonLatin(tenantName)) return tenantName;

  // Best-effort transliteration using the configured AI provider.
  // This is usually more accurate than translation for names.
  const prompt = [
    'You are a strict transliteration engine.',
    'Task: transliterate the input name into the target language script without translating meaning.',
    'Rules:',
    '- Output ONLY the transliterated text, no quotes, no JSON, no explanation.',
    '- Preserve spacing and punctuation as reasonable.',
    `Target language code: ${languageCode}`,
    `Input: ${tenantName}`,
  ].join('\n');
  const { text } = await aiGenerateText({ prompt, purpose: 'translation' });
  const cleaned = String(text || '').trim();
  if (!cleaned) return '';
  // If it still looks Latin, avoid setting it.
  if (!looksNonLatin(cleaned)) return '';
  return cleaned;
}

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   post:
 *     summary: Create PRGI/entity details for a Tenant [Superadmin]
 *     description: |
 *       Creates PRGI registration details linked to the tenant.
 *       - If `prgiNumber` is omitted, it will use the Tenant's `prgiNumber`.
 *       - Accepts ONLY IDs for language and locations; name/code fields are ignored.
 *     tags: [Tenants]
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
 *           examples:
 *             withNativeName:
 *               value:
 *                 prgiNumber: "PRGI-TS-2025-01987"
 *                 registrationTitle: "Prashnaayudham"
 *                 nativeName: "ప్రశ్నాయుధం"
 *                 periodicity: "DAILY"
 *                 registrationDate: "27/05/2025"
 *                 languageId: "lang_te_id"
 *           schema:
 *             type: object
 *             properties:
 *               prgiNumber: { type: string, example: "PRGI-TS-2025-01987" }
 *               registrationTitle: { type: string, example: "Prashnaayudham" }
 *               nativeName: { type: string, nullable: true, description: "Tenant name in native script (optional; auto-generated if omitted)", example: "ప్రశ్నాయుధం" }
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], example: DAILY }
 *               registrationDate: { type: string, example: "27/05/2025" }
 *               languageId: { type: string, description: "Language row id" }
 *               ownerName: { type: string, example: "KATYADA BAPU RAO" }
 *               publisherName: { type: string, example: "KATYADA BAPU RAO" }
 *               editorName: { type: string, example: "KATYADA BAPU RAO" }
 *               publicationCountryId: { type: string, description: "Country id" }
 *               publicationStateId: { type: string, description: "State id" }
 *               publicationDistrictId: { type: string, description: "District id" }
 *               publicationMandalId: { type: string, description: "Mandal id" }
 *               printingPressName: { type: string, example: "SHASHI PRINTING PRESS" }
 *               printingDistrictId: { type: string, description: "District id" }
 *               printingMandalId: { type: string, description: "Mandal id" }
 *               printingCityName: { type: string, example: "KAMAREDDY" }
 *               address: { type: string }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const body = req.body || {};
    const prgiNumber = body.prgiNumber || tenant.prgiNumber;
    if (!prgiNumber) return res.status(400).json({ error: 'prgiNumber missing on request and tenant' });
    // Accept only IDs for language and locations. Names/codes are ignored by design.
    const languageId = body.languageId || null;
    const publicationCountryId = body.publicationCountryId || null;
    const publicationStateId = body.publicationStateId || null;
    const publicationDistrictId = body.publicationDistrictId || null;
    const publicationMandalId = body.publicationMandalId || null;
    const printingDistrictId = body.printingDistrictId || null;
    const printingMandalId = body.printingMandalId || null;
    const registrationDate = parseDateDDMMYYYY(body.registrationDate || body.registration_date);

    // Optional: allow explicitly setting nativeName; otherwise auto-generate.
    const nativeNameInput = typeof body.nativeName === 'string' ? body.nativeName.trim() : '';
    const langRow = languageId
      ? await (prisma as any).language.findUnique({ where: { id: String(languageId) } }).catch(() => null)
      : null;
    const autoNativeName = !nativeNameInput
      ? await autoGenerateTenantNativeName({ tenantName: tenant.name, languageCode: langRow?.code || null })
      : '';

    const data = {
      tenantId,
      prgiNumber: String(prgiNumber),
      registrationTitle: body.registrationTitle || body.title || null,
      nativeName: (nativeNameInput || autoNativeName || null) as any,
      periodicity: (body.periodicity || 'DAILY').toUpperCase(),
      registrationDate: registrationDate || null,
      languageId,
      ownerName: body.ownerName || body.owner || null,
      publisherName: body.publisherName || body.publisher || null,
      editorName: body.editorName || body.editor || null,
      publicationCountryId,
      publicationStateId,
      publicationDistrictId,
      publicationMandalId,
      printingPressName: body.printingPressName || body.printingPress || null,
      printingDistrictId,
      printingMandalId,
      printingCityName: body.printingCityName || body.printingCity || null,
      address: body.address || null,
    };

    // Upsert on tenantId (unique)
    const row = await (prisma as any).tenantEntity.upsert({
      where: { tenantId },
      update: data,
      create: data,
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
    res.json(row);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity upsert error', e);
    res.status(500).json({ error: 'Failed to upsert entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity/simple:
 *   post:
 *     summary: Simplified create of PRGI/entity for a Tenant
 *     description: |
 *       Derives prgiNumber and registrationTitle from Tenant. Defaults publicationStateId from Tenant.stateId.
 *       Creates/updates a TENANT_ADMIN user (with reporter profile) if adminMobile or publisherMobile is provided.
 *     tags: [Tenants]
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
 *           examples:
 *             simpleWithNativeName:
 *               value:
 *                 languageId: "lang_te_id"
 *                 nativeName: "డాక్సిన్ టైమ్స్"
 *                 periodicity: "DAILY"
 *                 registrationDate: "04/09/2025"
 *                 publisherName: "Some Publisher"
 *           schema:
 *             type: object
 *             properties:
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], default: DAILY }
 *               registrationDate: { type: string, example: "04/09/2025" }
 *               adminMobile: { type: string, description: "Digits only (creates TENANT_ADMIN)" }
 *               publisherMobile: { type: string, description: "Alias for adminMobile (backwards compatible)" }
 *               publisherName: { type: string, description: "Stored as publisherName in entity; optional" }
 *               nativeName: { type: string, nullable: true, description: "Tenant name in native script (optional; auto-generated if omitted)", example: "డాక్సిన్ టైమ్స్" }
 *               editorName: { type: string }
 *               printingPressName: { type: string }
 *               printingCityName: { type: string }
 *               address: { type: string, description: "Business address (optional)" }
 *               languageId: { type: string, description: "Mandatory language id" }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/:tenantId/entity/simple', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const body = req.body || {};
    const registrationDate = parseDateDDMMYYYY(body.registrationDate);
    const periodicity = (body.periodicity || 'DAILY').toUpperCase();
    // languageId is mandatory
    const languageId = body.languageId;
    if (!languageId) return res.status(400).json({ error: 'languageId is required' });
    const lang = await (prisma as any).language.findUnique({ where: { id: String(languageId) } }).catch(() => null);
    if (!lang) return res.status(400).json({ error: `Invalid languageId: '${languageId}'` });

    const nativeNameInput = typeof body.nativeName === 'string' ? body.nativeName.trim() : '';
    const autoNativeName = !nativeNameInput
      ? await autoGenerateTenantNativeName({ tenantName: tenant.name, languageCode: lang.code })
      : '';

    const data = {
      tenantId,
      prgiNumber: tenant.prgiNumber,
      registrationTitle: tenant.name,
      nativeName: (nativeNameInput || autoNativeName || null) as any,
      periodicity,
      registrationDate: registrationDate || null,
      languageId,
      ownerName: null,
      publisherName: body.publisherName || null,
      editorName: body.editorName || null,
      publicationCountryId: null,
      publicationStateId: tenant.stateId || null,
      publicationDistrictId: null,
      publicationMandalId: null,
      printingPressName: body.printingPressName || null,
      printingDistrictId: null,
      printingMandalId: null,
      printingCityName: body.printingCityName || null,
      address: body.address || null,
    };

    const row = await (prisma as any).tenantEntity.upsert({
      where: { tenantId },
      update: data,
      create: data,
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
        tenant: { select: { id: true, name: true, slug: true, prgiNumber: true, prgiStatus: true } },
      }
    });

    // Optionally create / update TENANT_ADMIN user (alias: publisherMobile for backwards compatibility)
    let tenantAdminSetup: any = { skipped: true };
    const adminMobileRaw = body.adminMobile || body.publisherMobile;
    const adminMobile = adminMobileRaw ? String(adminMobileRaw).trim() : '';
    if (adminMobile) {
      if (!/^\d{7,}$/.test(adminMobile)) {
        tenantAdminSetup = { skipped: true, reason: 'invalid_mobile' };
      } else {
        const adminRole = await (prisma as any).role.findFirst({ where: { name: 'TENANT_ADMIN' } });
        if (adminRole) {
          const existingUser = await (prisma as any).user.findFirst({ where: { mobileNumber: adminMobile } });
          let userId: string;
          if (existingUser) {
            const toUpdate: any = {};
            if (existingUser.roleId !== adminRole.id) toUpdate.roleId = adminRole.id;
            if (!existingUser.languageId && languageId) toUpdate.languageId = languageId;
            if (Object.keys(toUpdate).length) {
              await (prisma as any).user.update({ where: { id: existingUser.id }, data: toUpdate });
            }
            userId = existingUser.id;
          } else {
            const mpinPlain = adminMobile.slice(-4);
            const mpinHash = await (require('bcrypt') as typeof import('bcrypt')).hash(mpinPlain, 10);
            const user = await (prisma as any).user.create({ data: { mobileNumber: adminMobile, mpin: mpinHash, roleId: adminRole.id, languageId, status: 'ACTIVE' } });
            userId = user.id;
          }
          const existingReporter = await (prisma as any).reporter.findFirst({ where: { tenantId, userId } });
          if (!existingReporter) {
            const designation = await (prisma as any).reporterDesignation.findFirst({
              where: { OR: [ { tenantId, code: 'EDITOR_IN_CHIEF' }, { tenantId: null, code: 'EDITOR_IN_CHIEF' } ] },
              orderBy: { tenantId: 'desc' }
            }).catch(()=>null);
            await (prisma as any).reporter.create({
              data: { tenantId, userId, designationId: designation?.id || null, level: designation?.level || null, stateId: tenant.stateId || null }
            });
          }
          tenantAdminSetup = { createdOrUpdated: true, mobile: adminMobile };
        } else {
          tenantAdminSetup = { skipped: true, reason: 'tenant_admin_role_missing' };
        }
      }
    }

    res.json({ entity: row, tenantAdminSetup });
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity simple upsert error', e);
    res.status(500).json({ error: 'Failed to create entity (simple)' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity/business:
 *   put:
 *     summary: Update business and printing details only
 *     description: Updates address, printingPressName, printingCityName, and optionally printingDistrictId/printingMandalId.
 *     tags: [Tenants]
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
 *             properties:
 *               address: { type: string }
 *               printingPressName: { type: string }
 *               printingCityName: { type: string }
 *               printingDistrictId: { type: string, nullable: true }
 *               printingMandalId: { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:tenantId/entity/business', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const existing = await (prisma as any).tenantEntity.findUnique({ where: { tenantId } });
    if (!existing) return res.status(404).json({ error: 'Entity details not found for tenant' });

    const body = req.body || {};
    const row = await (prisma as any).tenantEntity.update({
      where: { tenantId },
      data: {
        address: body.address ?? existing.address,
        printingPressName: body.printingPressName ?? existing.printingPressName,
        printingCityName: body.printingCityName ?? existing.printingCityName,
        printingDistrictId: body.printingDistrictId ?? existing.printingDistrictId,
        printingMandalId: body.printingMandalId ?? existing.printingMandalId,
      }
    });
    res.json(row);
  } catch (e) {
    console.error('entity business update error', e);
    res.status(500).json({ error: 'Failed to update business/printing details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   put:
 *     summary: Update PRGI/entity details for a Tenant [Superadmin]
 *     tags: [Tenants]
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
 *           examples:
 *             updateNativeName:
 *               value:
 *                 nativeName: "ప్రశ్నాయుధం"
 *                 editorName: "KATYADA BAPU RAO"
 *           schema:
 *             type: object
 *             properties:
 *               registrationTitle: { type: string, example: "Prashnaayudham" }
 *               nativeName: { type: string, nullable: true, description: "Tenant name in native script (optional)" }
 *               periodicity: { type: string, enum: [DAILY, WEEKLY, FORTNIGHTLY, MONTHLY], example: DAILY }
 *               registrationDate: { type: string, example: "27/05/2025" }
 *               languageId: { type: string, description: "Language id" }
 *               ownerName: { type: string, example: "KATYADA BAPU RAO" }
 *               publisherName: { type: string, example: "KATYADA BAPU RAO" }
 *               editorName: { type: string, example: "KATYADA BAPU RAO" }
 *               publicationCountryId: { type: string, description: "Country id" }
 *               publicationStateId: { type: string, description: "State id" }
 *               publicationDistrictId: { type: string, description: "District id" }
 *               publicationMandalId: { type: string, description: "Mandal id" }
 *               printingPressName: { type: string, example: "SHASHI PRINTING PRESS" }
 *               printingDistrictId: { type: string, description: "District id" }
 *               printingMandalId: { type: string, description: "Mandal id" }
 *               printingCityName: { type: string, example: "KAMAREDDY" }
 *               address: { type: string }
 *     description: prgiNumber is immutable and cannot be updated.
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const existing = await (prisma as any).tenantEntity.findUnique({ where: { tenantId } });
    if (!existing) return res.status(404).json({ error: 'Entity details not found for tenant' });

    const body = req.body || {};
    // Enforce immutability of prgiNumber on update
    if (typeof body.prgiNumber === 'string' && body.prgiNumber.trim() && body.prgiNumber.trim() !== existing.prgiNumber) {
      return res.status(400).json({ error: 'prgiNumber cannot be updated once created' });
    }

    // Accept only IDs for language and locations. Names/codes are ignored by design.
    const languageId = body.languageId ?? existing.languageId;
    const publicationCountryId = body.publicationCountryId ?? existing.publicationCountryId;
    const publicationStateId = body.publicationStateId ?? existing.publicationStateId;
    const publicationDistrictId = body.publicationDistrictId ?? existing.publicationDistrictId;
    const publicationMandalId = body.publicationMandalId ?? existing.publicationMandalId;
    const printingDistrictId = body.printingDistrictId ?? existing.printingDistrictId;
    const printingMandalId = body.printingMandalId ?? existing.printingMandalId;
    const registrationDate = parseDateDDMMYYYY(body.registrationDate || body.registration_date);

    const nativeNameInput = typeof body.nativeName === 'string' ? body.nativeName.trim() : '';
    const langRow = languageId
      ? await (prisma as any).language.findUnique({ where: { id: String(languageId) } }).catch(() => null)
      : null;
    const tenantRow = !nativeNameInput && !existing.nativeName
      ? await (prisma as any).tenant.findUnique({ where: { id: tenantId }, select: { name: true } }).catch(() => null)
      : null;
    const autoNativeName = !nativeNameInput && !existing.nativeName
      ? await autoGenerateTenantNativeName({ tenantName: tenantRow?.name || '', languageCode: langRow?.code || null })
      : '';

    const updateData: any = {
      registrationTitle: body.registrationTitle ?? body.title ?? existing.registrationTitle,
      nativeName: (nativeNameInput || existing.nativeName || autoNativeName || null) as any,
      periodicity: (body.periodicity || existing.periodicity || 'DAILY').toUpperCase(),
      registrationDate: registrationDate ?? existing.registrationDate,
      languageId: languageId ?? existing.languageId,
      ownerName: body.ownerName ?? body.owner ?? existing.ownerName,
      publisherName: body.publisherName ?? body.publisher ?? existing.publisherName,
      editorName: body.editorName ?? body.editor ?? existing.editorName,
      publicationCountryId: publicationCountryId ?? existing.publicationCountryId,
      publicationStateId: publicationStateId ?? existing.publicationStateId,
      publicationDistrictId: publicationDistrictId ?? existing.publicationDistrictId,
      publicationMandalId: publicationMandalId ?? existing.publicationMandalId,
      printingPressName: body.printingPressName ?? body.printingPress ?? existing.printingPressName,
      printingDistrictId: printingDistrictId ?? existing.printingDistrictId,
      printingMandalId: printingMandalId ?? existing.printingMandalId,
      printingCityName: body.printingCityName ?? body.printingCity ?? existing.printingCityName,
      address: body.address ?? existing.address,
    };
    // Do not allow updating prgiNumber

    const row = await (prisma as any).tenantEntity.update({
      where: { tenantId },
      data: updateData,
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
    res.json(row);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Duplicate prgiNumber' });
    }
    console.error('entity update error', e);
    res.status(500).json({ error: 'Failed to update entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity/native-name:
 *   patch:
 *     summary: Update tenant nativeName (manual correction)
 *     description: |
 *       Sets `TenantEntity.nativeName` for the tenant. Intended to correct auto-generated transliteration.
 *     tags: [Tenants]
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
 *             required: [nativeName]
 *             properties:
 *               nativeName:
 *                 type: string
 *                 nullable: true
 *                 description: Native-script tenant name; set null/empty to clear
 *                 example: "ప్రశ్నాయుధం"
 *     responses:
 *       200: { description: Updated TenantEntity }
 *       404: { description: Not found }
 */
router.patch('/:tenantId/entity/native-name', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const existing = await (prisma as any).tenantEntity.findUnique({ where: { tenantId } });
    if (!existing) return res.status(404).json({ error: 'Entity details not found for tenant' });

    const raw = (req.body || {}).nativeName;
    const val = raw === null ? null : typeof raw === 'string' ? raw.trim() : undefined;
    if (val === undefined) return res.status(400).json({ error: 'nativeName is required (string or null)' });
    if (typeof val === 'string' && val.length > 200) return res.status(400).json({ error: 'nativeName too long (max 200 chars)' });

    const row = await (prisma as any).tenantEntity.update({
      where: { tenantId },
      data: { nativeName: val ? val : null },
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
    return res.json(row);
  } catch (e: any) {
    console.error('entity nativeName patch error', e);
    return res.status(500).json({ error: 'Failed to update nativeName' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/entity:
 *   get:
 *     summary: Get PRGI/entity details for a Tenant [Superadmin]
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: TenantEntity }
 *       404: { description: Not found }
 */
router.get('/:tenantId/entity', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const row = await (prisma as any).tenantEntity.findUnique({
      where: { tenantId },
      include: {
        language: true,
        publicationCountry: true,
        publicationState: true,
        publicationDistrict: true,
        publicationMandal: true,
        printingDistrict: true,
        printingMandal: true,
        tenant: { select: { id: true, name: true, slug: true, prgiNumber: true, prgiStatus: true } },
      }
    });
    if (!row) return res.status(404).json({ error: 'Entity details not found for tenant' });
    res.json(row);
  } catch (e) {
    console.error('entity get error', e);
    res.status(500).json({ error: 'Failed to fetch entity details' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/categories:
 *   get:
 *     summary: List allocated categories for a tenant (union of domain allocations)
 *     description: |
 *       Returns unique categories allocated to any domain belonging to the tenant. Optionally filter
 *       by specific domain with `domainId`. If the tenant entity has a primary language set and
 *       `includeTranslation` is true (default), the translated name for that language is included as
 *       `translatedName`. If a tenant has no domains or no allocations, an empty array is returned.
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeTranslation
 *         schema: { type: boolean, default: true }
 *         description: Include tenant primary language translation name.
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Limit categories to a single domain's allocation (must belong to tenant).
 *     responses:
 *       200:
 *         description: Allocated category list
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   slug: { type: string }
 *                   name: { type: string }
 *                   translatedName: { type: string, nullable: true }
 *                   parentId: { type: string, nullable: true }
 *       404: { description: Tenant or domain (when specified) not found }
 */
router.get('/:tenantId/categories', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const includeTranslation = String(req.query.includeTranslation ?? 'true').toLowerCase() === 'true';
    const domainFilterId = req.query.domainId ? String(req.query.domainId) : undefined;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Fetch domains for tenant; optionally validate domainId
    const domains = await (prisma as any).domain.findMany({ where: { tenantId } });
    if (!domains.length) return res.json([]);
    let targetDomainIds: string[];
    if (domainFilterId) {
      const match = domains.find((d: any) => d.id === domainFilterId);
      if (!match) return res.status(404).json({ error: 'Domain not found for tenant' });
      targetDomainIds = [domainFilterId];
    } else {
      targetDomainIds = domains.map((d: any) => d.id);
    }

    // Domain category allocations
    const domainCats = await (prisma as any).domainCategory.findMany({
      where: { domainId: { in: targetDomainIds } },
      include: { category: true }
    });
    if (!domainCats.length) return res.json([]);
    // Unique categories
    const catMap = new Map<string, any>();
    domainCats.forEach((dc: any) => { if (!dc.category.isDeleted) catMap.set(dc.categoryId, dc.category); });
    const categories = Array.from(catMap.values());

    // Translation logic
    const entity = includeTranslation
      ? await (prisma as any).tenantEntity.findUnique({ where: { tenantId }, include: { language: true } }).catch(() => null)
      : null;
    const langCode = includeTranslation ? entity?.language?.code : null;
    let translations: any[] = [];
    if (langCode && categories.length) {
      const ids = categories.map((c: any) => c.id);
      translations = await (prisma as any).categoryTranslation.findMany({ where: { categoryId: { in: ids }, language: langCode } });
    }
    const tMap = new Map(translations.map((t: any) => [t.categoryId, t.name]));
    const shaped = categories.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      translatedName: langCode ? (tMap.get(c.id) || null) : null,
      parentId: c.parentId || null
    }));
    res.json(shaped);
  } catch (e: any) {
    console.error('tenant allocated categories error', e);
    res.status(500).json({ error: 'Failed to list tenant categories' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/categories:
 *   put:
 *     summary: Update categories for all tenant domains (convenience wrapper)
 *     description: |
 *       Replaces category allocations for ALL domains belonging to the tenant.
 *       Provide either `categoryIds` or `categorySlugs` (at least one).
 *     tags: [Tenants]
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
 *             properties:
 *               categoryIds:
 *                 type: array
 *                 items: { type: string }
 *               categorySlugs:
 *                 type: array
 *                 items: { type: string }
 *           examples:
 *             bySlugs:
 *               value:
 *                 categorySlugs: ["politics", "sports", "entertainment"]
 *             byIds:
 *               value:
 *                 categoryIds: ["cuid123", "cuid456"]
 *     responses:
 *       200:
 *         description: Updated categories
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tenant not found
 */
router.put('/:tenantId/categories', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { categoryIds, categorySlugs } = req.body || {};

    if (!Array.isArray(categoryIds) && !Array.isArray(categorySlugs)) {
      return res.status(400).json({ error: 'Provide categoryIds or categorySlugs array' });
    }

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Get all domains for this tenant
    const domains = await (prisma as any).domain.findMany({ where: { tenantId } });
    if (!domains.length) {
      return res.status(400).json({ error: 'Tenant has no domains. Create a domain first.' });
    }

    // Resolve categories
    const cleanedIds = Array.isArray(categoryIds) ? categoryIds.filter((c: string) => typeof c === 'string' && c.trim()) : [];
    const cleanedSlugs = Array.isArray(categorySlugs) ? categorySlugs.filter((c: string) => typeof c === 'string' && c.trim()) : [];

    let slugResolvedIds: string[] = [];
    if (cleanedSlugs.length) {
      const bySlug = await (prisma as any).category.findMany({ where: { slug: { in: cleanedSlugs } }, select: { id: true, slug: true } });
      const foundSlugMap: Record<string, string> = {};
      bySlug.forEach((c: any) => foundSlugMap[c.slug] = c.id);
      const missingSlugs = cleanedSlugs.filter(s => !foundSlugMap[s]);
      if (missingSlugs.length) {
        return res.status(400).json({ error: 'Some categorySlugs not found', missingSlugs });
      }
      slugResolvedIds = Object.values(foundSlugMap);
    }

    const combined = Array.from(new Set([...cleanedIds, ...slugResolvedIds]));

    // Validate category IDs exist
    if (combined.length) {
      const categories = await (prisma as any).category.findMany({ where: { id: { in: combined } }, select: { id: true } });
      const existingIds = new Set(categories.map((c: any) => c.id));
      const missingIds = combined.filter(cid => !existingIds.has(cid));
      if (missingIds.length) {
        return res.status(400).json({ error: 'Some categoryIds not found', missing: missingIds });
      }
    }

    // Update all domains with these categories (transaction)
    const domainIds = domains.map((d: any) => d.id);
    const ops: any[] = [
      (prisma as any).domainCategory.deleteMany({ where: { domainId: { in: domainIds } } }),
    ];
    for (const domainId of domainIds) {
      for (const categoryId of combined) {
        ops.push((prisma as any).domainCategory.create({ data: { domainId, categoryId } }));
      }
    }
    await (prisma as any).$transaction(ops);

    // Return updated categories
    const updatedDomainCats = await (prisma as any).domainCategory.findMany({
      where: { domainId: { in: domainIds } },
      include: { category: true }
    });
    const catMap = new Map<string, any>();
    updatedDomainCats.forEach((dc: any) => { if (!dc.category.isDeleted) catMap.set(dc.categoryId, dc.category); });
    const shaped = Array.from(catMap.values()).map((c: any) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      parentId: c.parentId || null
    }));

    res.json({ count: shaped.length, categories: shaped, domainsUpdated: domainIds.length });
  } catch (e: any) {
    console.error('tenant put categories error', e);
    res.status(500).json({ error: 'Failed to update tenant categories' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/id-card-settings:
 *   get:
 *     summary: Get ID card settings for a tenant
 *     tags: [ID Cards]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Tenant ID card settings }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 *   put:
 *     summary: Upsert ID card settings for a tenant
 *     tags: [ID Cards]
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
 *             properties:
 *               templateId: { type: string, default: "STYLE_1" }
 *               frontLogoUrl: { type: string }
 *               roundStampUrl: { type: string }
 *               signUrl: { type: string }
 *               primaryColor: { type: string, example: "#004f9f" }
 *               secondaryColor: { type: string, example: "#ff0000" }
 *               termsJson: { type: array, items: { type: string } }
 *               officeAddress: { type: string }
 *               helpLine1: { type: string }
 *               helpLine2: { type: string }
 *               validityType: { type: string, enum: [PER_USER_DAYS, FIXED_END_DATE], default: PER_USER_DAYS }
 *               validityDays: { type: integer, description: "Used when validityType = PER_USER_DAYS" }
 *               fixedValidUntil: { type: string, format: date-time, description: "Used when validityType = FIXED_END_DATE" }
 *               idPrefix: { type: string, example: "KM" }
 *               idDigits: { type: integer, example: 6 }
 *     responses:
 *       200: { description: Upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Tenant not found }
 */
/**
 * Global list of ID card settings (super admin only)
 */
router.get('/id-card-settings', auth, requireSuperAdmin, async (req, res) => {
  try {
    const pageRaw = req.query.page as string | undefined;
    const pageSizeRaw = req.query.pageSize as string | undefined;
    let page = pageRaw ? parseInt(pageRaw, 10) : 1;
    let pageSize = pageSizeRaw ? parseInt(pageSizeRaw, 10) : 50;
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 50;
    if (pageSize > 200) pageSize = 200;

    const total = await (prisma as any).tenantIdCardSettings.count();
    const skip = (page - 1) * pageSize;
    const rows = await (prisma as any).tenantIdCardSettings.findMany({
      orderBy: { updatedAt: 'desc' },
      skip,
      take: pageSize,
      include: { tenant: { select: { id: true, name: true } } }
    });
    res.json({ meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) }, data: rows });
  } catch (e) {
    console.error('tenant id-card-settings list error', e);
    res.status(500).json({ error: 'Failed to list ID card settings' });
  }
});

router.get('/:tenantId/id-card-settings', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
    const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
    if (!settings) return res.status(404).json({ error: 'ID card settings not found for tenant' });
    res.json(settings);
  } catch (e) {
    console.error('tenant id-card-settings get error', e);
    res.status(500).json({ error: 'Failed to fetch ID card settings' });
  }
});

router.put('/:tenantId/id-card-settings', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const body = req.body || {};
    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    const data: any = {
      tenantId,
      templateId: body.templateId || 'STYLE_1',
      frontLogoUrl: body.frontLogoUrl ?? null,
      roundStampUrl: body.roundStampUrl ?? null,
      signUrl: body.signUrl ?? null,
      primaryColor: body.primaryColor ?? null,
      secondaryColor: body.secondaryColor ?? null,
      termsJson: Array.isArray(body.termsJson) ? body.termsJson : null,
      officeAddress: body.officeAddress ?? null,
      helpLine1: body.helpLine1 ?? null,
      helpLine2: body.helpLine2 ?? null,
      validityType: body.validityType || 'PER_USER_DAYS',
      validityDays: body.validityType === 'PER_USER_DAYS' ? (body.validityDays ?? null) : null,
      fixedValidUntil: body.validityType === 'FIXED_END_DATE' ? (body.fixedValidUntil ? new Date(body.fixedValidUntil) : null) : null,
      idPrefix: body.idPrefix ?? null,
      idDigits: body.idDigits ?? null,
    };

    const row = await (prisma as any).tenantIdCardSettings.upsert({
      where: { tenantId },
      update: data,
      create: data,
    });
    res.json(row);
  } catch (e) {
    console.error('tenant id-card-settings upsert error', e);
    res.status(500).json({ error: 'Failed to upsert ID card settings' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/bootstrap-content:
 *   post:
 *     summary: Generate sample content for tenant (articles + ePaper)
 *     description: |
 *       Creates sample articles and ePaper issue for a tenant domain.
 *       Useful for testing or giving new tenants starter content.
 *       - Automatically detects domain languages and categories
 *       - Supports two modes: total count OR per-category count
 *       - Creates 1 sample ePaper issue if EPAPER domain exists
 *       - Optional AI-generated diverse content
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
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
 *               domainId: { type: string, description: 'Optional domain ID (uses primary if omitted)' }
 *               skipArticles: { type: boolean, default: false }
 *               skipEpaper: { type: boolean, default: false }
 *               articleCount: { type: integer, description: 'Total articles (1-50, ignores articlesPerCategory if set)' }
 *               articlesPerCategory: { type: integer, description: 'Articles PER category (1-20, e.g., 15)', minimum: 1, maximum: 20 }
 *               useAI: { type: boolean, default: false, description: 'Use AI to generate diverse content' }
 *               addImages: { type: boolean, default: true, description: 'Add images to articles' }
 *               imageSource: { type: string, enum: [placeholder, unsplash], default: placeholder, description: 'Image source: placeholder or Unsplash stock photos' }
 *           examples:
 *             default:
 *               value: {}
 *             perCategory:
 *               summary: 15 articles per category
 *               value: { articlesPerCategory: 15 }
 *             perCategoryWithAI:
 *               summary: 15 AI-generated articles per category
 *               value: { articlesPerCategory: 15, useAI: true }
 *             withUnsplashImages:
 *               summary: 15 articles per category with Unsplash images
 *               value: { articlesPerCategory: 15, imageSource: 'unsplash' }
 *             fullFeatures:
 *               summary: 15 AI articles with Unsplash images
 *               value: { articlesPerCategory: 15, useAI: true, imageSource: 'unsplash' }
 *             totalCount:
 *               value: { articleCount: 20 }
 *             epaperOnly:
 *               value: { skipArticles: true }
 *     responses:
 *       200:
 *         description: Bootstrap result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 created:
 *                   type: object
 *                   properties:
 *                     articles: { type: integer }
 *                     epaper: { type: integer }
 */
router.post('/:tenantId/bootstrap-content', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, skipArticles, skipEpaper, articleCount, articlesPerCategory, useAI, addImages, imageSource } = req.body || {};

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Resolve domain (use provided domainId or find primary active domain)
    let targetDomainId = domainId;
    if (!targetDomainId) {
      const primaryDomain = await (prisma as any).domain.findFirst({
        where: { tenantId, status: 'ACTIVE' },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }]
      });
      if (!primaryDomain) {
        return res.status(400).json({ error: 'No active domain found for tenant' });
      }
      targetDomainId = primaryDomain.id;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { bootstrapTenantContent } = require('../../lib/tenantBootstrap');
    const result = await bootstrapTenantContent(tenantId, targetDomainId, {
      skipArticles,
      skipEpaper,
      articleCount: articleCount ? Math.min(Math.max(1, articleCount), 50) : undefined,
      articlesPerCategory: articlesPerCategory ? Math.min(Math.max(1, articlesPerCategory), 20) : undefined,
      useAI: Boolean(useAI),
      addImages: addImages !== false, // Default true
      imageSource: (imageSource === 'unsplash' ? 'unsplash' : 'placeholder') as 'placeholder' | 'unsplash'
    });

    res.json(result);
  } catch (e: any) {
    console.error('tenant bootstrap-content error', e);
    res.status(500).json({ error: 'Failed to bootstrap content' });
  }
});

/**
 * @swagger
 * /tenants/{tenantId}/clear-bootstrap-content:
 *   delete:
 *     summary: Delete all sample/bootstrap content for tenant
 *     description: Removes all articles and ePaper issues tagged as sample/bootstrap content
 *     tags: [Tenants]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deletion result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     articles: { type: integer }
 *                     epaper: { type: integer }
 */
router.delete('/:tenantId/clear-bootstrap-content', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tenant = await (prisma as any).tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { clearBootstrapContent } = require('../../lib/tenantBootstrap');
    const result = await clearBootstrapContent(tenantId);

    res.json(result);
  } catch (e: any) {
    console.error('tenant clear-bootstrap-content error', e);
    res.status(500).json({ error: 'Failed to clear bootstrap content' });
  }
});

/**
 * @swagger
 * /tenants/id-card-settings:
 *   get:
 *     summary: List ID card settings for all tenants
 *     tags: [Tenants]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *         required: false
 *         description: Page number (default 1)
 *       - in: query
 *         name: page Size
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         required: false
 *         description: Items per page (default 50, max 200)
 *     responses:
 *       200: { description: Paginated settings with tenant info }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */

export default router;
