
import { Router } from 'express';
import passport from 'passport';
import { createArticleController, createTenantArticleController, createWebStoryController, updateArticleController, deleteArticleController } from './articles.controller';
import { composeAIArticleController, enqueueRawArticleController, composeWebOnlyController, composeBlocksController, composeSimpleArticleController } from './articles.ai.controller';
import { getWebArticleByIdPublic, getWebArticlesByDomainPublic, listTitlesAndHeroesPublic, listPublicArticles, updateWebArticleStatus } from './articles.public.controller';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';

const router = Router();

// Legacy short-news creation (citizen)
router.post('/', passport.authenticate('jwt', { session: false }), createArticleController);

// Tenant-scoped article creation (reporter/admin)
/**
 * @swagger
 * /articles/tenant:
 *   post:
 *     summary: Create an article scoped to a tenant
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               type: { type: string, example: 'reporter' }
 *               isPublished: { type: boolean }
 *               h1: { type: string }
 *               h2: { type: string }
 *               h3: { type: array, items: { type: string } }
 *               contentHtml: { type: string }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     heading: { type: string }
 *                     level: { type: integer, enum: [1,2,3] }
 *                     paragraphs: { type: array, items: { type: string } }
 *                     imageUrl: { type: string }
 *           example:
 *             tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *             languageCode: 'te'
 *             title: 'Budget Highlights 2025'
 *             content: 'Key points from the budget...'
 *             images: ['https://cdn/img1.jpg']
 *             categoryIds: ['cat123']
 *             type: 'reporter'
 *             isPublished: true
 *             h1: 'Budget Highlights 2025'
 *             h2: 'Key takeaways for taxpayers'
 *             h3: ['Direct taxes', 'Infra spend']
 *             sections:
 *               - heading: 'Direct Tax Reforms'
 *                 level: 2
 *                 paragraphs: ['Slab changes...', 'Rebate updates...']
 *               - heading: 'Infrastructure'
 *                 level: 2
 *                 paragraphs: ['Highways...', 'Rail...']
 *             contentHtml: '<h1>Budget Highlights 2025</h1><p>Key points...</p>'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/tenant', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createTenantArticleController);

/**
 * @swagger
 * /articles/webstories:
 *   post:
 *     summary: Create a web story (scoped to tenant)
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'en' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *               h1: { type: string }
 *               h2: { type: string }
 *               h3: { type: array, items: { type: string } }
 *               contentHtml: { type: string }
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     heading: { type: string }
 *                     level: { type: integer, enum: [1,2,3] }
 *                     paragraphs: { type: array, items: { type: string } }
 *                     imageUrl: { type: string }
 *           example:
 *             tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *             languageCode: 'en'
 *             title: 'Festival Highlights'
 *             content: 'Slide 1: ... Slide 2: ...'
 *             images: ['https://cdn/img1.jpg']
 *             categoryIds: ['cat123']
 *             isPublished: true
 *             h1: 'Festival Highlights Full Story'
 *             h2: 'Top moments'
 *             h3: ['Opening parade', 'Food stalls']
 *             contentHtml: '<h1>Festival Highlights</h1><p>Slide 1...</p>'
 *             sections:
 *               - heading: 'Opening Parade'
 *                 level: 2
 *                 paragraphs: ['Colorful floats', 'Local troupes performance']
 *                 imageUrl: 'https://cdn/img1.jpg'
 *               - heading: 'Food Stalls'
 *                 level: 2
 *                 paragraphs: ['Street foods', 'Traditional sweets']
 *                 imageUrl: 'https://cdn/img2.jpg'
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/webstories', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createWebStoryController);

/**
 * @swagger
 * /articles/ai/compose:
 *   post:
 *     summary: Compose AI-enhanced article (web, optionally short news)
 *     description: |
 *       Stores raw article then generates a website article JSON.
 *       Use header "X-Generate" with values: web, web+short, or web+newspaper.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: X-Generate
 *         schema: { type: string, enum: [web, web+short, web+newspaper] }
 *         required: false
 *         description: Control which variants to generate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, categoryIds]
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *               raw: { type: object, description: 'Original rich payload from editor' }
 *     responses:
 *       201:
 *         description: Created with generated payloads
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Web JSON and IDs
 *                 value:
 *                   articleId: "cmijx123abc"
 *                   webArticleId: "cmijklm456"
 *                   web:
 *                     slug: "telangana-budget-2025"
 *                     title: "తెలంగాణ బడ్జెట్ 2025"
 *                     status: "published"
 */
