/**
 * @swagger
 * /articles/web/{id}/status:
 *   patch:
 *     summary: Update TenantWebArticle status
 *     description: Update only the status field of a TenantWebArticle. If set to PUBLISHED, publishedAt is set to current time; if DRAFT or PENDING, publishedAt is cleared.
 *     tags: [Articles]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           example: cuid123
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PUBLISHED, ARCHIVED, PENDING]
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

// This file intentionally contains only Swagger documentation for the status endpoint.
// The actual route implementation lives in articles.routes.ts.
