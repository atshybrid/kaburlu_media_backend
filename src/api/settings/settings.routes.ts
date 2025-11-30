import { Router } from 'express';
import passport from 'passport';
import { getEntitySettings, upsertEntitySettings, getTenantSettings, upsertTenantSettings, getDomainSettings, upsertDomainSettings, listDomainSettings } from './settings.controller';

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
router.get('/entity/settings', passport.authenticate('jwt', { session: false }), getEntitySettings);
router.put('/entity/settings', passport.authenticate('jwt', { session: false }), upsertEntitySettings);
router.patch('/entity/settings', passport.authenticate('jwt', { session: false }), upsertEntitySettings);

/** Tenant Settings */
/**
 * @swagger
 * /tenants/{tenantId}/settings:
 *   get:
 *     summary: Get tenant settings (resolved)
 *     description: TENANT_ADMIN or SUPER_ADMIN. Shows tenant settings and effective (merged with entity).
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
 *     description: TENANT_ADMIN or SUPER_ADMIN. Replaces entire tenant settings JSON.
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
 *     description: TENANT_ADMIN or SUPER_ADMIN. Partially updates tenant settings JSON.
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
router.get('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), getTenantSettings);
router.put('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), upsertTenantSettings);
router.patch('/tenants/:tenantId/settings', passport.authenticate('jwt', { session: false }), upsertTenantSettings);

/** Domain Settings */
/**
 * @swagger
 * /tenants/{tenantId}/domains/{domainId}/settings:
 *   get:
 *     summary: Get domain settings (resolved)
 *     description: TENANT_ADMIN or SUPER_ADMIN. Domain is canonical for website config. Effective merges entity→tenant→domain.
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
 *     description: TENANT_ADMIN or SUPER_ADMIN. Replaces entire domain settings JSON.
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
 *     description: TENANT_ADMIN or SUPER_ADMIN. Partially updates domain settings JSON.
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
router.get('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), getDomainSettings);
router.put('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), upsertDomainSettings);
router.patch('/tenants/:tenantId/domains/:domainId/settings', passport.authenticate('jwt', { session: false }), upsertDomainSettings);

/**
 * @swagger
 * /tenants/{tenantId}/domains/settings:
 *   get:
 *     summary: List domain settings for tenant
 *     description: TENANT_ADMIN or SUPER_ADMIN. Paginated list for managing multiple domains.
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
router.get('/tenants/:tenantId/domains/settings', passport.authenticate('jwt', { session: false }), listDomainSettings);

export default router;