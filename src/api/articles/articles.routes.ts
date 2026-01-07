
import { Router } from 'express';
import passport from 'passport';
import { createArticleController, createTenantArticleController, createWebStoryController, updateArticleController, deleteArticleController } from './articles.controller';
import { composeAIArticleController, enqueueRawArticleController, composeWebOnlyController, composeBlocksController, composeSimpleArticleController, composeChatGptRewriteController, createRawArticleController, composeGeminiRewriteController, processRawArticleNowController, getArticleAiStatusController } from './articles.ai.controller';
import { getWebArticleByIdPublic, getWebArticlesByDomainPublic, listTitlesAndHeroesPublic, listPublicArticles, updateWebArticleStatus, getWebArticleBySlugPublic } from './articles.public.controller';
import { listNewspaperArticles, getNewspaperArticle, updateNewspaperArticle, createNewspaperArticle } from './newspaper.controller';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin } from '../middlewares/authz';
import { getRawArticleStatusController } from './articles.ai.controller';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Articles
 *     description: News articles (tenant web articles, raw/AI processing, newspaper articles)
 *   - name: AI Rewrite
 *     description: AI compose/rewrite endpoints for articles (requires auth)
 */

// Legacy short-news creation (citizen)
/**
 * @swagger
 * /articles:
 *   post:
 *     summary: Create an article (legacy)
 *     description: Legacy authenticated create endpoint.
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
 *               title: { type: string }
 *               content: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               languageCode: { type: string, example: 'te' }
 *               images: { type: array, items: { type: string } }
 *               isPublished: { type: boolean }
 *           examples:
 *             create:
 *               value:
 *                 title: "Road accident update"
 *                 content: "Two cars collided near main circle. Police arrived."
 *                 categoryIds: ["cmcat123"]
 *                 languageCode: "te"
 *                 images: ["https://cdn.example.com/1.webp"]
 *                 isPublished: false
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
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
router.get('/raw/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, getRawArticleStatusController);

/**
 * @swagger
 * /articles/raw/{id}:
 *   get:
 *     summary: Get raw article processing status
 *     description: Returns the current status of a raw article and any generated output IDs.
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: RawArticle ID returned by POST /articles/raw
 *     responses:
 *       200:
 *         description: Status fetched
 *         content:
 *           application/json:
 *             example:
 *               id: "cmixaid2c0000ugo86hnbgrah"
 *               status: "NEW"
 *               errorCode: null
 *               outputs:
 *                 webArticleId: "cmixbweb0001ug..."
 *                 shortNewsId: "cmixbsn0002ug..."
 *                 newspaperArticleId: "cmixbnp0003ug..."
 *       404:
 *         description: Not Found
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
/**
 * @swagger
 * /articles/ai/web:
 *   post:
 *     deprecated: true
 *     summary: DEPRECATED - use POST /articles/ai/blocks
 *     tags: [Articles]
 */
router.post('/ai/web', (_req, res) => {
	return res.status(410).json({ error: 'Deprecated. Use POST /articles/ai/blocks' });
});

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
/**
 * Note: This is the final POST API for website articles. SUPER_ADMIN and tenant-scoped reporter/admin tokens are allowed.
 */
router.post('/ai/blocks', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeBlocksController);

/**
 * @swagger
 * /articles/ai/chatgpt/rewrite:
 *   post:
 *     summary: Rewrite via ChatGPT (long SEO article + short news)
 *     description: Stores raw in Article, calls ChatGPT with rewrite prompt, saves TenantWebArticle and ShortNews.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domainName, categoryIds, languageCode, reporterId, rawContent]
 *             properties:
 *               tenantId: { type: string }
 *               domainName: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               languageCode: { type: string }
 *               coverImageUrl: { type: string }
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type: { type: string, enum: [image, video] }
 *                     url: { type: string }
 *               reporterId: { type: string }
 *               rawContent: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/ai/chatgpt/rewrite', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeChatGptRewriteController);
/**
 * @swagger
 * /articles/ai/gemini/rewrite:
 *   post:
 *     summary: Rewrite via Gemini (long SEO article + short news)
 *     description: Stores raw in Article, calls Gemini with rewrite prompt, saves TenantWebArticle and ShortNews.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domainName, categoryIds, languageCode, reporterId, rawContent]
 *             properties:
 *               tenantId: { type: string }
 *               domainName: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               languageCode: { type: string }
 *               coverImageUrl: { type: string }
 *               media:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type: { type: string, enum: [image, video] }
 *                     url: { type: string }
 *               reporterId: { type: string }
 *               rawContent: { type: string }
 *     responses:
 *       201:
 *         description: Created
 */
