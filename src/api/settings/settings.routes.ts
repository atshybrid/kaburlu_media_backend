import { Router } from 'express';
import passport from 'passport';
import { getEntitySettings, upsertEntitySettings, getTenantSettings, upsertTenantSettings, getDomainSettings, upsertDomainSettings, listDomainSettings, bootstrapEpaperDomainSettings } from './settings.controller';
import { requireSuperAdmin, requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Settings (Admin)
 *     description: Manage Entity, Tenant and Domain settings (JWT required)
 *   - name: Settings (Public)
 *     description: Read-only settings for the news website (auto-detect by Host)
 */

/** Entity Settings (SUPER_ADMIN) */
/**
 * @swagger
 * /entity/settings:
 *   get:
 *     summary: Get global entity settings
 *     description: SUPER_ADMIN only. Returns platform default settings used as fallbacks.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Settings JSON
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   theme: "dark"
 *                   primaryColor: "#0D47A1"
 *                   secondaryColor: "#FFC107"
 *                   logoUrl: "https://cdn.kaburlu.com/logos/global.png"
 *                   faviconUrl: "https://cdn.kaburlu.com/favicons/global.ico"
 *   put:
 *     summary: Replace global entity settings
 *     description: SUPER_ADMIN only. Replaces entire settings JSON.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           examples:
 *             sample:
 *               value:
 *                 theme: "light"
 *                 primaryColor: "#004D40"
 *                 secondaryColor: "#FF5722"
 *                 fontFamily: "Inter, Arial, sans-serif"
 *                 defaultLanguage: "en"
 *     responses:
 *       200:
 *         description: Updated settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   theme: "light"
 *                   primaryColor: "#004D40"
 *                   secondaryColor: "#FF5722"
 *                   fontFamily: "Inter, Arial, sans-serif"
 *                   defaultLanguage: "en"
 *   patch:
 *     summary: Update parts of entity settings
 *     description: SUPER_ADMIN only. Partially updates settings JSON.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *           examples:
 *             sample:
 *               value:
 *                 theme: "dark"
 *                 accentColor: "#03A9F4"
 *                 showTicker: true
 *                 supportedLanguages: ["en","te"]
 *     responses:
 *       200:
 *         description: Updated settings (merged)
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   theme: "dark"
 *                   accentColor: "#03A9F4"
 *                   showTicker: true
 *                   supportedLanguages: ["en","te"]
 */
/** Tenant Settings */
/**
 * @swagger
 * /tenants/{tenantId}/settings:
 *   get:
 *     summary: Get tenant settings (resolved)
 *     description: SUPER_ADMIN only. Shows tenant settings and effective (merged with entity).
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant settings with effective merged defaults
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   settings:
 *                     theme: "dark"
 *                     primaryColor: "#0D47A1"
 *                     secondaryColor: "#FFC107"
 *                     logoUrl: "https://cdn.kaburlu.com/logos/tenant.png"
 *                     faviconUrl: "https://cdn.kaburlu.com/favicons/tenant.ico"
 *                   effective:
 *                     theme: "dark"
 *                     primaryColor: "#0D47A1"
 *                     secondaryColor: "#FFC107"
 *   put:
 *     summary: Replace tenant settings
 *     description: SUPER_ADMIN only. Replaces entire tenant settings JSON.
 *     tags: [Settings (Admin)]
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
 *           examples:
 *             sample:
 *               value:
 *                 theme: "light"
 *                 primaryColor: "#1B5E20"
 *                 secondaryColor: "#E64A19"
 *                 fontFamily: "Inter"
 *             reporterLimitsApplyAll:
 *               summary: Reporter limits (apply to all designations)
 *               value:
 *                 reporterLimits:
 *                   enabled: true
 *                   defaultMax: 1
 *                   rules: []
 *             reporterLimitsOneByOne:
 *               summary: Reporter limits (one-by-one rules)
 *               value:
 *                 reporterLimits:
 *                   enabled: true
 *                   rules:
 *                     - designationId: "desg_abc"
 *                       level: "MANDAL"
 *                       mandalId: "mandal_xyz"
 *                       max: 2
 *                     - designationId: "desg_abc"
 *                       level: "DISTRICT"
 *                       districtId: "district_pqr"
 *                       max: 1
 *     responses:
 *       200:
 *         description: Tenant settings saved
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   settings:
 *                     theme: "light"
 *                     primaryColor: "#1B5E20"
 *                     secondaryColor: "#E64A19"
 *                     fontFamily: "Inter"
 *   patch:
 *     summary: Update parts of tenant settings
 *     description: SUPER_ADMIN only. Partially updates tenant settings JSON.
 *     tags: [Settings (Admin)]
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
 *           examples:
 *             reporterLimitsApplyAll:
 *               summary: Apply max to all designations
 *               value:
 *                 reporterLimits:
 *                   enabled: true
 *                   defaultMax: 1
 *             reporterLimitsDesignationLevelAnyLocation:
 *               summary: Apply to a designation for all locations of a level
 *               value:
 *                 reporterLimits:
 *                   enabled: true
 *                   rules:
 *                     - designationId: "desg_abc"
 *                       level: "MANDAL"
 *                       max: 2
 *             reporterLimitsDesignationLevelLocation:
 *               summary: Apply to a designation at a specific location
 *               value:
 *                 reporterLimits:
 *                   enabled: true
 *                   rules:
 *                     - designationId: "desg_abc"
 *                       level: "MANDAL"
 *                       mandalId: "mandal_xyz"
 *                       max: 2
 *     responses:
 *       200:
 *         description: Tenant settings updated (merged)
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   settings:
 *                     theme: "dark"
 *                     accentColor: "#03A9F4"
 */
router.get('/entity/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, getEntitySettings);
router.put('/entity/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertEntitySettings);
router.patch('/entity/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertEntitySettings);

router.get('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, getTenantSettings);
router.put('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertTenantSettings);
router.patch('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertTenantSettings);

// ---------------- Reporter Pricing (TENANT_ADMIN scoped or SUPER_ADMIN) ----------------

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

type ReporterPricingConfig = {
	subscriptionEnabled?: boolean;
	currency?: string;
	defaultMonthlyAmount?: number;
	defaultIdCardCharge?: number;
	byDesignation?: Array<{ designationId: string; monthlyAmount?: number; idCardCharge?: number }>;
};

function normalizeReporterPricing(value: any): ReporterPricingConfig {
	if (!value || typeof value !== 'object') return {};
	return value as ReporterPricingConfig;
}

function mergeReporterPricing(existing: ReporterPricingConfig, patch: ReporterPricingConfig): ReporterPricingConfig {
	const out: ReporterPricingConfig = { ...(existing || {}) };
	if (typeof patch.subscriptionEnabled === 'boolean') out.subscriptionEnabled = patch.subscriptionEnabled;
	if (typeof patch.currency === 'string' && patch.currency) out.currency = patch.currency;
	if (typeof patch.defaultMonthlyAmount === 'number') out.defaultMonthlyAmount = patch.defaultMonthlyAmount;
	if (typeof patch.defaultIdCardCharge === 'number') out.defaultIdCardCharge = patch.defaultIdCardCharge;
	if (Object.prototype.hasOwnProperty.call(patch, 'byDesignation')) {
		out.byDesignation = Array.isArray(patch.byDesignation) ? patch.byDesignation : [];
	}
	return out;
}

/**
 * @swagger
 * /tenants/{tenantId}/reporter-pricing:
 *   get:
 *     summary: Get tenant reporter pricing (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Reads `TenantSettings.data.reporterPricing`.
 *       Amounts are in the smallest currency unit (e.g. paise).
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Reporter pricing configuration
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "tenant_123"
 *                   reporterPricing:
 *                     subscriptionEnabled: true
 *                     currency: "INR"
 *                     defaultMonthlyAmount: 9900
 *                     defaultIdCardCharge: 19900
 *                     byDesignation:
 *                       - designationId: "desg_1"
 *                         monthlyAmount: 9900
 *                         idCardCharge: 19900
 */
router.get('/tenants/:tenantId/reporter-pricing', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
	try {
		const { tenantId } = req.params;
		const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
		if (!tenant) return res.status(404).json({ error: 'Tenant not found' });
		const row = await p.tenantSettings.findUnique({ where: { tenantId }, select: { data: true } }).catch(() => null);
		const pricing = normalizeReporterPricing(row?.data?.reporterPricing);
		return res.json({ tenantId, reporterPricing: pricing });
	} catch (e: any) {
		console.error('get reporter pricing error', e);
		return res.status(500).json({ error: 'Failed to get reporter pricing' });
	}
});

/**
 * @swagger
 * /tenants/{tenantId}/reporter-pricing:
 *   patch:
 *     summary: Update tenant reporter pricing (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Updates only `TenantSettings.data.reporterPricing`.
 *
 *       Merge rules:
 *       - scalar fields are merged
 *       - if `byDesignation` is provided, it replaces the entire array
 *
 *       Best-practice: reporter creation snapshots these prices into each Reporter row.
 *     tags: [Settings (Admin)]
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
 *               reporterPricing:
 *                 type: object
 *           examples:
 *             enableWithDefaults:
 *               value:
 *                 reporterPricing:
 *                   subscriptionEnabled: true
 *                   currency: "INR"
 *                   defaultMonthlyAmount: 9900
 *                   defaultIdCardCharge: 19900
 *             designationOverride:
 *               value:
 *                 reporterPricing:
 *                   byDesignation:
 *                     - designationId: "desg_1"
 *                       monthlyAmount: 14900
 *                       idCardCharge: 19900
 *     responses:
 *       200:
 *         description: Updated pricing
 */
router.patch('/tenants/:tenantId/reporter-pricing', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdminScoped, async (req, res) => {
	try {
		const { tenantId } = req.params;
		const body = req.body || {};
		const patch = normalizeReporterPricing(body.reporterPricing ?? body);

		const tenant = await p.tenant.findUnique({ where: { id: tenantId }, select: { id: true } }).catch(() => null);
		if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

		const existing = await p.tenantSettings.findUnique({ where: { tenantId }, select: { id: true, data: true } }).catch(() => null);
		const existingData = existing?.data && typeof existing.data === 'object' ? existing.data : {};
		const currentPricing = normalizeReporterPricing((existingData as any).reporterPricing);
		const nextPricing = mergeReporterPricing(currentPricing, patch);
		const nextData = { ...(existingData as any), reporterPricing: nextPricing };

		const saved = await p.tenantSettings.upsert({
			where: { tenantId },
			create: { tenantId, data: nextData },
			update: { data: nextData },
			select: { tenantId: true, data: true },
		});

		return res.json({ tenantId: saved.tenantId, reporterPricing: (saved.data as any)?.reporterPricing || {} });
	} catch (e: any) {
		console.error('patch reporter pricing error', e);
		return res.status(500).json({ error: 'Failed to update reporter pricing' });
	}
});

/** Domain Settings */
/**
 * @swagger
 * /tenants/{tenantId}/domains/{domainId}/settings:
 *   get:
 *     summary: Get domain settings (resolved)
 *     description: SUPER_ADMIN only. Domain is canonical for website config. Effective merges entity→tenant→domain.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Domain settings with effective merged defaults
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                   domainId: "dmn_123"
 *                   settings:
 *                     theme: "light"
 *                     primaryColor: "#3F51B5"
 *                     secondaryColor: "#CDDC39"
 *                     logoUrl: "https://cdn.kaburlu.com/logos/domain.png"
 *                     faviconUrl: "https://cdn.kaburlu.com/favicons/domain.ico"
 *                   effective:
 *                     theme: "light"
 *                     primaryColor: "#3F51B5"
 *                     secondaryColor: "#CDDC39"
 *   put:
 *     summary: Replace domain settings
 *     description: SUPER_ADMIN only. Replaces entire domain settings JSON.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
	*           examples:
	*             sample:
	*               summary: Full website config (recommended sections)
	*               value:
	*                 themeStyle: "style2"
	*                 branding:
	*                   logoUrl: "https://cdn.kaburlu.com/logos/domain.png"
	*                   faviconUrl: "https://cdn.kaburlu.com/favicons/domain.ico"
	*                 theme:
	*                   theme: "light"
	*                   colors:
	*                     primary: "#3F51B5"
	*                     secondary: "#CDDC39"
	*                     accent: "#FF9800"
	*                   typography:
	*                     fontFamily: "Inter, Arial, sans-serif"
	*                     baseSize: 16
	*                   layout:
	*                     header: "classic"
	*                     footer: "minimal"
	*                     showTopBar: true
	*                     showTicker: true
	*                 navigation:
	*                   menu:
	*                     - { label: "Home", href: "/" }
	*                     - { label: "Politics", href: "/category/politics" }
	*                 content:
	*                   defaultLanguage: "en"
	*                   supportedLanguages: ["en","te"]
	*                 seo:
	*                   defaultMetaTitle: "Kaburlu News"
	*                   defaultMetaDescription: "Latest breaking news and updates."
	*                   ogImageUrl: "https://cdn.kaburlu.com/seo/default-og.png"
	*                   canonicalBaseUrl: "https://news.kaburlu.com"
	*                 notifications:
	*                   enabled: true
	*                   providers:
	*                     webpush:
	*                       publicKey: "BExxx..."
	*                 integrations:
	*                   analytics:
	*                     provider: "gtag"
	*                     measurementId: "G-XXXXXXX"
	*                 flags:
	*                   enableComments: true
	*                   enableBookmarks: true
	*                 customCss: "body{font-family:Inter;}"
	 *     responses:
	 *       200:
	 *         description: Domain settings saved
	 *         content:
	 *           application/json:
	 *             examples:
	 *               sample:
	 *                 value:
	 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
	 *                   domainId: "dmn_123"
	 *                   settings:
	 *                     theme:
	 *                       theme: "light"
	 *                     customCss: "body{font-family:Inter;}"
 *   patch:
 *     summary: Update parts of domain settings
 *     description: SUPER_ADMIN only. Partially updates domain settings JSON.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
	*           examples:
	*             themeUpdate:
	*               summary: Update only theme colors and mode
	*               value:
	*                 theme:
	*                   theme: "dark"
	*                   colors:
	*                     primary: "#0D47A1"
	*                     secondary: "#FFC107"
	*             themeStyleUpdate:
	*               summary: Set homepage theme style (style1 or style2)
	*               value:
	*                 themeStyle: "style2"
	*             brandingUpdate:
	*               summary: Update only logo and favicon
	*               value:
	*                 branding:
	*                   logoUrl: "https://cdn.kaburlu.com/logos/domain.png"
	*                   faviconUrl: "https://cdn.kaburlu.com/favicons/domain.ico"
	*             seoUpdate:
	*               summary: Update SEO defaults
	*               value:
	*                 seo:
	*                   defaultMetaTitle: "Kaburlu News"
	*                   defaultMetaDescription: "Latest breaking news."
	*             customCssUpdate:
	*               summary: Add custom CSS only
	*               value:
	*                 customCss: "body{font-family:Inter;}"
	 *     responses:
	 *       200:
	 *         description: Domain settings updated (merged)
	 *         content:
	 *           application/json:
	 *             examples:
	 *               sample:
	 *                 value:
	 *                   tenantId: "cmidgq4v80004ugv8dtqv4ijk"
	 *                   domainId: "dmn_123"
	 *                   settings:
	 *                     theme:
	 *                       theme: "dark"
	 *                       colors:
	 *                         primary: "#0D47A1"
	 *                         secondary: "#FFC107"
 */
router.get('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, getDomainSettings);
router.put('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertDomainSettings);
router.patch('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, upsertDomainSettings);

/**
 * @swagger
 * /tenants/{tenantId}/domains/settings:
 *   get:
 *     summary: List domain settings for tenant
 *     description: SUPER_ADMIN only. Paginated list for managing multiple domains.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated domain settings
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   meta: { page: 1, pageSize: 20, total: 1 }
 *                   data:
 *                     - id: "ds_1"
 *                       domainId: "dmn_123"
 *                       tenantId: "cmidgq4v80004ugv8dtqv4ijk"
 *                       data:
 *                         theme: "dark"
 *                         primaryColor: "#0D47A1"
 *                         secondaryColor: "#FFC107"
 */
router.get('/tenants/:tenantId/domains/settings', passport.authenticate('jwt', { session: false }), requireSuperAdmin, listDomainSettings);

/**
 * @swagger
 * /tenants/{tenantId}/domains/{domainId}/settings/epaper/auto:
 *   post:
 *     summary: Auto-fill EPAPER domain settings (branding/theme) and generate SEO via AI
 *     description: |
 *       SUPER_ADMIN only. For EPAPER domains, this endpoint:
 *       - Seeds DomainSettings.branding/theme from the tenant's primary domain settings (or tenantTheme fallback)
 *       - Generates SEO fields (title/description/keywords/H1/tagline) using ChatGPT
 *       - Saves into DomainSettings.data.seo (canonicalBaseUrl is set to https://epaper-domain)
 *
 *       Useful when you want to (re)generate EPAPER domain settings on demand.
 *     tags: [Settings (Admin)]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Domain settings saved and effective merged settings returned
 *       400:
 *         description: Not an EPAPER domain / invalid tenant-domain relation
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Domain not found
 */
router.post('/tenants/:tenantId/domains/:domainId/settings/epaper/auto', passport.authenticate('jwt', { session: false }), requireSuperAdmin, bootstrapEpaperDomainSettings);

export default router;