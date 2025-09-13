import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

// List prompts
router.get(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req: any, res) => {
    try {
      // Simple role gate: only NEWS_DESK_ADMIN, LANGUAGE_ADMIN, SUPERADMIN can manage prompts
      const roleName = req.user?.role?.name || '';
      if (!['NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPERADMIN'].includes(roleName)) {
        return res.status(403).json({ success: false, error: 'Forbidden' });
      }
      const list = await (prisma as any).prompt?.findMany?.({ orderBy: { key: 'asc' } }) || [];
      res.json({ success: true, data: list });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Failed to fetch prompts' });
    }
  }
);

// Upsert a prompt by key
router.put(
  '/',
  passport.authenticate('jwt', { session: false }),
  async (req: any, res) => {
    try {
      const roleName = req.user?.role?.name || '';
      if (!['NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPERADMIN'].includes(roleName)) {
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