router.post('/ai/gemini/rewrite', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, composeGeminiRewriteController);

/**
 * @swagger
 * /articles/raw:
 *   post:
 *     summary: Store a raw article for later AI processing
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [domainId, reporterId, languageCode, content]
 *             properties:
 *               tenantId: { type: string }
 *               domainId: { type: string }
 *               reporterId: { type: string }
 *               languageCode: { type: string }
 *               title: { type: string }
 *               content: { type: string }
 *               categoryIds: { type: array, items: { type: string } }
 *               coverImageUrl: { type: string }
 *               media: { type: array, items: { type: object } }
 *     responses:
 *       201:
 *         description: Raw stored
 */
router.post('/raw', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createRawArticleController);

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
/**
 * @swagger
 * /articles/ai/simple:
 *   post:
 *     deprecated: true
 *     summary: DEPRECATED - use POST /articles/ai/blocks
 *     tags: [Articles]
 */
router.post('/ai/simple', (_req, res) => {
	return res.status(410).json({ error: 'Deprecated. Use POST /articles/ai/blocks' });
});

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
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *         description: Preferred. Domain name to scope articles (e.g., example.com)
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
 * /articles/public/articles/{slug}:
 *   get:
 *     summary: Get public article by slug (scoped by domain header)
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *         description: Preferred. Domain name to scope articles (e.g., example.com)
 *       - in: query
 *         name: domainName
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Article
 */
router.get('/public/articles/:slug', getWebArticleBySlugPublic);

/**
 * @swagger
 * /articles/public/web/slug/{slug}:
 *   get:
 *     summary: Get public article by slug (scoped by domain header)
 *     tags: [Articles]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *         description: Preferred. Domain name to scope articles (e.g., example.com)
 *       - in: query
 *         name: domainName
 *         required: false
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Article
 */
