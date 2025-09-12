import { Router } from 'express';
import * as shortNewsController from './shortnews.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/shortnews:
 *   post:
 *     summary: Submit short news (citizen reporter)
 *     tags: [ShortNews]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Local Event in Hyderabad"
 *               content:
 *                 type: string
 *                 example: "A new park was inaugurated today..."
 *               mediaUrls:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["https://img.com/1.jpg", "https://img.com/2.mp4"]
 *               latitude:
 *                 type: number
 *                 example: 17.385044
 *               longitude:
 *                 type: number
 *                 example: 78.486671
 *               address:
 *                 type: string
 *                 example: "Hyderabad, Telangana"
 *     responses:
 *       201:
 *         description: Short news submitted
 *   get:
 *     summary: List all short news
 *     tags: [ShortNews]
 *     responses:
 *       200:
 *         description: List of short news
 *
 * /api/v1/shortnews/{id}/status:
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
router.post('/', shortNewsController.createShortNews);
router.get('/', shortNewsController.listShortNews);
router.patch('/:id/status', shortNewsController.updateShortNewsStatus);

export default router;
