import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { translateAndSaveCategoryInBackground } from '../categories/categories.service';
import { requireSuperAdmin } from '../middlewares/authz';
import { defaultCategorySlugify, listDefaultCategorySlugs } from '../../lib/defaultCategories';
import { CORE_NEWS_CATEGORIES } from '../../lib/categoryAuto';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Domains
 *     description: Domain verification & status management
 */

/**
 * @swagger
 * /domains:
 *   get:
 *     summary: List domains
 *     tags: [Domains]
 *     responses:
 *       200:
 *         description: List domains
 *         content:
 *           application/json:
 *             examples:
 *               domains:
 *                 value:
 *                   - id: "dom_01"
 *                     tenantId: "tenant_01"
 *                     host: "example.com"
 *                     status: "ACTIVE"
 *                     kind: "NEWS"
 *                   - id: "dom_02"
 *                     tenantId: "tenant_01"
 *                     host: "epaper.example.com"
 *                     status: "ACTIVE"
 *                     kind: "EPAPER"
 */
router.get('/', async (_req, res) => {
  const domains = await (prisma as any).domain.findMany({ include: { tenant: true }, take: 200 });
  res.json(domains);
});

/**
 * @swagger
 * /domains/{id}/verify:
 *   post:
 *     summary: Verify a domain (DNS TXT or manual) [Superadmin]
 *     tags: [Domains]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method: { type: string, enum: [DNS_TXT, MANUAL], default: DNS_TXT }
 *               force: { type: boolean, default: false }
 *           examples:
 *             manual:
 *               value: { method: "MANUAL" }
 *             forceActive:
 *               value: { method: "DNS_TXT", force: true }
 *     responses:
 *       200: { description: Result }
 */
router.post('/:id/verify', auth, requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const d = await (prisma as any).domain.findUnique({ where: { id } });
    if (!d) return res.status(404).json({ error: 'Domain not found' });
    const method = (req.body?.method as string) || 'DNS_TXT';
    const force = Boolean(req.body?.force);
    // For now, allow manual verify or force to ACTIVE; DNS check can be implemented with real lookup later
    const status = force || method === 'MANUAL' ? 'ACTIVE' : 'VERIFYING';
    const updated = await (prisma as any).domain.update({ where: { id }, data: { status, verifiedAt: new Date() } });

    // When a domain becomes ACTIVE, auto-link default categories (create missing only).
    if (status === 'ACTIVE') {
      try {
        const slugSet = new Set<string>([
          ...listDefaultCategorySlugs({ includeChildren: true }),
          ...CORE_NEWS_CATEGORIES.map(c => c.slug),
        ]);

        // Add dynamic state categories under state-news.
        try {
          const states = await (prisma as any).state.findMany({
            where: { country: { code: 'IN' } },
            select: { name: true },
            take: 100,
          });
          for (const st of states || []) {
            const name = String(st?.name || '').trim();
            if (!name) continue;
            const slug = `state-news-${defaultCategorySlugify(name)}`.slice(0, 60);
            slugSet.add(slug);
          }
        } catch {
          // ignore
        }

        const slugs = Array.from(slugSet);
        const categories = await (prisma as any).category.findMany({
          where: { slug: { in: slugs }, isDeleted: false },
          select: { id: true },
        });
        if (categories.length) {
          await (prisma as any).domainCategory.createMany({
            data: categories.map((c: any) => ({ domainId: id, categoryId: c.id })),
            skipDuplicates: true,
          });
        }
      } catch (e: any) {
        console.warn('auto-link default categories failed', e?.message || e);
      }
    }

    res.json({ ok: true, domain: updated });
  } catch (e: any) {
    console.error('verify domain error', e);
    res.status(500).json({ error: 'Failed to verify domain' });
  }
});

/**
 * @swagger
 * /domains/{id}/kind:
 *   patch:
 *     summary: Set a domain kind for billing (NEWS vs EPAPER) [Superadmin]
 *     tags: [Domains]
 *     security: [{ bearerAuth: [] }]
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
 *             required: [kind]
 *             properties:
 *               kind: { type: string, enum: [NEWS, EPAPER] }
 *           examples:
 *             epaper:
 *               value: { kind: "EPAPER" }
 *     responses:
 *       200: { description: Updated domain }
 *       400: { description: Validation error }
 *       404: { description: Domain not found }
 */
router.patch('/:id/kind', auth, requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const kind = String(req.body?.kind || '').toUpperCase();
    if (!['NEWS', 'EPAPER'].includes(kind)) return res.status(400).json({ error: 'kind must be NEWS or EPAPER' });
    const d = await (prisma as any).domain.findUnique({ where: { id } });
    if (!d) return res.status(404).json({ error: 'Domain not found' });
    const updated = await (prisma as any).domain.update({ where: { id }, data: { kind } });
    return res.json({ ok: true, domain: updated });
  } catch (e: any) {
    console.error('set domain kind error', e);
    return res.status(500).json({ error: 'Failed to set domain kind' });
  }
});