router.get('/public/web/slug/:slug', getWebArticleBySlugPublic);

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
 *       - in: header
 *         name: X-Tenant-Domain
 *         required: false
 *         schema: { type: string }
 *         description: Preferred. Domain name to scope articles (e.g., example.com)
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
 * /articles/newspaper:
 *   get:
 *     summary: List newspaper articles (Print Desk)
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: date
 *         schema: { type: string, format: date }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: stateId
 *         schema: { type: string }
 *         description: Optional filter by state id
 *       - in: query
 *         name: districtId
 *         schema: { type: string }
 *         description: Optional filter by district id
 *       - in: query
 *         name: mandalId
 *         schema: { type: string }
 *         description: Optional filter by mandal id
 *       - in: query
 *         name: villageId
 *         schema: { type: string }
 *         description: Optional filter by village id
 *       - in: query
 *         name: limit
 *         schema: { type: integer, example: 50 }
 *         description: Max items to return
 *       - in: query
 *         name: offset
 *         schema: { type: integer, example: 0 }
 *         description: Pagination offset
 *     responses:
 *       200:
 *         description: List
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total: { type: integer }
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       tenantId: { type: string }
 *                       authorId: { type: string }
 *                       baseArticleId: { type: string, nullable: true }
 *                       categoryId: { type: string, nullable: true }
 *                       languageId: { type: string, nullable: true }
 *                       title: { type: string }
 *                       subTitle: { type: string, nullable: true }
 *                       lead: { type: string, nullable: true }
 *                       heading: { type: string }
 *                       points: { type: array, items: { type: string } }
 *                       dateline: { type: string }
 *                       placeName: { type: string, nullable: true }
 *                       content: { type: string }
 *                       status: { type: string }
 *                       createdAt: { type: string }
 *                       updatedAt: { type: string }
 *                       viewCount:
 *                         type: integer
 *                         nullable: true
 *                         description: Base Article view count (Article.viewCount)
 *                       sportLink: { type: string, nullable: true }
 *                       sportLinkDomain: { type: string, nullable: true }
 *                       sportLinkSlug: { type: string, nullable: true }
 *                       webArticleId: { type: string, nullable: true }
 *                       webArticleStatus: { type: string, nullable: true }
 *                       webArticleUrl: { type: string, nullable: true }
 *                       webArticleViewCount: { type: integer, nullable: true }
 *                       webArticle:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           id: { type: string }
 *                           slug: { type: string, nullable: true }
 *                           status: { type: string, nullable: true }
 *                           url: { type: string, nullable: true }
 *                           languageCode: { type: string, nullable: true }
 *                           title: { type: string, nullable: true }
 *                           viewCount: { type: integer, nullable: true }
 *                           publishedAt: { type: string, nullable: true }
 *             example:
 *               total: 1
 *               items:
 *                 - id: "cmxxxx"
 *                   tenantId: "cmtenant"
 *                   authorId: "cmuser"
 *                   baseArticleId: "cmarticle"
 *                   categoryId: "cmcat"
 *                   title: "Budget Highlights"
 *                   subTitle: "Key takeaways"
 *                   lead: "Today the finance minister announced..."
 *                   heading: "Budget Highlights"
 *                   points: ["Point one", "Point two"]
 *                   dateline: "Hyderabad, Dec 21, 2025"
 *                   placeName: "Hyderabad"
 *                   status: "PUBLISHED"
 *                   createdAt: "2025-12-21T10:00:00.000Z"
 *                   updatedAt: "2025-12-21T10:00:00.000Z"
 *                   viewCount: 145
 *                   webArticle:
 *                     id: "cmweb"
 *                     slug: "budget-highlights"
 *                     status: "PUBLISHED"
 *                     url: "https://example.com/te/articles/budget-highlights"
 *                     languageCode: "te"
 *                     title: "Budget Highlights"
 *                     viewCount: 987
 *                     publishedAt: "2025-12-21T10:05:00.000Z"
 *                   webArticleId: "cmweb"
 *                   webArticleStatus: "PUBLISHED"
 *                   webArticleUrl: "https://example.com/te/articles/budget-highlights"
 *                   webArticleViewCount: 987
 *                   sportLink: "https://example.com/te/articles/budget-highlights"
 *                   sportLinkDomain: "example.com"
 *                   sportLinkSlug: "budget-highlights"
 */
router.get('/newspaper', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, listNewspaperArticles);

