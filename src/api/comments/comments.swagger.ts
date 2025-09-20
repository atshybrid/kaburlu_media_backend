
/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         content:
 *           type: string
 *         userId:
 *           type: string
 *         articleId:
 *           type: string
 *           nullable: true
 *         shortNewsId:
 *           type: string
 *           nullable: true
 *         parentId:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *     CreateComment:
 *       type: object
 *       required: [content, userId]
 *       properties:
 *         content: { type: string }
 *         userId: { type: string }
 *         articleId: { type: string, nullable: true }
 *         shortNewsId: { type: string, nullable: true }
 *         parentId: { type: string, nullable: true }
 *     UpdateComment:
 *       type: object
 *       properties:
 *         content: { type: string }
 */
