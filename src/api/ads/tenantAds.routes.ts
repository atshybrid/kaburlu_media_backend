import { Router } from 'express';
import passport from 'passport';
import crypto from 'crypto';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';

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

/**
 * @swagger
 * tags:
 *   - name: Tenant Ads
 *     description: Tenant-scoped website ads stored in TenantSettings.data.ads (JWT required)
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

export default router;