router.post('/ai/compose', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeAIArticleController);

/**
 * @swagger
 * /articles/ai/web:
 *   post:
 *     summary: Generate and store website article (Gemini)
 *     description: Simple one-call API. Takes raw input, calls Gemini using the strict DB prompt, stores the generated website JSON under contentJson.web, and returns articleId + web.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, categoryIds]
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *               raw: { type: object }
 *           example:
 *             tenantId: 'cmidgq4v80004ugv8dtqv4ijk'
 *             languageCode: 'te'
 *             title: 'తెలంగాణ బడ్జెట్ 2025'
 *             content: 'ప్రధాన అంశాలు...'
 *             images: ['https://cdn/img1.jpg']
 *             categoryIds: ['cat123']
 *             isPublished: true
 *     responses:
 *       201:
 *         description: Created with web JSON
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Web JSON stored
 *                 value:
 *                   articleId: "cmijx123abc"
 *                   webArticleId: "cmijklm456"
 *                   web:
 *                     slug: "festival-highlights"
 *                     title: "Festival Highlights"
 *                     status: "published"
 */
router.post('/ai/web', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeWebOnlyController);

/**
 * @swagger
 * /articles/ai/blocks:
 *   post:
 *     summary: Generate using two-block prompt (SEO JSON + Plain Text)
 *     description: Returns structured SEO JSON and a plain text body, converts to normalized website JSON, stores it, and returns IDs.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, categoryIds]
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *     responses:
 *       201:
 *         description: Created with web JSON and SEO
 *         content:
 *           application/json:
 *             examples:
 *               success:
 *                 summary: Web JSON stored
 *                 value:
 *                   articleId: "cmijx123abc"
 *                   webArticleId: "cmijklm456"
 *                   seo:
 *                     slug: "festival-highlights"
 *                     title: "Festival Highlights"
 *                     meta:
 *                       seoTitle: "Festival Highlights"
 *                       metaDescription: "Top moments of the festival..."
 *                   web:
 *                     slug: "festival-highlights"
 *                     title: "Festival Highlights"
 *                     status: "published"
 */
router.post('/ai/blocks', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeBlocksController);

