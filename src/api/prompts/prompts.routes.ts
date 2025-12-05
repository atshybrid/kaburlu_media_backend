import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();
/**
 * @swagger
 * tags:
 *   - name: Prompts
 *     description: AI / editorial prompt templates management
 */

/**
 * @swagger
 * /prompts:
 *   get:
 *     summary: List prompts
 *     description: Returns all stored prompt templates ordered by key. Restricted to NEWS_DESK_ADMIN, LANGUAGE_ADMIN, SUPERADMIN.
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key: { type: string }
 *                       content: { type: string }
 *                       description: { type: string, nullable: true }
 *       403:
 *         description: Forbidden
 */
// List prompts
router.get(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req: any, res) => {
    try {
      // Simple role gate: only NEWS_DESK_ADMIN, LANGUAGE_ADMIN, SUPERADMIN can manage prompts
      const roleName = req.user?.role?.name || '';
      if (!['NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN'].includes(roleName)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const list = await (prisma as any).prompt?.findMany?.({ orderBy: { key: 'asc' } }) || [];
      res.json({ success: true, data: list });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to fetch prompts' });
    }
  }
);

/**
 * @swagger
 * /prompts:
 *   put:
 *     summary: Upsert prompt by key
 *     description: Creates or updates a prompt template identified by unique key. Restricted to NEWS_DESK_ADMIN, LANGUAGE_ADMIN, SUPERADMIN.
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [key, content]
 *             properties:
 *               key: { type: string }
 *               content: { type: string }
 *               description: { type: string }
 *           examples:
 *             create:
 *               summary: Create new prompt
 *               value:
 *                 key: "shortnews_ai_article"
 *                 content: "Rewrite the short news into a concise article..."
 *                 description: "AI rewrite template for short news to article"
 *             update:
 *               summary: Update existing prompt
 *               value:
 *                 key: "shortnews_ai_article"
 *                 content: "Rewrite the short news as a structured article with title, intro, body, summary."
 *     responses:
 *       200:
 *         description: Upserted prompt
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
// Upsert a prompt by key
router.put(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req: any, res) => {
    try {
      const roleName = req.user?.role?.name || '';
      if (!['NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN'].includes(roleName)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const { key, content, description } = req.body || {};
      if (!key || !content) return res.status(400).json({ success: false, error: 'key and content are required' });
      const upserted = await (prisma as any).prompt?.upsert?.({
        where: { key },
        update: { content, description },
        create: { key, content, description },
      });
      res.json({ success: true, data: upserted });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to save prompt' });
    }
  }
);

export default router;
/**
 * @swagger
 * /prompts/{key}:
 *   get:
 *     summary: Get prompt by key
 *     description: Fetch a single prompt by its key. Restricted to NEWS_DESK_ADMIN, LANGUAGE_ADMIN, SUPER_ADMIN, TENANT_ADMIN.
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Prompt
 *       404:
 *         description: Not found
 *       403:
 *         description: Forbidden
 */
router.get(
  '/:key',
  passport.authenticate('jwt', { session: false }),
  async (req: any, res) => {
    try {
      const roleName = req.user?.role?.name || '';
      if (!['NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPER_ADMIN', 'TENANT_ADMIN'].includes(roleName)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const key = String(req.params.key || '');
      const item = await (prisma as any).prompt?.findUnique?.({ where: { key } });
      if (!item) return res.status(404).json({ success: false, error: 'Not found' });
      return res.json({ success: true, data: item });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to fetch prompt' });
    }
  }
);
