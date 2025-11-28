import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { buildFamilyScopeUserIds } from './family.service';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// Allowed relation types
const REL_TYPES = ['PARENT','CHILD','SPOUSE','SIBLING'] as const;
type RelType = typeof REL_TYPES[number];
const inverseMap: Record<RelType, RelType> = { PARENT: 'CHILD', CHILD: 'PARENT', SPOUSE: 'SPOUSE', SIBLING: 'SIBLING' } as const;

/**
 * @swagger
 * /family/relations:
 *   get:
 *     summary: List your direct family relations
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/relations', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const rows = await (prisma as any)['familyRelation'].findMany({
      where: { userId },
      include: {
        relatedUser: { select: { id: true, mobileNumber: true, firebaseUid: true, profile: { select: { fullName: true } } } }
      },
      orderBy: [{ relationType: 'asc' }, { createdAt: 'asc' }]
    } as any);
    const items = rows.map((r: any) => ({
      relatedUserId: r.relatedUserId,
      relationType: r.relationType,
      relatedUser: {
        id: r.relatedUser.id,
        name: r.relatedUser?.profile?.fullName || null,
        mobileNumber: r.relatedUser?.mobileNumber || null,
        firebaseUid: r.relatedUser?.firebaseUid || null
      },
      createdAt: r.createdAt
    }));
    return res.json({ count: items.length, items });
  } catch (err) {
    console.error('list relations error', err);
    return res.status(500).json({ error: 'Failed to list relations' });
  }
});

// POST /family/relations/link - link a relation and its inverse
router.post('/relations/link', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { relatedUserId, relationType } = req.body as { relatedUserId: string; relationType: RelType };
    if (!relatedUserId || !relationType) return res.status(400).json({ error: 'relatedUserId and relationType are required' });
    if (!REL_TYPES.includes(relationType)) return res.status(400).json({ error: 'Invalid relationType' });

    // Validate users exist
    const [u1, u2] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.user.findUnique({ where: { id: relatedUserId } })
    ]);
    if (!u1 || !u2) return res.status(404).json({ error: 'User not found' });

    // Compute inverse
    const inverse = inverseMap[relationType];

    const created = await prisma.$transaction(async (tx) => {
      const a = await (tx as any)['familyRelation'].upsert({
        where: { userId_relatedUserId_relationType: { userId, relatedUserId, relationType } },
        update: {},
        create: { userId, relatedUserId, relationType }
      });
      const b = await (tx as any)['familyRelation'].upsert({
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

/**
 * @swagger
 * /family/relations:
 *   delete:
 *     summary: Unlink a family relation (removes both directions)
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [relatedUserId, relationType]
 *             properties:
 *               relatedUserId: { type: string }
 *               relationType: { type: string, enum: [PARENT, CHILD, SPOUSE, SIBLING] }
 *     responses:
 *       200: { description: OK }
 */
router.delete('/relations', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { relatedUserId, relationType } = req.body as { relatedUserId: string; relationType: RelType };
    if (!relatedUserId || !relationType) return res.status(400).json({ error: 'relatedUserId and relationType are required' });
    if (!REL_TYPES.includes(relationType)) return res.status(400).json({ error: 'Invalid relationType' });
    const inverse = inverseMap[relationType];
    await prisma.$transaction(async (tx) => {
      await (tx as any)['familyRelation'].deleteMany({ where: { userId, relatedUserId, relationType } });
      await (tx as any)['familyRelation'].deleteMany({ where: { userId: relatedUserId, relatedUserId: userId, relationType: inverse } });
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('unlink relation error', err);
    return res.status(500).json({ error: 'Failed to unlink relation' });
  }
});

/**
 * @swagger
 * /family/relations:
 *   patch:
 *     summary: Change a relation type (removes old + creates new, both directions)
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [relatedUserId, fromType, toType]
 *             properties:
 *               relatedUserId: { type: string }
 *               fromType: { type: string, enum: [PARENT, CHILD, SPOUSE, SIBLING] }
 *               toType: { type: string, enum: [PARENT, CHILD, SPOUSE, SIBLING] }
 *     responses:
 *       200: { description: OK }
 */
router.patch('/relations', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { relatedUserId, fromType, toType } = req.body as { relatedUserId: string; fromType: RelType; toType: RelType };
    if (!relatedUserId || !fromType || !toType) return res.status(400).json({ error: 'relatedUserId, fromType, and toType are required' });
    if (!REL_TYPES.includes(fromType) || !REL_TYPES.includes(toType)) return res.status(400).json({ error: 'Invalid relation type' });
    const fromInverse = inverseMap[fromType];
    const toInverse = inverseMap[toType];
    await prisma.$transaction(async (tx) => {
      // remove old
      await (tx as any)['familyRelation'].deleteMany({ where: { userId, relatedUserId, relationType: fromType } });
      await (tx as any)['familyRelation'].deleteMany({ where: { userId: relatedUserId, relatedUserId: userId, relationType: fromInverse } });
      // add new
      await (tx as any)['familyRelation'].upsert({
        where: { userId_relatedUserId_relationType: { userId, relatedUserId, relationType: toType } },
        update: {},
        create: { userId, relatedUserId, relationType: toType }
      });
      await (tx as any)['familyRelation'].upsert({
        where: { userId_relatedUserId_relationType: { userId: relatedUserId, relatedUserId: userId, relationType: toInverse } },
        update: {},
        create: { userId: relatedUserId, relatedUserId: userId, relationType: toInverse }
      });
    });
    return res.json({ success: true });
  } catch (err) {
    console.error('update relation error', err);
    return res.status(500).json({ error: 'Failed to update relation' });
  }
});

// GET /family/scope/preview?direction=both&maxDepth=2
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