/**
 * @swagger
 * /articles/newspaper:
 *   post:
 *     summary: Create newspaper article (Tenant Reporter)
 *     description: |
 *       Stores a print-ready NewspaperArticle linked to a base Article, and queues AI processing.
 *
 *       Location best-practice:
 *       - Provide any ONE id in `location`: `villageId` OR `mandalId` OR `districtId` OR `stateId`
 *       - Server derives the rest of the hierarchy and stores it on NewspaperArticle for easy filtering.
 *
 *       AI behavior is controlled only by tenant feature flag `TenantFeatureFlags.aiArticleRewriteEnabled`:
 *       - When enabled (default): `aiMode=FULL` and the worker generates Newspaper + Web + ShortNews using prompt key `ai_rewrite_prompt_true`.
 *       - When disabled: `aiMode=LIMITED` and the worker generates SEO + ShortNews using prompt key `ai_rewrite_prompt_false` (no newspaper rewrite).
 *
 *       SUPER_ADMIN testing override (does not persist):
 *       - Add query `forceAiRewriteEnabled=true` to force FULL (SUPER_ADMIN only)
 *       - Add query `forceAiRewriteEnabled=false` to force LIMITED (allowed for Reporter/Admin too)
 *
 *       This endpoint always returns `202 Accepted` after storing the records.
 *
 *       Publishing rule (best practice):
 *       - For role REPORTER, `status` from request is ignored. Server auto-derives status using Reporter.kycData.autoPublish.
 *       - Tenant Admin/Editor/Superadmin can publish later via PATCH /articles/newspaper/{id}.
 *     tags: [Articles, AI Rewrite]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: forceAiRewriteEnabled
 *         required: false
 *         schema: { type: boolean }
 *         description: "Forces aiMode for this request without changing tenant subscription. Safety: true is SUPER_ADMIN only; false allowed for Reporter/Admin."
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, categoryId, location]
 *             example:
 *               languageCode: "te"
 *               categoryId: "cmcat123"
 *               title: "Budget Highlights"
 *               subTitle: "Key takeaways"
 *               lead: "Today the finance minister announced..."
 *               media:
 *                 images:
 *                   - url: "https://cdn.example.com/cover.webp"
 *                     caption: "Cover"
 *                 videos:
 *                   - url: "https://cdn.example.com/clip.mp4"
 *                     caption: "现场 clip"
 *               content:
 *                 - type: "paragraph"
 *                   text: "Paragraph 1..."
 *                 - type: "paragraph"
 *                   text: "Paragraph 2..."
 *               bulletPoints: ["Point one", "Point two"]
 *               location:
 *                 districtId: "cmdistrict"
 *
 *             properties:
 *               language:
 *                 type: string
 *                 example: 'te'
 *                 description: Language code (alias of languageCode)
 *               languageCode:
 *                 type: string
 *                 example: 'te'
 *                 description: Language code
 *               domainId:
 *                 type: string
 *                 description: Optional domain scope for TenantWebArticle (recommended for public slug API). If omitted, server will pick tenant primary/active domain.
 *               categoryId:
 *                 type: string
 *                 description: Mandatory category id (preferred). Server links base Article + NewspaperArticle + TenantWebArticle to this category.
 *               category: { type: string }
 *               title: { type: string, maxLength: 100 }
 *               subTitle: { type: string, maxLength: 100 }
 *               heading: { type: string }
 *               dateLine: { type: string }
 *               dateline: { type: string }
 *               newspaperName:
 *                 type: string
 *                 description: Optional newspaper display name used inside dateline parentheses (defaults to TenantEntity.registrationTitle or tenant.name)
 *               publishedAt: { type: string }
 *               lead: { type: string }
 *               content:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     type: { type: string, example: 'paragraph' }
 *                     text: { type: string }
 *               bulletPoints:
 *                 type: array
 *                 maxItems: 5
 *                 items: { type: string, maxLength: 100, description: 'Each item max 100 characters' }
 *
 *               # Media / hero image (optional)
 *               # Any of these can be provided; server will normalize into:
 *               # - Article.images (images only)
 *               # - Article.contentJson.raw.images (images)
 *               # - Article.contentJson.raw.videos (videos)
 *               coverImageUrl:
 *                 type: string
 *                 description: Primary hero image URL
 *                 example: "https://cdn.example.com/cover.webp"
 *               images:
 *                 type: array
 *                 description: Image URLs (first becomes hero if coverImageUrl not provided)
 *                 items: { type: string }
 *               videos:
 *                 type: array
 *                 description: Video URLs
 *                 items: { type: string }
 *               mediaUrls:
 *                 type: array
 *                 description: Image/video URLs
 *                 items: { type: string }
 *               location:
 *                 type: object
 *                 description: |
 *                   Location reference used for dateline and filtering.
 *                   Rule: Provide any ONE id in location: villageId OR mandalId OR districtId OR stateId.
 *                   - If you provide villageId and the Village exists in DB, server derives mandalId/districtId/stateId.
 *                   - If you provide mandalId, server derives districtId/stateId.
 *                   - If you provide districtId, server derives stateId.
 *                 oneOf:
 *                   - required: [villageId]
 *                   - required: [mandalId]
 *                   - required: [districtId]
 *                   - required: [stateId]
 *                 properties:
 *                   villageId: { type: string, nullable: true }
 *                   villageName: { type: string, nullable: true }
 *                   mandalId: { type: string, nullable: true }
 *                   mandalName: { type: string, nullable: true }
 *                   districtId: { type: string, nullable: true }
 *                   districtName: { type: string, nullable: true }
 *                   stateId: { type: string, nullable: true }
 *                   stateName: { type: string, nullable: true }
 *                   city: { type: string, nullable: true }
 *               media:
 *                 type: object
 *                 description: Structured media list (alternative to images/mediaUrls)
 *                 properties:
 *                   images:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         url: { type: string }
 *                         alt: { type: string, nullable: true }
 *                         caption: { type: string, nullable: true }
 *                   videos:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         url: { type: string }
 *                         caption: { type: string, nullable: true }
 *               seo:
 *                 type: object
 *                 properties:
 *                   metaTitle: { type: string }
 *                   metaDescription: { type: string }
 *               tags: { type: array, items: { type: string } }
 *
 *               # NOTE: `status` is server-controlled and not accepted in payload.
 *               # - REPORTER: autoPublish=true => PUBLISHED, else => PENDING
 *               # - All other roles: PUBLISHED
 *
 *           examples:
 *             modern:
 *               summary: Recommended (structured media)
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "Budget Highlights"
 *                 subTitle: "Key takeaways"
 *                 lead: "Today the finance minister announced..."
 *                 media:
 *                   images:
 *                     - url: "https://cdn.example.com/cover.webp"
 *                       caption: "Cover"
 *                   videos:
 *                     - url: "https://cdn.example.com/clip.mp4"
 *                       caption: "现场 clip"
 *                 content:
 *                   - type: "paragraph"
 *                     text: "Paragraph 1..."
 *                   - type: "paragraph"
 *                     text: "Paragraph 2..."
 *                 bulletPoints: ["Point one", "Point two"]
 *                 location:
 *                   districtId: "cmdistrict"
 *                   districtName: "Hyderabad"
 *                   stateName: "Telangana"
 *             locationVillage:
 *               summary: Location using villageId (most specific)
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "Village level news"
 *                 lead: "Village event details..."
 *                 location:
 *                   villageId: "cmvillage"
 *             locationMandal:
 *               summary: Location using mandalId
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "Mandal level news"
 *                 lead: "Mandal event details..."
 *                 location:
 *                   mandalId: "cmmandal"
 *             locationDistrict:
 *               summary: Location using districtId
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "District level news"
 *                 lead: "District event details..."
 *                 location:
 *                   districtId: "cmdistrict"
 *             locationState:
 *               summary: Location using stateId
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "State level news"
 *                 lead: "State event details..."
 *                 location:
 *                   stateId: "cmstate"
 *             legacy:
 *               summary: Legacy (coverImageUrl/images/mediaUrls)
 *               value:
 *                 languageCode: "te"
 *                 categoryId: "cmcat123"
 *                 title: "Budget Highlights"
 *                 subTitle: "Key takeaways"
 *                 lead: "Today the finance minister announced..."
 *                 coverImageUrl: "https://cdn.example.com/cover.webp"
 *                 images: ["https://cdn.example.com/cover.webp"]
 *                 mediaUrls: ["https://cdn.example.com/clip.mp4"]
 *                 content:
 *                   - type: "paragraph"
 *                     text: "Paragraph 1..."
 *                 bulletPoints: ["Point one", "Point two"]
 *     responses:
 *       202:
 *         description: Accepted (stored and queued for background AI processing)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "Newspaper article stored; FULL AI rewrite queued"
 *               externalArticleId: "ART202512210001"
 *               articleId: "cmarticle"
 *               baseArticleId: "cmarticle"
 *               newspaperArticleId: "cmnp"
 *               tenantAiRewriteEnabled: true
 *               aiMode: "FULL"
 *               statusUrl: "/articles/cmarticle/ai-status"
 *       400:
 *         description: Validation error (e.g., title missing, title>50, subTitle>50, bulletPoints invalid)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.post('/newspaper', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, createNewspaperArticle);

/**
 * @swagger
 * /articles/newspaper/{id}:
 *   get:
 *     summary: Get single newspaper article
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: Details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string }
 *                 tenantId: { type: string }
 *                 authorId: { type: string }
 *                 baseArticleId: { type: string, nullable: true }
 *                 categoryId: { type: string, nullable: true }
 *                 languageId: { type: string, nullable: true }
 *                 title: { type: string }
 *                 subTitle: { type: string, nullable: true }
 *                 lead: { type: string, nullable: true }
 *                 heading: { type: string }
 *                 points: { type: array, items: { type: string } }
 *                 dateline: { type: string }
 *                 placeName: { type: string, nullable: true }
 *                 content: { type: string }
 *                 status: { type: string }
 *                 createdAt: { type: string }
 *                 updatedAt: { type: string }
 *                 viewCount: { type: integer, nullable: true }
 *                 sportLink: { type: string, nullable: true }
 *                 sportLinkDomain: { type: string, nullable: true }
 *                 sportLinkSlug: { type: string, nullable: true }
 *                 webArticle: { type: object, nullable: true }
 *                 webArticleId: { type: string, nullable: true }
 *                 webArticleStatus: { type: string, nullable: true }
 *                 webArticleUrl: { type: string, nullable: true }
 *                 webArticleViewCount: { type: integer, nullable: true }
 */
