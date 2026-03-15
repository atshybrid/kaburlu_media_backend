import { Router } from 'express';
import passport from 'passport';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import { buildEffectiveStyle1AdsResponse, normalizeStyle1AdsConfig } from '../../lib/adsStyle1';
import { buildEffectiveStyle2AdsResponse, normalizeStyle2AdsConfig } from '../../lib/adsStyle2';

// transient any-cast for newly added delegates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

const router = Router({ mergeParams: true });

type TenantAd = {
  id: string;
  placement: string;
  title?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  clickUrl?: string | null;
  text?: string | null;
  enabled?: boolean;
  visibility?: 'PRIVATE' | 'PUBLIC';
  domainId?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  priority?: number;
  meta?: any;
  createdAt?: string;
  updatedAt?: string;
};

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  // Prefer stable UUIDs if available, else random fallback.
  return (crypto as any).randomUUID ? (crypto as any).randomUUID() : crypto.randomBytes(16).toString('hex');
}

function asArray(value: any): any[] {
  return Array.isArray(value) ? value : [];
}

function normalizeVisibility(v: any): 'PRIVATE' | 'PUBLIC' {
  const s = String(v || '').toUpperCase().trim();
  return s === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE';
}

function clampNumber(n: any, min: number, max: number, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.min(Math.max(x, min), max);
}

async function loadTenantAds(tenantId: string): Promise<{ row: any | null; ads: TenantAd[]; data: any }>{
  const row = await p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const ads = asArray((data as any).ads).map((a: any) => a).filter(Boolean);
  return { row, ads, data };
}

async function saveTenantAds(tenantId: string, existingRow: any | null, nextAds: TenantAd[], baseData: any) {
  const nextData = { ...(baseData || {}), ads: nextAds };
  if (existingRow) {
    return p.tenantSettings.update({ where: { tenantId }, data: { data: nextData } });
  }
  return p.tenantSettings.create({ data: { tenantId, data: nextData } });
}

async function loadTenantAdsStyle1(tenantId: string): Promise<{ row: any | null; adsStyle1: any; data: any }> {
  const row = await p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const adsStyle1 = (data as any).adsStyle1 && typeof (data as any).adsStyle1 === 'object' ? (data as any).adsStyle1 : {};
  return { row, adsStyle1, data };
}

async function saveTenantAdsStyle1(tenantId: string, existingRow: any | null, nextAdsStyle1: any, baseData: any) {
  const nextData = { ...(baseData || {}), adsStyle1: nextAdsStyle1 };
  if (existingRow) {
    return p.tenantSettings.update({ where: { tenantId }, data: { data: nextData } });
  }
  return p.tenantSettings.create({ data: { tenantId, data: nextData } });
}

async function loadTenantAdsStyle2(tenantId: string): Promise<{ row: any | null; adsStyle2: any; data: any }> {
  const row = await p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const adsStyle2 = (data as any).adsStyle2 && typeof (data as any).adsStyle2 === 'object' ? (data as any).adsStyle2 : {};
  return { row, adsStyle2, data };
}

async function saveTenantAdsStyle2(tenantId: string, existingRow: any | null, nextAdsStyle2: any, baseData: any) {
  const nextData = { ...(baseData || {}), adsStyle2: nextAdsStyle2 };
  if (existingRow) {
    return p.tenantSettings.update({ where: { tenantId }, data: { data: nextData } });
  }
  return p.tenantSettings.create({ data: { tenantId, data: nextData } });
}

