import { Router } from 'express';
import passport from 'passport';
import * as shortNewsController from './shortnews.controller';

const router = Router();

/**
 * @swagger
 * /shortnews:
 *   post:
 *     summary: Submit short news (citizen reporter)
 *     tags: [ShortNews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - content
 *               - categoryId
 *               - latitude
 *               - longitude
 *             properties:
 *               title:
 *                 type: string
 *                 description: Required. The server will auto-generate the slug from this title.
 *                 example: "Local Event in Hyderabad"
 *               content:
 *                 type: string
 *                 example: "A new park was inaugurated today..."
 *               categoryId:
 *                 type: string
 *                 description: Required. Category to file this short news under.
 *                 example: "clx123abc456def"
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://img.com/1.jpg", "https://img.com/2.mp4"]
 *               latitude:
 *                 type: number
 *                 example: 17.385044
 *                 description: Required. Latitude between -90 and 90.
 *               longitude:
 *                 type: number
 *                 example: 78.486671
 *                 description: Required. Longitude between -180 and 180.
 *               address:
 *                 type: string
 *                 example: "Hyderabad, Telangana"
 *               accuracyMeters:
 *                 type: number
 *                 example: 12.5
 *               provider:
 *                 type: string
 *                 example: fused
 *                 description: "fused|gps|network"
 *               timestampUtc:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-09-14T12:30:45Z"
 *               placeId:
 *                 type: string
 *                 example: "ChIJ...abc"
 *               placeName:
 *                 type: string
 *                 example: "Hyderabad"
 *               source:
 *                 type: string
 *                 example: foreground
 *                 description: "foreground|background|manual"
 *     responses:
 *       201:
 *         description: Short news submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     slug:
 *                       type: string
 *                     transliteratedSlug:
 *                       type: string
 *                       description: ASCII transliteration of slug for URL usage
 *                     status:
 *                       type: string
 *                       description: Initial moderation status (AI_APPROVED, DESK_PENDING, or REJECTED)
 *                     languageId:
 *                       type: string
 *                     languageName:
 *                       type: string
 *                     languageCode:
 *                       type: string
 *                     canonicalUrl:
 *                       type: string
 *                     seo:
 *                       type: object
 *                       properties:
 *                         metaTitle:
 *                           type: string
 *                         metaDescription:
 *                           type: string
 *                         tags:
 *                           type: array
 *                           items:
 *                             type: string
 *                         altTexts:
 *                           type: object
 *                           additionalProperties:
 *                             type: string
 *                           description: Map of image URL to generated alt text (in the same language)
 *                         jsonLd:
 *                           type: object
 *                           description: Structured data for embedding
 *                     languageInfo:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         code:
 *                           type: string
 *                         name:
 *                           type: string
 *                         nativeName:
 *                           type: string
 *   get:
 *     summary: List short news (cursor-based)
 *     tags: [ShortNews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of items to return
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           example: eyJpZCI6IjEyMyIsImRhdGUiOiIyMDI1LTA5LTEzVDA3OjAwOjAwLjAwMFoifQ==
 *         description: Base64-encoded JSON { id, date } to get next items after this cursor
 *     responses:
 *       200:
 *         description: List of short news with pageInfo { nextCursor, hasMore }.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 pageInfo:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     nextCursor:
 *                       type: string
 *                     hasMore:
 *                       type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id: { type: string }
 *                       title: { type: string }
 *                       slug: { type: string }
 *                       mediaUrls:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: "Image/Video URLs (image: .webp, video: .webm preferred)"
 *                       languageId: { type: string, nullable: true }
 *                       languageName: { type: string, nullable: true }
 *                       languageCode: { type: string, nullable: true }
 *                       categoryId: { type: string }
 *                       categoryName: { type: string, nullable: true }
 *                       authorId: { type: string }
 *                       authorName: { type: string, nullable: true, description: "Currently email or mobile number" }
 *                       placeName: { type: string, nullable: true }
 *                       address: { type: string, nullable: true }
 *                       latitude: { type: number, nullable: true }
 *                       longitude: { type: number, nullable: true }
 *                       accuracyMeters: { type: number, nullable: true }
 *                       provider: { type: string, nullable: true }
 *                       timestampUtc: { type: string, format: date-time, nullable: true }
 *                       placeId: { type: string, nullable: true }
 *                       source: { type: string, nullable: true }
 *
 * /shortnews/{id}/status:
 *   patch:
 *     summary: Update status (AI/desk approval)
 *     tags: [ShortNews]
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
 *               status:
 *                 type: string
 *                 enum: [AI_APPROVED, DESK_PENDING, DESK_APPROVED, REJECTED]
 *                 example: "DESK_PENDING"
 *               aiRemark:
 *                 type: string
 *                 example: "Plagiarism detected"
 *     responses:
 *       200:
 *         description: Status updated
 */
