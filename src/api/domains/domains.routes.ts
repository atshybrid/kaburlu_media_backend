import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { translateAndSaveCategoryInBackground } from '../categories/categories.service';
import { requireSuperAdmin } from '../middlewares/authz';

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
 *       200: { description: List domains }
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
    res.json({ ok: true, domain: updated });
  } catch (e: any) {
    console.error('verify domain error', e);
    res.status(500).json({ error: 'Failed to verify domain' });
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