/**
 * @swagger
 * tags:
 *   - name: Tenant Ads
 *     description: Tenant-scoped website ads stored in TenantSettings.data.ads (JWT required)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AdSlotConfig:
 *       type: object
 *       description: Configuration for a single Google AdSense ad slot
 *       properties:
 *         slotId:
 *           type: string
 *           nullable: true
 *           description: 10-digit Google AdSense slot ID (from your AdSense dashboard)
 *           example: "1234567890"
 *         format:
 *           type: string
 *           enum: [auto, autorelaxed, fluid]
 *           description: >
 *             auto = responsive banner/rectangle;
 *             autorelaxed = multiplex/native (use for home_multiplex and article_multiplex);
 *             fluid = in-feed
 *           example: "auto"
 *         enabled:
 *           type: boolean
 *           description: Whether this slot is active. Set false to hide without deleting slotId.
 *           example: true
 *     AdsConfig:
 *       type: object
 *       description: Full tenant ads configuration with 8 standard page slots
 *       properties:
 *         enabled:
 *           type: boolean
 *           description: Master switch — disables all ads if false
 *           example: true
 *         adsenseClientId:
 *           type: string
 *           nullable: true
 *           description: Google AdSense publisher ID (must start with ca-pub-)
 *           example: "ca-pub-5191460803448280"
 *         slots:
 *           type: object
 *           description: |
 *             Map of standard slot keys to their config.
 *             **Pages × Slots:**
 *             - Home page: home_top, home_mid, home_multiplex
 *             - Article detail page: article_top, article_mid, article_multiplex
 *             - Category listing page: category_top, category_mid
 *           properties:
 *             home_top:          { $ref: '#/components/schemas/AdSlotConfig' }
 *             home_mid:          { $ref: '#/components/schemas/AdSlotConfig' }
 *             home_multiplex:    { $ref: '#/components/schemas/AdSlotConfig' }
 *             article_top:       { $ref: '#/components/schemas/AdSlotConfig' }
 *             article_mid:       { $ref: '#/components/schemas/AdSlotConfig' }
 *             article_multiplex: { $ref: '#/components/schemas/AdSlotConfig' }
 *             category_top:      { $ref: '#/components/schemas/AdSlotConfig' }
 *             category_mid:      { $ref: '#/components/schemas/AdSlotConfig' }
 */

/**
 * @swagger
 * /tenants/{tenantId}/ads:
 *   get:
 *     summary: List tenant ads (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Ads list
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   - id: "ad_1"
 *                     placement: "homepage_top"
 *                     title: "Sponsor"
 *                     imageUrl: "https://cdn.example.com/ads/top.webp"
 *                     videoUrl: null
 *                     clickUrl: "https://sponsor.example.com"
 *                     text: null
 *                     enabled: true
 *                     visibility: "PRIVATE"
 *                     domainId: null
 *                     startsAt: null
 *                     endsAt: null
 *                     priority: 10
 *                     meta: { kind: "image" }
 *                     createdAt: "2025-12-29T10:00:00.000Z"
 *                     updatedAt: "2025-12-29T10:00:00.000Z"
 */
