
/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier for a comment.
 *         content:
 *           type: string
 *           description: The content of the comment.
 *         userId:
 *           type: string
 *           description: The ID of the user who made the comment.
 *         articleId:
 *           type: string
 *           description: The ID of the article the comment belongs to.
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The ID of the parent comment if it is a reply.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the comment was created.
 *     CreateComment:
 *        type: object
 *        required:
 *          - content
 *          - userId
 *          - articleId
 *        properties:
 *          content:
 *            type: string
 *          userId:
 *            type: string
 *          articleId:
 *            type: string
 *          parentId:
 *            type: string
 *            nullable: true
 *     UpdateComment:
 *       type: object
 *       properties:
 *         content:
 *           type: string
 */

/**
 * @swagger
 * /api/comments/article/{articleId}:
 *   get:
 *     summary: Get all comments for a specific article
 *     tags: [Comments]
 *     parameters:
 *       - in: path
 *         name: articleId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the article.
 *     responses:
 *       200:
 *         description: A list of comments for the article.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 */

/**
 * @swagger
 * /api/comments:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateComment'
 *     responses:
 *       210:
 *         description: Comment created successfully.
 */

/**
 * @swagger
 * /api/comments/{id}:
 *   put:
 *     summary: Update a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the comment to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateComment'
 *     responses:
 *       200:
 *         description: Comment updated successfully.
 *   delete:
 *     summary: Delete a comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the comment to delete.
 *     responses:
 *       200:
 *         description: Comment deleted successfully.
 */
