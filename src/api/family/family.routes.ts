import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { buildFamilyScopeUserIds } from './family.service';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// POST /api/v1/family/relations/link - link a relation and its inverse
router.post('/relations/link', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { relatedUserId, relationType } = req.body as { relatedUserId: string; relationType: 'PARENT'|'CHILD'|'SPOUSE'|'SIBLING' };
    if (!relatedUserId || !relationType) return res.status(400).json({ error: 'relatedUserId and relationType are required' });

    // Validate users exist
    const [u1, u2] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: relatedUserId } })
    ]);
    if (!u1 || !u2) return res.status(404).json({ error: 'User not found' });

    // Compute inverse
    const inverseMap: Record<string, 'PARENT'|'CHILD'|'SPOUSE'|'SIBLING'> = { PARENT: 'CHILD', CHILD: 'PARENT', SPOUSE: 'SPOUSE', SIBLING: 'SIBLING' };
    const inverse = inverseMap[relationType];

    const created = await prisma.$transaction(async (tx) => {
      const a = await tx.familyRelation.upsert({
        where: { userId_relatedUserId_relationType: { userId, relatedUserId, relationType } },
        update: {},
        create: { userId, relatedUserId, relationType }
      });
      const b = await tx.familyRelation.upsert({
        where: { userId_relatedUserId_relationType: { userId: relatedUserId, relatedUserId: userId, relationType: inverse } },
        update: {},
        create: { userId: relatedUserId, relatedUserId: userId, relationType: inverse }
      });
      return { a, b };
    });

    return res.json({ success: true, relation: created });
  } catch (err: any) {
    console.error('link relation error', err);
    return res.status(500).json({ error: 'Failed to link relation' });
  }
});

// GET /api/v1/family/scope/preview?direction=both&maxDepth=2
router.get('/scope/preview', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const direction = String(req.query.direction || 'both');
    const maxDepth = Math.max(1, Number(req.query.maxDepth || 2));
    const { members, truncated, depthReached } = await buildFamilyScopeUserIds({ rootUserId: userId, direction: direction as any, maxDepth, includeSelf: true, hardMemberCap: 10000 });
    return res.json({ rootUserId: userId, direction, maxDepth, estimatedCount: members.length, truncated, depthReached });
  } catch (err) {
    console.error('scope preview error', err);
    return res.status(500).json({ error: 'Failed to preview scope' });
  }
});

export default router;