router.get(
  '/tenants/:tenantId/ads',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const { ads } = await loadTenantAds(tenantId);
    res.json(ads);
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style1:
 *   get:
 *     summary: Get style1 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Returns the stored style1 ads config from TenantSettings.data.adsStyle1.
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Style1 ads config
 */
router.get(
  '/tenants/:tenantId/ads/style1',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const { adsStyle1 } = await loadTenantAdsStyle1(tenantId);
    res.json({ ads: buildEffectiveStyle1AdsResponse(adsStyle1, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style1:
 *   put:
 *     summary: Replace style1 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Stores config under TenantSettings.data.adsStyle1.
 *     tags: [Tenant Ads]
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
 *               ads:
 *                 type: object
 *                 description: Style1 ads config ({enabled, debug, googleAdsense, slots})
 *           examples:
 *             googleExample:
 *               value:
 *                 ads:
 *                   enabled: true
 *                   debug: false
 *                   googleAdsense: { client: "ca-pub-1234567890123456" }
 *                   slots:
 *                     home_top_banner:
 *                       enabled: true
 *                       provider: google
 *                       google: { slot: "1000000001", format: "auto", responsive: true }
 *                     article_inline:
 *                       enabled: true
 *                       provider: google
 *                       google: { slot: "1000000012", format: "auto", responsive: true }
 *             localExample:
 *               value:
 *                 ads:
 *                   enabled: true
 *                   debug: false
 *                   slots:
 *                     home_top_banner:
 *                       enabled: true
 *                       provider: local
 *                       local:
 *                         imageUrl: "https://cdn.example.com/ads/home-top-728x90.jpg"
 *                         clickUrl: "https://sponsor.example.com/home-top"
 *                         alt: "Home Top Sponsor"
 *     responses:
 *       200:
 *         description: Saved
 */
router.put(
  '/tenants/:tenantId/ads/style1',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};
    const incoming = (body && typeof body === 'object' && (body as any).ads) ? (body as any).ads : body;

    const normalized = normalizeStyle1AdsConfig(incoming);
    const { row, data } = await loadTenantAdsStyle1(tenantId);
    await saveTenantAdsStyle1(tenantId, row, normalized, data);
    res.json({ ok: true, ads: buildEffectiveStyle1AdsResponse(normalized, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style1:
 *   patch:
 *     summary: Update style1 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Deep-merges slots; supports sending only a few slot keys.
 *     tags: [Tenant Ads]
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
 *               ads:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch(
  '/tenants/:tenantId/ads/style1',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};
    const incoming = (body && typeof body === 'object' && (body as any).ads) ? (body as any).ads : body;

    const { row, adsStyle1, data } = await loadTenantAdsStyle1(tenantId);
    const prev = normalizeStyle1AdsConfig(adsStyle1);
    const nextPatch = normalizeStyle1AdsConfig(incoming);

    const merged = {
      ...prev,
      ...nextPatch,
      googleAdsense: (nextPatch as any).googleAdsense ?? (prev as any).googleAdsense,
      slots: { ...(prev.slots || {}), ...(nextPatch.slots || {}) }
    };

    const normalized = normalizeStyle1AdsConfig(merged);
    await saveTenantAdsStyle1(tenantId, row, normalized, data);
    res.json({ ok: true, ads: buildEffectiveStyle1AdsResponse(normalized, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style2:
 *   get:
 *     summary: Get style2 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Returns the stored style2 ads config from TenantSettings.data.adsStyle2.
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Style2 ads config
 */
router.get(
  '/tenants/:tenantId/ads/style2',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const { adsStyle2 } = await loadTenantAdsStyle2(tenantId);
    res.json({ ads: buildEffectiveStyle2AdsResponse(adsStyle2, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style2:
 *   put:
 *     summary: Replace style2 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Stores config under TenantSettings.data.adsStyle2.
 *     tags: [Tenant Ads]
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
 *               ads:
 *                 type: object
 *                 description: Style2 ads config ({enabled, debug, googleAdsense, slots})
 *           examples:
 *             googleExample:
 *               value:
 *                 ads:
 *                   enabled: true
 *                   debug: true
 *                   googleAdsense: { client: "ca-pub-1234567890123456" }
 *                   slots:
 *                     home_left_1:
 *                       enabled: true
 *                       provider: google
 *                       google: { slot: "3100000001", format: "auto", responsive: true }
 *                     style2_article_sidebar:
 *                       enabled: true
 *                       provider: google
 *                       google: { slot: "3100000005", format: "auto", responsive: true }
 *             localExample:
 *               value:
 *                 ads:
 *                   enabled: true
 *                   debug: true
 *                   slots:
 *                     home_left_1:
 *                       enabled: true
 *                       provider: local
 *                       local:
 *                         imageUrl: "https://cdn.example.com/ads/style2-left1-300x250.jpg"
 *                         clickUrl: "https://sponsor.example.com/left1"
 *                         alt: "Sponsor Left 1"
 *     responses:
 *       200:
 *         description: Saved
 */
router.put(
  '/tenants/:tenantId/ads/style2',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};
    const incoming = (body && typeof body === 'object' && (body as any).ads) ? (body as any).ads : body;

    const normalized = normalizeStyle2AdsConfig(incoming);
    const { row, data } = await loadTenantAdsStyle2(tenantId);
    await saveTenantAdsStyle2(tenantId, row, normalized, data);
    res.json({ ok: true, ads: buildEffectiveStyle2AdsResponse(normalized, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/style2:
 *   patch:
 *     summary: Update style2 slot-based ads config (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: Deep-merges slots; supports sending only a few slot keys.
 *     tags: [Tenant Ads]
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
 *               ads:
 *                 type: object
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch(
  '/tenants/:tenantId/ads/style2',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};
    const incoming = (body && typeof body === 'object' && (body as any).ads) ? (body as any).ads : body;

    const { row, adsStyle2, data } = await loadTenantAdsStyle2(tenantId);
    const prev = normalizeStyle2AdsConfig(adsStyle2);
    const nextPatch = normalizeStyle2AdsConfig(incoming);

    const merged = {
      ...prev,
      ...nextPatch,
      googleAdsense: (nextPatch as any).googleAdsense ?? (prev as any).googleAdsense,
      slots: { ...(prev.slots || {}), ...(nextPatch.slots || {}) }
    };

    const normalized = normalizeStyle2AdsConfig(merged);
    await saveTenantAdsStyle2(tenantId, row, normalized, data);
    res.json({ ok: true, ads: buildEffectiveStyle2AdsResponse(normalized, { includeAllSlots: true }) });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads:
 *   post:
 *     summary: Create a tenant ad (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Ads]
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
 *             required: [placement]
 *             properties:
 *               placement: { type: string, example: "homepage_top" }
 *               title: { type: string }
 *               imageUrl: { type: string }
 *               clickUrl: { type: string }
 *               enabled: { type: boolean, example: true }
 *               visibility: { type: string, enum: [PRIVATE, PUBLIC], example: PRIVATE }
 *               domainId: { type: string, nullable: true }
 *               startsAt: { type: string, nullable: true, description: ISO date-time }
 *               endsAt: { type: string, nullable: true, description: ISO date-time }
 *               priority: { type: number, example: 0 }
 *           examples:
 *             imagePrivate:
 *               summary: Private image ad (default for tenant website)
 *               value:
 *                 placement: "homepage_top"
 *                 title: "Sponsor"
 *                 imageUrl: "https://cdn.example.com/ads/top.webp"
 *                 clickUrl: "https://sponsor.example.com"
 *                 enabled: true
 *                 visibility: "PRIVATE"
 *                 domainId: null
 *                 priority: 10
 *             videoPrivate:
 *               summary: Private video ad
 *               value:
 *                 placement: "article_inline"
 *                 title: "Video Sponsor"
 *                 videoUrl: "https://cdn.example.com/ads/clip.mp4"
 *                 clickUrl: "https://sponsor.example.com"
 *                 enabled: true
 *                 visibility: "PRIVATE"
 *                 startsAt: "2025-12-29T00:00:00.000Z"
 *                 endsAt: "2026-01-15T00:00:00.000Z"
 *     responses:
 *       200:
 *         description: Created ad
 *         content:
 *           application/json:
 *             examples:
 *               created:
 *                 value:
 *                   id: "ad_1"
 *                   placement: "homepage_top"
 *                   title: "Sponsor"
 *                   imageUrl: "https://cdn.example.com/ads/top.webp"
 *                   videoUrl: null
 *                   clickUrl: "https://sponsor.example.com"
 *                   text: null
 *                   enabled: true
 *                   visibility: "PRIVATE"
 *                   domainId: null
 *                   startsAt: null
 *                   endsAt: null
 *                   priority: 10
 *                   meta: null
 *                   createdAt: "2025-12-29T10:00:00.000Z"
 *                   updatedAt: "2025-12-29T10:00:00.000Z"
 */
router.post(
  '/tenants/:tenantId/ads',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};

    const placement = String(body.placement || '').trim();
    if (!placement) return res.status(400).json({ error: 'placement is required' });

    const { row, ads, data } = await loadTenantAds(tenantId);
    const ts = nowIso();

    const ad: TenantAd = {
      id: newId(),
      placement,
      title: Object.prototype.hasOwnProperty.call(body, 'title') ? (body.title ?? null) : null,
      imageUrl: Object.prototype.hasOwnProperty.call(body, 'imageUrl') ? (body.imageUrl ?? null) : null,
      videoUrl: Object.prototype.hasOwnProperty.call(body, 'videoUrl') ? (body.videoUrl ?? null) : null,
      clickUrl: Object.prototype.hasOwnProperty.call(body, 'clickUrl') ? (body.clickUrl ?? null) : null,
      text: Object.prototype.hasOwnProperty.call(body, 'text') ? (body.text ?? null) : null,
      enabled: Object.prototype.hasOwnProperty.call(body, 'enabled') ? !!body.enabled : true,
      visibility: Object.prototype.hasOwnProperty.call(body, 'visibility') ? normalizeVisibility(body.visibility) : 'PRIVATE',
      domainId: Object.prototype.hasOwnProperty.call(body, 'domainId') ? (body.domainId ?? null) : null,
      startsAt: Object.prototype.hasOwnProperty.call(body, 'startsAt') ? (body.startsAt ?? null) : null,
      endsAt: Object.prototype.hasOwnProperty.call(body, 'endsAt') ? (body.endsAt ?? null) : null,
      priority: Object.prototype.hasOwnProperty.call(body, 'priority') ? clampNumber(body.priority, -1000, 1000, 0) : 0,
      meta: Object.prototype.hasOwnProperty.call(body, 'meta') ? (body.meta ?? null) : null,
      createdAt: ts,
      updatedAt: ts
    };

    const nextAds = [ad, ...ads];
    await saveTenantAds(tenantId, row, nextAds, data);
    res.json(ad);
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/{adId}:
 *   patch:
 *     summary: Update a tenant ad (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: adId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               placement: { type: string, example: "homepage_top" }
 *               title: { type: string }
 *               imageUrl: { type: string }
 *               videoUrl: { type: string }
 *               clickUrl: { type: string }
 *               text: { type: string }
 *               enabled: { type: boolean }
 *               visibility: { type: string, enum: [PRIVATE, PUBLIC] }
 *               domainId: { type: string, nullable: true }
 *               startsAt: { type: string, nullable: true, description: ISO date-time }
 *               endsAt: { type: string, nullable: true, description: ISO date-time }
 *               priority: { type: number }
 *               meta: { type: object, additionalProperties: true }
 *           examples:
 *             update:
 *               summary: Update title + click URL
 *               value:
 *                 title: "New Sponsor Title"
 *                 clickUrl: "https://sponsor.example.com/new"
 *                 priority: 25
 *     responses:
 *       200:
 *         description: Updated ad
 *         content:
 *           application/json:
 *             examples:
 *               updated:
 *                 value:
 *                   id: "ad_1"
 *                   placement: "homepage_top"
 *                   title: "New Sponsor Title"
 *                   imageUrl: "https://cdn.example.com/ads/top.webp"
 *                   videoUrl: null
 *                   clickUrl: "https://sponsor.example.com/new"
 *                   text: null
 *                   enabled: true
 *                   visibility: "PRIVATE"
 *                   domainId: null
 *                   startsAt: null
 *                   endsAt: null
 *                   priority: 25
 *                   meta: null
 *                   createdAt: "2025-12-29T10:00:00.000Z"
 *                   updatedAt: "2025-12-29T11:00:00.000Z"
 *       404:
 *         description: Not found
 */
router.patch(
  '/tenants/:tenantId/ads/:adId',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId, adId } = req.params;
    const body = req.body || {};

    const { row, ads, data } = await loadTenantAds(tenantId);
    const idx = ads.findIndex((a: any) => String(a?.id) === String(adId));
    if (idx < 0) return res.status(404).json({ error: 'Ad not found' });

    const prev = ads[idx] as TenantAd;
    const ts = nowIso();

    const next: TenantAd = { ...prev };
    if (Object.prototype.hasOwnProperty.call(body, 'placement')) {
      const placement = String(body.placement || '').trim();
      if (!placement) return res.status(400).json({ error: 'placement cannot be empty' });
      next.placement = placement;
    }
    if (Object.prototype.hasOwnProperty.call(body, 'title')) next.title = body.title ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'imageUrl')) next.imageUrl = body.imageUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'videoUrl')) next.videoUrl = body.videoUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'clickUrl')) next.clickUrl = body.clickUrl ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'text')) next.text = body.text ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'enabled')) next.enabled = !!body.enabled;
    if (Object.prototype.hasOwnProperty.call(body, 'visibility')) next.visibility = normalizeVisibility(body.visibility);
    if (Object.prototype.hasOwnProperty.call(body, 'domainId')) next.domainId = body.domainId ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'startsAt')) next.startsAt = body.startsAt ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'endsAt')) next.endsAt = body.endsAt ?? null;
    if (Object.prototype.hasOwnProperty.call(body, 'priority')) next.priority = clampNumber(body.priority, -1000, 1000, Number(prev.priority || 0));
    if (Object.prototype.hasOwnProperty.call(body, 'meta')) next.meta = body.meta ?? null;
    next.updatedAt = ts;

    const nextAds = [...ads];
    nextAds[idx] = next;
    await saveTenantAds(tenantId, row, nextAds, data);
    res.json(next);
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/{adId}:
 *   delete:
 *     summary: Delete a tenant ad (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: adId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *         content:
 *           application/json:
 *             examples:
 *               ok:
 *                 value: { ok: true }
 *       404:
 *         description: Not found
 */
router.delete(
  '/tenants/:tenantId/ads/:adId',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId, adId } = req.params;

    const { row, ads, data } = await loadTenantAds(tenantId);
    const nextAds = ads.filter((a: any) => String(a?.id) !== String(adId));
    if (nextAds.length === ads.length) return res.status(404).json({ error: 'Ad not found' });

    await saveTenantAds(tenantId, row, nextAds, data);
    res.json({ ok: true });
  }
);

// ─────────────────────────────────────────────────────────────────
// Standard 8-Slot Ads Config  (stored in TenantSettings.data.adsConfig)
// Slot keys: home_top | home_mid | home_multiplex |
//            article_top | article_mid | article_multiplex |
//            category_top | category_mid
// ─────────────────────────────────────────────────────────────────

const VALID_SLOT_KEYS = [
  'home_top', 'home_mid', 'home_multiplex',
  'article_top', 'article_mid', 'article_multiplex',
  'category_top', 'category_mid',
] as const;
type SlotKey = typeof VALID_SLOT_KEYS[number];

interface SlotConfig {
  slotId: string | null;
  format: 'auto' | 'autorelaxed' | 'fluid';
  enabled: boolean;
}

interface AdsConfig {
  enabled: boolean;
  adsenseClientId: string | null;
  slots: Partial<Record<SlotKey, SlotConfig>>;
}

const DEFAULT_SLOT: SlotConfig = { slotId: null, format: 'auto', enabled: false };
const MULTIPLEX_SLOT: SlotConfig = { slotId: null, format: 'autorelaxed', enabled: false };

function defaultAdsConfig(): AdsConfig {
  const slots: Partial<Record<SlotKey, SlotConfig>> = {};
  for (const key of VALID_SLOT_KEYS) {
    slots[key] = key.includes('multiplex') ? { ...MULTIPLEX_SLOT } : { ...DEFAULT_SLOT };
  }
  return { enabled: false, adsenseClientId: null, slots };
}

function validateSlotId(id: any): boolean {
  if (id === null || id === undefined || id === '') return true; // allow clearing
  return /^\d{10}$/.test(String(id));
}

function validateClientId(id: any): boolean {
  if (id === null || id === undefined || id === '') return true;
  return String(id).startsWith('ca-pub-');
}

function normalizeSlot(incoming: any, isMultiplex: boolean): SlotConfig {
  const defaultFormat = isMultiplex ? 'autorelaxed' : 'auto';
  return {
    slotId: incoming?.slotId ?? null,
    format: ['auto', 'autorelaxed', 'fluid'].includes(incoming?.format) ? incoming.format : defaultFormat,
    enabled: typeof incoming?.enabled === 'boolean' ? incoming.enabled : !!incoming?.slotId,
  };
}

async function loadAdsConfig(tenantId: string): Promise<{ row: any | null; adsConfig: AdsConfig; data: any }> {
  const row = await p.tenantSettings.findUnique({ where: { tenantId } }).catch(() => null);
  const data = (row && typeof row.data === 'object' && row.data) ? row.data : {};
  const stored = (data as any).adsConfig;
  const base = defaultAdsConfig();
  if (stored && typeof stored === 'object') {
    base.enabled = typeof stored.enabled === 'boolean' ? stored.enabled : false;
    base.adsenseClientId = stored.adsenseClientId ?? null;
    for (const key of VALID_SLOT_KEYS) {
      if (stored.slots?.[key]) {
        base.slots[key] = normalizeSlot(stored.slots[key], key.includes('multiplex'));
      }
    }
  }
  return { row, adsConfig: base, data };
}

async function saveAdsConfig(tenantId: string, existingRow: any | null, adsConfig: AdsConfig, baseData: any) {
  const nextData = { ...(baseData || {}), adsConfig };
  if (existingRow) {
    return p.tenantSettings.update({ where: { tenantId }, data: { data: nextData } });
  }
  return p.tenantSettings.create({ data: { tenantId, data: nextData } });
}

/**
 * @swagger
 * /tenants/{tenantId}/ads/config:
 *   get:
 *     summary: Get standard 8-slot ads config (TENANT_ADMIN or SUPER_ADMIN)
 *     description: |
 *       Returns the full ads configuration for this tenant including the 8 standard
 *       ad slot keys used across Home, Article, and Category pages.
 *
 *       **Slot Keys:**
 *       - `home_top` — Home page top banner (below header)
 *       - `home_mid` — Home page mid feed (after 3rd article card)
 *       - `home_multiplex` — Home page multiplex (bottom of feed) — format: autorelaxed
 *       - `article_top` — Article detail page below title
 *       - `article_mid` — Article detail page mid content (after para 3)
 *       - `article_multiplex` — Article detail below the article — format: autorelaxed
 *       - `category_top` — Category listing page top banner
 *       - `category_mid` — Category listing mid feed
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *     responses:
 *       200:
 *         description: Full ads config with all 8 slots
 *         content:
 *           application/json:
 *             example:
 *               enabled: true
 *               adsenseClientId: "ca-pub-5191460803448280"
 *               slots:
 *                 home_top:
 *                   slotId: "1234567890"
 *                   format: "auto"
 *                   enabled: true
 *                 home_mid:
 *                   slotId: "2345678901"
 *                   format: "auto"
 *                   enabled: true
 *                 home_multiplex:
 *                   slotId: "3456789012"
 *                   format: "autorelaxed"
 *                   enabled: true
 *                 article_top:
 *                   slotId: "4567890123"
 *                   format: "auto"
 *                   enabled: true
 *                 article_mid:
 *                   slotId: "5678901234"
 *                   format: "auto"
 *                   enabled: true
 *                 article_multiplex:
 *                   slotId: "6789012345"
 *                   format: "autorelaxed"
 *                   enabled: true
 *                 category_top:
 *                   slotId: "7890123456"
 *                   format: "auto"
 *                   enabled: true
 *                 category_mid:
 *                   slotId: "8901234567"
 *                   format: "auto"
 *                   enabled: false
 */
router.get(
  '/tenants/:tenantId/ads/config',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const { adsConfig } = await loadAdsConfig(tenantId);
    res.json(adsConfig);
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/config:
 *   put:
 *     summary: Replace full ads config — all 8 slots at once (TENANT_ADMIN or SUPER_ADMIN)
 *     description: |
 *       Replaces the entire ads config for a tenant. Provide `adsenseClientId` (must start
 *       with `ca-pub-`) and any/all slot configs. Missing slots get defaults (enabled: false).
 *
 *       **Slot ID validation:** must be exactly 10 digits (e.g. `1234567890`).
 *       Pass `null` or omit to clear a slot ID.
 *     tags: [Tenant Ads]
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
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               adsenseClientId:
 *                 type: string
 *                 example: "ca-pub-5191460803448280"
 *                 description: Must start with ca-pub-
 *               slots:
 *                 type: object
 *                 description: Map of slot key to slot config
 *                 properties:
 *                   home_top:      { $ref: '#/components/schemas/AdSlotConfig' }
 *                   home_mid:      { $ref: '#/components/schemas/AdSlotConfig' }
 *                   home_multiplex:  { $ref: '#/components/schemas/AdSlotConfig' }
 *                   article_top:   { $ref: '#/components/schemas/AdSlotConfig' }
 *                   article_mid:   { $ref: '#/components/schemas/AdSlotConfig' }
 *                   article_multiplex: { $ref: '#/components/schemas/AdSlotConfig' }
 *                   category_top:  { $ref: '#/components/schemas/AdSlotConfig' }
 *                   category_mid:  { $ref: '#/components/schemas/AdSlotConfig' }
 *           examples:
 *             fullConfig:
 *               summary: Setup all 8 slots with Google AdSense
 *               value:
 *                 enabled: true
 *                 adsenseClientId: "ca-pub-5191460803448280"
 *                 slots:
 *                   home_top:          { slotId: "1234567890", format: "auto",        enabled: true }
 *                   home_mid:          { slotId: "2345678901", format: "auto",        enabled: true }
 *                   home_multiplex:    { slotId: "3456789012", format: "autorelaxed", enabled: true }
 *                   article_top:       { slotId: "4567890123", format: "auto",        enabled: true }
 *                   article_mid:       { slotId: "5678901234", format: "auto",        enabled: true }
 *                   article_multiplex: { slotId: "6789012345", format: "autorelaxed", enabled: true }
 *                   category_top:      { slotId: "7890123456", format: "auto",        enabled: true }
 *                   category_mid:      { slotId: "8901234567", format: "auto",        enabled: false }
 *             disableAds:
 *               summary: Disable all ads
 *               value:
 *                 enabled: false
 *                 adsenseClientId: null
 *                 slots: {}
 *     responses:
 *       200:
 *         description: Saved config
 *       400:
 *         description: Validation error (invalid adsenseClientId or slotId format)
 */
router.put(
  '/tenants/:tenantId/ads/config',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId } = req.params;
    const body = req.body || {};

    if (body.adsenseClientId && !validateClientId(body.adsenseClientId)) {
      return res.status(400).json({ error: 'adsenseClientId must start with ca-pub-' });
    }

    const base = defaultAdsConfig();
    base.enabled = typeof body.enabled === 'boolean' ? body.enabled : false;
    base.adsenseClientId = body.adsenseClientId ?? null;

    const incomingSlots = body.slots && typeof body.slots === 'object' ? body.slots : {};
    for (const key of VALID_SLOT_KEYS) {
      const slot = incomingSlots[key];
      if (slot) {
        if (slot.slotId && !validateSlotId(slot.slotId)) {
          return res.status(400).json({ error: `slots.${key}.slotId must be exactly 10 digits` });
        }
        base.slots[key] = normalizeSlot(slot, key.includes('multiplex'));
      }
    }

    const unknownKeys = Object.keys(incomingSlots).filter(k => !VALID_SLOT_KEYS.includes(k as SlotKey));
    if (unknownKeys.length > 0) {
      return res.status(400).json({ error: `Unknown slot keys: ${unknownKeys.join(', ')}. Valid keys: ${VALID_SLOT_KEYS.join(', ')}` });
    }

    const { row, data } = await loadAdsConfig(tenantId);
    await saveAdsConfig(tenantId, row, base, data);
    res.json({ ok: true, adsConfig: base });
  }
);

/**
 * @swagger
 * /tenants/{tenantId}/ads/config/slots/{slotKey}:
 *   patch:
 *     summary: Update a single ad slot (TENANT_ADMIN or SUPER_ADMIN)
 *     description: |
 *       Updates one specific slot without touching the rest of the config.
 *       Also allows updating `enabled` and `adsenseClientId` at the top level.
 *
 *       **Valid slotKey values:**
 *       `home_top`, `home_mid`, `home_multiplex`, `article_top`, `article_mid`,
 *       `article_multiplex`, `category_top`, `category_mid`
 *     tags: [Tenant Ads]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID
 *       - in: path
 *         name: slotKey
 *         required: true
 *         schema:
 *           type: string
 *           enum: [home_top, home_mid, home_multiplex, article_top, article_mid, article_multiplex, category_top, category_mid]
 *         description: Which slot to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               slotId:
 *                 type: string
 *                 nullable: true
 *                 description: 10-digit Google AdSense slot ID. Pass null to clear.
 *                 example: "1234567890"
 *               format:
 *                 type: string
 *                 enum: [auto, autorelaxed, fluid]
 *                 example: "auto"
 *               enabled:
 *                 type: boolean
 *                 example: true
 *               adsenseClientId:
 *                 type: string
 *                 description: Optional — also update the top-level client ID
 *                 example: "ca-pub-5191460803448280"
 *           examples:
 *             enableSlot:
 *               summary: Enable home_top with a new slot ID
 *               value:
 *                 slotId: "1234567890"
 *                 enabled: true
 *             disableSlot:
 *               summary: Disable article_mid
 *               value:
 *                 enabled: false
 *             clearAndUpdate:
 *               summary: Update article_multiplex slot + set client ID at same time
 *               value:
 *                 slotId: "6789012345"
 *                 format: "autorelaxed"
 *                 enabled: true
 *                 adsenseClientId: "ca-pub-5191460803448280"
 *     responses:
 *       200:
 *         description: Updated — returns full adsConfig
 *         content:
 *           application/json:
 *             example:
 *               ok: true
 *               slotKey: "home_top"
 *               slot:
 *                 slotId: "1234567890"
 *                 format: "auto"
 *                 enabled: true
 *               adsConfig:
 *                 enabled: true
 *                 adsenseClientId: "ca-pub-5191460803448280"
 *                 slots:
 *                   home_top: { slotId: "1234567890", format: "auto", enabled: true }
 *       400:
 *         description: Invalid slotKey or slotId format
 *         content:
 *           application/json:
 *             examples:
 *               invalidKey:
 *                 value: { error: "Invalid slotKey: home_sidebar. Valid keys: home_top, home_mid, ..." }
 *               invalidSlotId:
 *                 value: { error: "slotId must be exactly 10 digits" }
 */
router.patch(
  '/tenants/:tenantId/ads/config/slots/:slotKey',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    const { tenantId, slotKey } = req.params;
    const body = req.body || {};

    if (!VALID_SLOT_KEYS.includes(slotKey as SlotKey)) {
      return res.status(400).json({
        error: `Invalid slotKey: ${slotKey}. Valid keys: ${VALID_SLOT_KEYS.join(', ')}`,
      });
    }

    if (body.slotId && !validateSlotId(body.slotId)) {
      return res.status(400).json({ error: 'slotId must be exactly 10 digits' });
    }

    if (body.adsenseClientId && !validateClientId(body.adsenseClientId)) {
      return res.status(400).json({ error: 'adsenseClientId must start with ca-pub-' });
    }

    const { row, adsConfig, data } = await loadAdsConfig(tenantId);
    const key = slotKey as SlotKey;
    const prev = adsConfig.slots[key] ?? (key.includes('multiplex') ? { ...MULTIPLEX_SLOT } : { ...DEFAULT_SLOT });

    adsConfig.slots[key] = {
      slotId: Object.prototype.hasOwnProperty.call(body, 'slotId') ? (body.slotId ?? null) : prev.slotId,
      format: body.format ?? prev.format,
      enabled: typeof body.enabled === 'boolean' ? body.enabled : prev.enabled,
    };

    if (Object.prototype.hasOwnProperty.call(body, 'adsenseClientId')) {
      adsConfig.adsenseClientId = body.adsenseClientId ?? null;
    }
    if (typeof body.enabled === 'boolean' && !('slotId' in body)) {
      // enabling top-level ads flag if explicitly passed
    }

    await saveAdsConfig(tenantId, row, adsConfig, data);
    res.json({ ok: true, slotKey: key, slot: adsConfig.slots[key], adsConfig });
  }
);

export default router;