router.post('/', passport.authenticate('jwt', { session: false }), shortNewsController.createShortNews);
router.get('/', passport.authenticate('jwt', { session: false }), shortNewsController.listShortNews);

// Role guard utility for privileged reads
function requireDeskOrAdmin(req: any, res: any, next: any) {
	const roleName = (req.user?.role?.name || '').toUpperCase();
	const allowed = new Set(['SUPERADMIN', 'SUPER_ADMIN', 'LANGUAGE_ADMIN', 'NEWS_DESK', 'NEWS_DESK_ADMIN']);
	if (allowed.has(roleName)) return next();
	return res.status(403).json({ error: 'Forbidden: desk/admin access only' });
}

/**
 * @swagger
 * /shortnews/all:
 *   get:
 *     summary: List all short news (admin/desk)
 *     description: Returns all short news across categories and statuses. Optional filters by languageId, status, and categoryId.
 *     tags: [ShortNews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: languageId
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, AI_APPROVED, DESK_PENDING, DESK_APPROVED, REJECTED]
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *           example: eyJpZCI6IjEyMyIsImRhdGUiOiIyMDI1LTA5LTEzVDA3OjAwOjAwLjAwMFoifQ==
 *         description: Base64-encoded JSON { id, date }
 *     responses:
 *       200:
 *         description: List of short news (admin/desk) with pagination.
 */
router.get('/all', passport.authenticate('jwt', { session: false }), requireDeskOrAdmin, shortNewsController.listAllShortNews);
/**
 * @swagger
 * /shortnews/{id}:
 *   put:
 *     summary: Update short news (author or desk/admin)
 *     tags: [ShortNews]
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
 *               title: { type: string }
 *               content: { type: string, description: "Must be 60 words or less" }
 *               categoryId: { type: string }
 *               tags:
 *                 type: array
 *                 items: { type: string }
 *               mediaUrls:
 *                 type: array
 *                 items: { type: string }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               address: { type: string }
 *               accuracyMeters: { type: number }
 *               provider: { type: string }
 *               timestampUtc: { type: string, format: date-time }
 *               placeId: { type: string }
 *               placeName: { type: string }
 *               source: { type: string }
 *     responses:
 *       200:
 *         description: Updated short news item
 */
router.put('/:id', passport.authenticate('jwt', { session: false }), shortNewsController.updateShortNews);
router.patch('/:id/status', shortNewsController.updateShortNewsStatus);

/**
 * @swagger
 * /shortnews/{id}/jsonld:
 *   get:
 *     summary: Get JSON-LD for a ShortNews item
 *     tags: [ShortNews]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: JSON-LD object for embedding in pages
 */
router.get('/:id/jsonld', shortNewsController.getShortNewsJsonLd);

/**
 * @swagger
 * /shortnews/public:
 *   get:
 *     summary: Public feed - approved only (AI_APPROVED and DESK_APPROVED)
 *     tags: [ShortNews]
 *     parameters:
 *       - in: query
 *         name: languageId
 *         required: false
 *         schema:
 *           type: string
 *         description: Optional language ID filter. If provided, only items in this language are returned.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Base64-encoded JSON { id, date }
 *       - in: query
 *         name: latitude
 *         required: false
 *         schema:
 *           type: number
 *           format: float
 *         description: Optional latitude. If both latitude and longitude are provided, results are filtered to within ~30 km radius.
 *       - in: query
 *         name: longitude
 *         required: false
 *         schema:
 *           type: number
 *           format: float
 *         description: Optional longitude. If both latitude and longitude are provided, results are filtered to within ~30 km radius.
 *     responses:
 *       200:
 *         description: Approved short news list enriched with categoryName, authorName, place/address, lat/lon, canonicalUrl, jsonLd, and primary media
 */
router.get('/public', shortNewsController.listApprovedShortNews);

/**
 * @swagger
 * /shortnews/moderation:
 *   get:
 *     summary: Moderation queue/status-wise listing
 *     tags: [ShortNews]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, AI_APPROVED, DESK_PENDING, DESK_APPROVED, REJECTED]
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Base64-encoded JSON { id, date }
 *     responses:
 *       200:
 *         description: Items by status for current user/desk enriched with categoryName, authorName, place/address, lat/lon
 */
router.get('/moderation', passport.authenticate('jwt', { session: false }), shortNewsController.listShortNewsByStatus);

export default router;
