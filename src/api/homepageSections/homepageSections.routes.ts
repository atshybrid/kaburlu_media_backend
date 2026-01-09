import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdminScoped, requireSuperAdmin } from '../middlewares/authz';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

/**
 * Valid section types for Style2 homepage layout
 */
const VALID_SECTION_TYPES = [
  'hero_sidebar',       // Main hero with sidebar (hero_category + sidebar_category + bottom_category)
  'category_boxes_3col', // 3-column category boxes (categories[])
  'small_cards_3col',   // 3-column small cards (categories[])
  'magazine_grid',      // Magazine-style grid layout (category)
  'horizontal_scroll',  // Horizontal scrolling cards (category)
  'spotlight',          // Featured spotlight section (category)
  'newspaper_columns',  // Traditional newspaper columns (categories[])
  'horizontal_cards',   // Horizontal card layout (category)
  'photo_gallery',      // Photo gallery section (category)
  'timeline',           // Timeline-style news feed (category)
  'featured_banner',    // Featured banner section (category)
  'compact_lists_2col', // 2-column compact lists (categories[])
  'category_cards',     // Default category cards (legacy, uses category)
  'hero',               // Legacy hero type
  'grid',               // Legacy grid type
  'list',               // Legacy list type
  'cards',              // Legacy cards type
  'ticker'              // Legacy ticker type
];

/**
 * Valid query kinds for data fetching
 */
const VALID_QUERY_KINDS = [
  'category',    // Fetch from linked category
  'latest',      // Fetch latest articles
  'trending',    // Fetch trending/popular articles
  'most_viewed'  // Fetch most viewed articles
];

/**
 * Section types that use multiple categories (categories[] array)
 */
const MULTI_CATEGORY_SECTION_TYPES = [
  'category_boxes_3col',
  'small_cards_3col',
  'newspaper_columns',
  'compact_lists_2col'
];

/**
 * Section types that use hero_sidebar pattern (3 category slots)
 */
const HERO_SIDEBAR_SECTION_TYPES = ['hero_sidebar'];

/**
 * @swagger
 * tags:
 *   - name: Homepage Sections
 *     description: |
 *       Style2 homepage section configuration - configure homepage layout with various section types.
 *       
 *       ## Section Types
 *       | Section Type | Category Field | Description |
 *       |--------------|----------------|-------------|
 *       | hero_sidebar | category + secondaryCategory + tertiaryCategory | Main hero with sidebar |
 *       | category_boxes_3col | categorySlugs[] | 3-column category boxes |
 *       | small_cards_3col | categorySlugs[] | 3-column small cards |
 *       | magazine_grid | category | Magazine-style grid |
 *       | horizontal_scroll | category | Horizontal scrolling cards |
 *       | spotlight | category | Featured spotlight |
 *       | newspaper_columns | categorySlugs[] | Traditional newspaper columns |
 *       | horizontal_cards | category | Horizontal card layout |
 *       | photo_gallery | category | Photo gallery |
 *       | timeline | category | Timeline-style feed |
 *       | featured_banner | category | Featured banner |
 *       | compact_lists_2col | categorySlugs[] | 2-column compact lists |
 *       
 *       ## Query Kinds
 *       - `category`: Fetch articles from linked category
 *       - `latest`: Fetch latest articles (no category needed)
 *       - `trending`: Fetch trending/popular articles (no category needed)
 *       - `most_viewed`: Fetch most viewed articles (no category needed)
 */

/**
 * @swagger
 * /homepage-sections/{tenantId}:
 *   get:
 *     summary: List all homepage section configs for a tenant
 *     description: Returns all configured homepage sections for the tenant, optionally filtered by domainId.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Filter sections by domain (optional)
 *       - in: query
 *         name: activeOnly
 *         schema: { type: boolean, default: false }
 *         description: Only return active sections
 *     responses:
 *       200:
 *         description: List of homepage sections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   key: { type: string }
 *                   label: { type: string }
 *                   labelEn: { type: string, nullable: true }
 *                   position: { type: integer }
 *                   style: { type: string }
 *                   sectionType: { type: string }
 *                   queryKind: { type: string }
 *                   categoryId: { type: string, nullable: true }
 *                   categorySlug: { type: string, nullable: true }
 *                   secondaryCategorySlug: { type: string, nullable: true }
 *                   tertiaryCategorySlug: { type: string, nullable: true }
 *                   categorySlugs: { type: array, items: { type: string }, nullable: true }
 *                   articleLimit: { type: integer }
 *                   isActive: { type: boolean }
 *                   category: { type: object, nullable: true }
 */
