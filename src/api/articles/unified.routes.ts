import { Router } from 'express';
import passport from 'passport';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { createUnifiedArticle, listUnifiedArticles, updateUnifiedArticle, getUnifiedArticle } from './unified.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: News Room
 *     description: Unified newsroom APIs - AI rewrite + article creation
 */

/**
 * @swagger
 * /articles/unified:
 *   post:
 *     summary: Create Newspaper + Web + ShortNews in ONE atomic call
 *     description: |
 *       **UNIFIED ARTICLE CREATION**
 *       
 *       Creates all 3 article types atomically:
 *       - NewspaperArticle (for print/ePaper)
 *       - TenantWebArticle (for website CMS)
 *       - ShortNews (for mobile app)
 *       
 *       **Allowed Roles:** REPORTER, TENANT_ADMIN, SUPER_ADMIN, EDITOR roles
 *       
 *       **Tenant Resolution:**
 *       - SUPER_ADMIN: MUST provide tenantId in payload
 *       - TENANT_ADMIN: Uses tenantId from payload or falls back to assigned tenant
 *       - REPORTER: Uses tenantId from reporter profile
 *       
 *       **Status Logic:**
 *       - REPORTER + autoPublish=true + publishReady=true → PUBLISHED
 *       - REPORTER + autoPublish=true + publishReady=false → PENDING
 *       - REPORTER + autoPublish=false → PENDING
 *       - ADMIN/EDITOR/SUPER_ADMIN → PUBLISHED
 *       
 *       **Required Fields:**
 *       - baseArticle.languageCode
 *       - location.resolved (at least state or district)
 *       - printArticle.headline
 *       - printArticle.body[]
 *
 *       **AI Rewrite Compatibility:**
 *       If you are posting the output of `POST /api/v1/ai/rewrite/unified` directly,
 *       you may send these snake_case keys and the server will auto-map them:
 *       - `print_article` → `printArticle`
 *       - `web_article` → `webArticle` (including `seo.url_slug` → `seo.slug`)
 *       - `short_mobile_article` → `shortNews` (maps `body` → `content`)
 *       - `status.publish_ready` → `publishControl.publishReady`
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [baseArticle, location, printArticle]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: "Required for SUPER_ADMIN, optional for TENANT_ADMIN"
 *                 example: "clxyz123..."
 *               domainId:
 *                 type: string
 *                 description: "Optional - uses primary domain if not provided"
 *                 example: "clxyz456..."
 *               baseArticle:
 *                 type: object
 *                 required: [languageCode]
 *                 properties:
 *                   languageCode:
 *                     type: string
 *                     example: "te"
 *                   newsType:
 *                     type: string
 *                     example: "Crime / Medical Negligence"
 *                   category:
 *                     type: object
 *                     properties:
 *                       categoryId: { type: string }
 *                       categoryName: { type: string }
 *                   publisher:
 *                     type: object
 *                     deprecated: true
 *                     description: "OPTIONAL - Not needed for REPORTER/TENANT_ADMIN. Auto-resolved from login context."
 *                     properties:
 *                       tenantId: { type: string }
 *                       domainId: { type: string }
 *               location:
 *                 type: object
 *                 properties:
 *                   inputText:
 *                     type: string
 *                     example: "అంచునూరు గ్రామం, దోమకొండ మండలం"
 *                   resolved:
 *                     type: object
 *                     properties:
 *                       village: { type: object }
 *                       mandal: { type: object }
 *                       district: { type: object }
 *                       state: { type: object }
 *                   dateline:
 *                     type: object
 *                     properties:
 *                       placeName: { type: string }
 *                       date: { type: string }
 *                       formatted: { type: string }
 *               printArticle:
 *                 type: object
 *                 required: [headline, body]
 *                 properties:
 *                   headline:
 *                     type: string
 *                     example: "తప్పు చికిత్సతో వృద్ధుడి మృతి"
 *                   subtitle:
 *                     type: string
 *                   body:
 *                     type: array
 *                     items: { type: string }
 *                   highlights:
 *                     type: array
 *                     items: { type: string }
 *                   responses:
 *                     type: array
 *                     items: { type: string }
 *               webArticle:
 *                 type: object
 *                 properties:
 *                   headline: { type: string }
 *                   lead: { type: string }
 *                   sections:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         subhead: { type: string }
 *                         paragraphs: { type: array, items: { type: string } }
 *                   seo:
 *                     type: object
 *                     properties:
 *                       slug: { type: string }
 *                       metaTitle: { type: string }
 *                       metaDescription: { type: string }
 *                       keywords: { type: array, items: { type: string } }
 *               shortNews:
 *                 type: object
 *                 properties:
 *                   h1: { type: string }
 *                   h2: { type: string }
 *                   content: { type: string }
 *               media:
 *                 type: object
 *                 properties:
 *                   images:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         url: { type: string }
 *                         caption: { type: string }
 *                         alt: { type: string }
 *                         afterParagraph:
 *                           type: integer
 *                           description: "Optional. If provided, inserts this image after the Nth body paragraph in webArticle contentHtml. Also stored in contentJson.meta.imagePlacementPlan."
 *               publishControl:
 *                 type: object
 *                 properties:
 *                   publishReady:
 *                     type: boolean
 *                     description: "If false, article stays PENDING even if reporter has autoPublish=true"
 *                   reason:
 *                     type: string
 *
 *               # Optional: AI rewrite output keys (snake_case) - auto-mapped by server
 *               print_article:
 *                 type: object
 *                 description: "AI rewrite print_article (alternative to printArticle)"
 *               web_article:
 *                 type: object
 *                 description: "AI rewrite web_article (alternative to webArticle)"
 *               short_mobile_article:
 *                 type: object
 *                 description: "AI rewrite short_mobile_article (alternative to shortNews)"
 *               media_requirements:
 *                 type: object
 *               image_placement_hints:
 *                 type: array
 *                 items: { type: object }
 *               internal_evidence:
 *                 type: object
 *               status:
 *                 type: object
 *           example:
 *             tenantId: "clxyz123..."
 *             baseArticle:
 *               languageCode: "te"
 *               category:
 *                 categoryName: "Accident"
 *             location:
 *               inputText: "హైదరాబాద్"
 *               resolved:
 *                 district: { id: "cldist...", name: "Hyderabad" }
 *                 state: { id: "clstate...", name: "Telangana" }
 *               dateline:
 *                 placeName: "హైదరాబాద్"
 *                 formatted: "హైదరాబాద్, ఫిబ్రవరి 6"
 *             media:
 *               images:
 *                 - url: "https://cdn.example.com/photo1.jpg"
 *                   caption: "ప్రమాద స్థలం"
 *                   alt: "రోడ్డు ప్రమాదం"
 *
 *             # AI rewrite output blocks (snake_case) - optional
 *             detected_category: "Accident"
 *             print_article:
 *               headline: "రోడ్డు ప్రమాదంలో ఇద్దరికి గాయాలు"
 *               subtitle: null
 *               body:
 *                 - "శుక్రవారం రాత్రి నగరంలో జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరికి గాయాలయ్యాయి."
 *                 - "పోలీసులు కేసు నమోదు చేసి దర్యాప్తు చేస్తున్నారు."
 *             web_article:
 *               headline: "రోడ్డు ప్రమాదంలో ఇద్దరికి గాయాలు"
 *               lead: "నగరంలో శుక్రవారం రాత్రి జరిగిన ప్రమాదంలో ఇద్దరు గాయపడ్డారు."
 *               body:
 *                 - "పోలీసుల ప్రకారం..."
 *               seo:
 *                 url_slug: "hyderabad-road-accident-injured"
 *                 meta_title: "రోడ్డు ప్రమాదం: ఇద్దరికి గాయాలు"
 *                 meta_description: "హైదరాబాద్‌లో జరిగిన రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు."
 *                 keywords: ["హైదరాబాద్", "రోడ్డు ప్రమాదం"]
 *             short_mobile_article:
 *               h1: "రోడ్డు ప్రమాదం"
 *               h2: "ఇద్దరికి గాయాలు"
 *               body: "నగరంలో రోడ్డు ప్రమాదంలో ఇద్దరు గాయపడ్డారు. పోలీసులు కేసు నమోదు చేశారు."
 *             status:
 *               publish_ready: false
 *               validation_issues: ["Need at least 1 clear photo"]
 *               approval_status: "REVIEW_REQUIRED"
 *     responses:
 *       201:
 *         description: All 3 articles created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 status: { type: string, enum: [PUBLISHED, PENDING, DRAFT] }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newspaperArticle:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         externalId: { type: string }
 *                         title: { type: string }
 *                         status: { type: string }
 *                     webArticle:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         slug: { type: string }
 *                         status: { type: string }
 *                     shortNews:
 *                       type: object
 *                       properties:
 *                         id: { type: string }
 *                         heading: { type: string }
 *                         status: { type: string }
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post(
  '/unified',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  createUnifiedArticle
);

/**
 * @swagger
 * /articles/unified:
 *   get:
 *     summary: List articles with filters (newspaper, web, shortNews)
 *     description: |
 *       **LIST ARTICLES**
 *       
 *       Get articles with filters for tenantId, domainId, type, date range and pagination.
 *       
 *       **Allowed Roles:** REPORTER, TENANT_ADMIN, SUPER_ADMIN, EDITOR roles
 *       
 *       **Type Options:**
 *       - `all` - Returns summary of all 3 types
 *       - `newspaper` - Only NewspaperArticle with pagination
 *       - `web` - Only TenantWebArticle with pagination
 *       - `shortNews` - Only ShortNews with pagination
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: Tenant ID (required for SUPER_ADMIN)
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *         description: Filter by domain ID
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [all, newspaper, web, shortNews] }
 *         description: Article type to fetch (default all)
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, PENDING, PUBLISHED, REJECTED] }
 *         description: Filter by status
 *       - in: query
 *         name: fromDate
 *         schema: { type: string, format: date }
 *         description: From date (YYYY-MM-DD)
 *       - in: query
 *         name: toDate
 *         schema: { type: string, format: date }
 *         description: To date (YYYY-MM-DD)
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, maximum: 100 }
 *         description: Items per page
 *       - in: query
 *         name: sortBy
 *         schema: { type: string, default: createdAt }
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Articles list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 tenantId: { type: string }
 *                 type: { type: string }
 *                 filters: { type: object }
 *                 data:
 *                   type: object
 *                   properties:
 *                     newspaper: { type: object }
 *                     web: { type: object }
 *                     shortNews: { type: object }
 */