/**
 * @swagger
 * /articles/ai/simple:
 *   post:
 *     summary: Simple AI article (content + domain/category/media)
 *     description: |
 *       SUPER_ADMIN or tenant-scoped roles submit raw content with domain/category/media. The API runs a strict two-block prompt (SEO JSON + Plain Text body),
 *       computes an AI approval status (APPROVED or REVIEW_REQUIRED), converts the body to normalized blocks + sanitized HTML, and stores a TenantWebArticle.
 *       Language: if `languageCode = te`, both blocks are enforced to be Telugu; otherwise use the requested language. If language mismatch is detected, `aiStatus` becomes REVIEW_REQUIRED.
 *       If `X-Debug-Prompt: true` header is present, the response includes the exact prompt string used.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domainId, categoryIds, content]
 *             properties:
 *               domainId: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               content: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               coverImageUrl: { type: string }
 *               media: { type: object, properties: { images: { type: array, items: { type: string } }, videos: { type: array, items: { type: string } } } }
 *               persona: { type: string, example: 'Senior Tech Analyst' }
 *               primaryKeyword: { type: string }
 *               targetAudience: { type: string }
 *               tone: { type: string }
 *           examples:
 *             minimal:
 *               summary: Minimal payload
 *               value:
 *                 domainId: "cmij2htcy0009ht1epqf3pytz"
 *                 categoryIds: ["cmij6h1nh000vgs1e0vnjw8o4"]
 *                 content: "Raw body text here..."
 *             full:
 *               summary: With media and persona
 *               value:
 *                 domainId: "cmij2htcy0009ht1epqf3pytz"
 *                 categoryIds: ["cmij6h1nh000vgs1e0vnjw8o4"]
 *                 content: "Raw body text here..."
 *                 languageCode: "te"
 *                 coverImageUrl: "https://cdn/img1.webp"
 *                 media:
 *                   images: ["https://cdn/img1.webp", "https://cdn/img2.webp"]
 *                   videos: ["https://cdn/video1.mp4"]
 *                 persona: "Investigative Reporter"
 *                 primaryKeyword: "వరికి కొనుగోలు"
 *                 targetAudience: "తెలుగు పాఠకులు"
 *                 tone: "Objective and Detailed"
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 webArticleId: { type: string }
 *                 aiStatus: { type: string, enum: [APPROVED, REVIEW_REQUIRED] }
 *                 usage: { type: object, description: 'AI provider usage metrics (tokens/characters) for billing', additionalProperties: true }
 *                 seo:
 *                   type: object
 *                   properties:
 *                     seo_title: { type: string }
 *                     meta_description: { type: string }
 *                     primary_keyword: { type: string }
 *                     secondary_keywords: { type: array, items: { type: string } }
 *                     tags: { type: array, items: { type: string } }
 *                     url_slug: { type: string }
 *                 web:
 *                   type: object
 *                   properties:
 *                     slug: { type: string }
 *                     title: { type: string }
 *                     status: { type: string }
 *                     contentHtml: { type: string }
 *                     blocks: { type: array, items: { type: object } }
 *                 prompt: { type: string, description: 'Returned only when X-Debug-Prompt: true' }
 *             examples:
 *               approved:
 *                 summary: Approved result
 *                 value:
 *                   webArticleId: "cm_simple123"
 *                   aiStatus: "APPROVED"
 *                   usage: { promptTokens: 2048, completionTokens: 512, totalTokens: 2560 }
 *                   seo:
 *                     seo_title: "తెలంగాణ వరి కొనుగోళ్లు: స్థితిగతులు"
 *                     meta_description: "జిల్లాలో వరి కొనుగోళ్ల పురోగతి, కేటాయింపులు మరియు సదుపాయాల సమీక్ష."
 *                     url_slug: "telangana-vari-purchases-status"
 *                     tags: ["#Agriculture", "#Procurement", "#Telangana"]
 *                   web:
 *                     slug: "telangana-vari-purchases-status"
 *                     title: "తెలంగాణ వరి కొనుగోళ్లు: స్థితిగతులు"
 *                     status: "draft"
 *               review:
 *                 summary: Review required
 *                 value:
 *                   webArticleId: "cm_simple999"
 *                   aiStatus: "REVIEW_REQUIRED"
 *                   seo: { seo_title: "..." }
 *                   web: { slug: "...", title: "...", status: "pending" }
 *       202:
 *         description: AI returned incomplete output (e.g., missing body or SEO JSON)
 *         content:
 *           application/json:
 *             examples:
 *               missingBody:
 *                 value:
 *                   aiError: "MISSING_BODY"
 *               missingSeo:
 *                 value:
 *                   aiError: "MISSING_SEO_BLOCK"
 *       400:
 *         description: Validation error (missing required fields or invalid domain/language)
 *       500:
 *         description: Server error while persisting TenantWebArticle
 */
router.post('/ai/simple', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeSimpleArticleController);

/**
 * @swagger
 * /articles/public/web/{id}:
 *   get:
 *     summary: Get TenantWebArticle by id (public)
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Article
 */
router.get('/public/web/:id', getWebArticleByIdPublic);

/**
 * @swagger
 * /articles/public/web/domain/{domainId}:
 *   get:
 *     summary: List TenantWebArticles by domain (public)
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: domainId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PUBLISHED, DRAFT, PENDING], default: PUBLISHED }
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       coverImageUrl: { type: string }
 *                       seoTitle: { type: string }
 *                       metaDescription: { type: string }
 *                       tags:
 *                         type: array
 *                         items: { type: string }
 *                       jsonLd: { type: object }
 *                       contentJson: { type: object }
 */
router.get('/public/web/domain/:domainId', getWebArticlesByDomainPublic);

/**
 * @swagger
 * /articles/public/web/list:
 *   get:
 *     summary: List titles and hero images (public)
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: domainId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PUBLISHED, DRAFT, PENDING], default: PUBLISHED }
 *     responses:
 *       200:
 *         description: List of titles and hero images
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       coverImageUrl: { type: string }
 *                       publishedAt: { type: string }
 *                       tags:
 *                         type: array
 *                         items: { type: string }
 *                       contentJson: { type: object }
 */
router.get('/public/web/list', listTitlesAndHeroesPublic);

/**
 * @swagger
 * /articles/public:
 *   get:
 *     summary: List public TenantWebArticles (filter by domain name)
 *     tags: [Articles]
 *     parameters:
 *       - in: query
 *         name: domainName
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PUBLISHED, DRAFT, PENDING], default: PUBLISHED }
 *     responses:
 *       200:
 *         description: List of public articles
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       tenantId: { type: string }
 *                       domainId: { type: string }
 *                       languageId: { type: string }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       status: { type: string }
 *                       coverImageUrl: { type: string }
 *                       seoTitle: { type: string }
 *                       metaDescription: { type: string }
 *                       tags:
 *                         type: array
 *                         items: { type: string }
 *                       jsonLd: { type: object }
 *                       contentJson: { type: object }
 */