router.get('/newspaper/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, getNewspaperArticle);

/**
 * @swagger
 * /articles/newspaper/{id}:
 *   patch:
 *     summary: Update newspaper article (Print Desk)
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               heading: { type: string }
 *               subTitle: { type: string, nullable: true }
 *               lead: { type: string, nullable: true }
 *               points: { type: array, items: { type: string } }
 *               status: { type: string }
 *               content: { type: string }
 *               dateline: { type: string }
 *     responses:
 *       200: { description: Updated }
 */
router.patch('/newspaper/:id', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, updateNewspaperArticle);

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
 * /articles/queue/pending:
 *   get:
 *     summary: List pending AI jobs (Articles and RawArticles)
 *     description: Returns items that are waiting for or currently in AI processing.
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending items
 *         content:
 *           application/json:
 *             example:
 *               articles:
 *                 - id: "cmijx123abc"
 *                   aiStatus: "PENDING"
 *                   aiQueue: { web: true, short: false, newspaper: false }
 *               rawArticles:
 *                 - id: "cmixaid2c0000ugo86hnbgrah"
 *                   status: "NEW"
 */
router.get('/queue/pending', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (_req, res) => {
	try {
		const articles = await prisma.article.findMany({
			where: {
				OR: [
					{ contentJson: { path: ['aiStatus'], equals: 'PENDING' } },
					{ contentJson: { path: ['aiStatus'], equals: 'PROCESSING' } },
				]
			},
			select: { id: true, contentJson: true, createdAt: true }
		});
		const rawArticles = await (prisma as any).rawArticle.findMany({
			where: { status: { in: ['NEW', 'PROCESSING'] } },
			select: { id: true, status: true, createdAt: true }
		});
		return res.json({
			articles: articles.map(a => ({ id: a.id, aiStatus: (a as any).contentJson?.aiStatus, aiQueue: (a as any).contentJson?.aiQueue, createdAt: a.createdAt })),
			rawArticles
		});
	} catch (e) {
		console.error('GET /articles/queue/pending error', e);
		return res.status(500).json({ error: 'Failed to list pending items' });
	}
});

/**
 * @swagger
 * /articles/raw/{id}/process:
 *   post:
 *     summary: Process a raw article immediately (fast rewrite)
 *     description: Triggers rewrite using Gemini (flash), creates TenantWebArticle and ShortNews, and updates raw outputs.
 *     tags: [Articles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: RawArticle ID
 *     responses:
 *       201:
 *         description: Processed
 *         content:
 *           application/json:
 *             example:
 *               id: "cmixaid2c0000ugo86hnbgrah"
 *               status: "DONE"
 *               outputs:
 *                 webArticleId: "cmixbweb0001ug..."
 *                 shortNewsId: "cmixbsn0002ug..."
 */
router.post('/raw/:id/process', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, processRawArticleNowController);

/**
 * @swagger
 * /articles/{id}/ai-status:
 *   get:
 *     summary: Get AI rewrite queue status for an article
 *     description: Returns current Postgres-queue status (aiMode/aiStatus), queued flags, and generated output IDs.
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
 *         description: Status
 *         content:
 *           application/json:
 *             example:
 *               articleId: "cmarticle"
 *               tenantId: "cmtenant"
 *               status: "PUBLISHED"
 *               ai:
 *                 aiStatus: "DONE"
 *                 aiMode: "FULL"
 *                 aiStartedAt: "2026-01-06T10:12:00.000Z"
 *                 aiFinishedAt: "2026-01-06T10:12:18.000Z"
 *                 aiError: null
 *                 aiSkipReason: null
 *                 queue:
 *                   web: false
 *                   short: false
 *                   newspaper: false
 *                 outputs:
 *                   webArticleId: "cmweb"
 *                   shortNewsId: "cmsn"
 *                   newspaperArticleId: "cmnp"
 *               externalArticleId: "ART202601060001"
 *               rawArticleId: "cmraw"
 *               updatedAt: "2026-01-06T10:12:18.000Z"
 *               createdAt: "2026-01-06T10:12:00.000Z"
 */
router.get('/:id/ai-status', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, getArticleAiStatusController);

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
