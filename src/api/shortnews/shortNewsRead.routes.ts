import { Router } from 'express';
import passport from 'passport';
import { ShortNewsReadController } from './shortNewsRead.controller';

const router = Router();
const controller = new ShortNewsReadController();

/**
 * @swagger
 * /shortnews/read/progress:
 *   post:
 *     summary: Record read progress for a ShortNews item (marks as read)
 *     tags: [Engagement - Read Tracking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shortNewsId]
 *             properties:
 *               shortNewsId:
 *                 type: string
 *                 description: ID of the ShortNews item
 *               deltaTimeMs:
 *                 type: integer
 *                 description: Milliseconds spent since last event (capped per event)
 *               maxScrollPercent:
 *                 type: number
 *                 description: Max scroll percent reached in this event (0-100)
 *               ended:
 *                 type: boolean
 *                 description: Whether this event ends a session (increments sessionsCount)
 *     responses:
 *       200:
 *         description: Read recorded
 *       404:
 *         description: ShortNews not found
 */
router.post('/progress', passport.authenticate('jwt', { session: false }), controller.recordProgress);

export default router;