router.get('/:tenantId', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;
    const activeOnly = String(req.query.activeOnly || '').toLowerCase() === 'true';

    const where: any = { tenantId };
    if (domainId) where.domainId = domainId;
    if (activeOnly) where.isActive = true;

    const sections = await p.homepageSectionConfig.findMany({
      where,
      orderBy: { position: 'asc' },
      include: {
        category: { select: { id: true, slug: true, name: true, iconUrl: true } },
        secondaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } },
        tertiaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } }
      }
    });

    return res.json(sections);
  } catch (e) {
    console.error('homepage-sections list error', e);
    return res.status(500).json({ error: 'Failed to list homepage sections' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   get:
 *     summary: Get a single homepage section by key
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Section config }
 *       404: { description: Not found }
 */
router.get('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;

    const section = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } },
      include: {
        category: { select: { id: true, slug: true, name: true, iconUrl: true } },
        secondaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } },
        tertiaryCategory: { select: { id: true, slug: true, name: true, iconUrl: true } }
      }
    });

    if (!section) return res.status(404).json({ error: 'Section not found' });
    return res.json(section);
  } catch (e) {
    console.error('homepage-sections get error', e);
    return res.status(500).json({ error: 'Failed to get homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}:
 *   post:
 *     summary: Create a new homepage section config
 *     description: |
 *       Create a section for Style2 homepage with various section types.
 *       
 *       **Section Types:**
 *       - `hero_sidebar`: Uses category + secondaryCategorySlug + tertiaryCategorySlug
 *       - `category_boxes_3col`, `small_cards_3col`, `newspaper_columns`, `compact_lists_2col`: Use categorySlugs[]
 *       - `magazine_grid`, `horizontal_scroll`, `spotlight`, etc.: Use single categorySlug
 *       
 *       **Query Kinds:**
 *       - `category`: Fetch from linked category
 *       - `latest`: Fetch latest articles (no category needed)
 *       - `trending`: Fetch trending articles (no category needed)
 *       - `most_viewed`: Fetch most viewed articles (no category needed)
 *     tags: [Homepage Sections]
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
 *             required: [key, label, sectionType]
 *             properties:
 *               key: { type: string, example: "hero_main", description: "Unique section key" }
 *               label: { type: string, example: "ప్రధాన వార్తలు", description: "Display label in tenant language" }
 *               labelEn: { type: string, example: "Main News", description: "English fallback label" }
 *               position: { type: integer, example: 1, description: "Order on page (lower = higher)" }
 *               sectionType: { type: string, enum: [hero_sidebar, category_boxes_3col, small_cards_3col, magazine_grid, horizontal_scroll, spotlight, newspaper_columns, horizontal_cards, photo_gallery, timeline, featured_banner, compact_lists_2col], example: "hero_sidebar" }
 *               queryKind: { type: string, enum: [category, latest, trending, most_viewed], default: "category" }
 *               categorySlug: { type: string, example: "politics", description: "Primary category slug" }
 *               secondaryCategorySlug: { type: string, example: "sports", description: "Secondary category (for hero_sidebar)" }
 *               tertiaryCategorySlug: { type: string, example: "entertainment", description: "Tertiary category (for hero_sidebar)" }
 *               categorySlugs: { type: array, items: { type: string }, example: ["politics", "sports", "entertainment"], description: "Multiple categories (for 3col sections)" }
 *               articleLimit: { type: integer, example: 6, default: 6 }
 *               isActive: { type: boolean, default: true }
 *               domainId: { type: string, nullable: true, description: "Domain-specific config (optional)" }
 *               config: { type: object, description: "Extra config JSON" }
 *           examples:
 *             hero_sidebar:
 *               summary: Hero sidebar with 3 categories
 *               value:
 *                 key: "hero_main"
 *                 label: "ప్రధాన వార్తలు"
 *                 labelEn: "Main News"
 *                 position: 0
 *                 sectionType: "hero_sidebar"
 *                 queryKind: "latest"
 *                 secondaryCategorySlug: "trending"
 *                 tertiaryCategorySlug: "politics"
 *                 articleLimit: 10
 *             category_boxes_3col:
 *               summary: 3-column category boxes
 *               value:
 *                 key: "category_boxes"
 *                 label: "వర్గాలు"
 *                 labelEn: "Categories"
 *                 position: 1
 *                 sectionType: "category_boxes_3col"
 *                 categorySlugs: ["politics", "sports", "entertainment"]
 *                 articleLimit: 6
 *             timeline_latest:
 *               summary: Timeline with latest articles
 *               value:
 *                 key: "timeline"
 *                 label: "తాజా వార్తలు"
 *                 labelEn: "Latest News"
 *                 position: 5
 *                 sectionType: "timeline"
 *                 queryKind: "latest"
 *                 articleLimit: 10
 *     responses:
 *       201: { description: Created section }
 *       400: { description: Validation error }
 *       409: { description: Section key already exists }
 */
router.post('/:tenantId', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const {
      key, label, labelEn, position, style, sectionType, queryKind,
      categorySlug, secondaryCategorySlug, tertiaryCategorySlug, categorySlugs,
      articleLimit, isActive, domainId, config
    } = req.body || {};

    if (!key || typeof key !== 'string' || !key.trim()) {
      return res.status(400).json({ error: 'key is required' });
    }
    if (!label || typeof label !== 'string' || !label.trim()) {
      return res.status(400).json({ error: 'label is required' });
    }

    const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

    // Validate sectionType if provided
    const resolvedSectionType = typeof sectionType === 'string' && sectionType.trim()
      ? sectionType.trim()
      : 'category_cards';
    if (!VALID_SECTION_TYPES.includes(resolvedSectionType)) {
      return res.status(400).json({ error: `Invalid sectionType. Valid types: ${VALID_SECTION_TYPES.join(', ')}` });
    }

    // Validate queryKind if provided
    const resolvedQueryKind = typeof queryKind === 'string' && queryKind.trim()
      ? queryKind.trim()
      : 'category';
    if (!VALID_QUERY_KINDS.includes(resolvedQueryKind)) {
      return res.status(400).json({ error: `Invalid queryKind. Valid kinds: ${VALID_QUERY_KINDS.join(', ')}` });
    }

    // Helper to resolve category by slug
    async function resolveCategory(slug: string | null | undefined): Promise<{ id: string; slug: string } | null> {
      if (!slug || typeof slug !== 'string' || !slug.trim()) return null;
      const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
      if (!cat) return null;
      return { id: cat.id, slug: cat.slug };
    }

    // Resolve primary category
    const primaryCat = await resolveCategory(categorySlug);
    
    // Resolve secondary category (for hero_sidebar)
    const secondaryCat = HERO_SIDEBAR_SECTION_TYPES.includes(resolvedSectionType)
      ? await resolveCategory(secondaryCategorySlug)
      : null;
    
    // Resolve tertiary category (for hero_sidebar)
    const tertiaryCat = HERO_SIDEBAR_SECTION_TYPES.includes(resolvedSectionType)
      ? await resolveCategory(tertiaryCategorySlug)
      : null;

    // Validate categorySlugs for multi-category section types
    let resolvedCategorySlugs: string[] | null = null;
    if (MULTI_CATEGORY_SECTION_TYPES.includes(resolvedSectionType)) {
      if (Array.isArray(categorySlugs) && categorySlugs.length > 0) {
        // Validate each slug exists
        const validSlugs: string[] = [];
        for (const slug of categorySlugs) {
          if (typeof slug === 'string' && slug.trim()) {
            const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
            if (cat) validSlugs.push(cat.slug);
          }
        }
        if (validSlugs.length > 0) {
          resolvedCategorySlugs = validSlugs;
        }
      }
    }

    const data: any = {
      tenantId,
      domainId: domainId || null,
      key: normalizedKey,
      label: label.trim(),
      labelEn: labelEn ? String(labelEn).trim() : null,
      position: typeof position === 'number' ? position : 0,
      style: typeof style === 'string' && style.trim() ? style.trim() : 'cards',
      sectionType: resolvedSectionType,
      queryKind: resolvedQueryKind,
      categoryId: primaryCat?.id || null,
      categorySlug: primaryCat?.slug || null,
      secondaryCategoryId: secondaryCat?.id || null,
      secondaryCategorySlug: secondaryCat?.slug || null,
      tertiaryCategoryId: tertiaryCat?.id || null,
      tertiaryCategorySlug: tertiaryCat?.slug || null,
      categorySlugs: resolvedCategorySlugs,
      articleLimit: typeof articleLimit === 'number' ? Math.min(Math.max(articleLimit, 1), 50) : 6,
      isActive: typeof isActive === 'boolean' ? isActive : true,
      config: config || null
    };

    const created = await p.homepageSectionConfig.create({
      data,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        secondaryCategory: { select: { id: true, slug: true, name: true } },
        tertiaryCategory: { select: { id: true, slug: true, name: true } }
      }
    });

    return res.status(201).json(created);
  } catch (e: any) {
    if (String(e.code) === 'P2002') {
      return res.status(409).json({ error: 'Section key already exists for this tenant/domain' });
    }
    console.error('homepage-sections create error', e);
    return res.status(500).json({ error: 'Failed to create homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   put:
 *     summary: Update a homepage section config
 *     description: |
 *       Update label, category link, position, section type, query kind, or other settings.
 *       Supports all Style2 section types and query kinds.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               label: { type: string }
 *               labelEn: { type: string }
 *               position: { type: integer }
 *               style: { type: string }
 *               sectionType: { type: string }
 *               queryKind: { type: string }
 *               categorySlug: { type: string, nullable: true }
 *               secondaryCategorySlug: { type: string, nullable: true }
 *               tertiaryCategorySlug: { type: string, nullable: true }
 *               categorySlugs: { type: array, items: { type: string }, nullable: true }
 *               articleLimit: { type: integer }
 *               isActive: { type: boolean }
 *               config: { type: object }
 *     responses:
 *       200: { description: Updated section }
 *       404: { description: Not found }
 */
router.put('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;
    const {
      label, labelEn, position, style, sectionType, queryKind,
      categorySlug, secondaryCategorySlug, tertiaryCategorySlug, categorySlugs,
      articleLimit, isActive, config
    } = req.body || {};

    const existing = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } }
    });

    if (!existing) return res.status(404).json({ error: 'Section not found' });

    const updateData: any = {};

    if (typeof label === 'string' && label.trim()) updateData.label = label.trim();
    if (labelEn !== undefined) updateData.labelEn = labelEn ? String(labelEn).trim() : null;
    if (typeof position === 'number') updateData.position = position;
    if (typeof style === 'string' && style.trim()) updateData.style = style.trim();
    if (typeof articleLimit === 'number') updateData.articleLimit = Math.min(Math.max(articleLimit, 1), 50);
    if (typeof isActive === 'boolean') updateData.isActive = isActive;
    if (config !== undefined) updateData.config = config;

    // Handle sectionType update
    if (sectionType !== undefined) {
      if (typeof sectionType === 'string' && VALID_SECTION_TYPES.includes(sectionType.trim())) {
        updateData.sectionType = sectionType.trim();
      }
    }

    // Handle queryKind update
    if (queryKind !== undefined) {
      if (typeof queryKind === 'string' && VALID_QUERY_KINDS.includes(queryKind.trim())) {
        updateData.queryKind = queryKind.trim();
      }
    }

    // Helper to resolve category
    async function resolveCategory(slug: string | null | undefined): Promise<{ id: string; slug: string } | null> {
      if (slug === null || slug === '') return null;
      if (!slug || typeof slug !== 'string' || !slug.trim()) return undefined as any; // no change
      const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
      if (!cat) return null;
      return { id: cat.id, slug: cat.slug };
    }

    // Handle primary category update
    if (categorySlug !== undefined) {
      if (categorySlug === null || categorySlug === '') {
        updateData.categoryId = null;
        updateData.categorySlug = null;
      } else {
        const cat = await p.category.findUnique({ where: { slug: String(categorySlug).trim() } });
        if (!cat) return res.status(400).json({ error: `Category with slug "${categorySlug}" not found` });
        updateData.categoryId = cat.id;
        updateData.categorySlug = cat.slug;
      }
    }

    // Handle secondary category update
    if (secondaryCategorySlug !== undefined) {
      if (secondaryCategorySlug === null || secondaryCategorySlug === '') {
        updateData.secondaryCategoryId = null;
        updateData.secondaryCategorySlug = null;
      } else {
        const cat = await p.category.findUnique({ where: { slug: String(secondaryCategorySlug).trim() } });
        if (cat) {
          updateData.secondaryCategoryId = cat.id;
          updateData.secondaryCategorySlug = cat.slug;
        }
      }
    }

    // Handle tertiary category update
    if (tertiaryCategorySlug !== undefined) {
      if (tertiaryCategorySlug === null || tertiaryCategorySlug === '') {
        updateData.tertiaryCategoryId = null;
        updateData.tertiaryCategorySlug = null;
      } else {
        const cat = await p.category.findUnique({ where: { slug: String(tertiaryCategorySlug).trim() } });
        if (cat) {
          updateData.tertiaryCategoryId = cat.id;
          updateData.tertiaryCategorySlug = cat.slug;
        }
      }
    }

    // Handle categorySlugs array update
    if (categorySlugs !== undefined) {
      if (categorySlugs === null || (Array.isArray(categorySlugs) && categorySlugs.length === 0)) {
        updateData.categorySlugs = null;
      } else if (Array.isArray(categorySlugs)) {
        const validSlugs: string[] = [];
        for (const slug of categorySlugs) {
          if (typeof slug === 'string' && slug.trim()) {
            const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
            if (cat) validSlugs.push(cat.slug);
          }
        }
        updateData.categorySlugs = validSlugs.length > 0 ? validSlugs : null;
      }
    }

    const updated = await p.homepageSectionConfig.update({
      where: { id: existing.id },
      data: updateData,
      include: {
        category: { select: { id: true, slug: true, name: true } },
        secondaryCategory: { select: { id: true, slug: true, name: true } },
        tertiaryCategory: { select: { id: true, slug: true, name: true } }
      }
    });

    return res.json(updated);
  } catch (e) {
    console.error('homepage-sections update error', e);
    return res.status(500).json({ error: 'Failed to update homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/{key}:
 *   delete:
 *     summary: Delete a homepage section config
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: key
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:tenantId/:key', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId, key } = req.params;
    const domainId = req.query.domainId ? String(req.query.domainId) : null;

    const existing = await p.homepageSectionConfig.findUnique({
      where: { tenantId_domainId_key: { tenantId, domainId, key } }
    });

    if (!existing) return res.status(404).json({ error: 'Section not found' });

    await p.homepageSectionConfig.delete({ where: { id: existing.id } });

    return res.json({ success: true, deleted: key });
  } catch (e) {
    console.error('homepage-sections delete error', e);
    return res.status(500).json({ error: 'Failed to delete homepage section' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/bulk:
 *   put:
 *     summary: Bulk upsert homepage sections
 *     description: |
 *       Create or update multiple sections at once. Useful for initial setup or reordering.
 *       Each section is identified by `key`. If exists, updates; otherwise creates.
 *       
 *       Supports all Style2 section types and query kinds.
 *     tags: [Homepage Sections]
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
 *               domainId: { type: string, nullable: true }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, label]
 *                   properties:
 *                     key: { type: string }
 *                     label: { type: string }
 *                     labelEn: { type: string }
 *                     position: { type: integer }
 *                     style: { type: string }
 *                     sectionType: { type: string }
 *                     queryKind: { type: string }
 *                     categorySlug: { type: string, nullable: true }
 *                     secondaryCategorySlug: { type: string, nullable: true }
 *                     tertiaryCategorySlug: { type: string, nullable: true }
 *                     categorySlugs: { type: array, items: { type: string }, nullable: true }
 *                     articleLimit: { type: integer }
 *                     isActive: { type: boolean }
 *           examples:
 *             style2_setup:
 *               summary: Complete Style2 homepage setup
 *               value:
 *                 sections:
 *                   - { key: "hero_main", label: "ప్రధాన వార్తలు", labelEn: "Main News", position: 0, sectionType: "hero_sidebar", queryKind: "latest", secondaryCategorySlug: "trending", tertiaryCategorySlug: "politics", articleLimit: 15 }
 *                   - { key: "category_boxes", label: "వర్గాలు", labelEn: "Categories", position: 1, sectionType: "category_boxes_3col", categorySlugs: ["politics", "sports", "entertainment"], articleLimit: 6 }
 *                   - { key: "magazine", label: "బిజినెస్", labelEn: "Business", position: 2, sectionType: "magazine_grid", categorySlug: "business", articleLimit: 8 }
 *                   - { key: "timeline", label: "తాజా వార్తలు", labelEn: "Latest", position: 3, sectionType: "timeline", queryKind: "latest", articleLimit: 10 }
 *     responses:
 *       200: { description: Bulk upsert results }
 */
router.put('/:tenantId/bulk', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, sections } = req.body || {};

    if (!Array.isArray(sections) || sections.length === 0) {
      return res.status(400).json({ error: 'sections array is required' });
    }

    // Helper to resolve category
    async function resolveCat(slug: string | null | undefined): Promise<{ id: string; slug: string } | null> {
      if (!slug || typeof slug !== 'string' || !slug.trim()) return null;
      const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
      if (!cat) return null;
      return { id: cat.id, slug: cat.slug };
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const sec of sections) {
      if (!sec.key || !sec.label) {
        errors.push({ key: sec.key, error: 'key and label are required' });
        continue;
      }

      const normalizedKey = String(sec.key).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      // Resolve section type and query kind
      const sectionType = typeof sec.sectionType === 'string' && VALID_SECTION_TYPES.includes(sec.sectionType.trim())
        ? sec.sectionType.trim()
        : 'category_cards';
      const queryKind = typeof sec.queryKind === 'string' && VALID_QUERY_KINDS.includes(sec.queryKind.trim())
        ? sec.queryKind.trim()
        : 'category';

      // Resolve categories
      const primaryCat = await resolveCat(sec.categorySlug);
      const secondaryCat = HERO_SIDEBAR_SECTION_TYPES.includes(sectionType) ? await resolveCat(sec.secondaryCategorySlug) : null;
      const tertiaryCat = HERO_SIDEBAR_SECTION_TYPES.includes(sectionType) ? await resolveCat(sec.tertiaryCategorySlug) : null;

      // Resolve categorySlugs array
      let resolvedCategorySlugs: string[] | null = null;
      if (MULTI_CATEGORY_SECTION_TYPES.includes(sectionType) && Array.isArray(sec.categorySlugs)) {
        const validSlugs: string[] = [];
        for (const slug of sec.categorySlugs) {
          if (typeof slug === 'string' && slug.trim()) {
            const cat = await p.category.findUnique({ where: { slug: slug.trim() } });
            if (cat) validSlugs.push(cat.slug);
          }
        }
        if (validSlugs.length > 0) resolvedCategorySlugs = validSlugs;
      }

      const data: any = {
        tenantId,
        domainId: domainId || null,
        key: normalizedKey,
        label: String(sec.label).trim(),
        labelEn: sec.labelEn ? String(sec.labelEn).trim() : null,
        position: typeof sec.position === 'number' ? sec.position : 0,
        style: typeof sec.style === 'string' && sec.style.trim() ? sec.style.trim() : 'cards',
        sectionType,
        queryKind,
        categoryId: primaryCat?.id || null,
        categorySlug: primaryCat?.slug || null,
        secondaryCategoryId: secondaryCat?.id || null,
        secondaryCategorySlug: secondaryCat?.slug || null,
        tertiaryCategoryId: tertiaryCat?.id || null,
        tertiaryCategorySlug: tertiaryCat?.slug || null,
        categorySlugs: resolvedCategorySlugs,
        articleLimit: typeof sec.articleLimit === 'number' ? Math.min(Math.max(sec.articleLimit, 1), 50) : 6,
        isActive: typeof sec.isActive === 'boolean' ? sec.isActive : true
      };

      try {
        const upserted = await p.homepageSectionConfig.upsert({
          where: { tenantId_domainId_key: { tenantId, domainId: domainId || null, key: normalizedKey } },
          create: data,
          update: {
            label: data.label,
            labelEn: data.labelEn,
            position: data.position,
            style: data.style,
            sectionType: data.sectionType,
            queryKind: data.queryKind,
            categoryId: data.categoryId,
            categorySlug: data.categorySlug,
            secondaryCategoryId: data.secondaryCategoryId,
            secondaryCategorySlug: data.secondaryCategorySlug,
            tertiaryCategoryId: data.tertiaryCategoryId,
            tertiaryCategorySlug: data.tertiaryCategorySlug,
            categorySlugs: data.categorySlugs,
            articleLimit: data.articleLimit,
            isActive: data.isActive
          },
          include: {
            category: { select: { id: true, slug: true, name: true } },
            secondaryCategory: { select: { id: true, slug: true, name: true } },
            tertiaryCategory: { select: { id: true, slug: true, name: true } }
          }
        });
        results.push(upserted);
      } catch (e: any) {
        errors.push({ key: normalizedKey, error: e?.message || 'Failed to upsert' });
      }
    }

    return res.json({ success: true, count: results.length, sections: results, errors });
  } catch (e) {
    console.error('homepage-sections bulk error', e);
    return res.status(500).json({ error: 'Failed to bulk upsert homepage sections' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/reorder:
 *   patch:
 *     summary: Reorder homepage sections
 *     description: Update positions of multiple sections at once.
 *     tags: [Homepage Sections]
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
 *               domainId: { type: string, nullable: true }
 *               order:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     key: { type: string }
 *                     position: { type: integer }
 *           examples:
 *             reorder:
 *               value:
 *                 order:
 *                   - { key: "hero", position: 0 }
 *                   - { key: "sports", position: 1 }
 *                   - { key: "politics", position: 2 }
 *                   - { key: "crime", position: 3 }
 *     responses:
 *       200: { description: Reorder results }
 */
router.patch('/:tenantId/reorder', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, order } = req.body || {};

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({ error: 'order array is required' });
    }

    const results: any[] = [];
    for (const item of order) {
      if (!item.key || typeof item.position !== 'number') continue;
      const key = String(item.key).trim();
      try {
        const updated = await p.homepageSectionConfig.updateMany({
          where: { tenantId, domainId: domainId || null, key },
          data: { position: item.position }
        });
        results.push({ key, position: item.position, updated: updated.count });
      } catch (e) {
        results.push({ key, position: item.position, error: 'Failed' });
      }
    }

    return res.json({ success: true, results });
  } catch (e) {
    console.error('homepage-sections reorder error', e);
    return res.status(500).json({ error: 'Failed to reorder homepage sections' });
  }
});

/**
 * Default Style2 section templates that use the domain's configured categories
 */
const DEFAULT_STYLE2_SECTIONS = [
  { key: 'hero_main', label: 'Main News', labelEn: 'Main News', position: 0, sectionType: 'hero_sidebar', queryKind: 'latest', articleLimit: 15 },
  { key: 'category_boxes', label: 'Categories', labelEn: 'Categories', position: 10, sectionType: 'category_boxes_3col', queryKind: 'category', articleLimit: 6 },
  { key: 'magazine_section', label: 'Featured', labelEn: 'Featured', position: 20, sectionType: 'magazine_grid', queryKind: 'category', articleLimit: 8 },
  { key: 'horizontal_scroll', label: 'Trending', labelEn: 'Trending', position: 30, sectionType: 'horizontal_scroll', queryKind: 'trending', articleLimit: 10 },
  { key: 'spotlight', label: 'Spotlight', labelEn: 'Spotlight', position: 40, sectionType: 'spotlight', queryKind: 'category', articleLimit: 5 },
  { key: 'newspaper_columns', label: 'More News', labelEn: 'More News', position: 50, sectionType: 'newspaper_columns', queryKind: 'category', articleLimit: 6 },
  { key: 'horizontal_cards', label: 'Lifestyle', labelEn: 'Lifestyle', position: 60, sectionType: 'horizontal_cards', queryKind: 'category', articleLimit: 6 },
  { key: 'photo_gallery', label: 'Photos', labelEn: 'Photos', position: 70, sectionType: 'photo_gallery', queryKind: 'category', articleLimit: 12 },
  { key: 'timeline', label: 'Latest', labelEn: 'Latest', position: 80, sectionType: 'timeline', queryKind: 'latest', articleLimit: 15 },
  { key: 'compact_lists', label: 'Popular', labelEn: 'Popular', position: 90, sectionType: 'compact_lists_2col', queryKind: 'most_viewed', articleLimit: 10 }
];

/**
 * @swagger
 * /homepage-sections/{tenantId}/apply-style2-defaults:
 *   post:
 *     summary: Apply default Style2 homepage sections using domain's categories
 *     description: |
 *       Creates default Style2 homepage sections for a tenant/domain.
 *       Automatically assigns categories from the domain's configured DomainCategory list.
 *       
 *       This endpoint:
 *       1. Fetches categories configured for the domain (DomainCategory)
 *       2. Creates default Style2 sections with various section types
 *       3. Assigns categories to sections based on count (uses all available styles)
 *       
 *       Use this for quick homepage setup when domain has categories configured.
 *     tags: [Homepage Sections]
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
 *               domainId: { type: string, nullable: true, description: "Domain to apply defaults for" }
 *               clearExisting: { type: boolean, default: false, description: "Remove existing sections before applying" }
 *     responses:
 *       200:
 *         description: Applied default sections
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 sectionsCreated: { type: integer }
 *                 sections: { type: array }
 */
router.post('/:tenantId/apply-style2-defaults', auth, requireSuperOrTenantAdminScoped, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { domainId, clearExisting } = req.body || {};

    // Clear existing sections if requested
    if (clearExisting) {
      await p.homepageSectionConfig.deleteMany({
        where: { tenantId, domainId: domainId || null }
      });
    }

    // Fetch domain categories (sorted by position)
    const domainCategories = domainId
      ? await p.domainCategory.findMany({
          where: { domainId },
          orderBy: { position: 'asc' },
          include: { category: { select: { id: true, slug: true, name: true } } }
        })
      : [];

    // Extract category slugs
    const categorySlugs = domainCategories
      .map((dc: any) => dc.category?.slug)
      .filter((s: any) => s);

    // Helper to get category at index (with fallback to first)
    const getCatSlug = (idx: number) => categorySlugs[idx % Math.max(categorySlugs.length, 1)] || null;
    const getCatSlugsArray = (count: number, startIdx: number) => {
      const arr: string[] = [];
      for (let i = 0; i < count && i < categorySlugs.length; i++) {
        const slug = getCatSlug(startIdx + i);
        if (slug) arr.push(slug);
      }
      return arr.length > 0 ? arr : null;
    };

    const results: any[] = [];
    let catIdx = 0;

    for (const template of DEFAULT_STYLE2_SECTIONS) {
      const data: any = {
        tenantId,
        domainId: domainId || null,
        key: template.key,
        label: template.label,
        labelEn: template.labelEn,
        position: template.position,
        style: 'cards',
        sectionType: template.sectionType,
        queryKind: template.queryKind,
        articleLimit: template.articleLimit,
        isActive: true
      };

      // Assign categories based on section type
      if (template.queryKind === 'category') {
        if (MULTI_CATEGORY_SECTION_TYPES.includes(template.sectionType)) {
          // Multi-category sections get 3 categories
          data.categorySlugs = getCatSlugsArray(3, catIdx);
          catIdx += 3;
        } else if (HERO_SIDEBAR_SECTION_TYPES.includes(template.sectionType)) {
          // Hero sidebar gets primary + secondary + tertiary
          data.categorySlug = getCatSlug(catIdx++);
          data.secondaryCategorySlug = getCatSlug(catIdx++);
          data.tertiaryCategorySlug = getCatSlug(catIdx++);
        } else {
          // Single category sections
          data.categorySlug = getCatSlug(catIdx++);
        }
      }

      // Resolve category IDs
      if (data.categorySlug) {
        const cat = await p.category.findUnique({ where: { slug: data.categorySlug } });
        if (cat) data.categoryId = cat.id;
      }
      if (data.secondaryCategorySlug) {
        const cat = await p.category.findUnique({ where: { slug: data.secondaryCategorySlug } });
        if (cat) data.secondaryCategoryId = cat.id;
      }
      if (data.tertiaryCategorySlug) {
        const cat = await p.category.findUnique({ where: { slug: data.tertiaryCategorySlug } });
        if (cat) data.tertiaryCategoryId = cat.id;
      }

      try {
        const section = await p.homepageSectionConfig.upsert({
          where: { tenantId_domainId_key: { tenantId, domainId: domainId || null, key: template.key } },
          create: data,
          update: data,
          include: {
            category: { select: { id: true, slug: true, name: true } },
            secondaryCategory: { select: { id: true, slug: true, name: true } },
            tertiaryCategory: { select: { id: true, slug: true, name: true } }
          }
        });
        results.push(section);
      } catch (e: any) {
        console.error(`Failed to create section ${template.key}:`, e?.message);
      }
    }

    return res.json({
      success: true,
      sectionsCreated: results.length,
      categoriesUsed: categorySlugs.slice(0, catIdx),
      sections: results
    });
  } catch (e) {
    console.error('homepage-sections apply-defaults error', e);
    return res.status(500).json({ error: 'Failed to apply default sections' });
  }
});

/**
 * @swagger
 * /homepage-sections/{tenantId}/section-types:
 *   get:
 *     summary: Get available section types and query kinds
 *     description: Returns list of valid section types and query kinds for Style2 homepage configuration.
 *     tags: [Homepage Sections]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Available section types and query kinds
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sectionTypes: { type: array, items: { type: object } }
 *                 queryKinds: { type: array, items: { type: object } }
 */
router.get('/:tenantId/section-types', auth, requireSuperOrTenantAdminScoped, async (_req, res) => {
  return res.json({
    sectionTypes: [
      { value: 'hero_sidebar', label: 'Hero with Sidebar', categoryField: 'category + secondaryCategory + tertiaryCategory', description: 'Main hero section with sidebar content' },
      { value: 'category_boxes_3col', label: '3-Column Category Boxes', categoryField: 'categorySlugs[]', description: '3-column layout with category boxes' },
      { value: 'small_cards_3col', label: '3-Column Small Cards', categoryField: 'categorySlugs[]', description: '3-column small card layout' },
      { value: 'magazine_grid', label: 'Magazine Grid', categoryField: 'category', description: 'Magazine-style grid layout' },
      { value: 'horizontal_scroll', label: 'Horizontal Scroll', categoryField: 'category', description: 'Horizontally scrolling cards' },
      { value: 'spotlight', label: 'Spotlight', categoryField: 'category', description: 'Featured spotlight section' },
      { value: 'newspaper_columns', label: 'Newspaper Columns', categoryField: 'categorySlugs[]', description: 'Traditional newspaper column layout' },
      { value: 'horizontal_cards', label: 'Horizontal Cards', categoryField: 'category', description: 'Horizontal card layout' },
      { value: 'photo_gallery', label: 'Photo Gallery', categoryField: 'category', description: 'Photo gallery section' },
      { value: 'timeline', label: 'Timeline', categoryField: 'category', description: 'Timeline-style news feed' },
      { value: 'featured_banner', label: 'Featured Banner', categoryField: 'category', description: 'Featured banner section' },
      { value: 'compact_lists_2col', label: '2-Column Compact Lists', categoryField: 'categorySlugs[]', description: '2-column compact list layout' }
    ],
    queryKinds: [
      { value: 'category', label: 'Category', description: 'Fetch articles from linked category' },
      { value: 'latest', label: 'Latest', description: 'Fetch latest articles (no category needed)' },
      { value: 'trending', label: 'Trending', description: 'Fetch trending/popular articles (no category needed)' },
      { value: 'most_viewed', label: 'Most Viewed', description: 'Fetch most viewed articles (no category needed)' }
    ],
    multiCategorySectionTypes: MULTI_CATEGORY_SECTION_TYPES,
    heroSidebarSectionTypes: HERO_SIDEBAR_SECTION_TYPES
  });
});

export default router;
