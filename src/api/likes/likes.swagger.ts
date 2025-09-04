
/**
 * @swagger
 * components:
 *   schemas:
 *     Like:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier for a like.
 *         userId:
 *           type: string
 *           description: The ID of the user who liked the article.
 *         articleId:
 *           type: string
 *           description: The ID of the article that was liked.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the like was created.
 */

/**
 * @swagger
 * /api/likes/{articleId}:
 *   get:
 *     summary: Get all likes for a specific article
 *     tags: [Likes]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the article.
 *     responses:
 *       200:
 *         description: A list of likes for the article.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Like'
 */

/**
 * @swagger
 * /api/likes:
 *   post:
 *     summary: Add a like to an article
 *     tags: [Likes]
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
 *     responses:
 *       201:
 *         description: Like added successfully.
 *   delete:
 *     summary: Remove a like from an article
 *     tags: [Likes]
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
 *     responses:
 *       200:
 *         description: Like removed successfully.
 */