/**
 * @swagger
 * /domains/{id}/categories:
 *   put:
 *     summary: Replace category allocation for a domain [Superadmin]
 *     description: |
 *       Provide either `categoryIds` or `categorySlugs` (at least one of them). The endpoint
 *       resolves slugs to IDs, validates existence, ensures a translation for the tenant's primary
 *       language, optionally creating missing translations when `createIfMissingTranslations=true`.
 *       All previous mappings for the domain are replaced atomically.
 *     tags: [Domains]
 *     security: [{ bearerAuth: [] }]
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
 *               categoryIds:
 *                 type: array
 *                 items: { type: string }
 *                 description: Optional array of category IDs. Use either this or categorySlugs.
 *               categorySlugs:
 *                 type: array
 *                 items: { type: string }
 *                 description: Optional array of category slugs. Prefer slugs for portability.
 *               createIfMissingTranslations:
 *                 type: boolean
 *                 default: false
 *                 description: Attempt to auto-create missing translations for tenant language.
 *             oneOf:
 *               - required: [categoryIds]
 *               - required: [categorySlugs]
 *           examples:
 *             bySlugs:
 *               summary: Replace using slugs
 *               value:
 *                 categorySlugs: ["national", "international"]
 *                 createIfMissingTranslations: true
 *             byIds:
 *               summary: Replace using IDs
 *               value:
 *                 categoryIds: ["cuid123", "cuid456"]
 *     responses:
 *       200:
 *         description: Updated mappings
 *       400:
 *         description: Bad request - invalid input or missing data
 *         content:
 *           application/json:
 *             examples:
 *               missingIds:
 *                 summary: Some IDs not found
 *                 value:
 *                   error: Some categoryIds not found
 *                   missing: ["cuid123"]
 *               missingSlugs:
 *                 summary: Some slugs not found
 *                 value:
 *                   error: Some categorySlugs not found
 *                   missingSlugs: ["politics"]
 *               lackingTranslation:
 *                 summary: Translation missing
 *                 value:
 *                   error: Some categories lack translation for tenant language
 *                   language: te
 *                   lackingTranslation: ["cuid789"]
 */
router.put('/:id/categories', auth, requireSuperAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const { categoryIds, categorySlugs, createIfMissingTranslations } = req.body || {};
    if (!Array.isArray(categoryIds) && !Array.isArray(categorySlugs)) {
      return res.status(400).json({ error: 'Provide categoryIds or categorySlugs array' });
    }
    const domain = await (prisma as any).domain.findUnique({ where: { id }, include: { tenant: true } });
    if (!domain) return res.status(404).json({ error: 'Domain not found' });
    const entity = await (prisma as any).tenantEntity.findUnique({ where: { tenantId: domain.tenantId }, include: { language: true } }).catch(() => null);
    const langCode = entity?.language?.code;
    if (!langCode) return res.status(400).json({ error: 'Tenant entity language not set; set entity first' });

    const cleanedIds = Array.isArray(categoryIds) ? categoryIds.filter((c: string) => typeof c === 'string' && c.trim()) : [];
    const cleanedSlugs = Array.isArray(categorySlugs) ? categorySlugs.filter((c: string) => typeof c === 'string' && c.trim()) : [];

    // Resolve slugs to IDs if provided
    let slugResolvedIds: string[] = [];
    if (cleanedSlugs.length) {
      const bySlug = await (prisma as any).category.findMany({ where: { slug: { in: cleanedSlugs } }, select: { id: true, slug: true } });
      const foundSlugMap: Record<string,string> = {};
      bySlug.forEach((c: any) => foundSlugMap[c.slug] = c.id);
      const missingSlugs = cleanedSlugs.filter(s => !foundSlugMap[s]);
      if (missingSlugs.length) {
        return res.status(400).json({ error: 'Some categorySlugs not found', missingSlugs });
      }
      slugResolvedIds = Object.values(foundSlugMap);
    }

    const combined = Array.from(new Set([...cleanedIds, ...slugResolvedIds]));
    if (!combined.length) {
      await (prisma as any).domainCategory.deleteMany({ where: { domainId: id } });
      return res.json({ count: 0, items: [] });
    }

    // Validate category IDs exist
    const categories = await (prisma as any).category.findMany({ where: { id: { in: combined } }, select: { id: true, name: true } });
    const existingIds = new Set(categories.map((c: any) => c.id));
    const missingIds = combined.filter(cid => !existingIds.has(cid));
    if (missingIds.length) {
      return res.status(400).json({ error: 'Some categoryIds not found', missing: missingIds });
    }

    // Check translations; optionally create missing ones
    const translations = await (prisma as any).categoryTranslation.findMany({ where: { categoryId: { in: combined }, language: langCode } });
    const translatedIds = new Set(translations.map((t: any) => t.categoryId));
    const lacking = combined.filter(cid => !translatedIds.has(cid));
    if (lacking.length && createIfMissingTranslations) {
      // Fire translation upserts sequentially (background-like) but await to ensure available now
      for (const cid of lacking) {
        const cat = categories.find((c: any) => c.id === cid);
        if (cat) {
          try { await translateAndSaveCategoryInBackground(cat.id, cat.name); } catch (e) { /* ignore */ }
        }
      }
      // Re-check translations
      const translations2 = await (prisma as any).categoryTranslation.findMany({ where: { categoryId: { in: combined }, language: langCode } });
      const translatedIds2 = new Set(translations2.map((t: any) => t.categoryId));
      const stillLacking = combined.filter(cid => !translatedIds2.has(cid));
      if (stillLacking.length) {
        return res.status(400).json({ error: 'Translations still missing after attempt', language: langCode, lackingTranslation: stillLacking });
      }
    } else if (lacking.length) {
      return res.status(400).json({ error: 'Some categories lack translation for tenant language', language: langCode, lackingTranslation: lacking });
    }

    // Atomic replace transaction
    const ops: any[] = [
      (prisma as any).domainCategory.deleteMany({ where: { domainId: id } }),
      ...(combined.map(cid => (prisma as any).domainCategory.create({ data: { domainId: id, categoryId: cid } })))
    ];
    await (prisma as any).$transaction(ops);
    const mappings = await (prisma as any).domainCategory.findMany({ where: { domainId: id }, include: { category: true } });
    res.json({ count: mappings.length, items: mappings, language: langCode });
  } catch (e: any) {
    console.error('set domain categories error', e);
    res.status(500).json({ error: 'Failed to set domain categories', detail: e.message });
  }
});

export default router;