router.get('/public', listPublicArticles);

// Frontend-friendly alias
router.get('/public/articles', listPublicArticles);

/**
 * @swagger
 * /articles/web/{id}/status:
 *   patch:
 *     summary: Update TenantWebArticle status
 *     tags: [Articles]
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
 *               status: { type: string, enum: [DRAFT, PUBLISHED, ARCHIVED, PENDING] }
 *           examples:
 *             publish:
 *               summary: Publish article
 *               value:
 *                 status: PUBLISHED
 *             draft:
 *               summary: Move to draft
 *               value:
 *                 status: DRAFT
 *     responses:
 *       200:
 *         description: Updated status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 status: { type: string }
 *                 publishedAt: { type: string, nullable: true }
 *                 updatedAt: { type: string }
 *             examples:
 *               published:
 *                 summary: Published response
 *                 value:
 *                   id: "cuid123"
 *                   status: "PUBLISHED"
 *                   publishedAt: "2025-12-04T10:12:00.000Z"
 *                   updatedAt: "2025-12-04T10:12:00.000Z"
 *               draft:
 *                 summary: Draft response
 *                 value:
 *                   id: "cuid123"
 *                   status: "DRAFT"
 *                   publishedAt: null
 *                   updatedAt: "2025-12-04T10:13:00.000Z"
 */
router.patch('/web/:id/status', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, updateWebArticleStatus);

/**
 * @swagger
 * /articles/ai/raw:
 *   post:
 *     summary: Enqueue raw article for background AI processing
 *     description: |
 *       Stores raw article and marks AI queue flags in contentJson.
 *       Background worker will generate web and short news.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content, categoryIds]
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               languageCode: { type: string, example: 'te' }
 *               title: { type: string }
 *               content: { type: string }
 *               images: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string } }
 *               raw: { type: object }
 *               queue: { type: object, properties: { web: {type: boolean}, short: {type: boolean}, newspaper: {type: boolean} } }
 *     responses:
 *       202:
 *         description: Queued for background processing
 */
router.post('/ai/raw', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, enqueueRawArticleController);

/**
 * @swagger
 * /articles/{id}:
 *   get:
 *     summary: Get article by ID (includes contentJson)
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Article
 */
router.get('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
	try {
		const { id } = req.params as any;
		const article = await prisma.article.findUnique({
			where: { id },
			include: { categories: true, author: true }
		});
		if (!article) return res.status(404).json({ error: 'Not found' });
		return res.json(article);
	} catch (e) {
		console.error('GET /articles/:id error', e);
		return res.status(500).json({ error: 'Failed to fetch article' });
	}
});

/**
 * @swagger
 * /articles/{id}:
 *   put:
 *     summary: Update an article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
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
 *               title: { type: string }
 *               content: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               status: { type: string, enum: ['DRAFT','PUBLISHED','ARCHIVED'] }
 *     responses:
 *       200:
 *         description: Updated
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, updateArticleController);

/**
 * @swagger
 * /articles/{id}:
 *   delete:
 *     summary: Delete an article
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, deleteArticleController);



/**
 * @swagger
 * components:
 *   schemas:
 *     CreateArticleDto:
 *       type: object
 *       required:
 *         - title
 *         - content
 *         - categoryIds
 *       properties:
	*         title:
	*           type: string
	*           example: 'The Future of AI in Journalism'
	*         content:
	*           type: string
	*           example: 'In this article, we explore the transformative impact of AI...'
	*         categoryIds:
	*           type: array
	*           items:
	*             type: string
	*           example: ["clq9zsm0d0000vcwz1z2z3z4z", "clq9zsm0e0001vcwzabcdefgh"]
	*         isPublished:
	*           type: boolean
	*           example: true
	*         isBreaking:
	*           type: boolean
	*           example: false
	*         isFeatured:
	*           type: boolean
	*           example: true
 */

export default router;
/**
 * @swagger
 * /comments/article/{articleId}:
 *   get:
 *     summary: Get all comments for an article
 *     tags: [Engagement, Engagement - Comments]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of comments
 *
 * /comments:
 *   post:
 *     summary: Add a comment to an article
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               articleId:
 *                 type: string
 *               content:
 *                 type: string
 *     responses:
 *       201:
 *         description: Comment added
 *
 * /comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *     responses:
 *       200:
 *         description: Comment updated
 *   delete:
 *     summary: Delete a comment
 *     tags: [Engagement, Engagement - Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Comment deleted
 *
 */