router.get(
  '/unified',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  listUnifiedArticles
);

/**
 * @swagger
 * /articles/unified/{id}:
 *   get:
 *     summary: Get single article by ID
 *     description: |
 *       **GET ARTICLE DETAIL**
 *       
 *       Fetch a single article by ID. Use `type` query param to specify article type.
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Article ID
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [newspaper, web, shortNews] }
 *         description: Article type (default newspaper)
 *     responses:
 *       200:
 *         description: Article details
 *       404:
 *         description: Article not found
 */
router.get(
  '/unified/:id',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  getUnifiedArticle
);

/**
 * @swagger
 * /articles/unified/{id}:
 *   patch:
 *     summary: Update any article type (newspaper, web, shortNews)
 *     description: |
 *       **UPDATE ARTICLE**
 *       
 *       Update fields of any article type. Use `type` query param to specify which type.
 *       
 *       **Allowed Roles:** REPORTER (own articles only), TENANT_ADMIN, SUPER_ADMIN, EDITOR roles
 *       
 *       **Fields by Type:**
 *       
 *       **newspaper:**
 *       - title, heading, subTitle, dateLine, status, content, bulletPoints, coverImageUrl, images, categoryId
 *       
 *       **web:**
 *       - title, slug, status, contentHtml, plainText, seoTitle, metaDescription, coverImageUrl, tags, categoryIds
 *       
 *       **shortNews:**
 *       - heading, subHeading, summary, status, coverImageUrl, categoryId
 *     tags: [News Room]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: Article ID
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [newspaper, web, shortNews] }
 *         description: Article type to update
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               heading: { type: string }
 *               subTitle: { type: string }
 *               status: { type: string, enum: [DRAFT, PENDING, PUBLISHED, REJECTED] }
 *               content:
 *                 type: array
 *                 items: { type: string }
 *                 description: Body paragraphs (for newspaper)
 *               bulletPoints:
 *                 type: array
 *                 items: { type: string }
 *               coverImageUrl: { type: string }
 *               categoryId: { type: string }
 *               slug: { type: string, description: "For web only" }
 *               contentHtml: { type: string, description: "For web only" }
 *               seoTitle: { type: string, description: "For web only" }
 *               metaDescription: { type: string, description: "For web only" }
 *               tags: { type: array, items: { type: string }, description: "For web only" }
 *               summary: { type: string, description: "For shortNews only" }
 *               subHeading: { type: string, description: "For shortNews only" }
 *     responses:
 *       200:
 *         description: Article updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 type: { type: string }
 *                 data: { type: object }
 *       400:
 *         description: Invalid type or missing ID
 *       403:
 *         description: Not authorized
 *       404:
 *         description: Article not found
 */
router.patch(
  '/unified/:id',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  updateUnifiedArticle
);

export default router;
