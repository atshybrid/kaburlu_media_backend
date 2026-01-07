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

/**
 * @swagger
 * /family/create:
 *   post:
 *     summary: Create or get your family tree for a given side
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [side]
 *             properties:
 *               side: { type: string, enum: [FATHER, MOTHER, SPOUSE] }
 *               surnameId: { type: string }
 *               villageId: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/create', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const side = String(req.body?.side || '').toUpperCase();
    if (!['FATHER', 'MOTHER', 'SPOUSE'].includes(side)) return res.status(400).json({ error: 'Invalid side' });

    const surnameId = req.body?.surnameId ? String(req.body.surnameId) : undefined;
    const villageId = req.body?.villageId ? String(req.body.villageId) : undefined;
    const userName = String(req.user?.profile?.fullName || '').trim() || 'Me';

    const result = await prisma.$transaction(async (tx) => {
      const existing = await (tx as any)['familyTree'].findUnique({
        where: { createdByUserId_side: { createdByUserId: userId, side } },
        include: { members: { orderBy: { createdAt: 'asc' } } },
      });
      if (existing) return { family: existing, created: false };

      const family = await (tx as any)['familyTree'].create({
        data: {
          createdByUserId: userId,
          side,
          ...(surnameId ? { surnameId } : {}),
          ...(villageId ? { villageId } : {}),
        },
      });

      const root = await (tx as any)['familyTreeMember'].create({
        data: {
          familyTreeId: family.id,
          userId,
          fullName: userName,
          isPlaceholder: false,
          isVerified: true,
        },
      });

      const updatedFamily = await (tx as any)['familyTree'].update({
        where: { id: family.id },
        data: {
          rootMemberId: root.id,
          groupName: `${root.fullName} Family`,
        },
        include: { members: { orderBy: { createdAt: 'asc' } } },
      });

      return { family: updatedFamily, created: true };
    });

    return res.json({ ...result });
  } catch (err: any) {
    console.error('family create error', err);
    return res.status(500).json({ error: 'Failed to create family' });
  }
});

/**
 * @swagger
 * /family/member/add:
 *   post:
 *     summary: Add a member (supports placeholder parent creation and root move-up when attaching a parent to root)
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyId, fullName]
 *             properties:
 *               familyId: { type: string }
 *               fullName: { type: string }
 *               kinRelationId: { type: string }
 *               parentMemberId: { type: string }
 *               parentName: { type: string }
 *               childMemberId: { type: string, description: "If provided, new member will be attached as PARENT of this child (root can move up)." }
 *     responses:
 *       200: { description: OK }
 */
router.post('/member/add', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const familyId = String(req.body?.familyId || '').trim();
    const fullName = String(req.body?.fullName || '').trim();
    if (!familyId || !fullName) return res.status(400).json({ error: 'familyId and fullName are required' });

    const kinRelationId = req.body?.kinRelationId ? String(req.body.kinRelationId) : undefined;
    const parentMemberId = req.body?.parentMemberId ? String(req.body.parentMemberId) : undefined;
    const parentName = req.body?.parentName ? String(req.body.parentName).trim() : undefined;
    const childMemberId = req.body?.childMemberId ? String(req.body.childMemberId) : undefined;

    const out = await prisma.$transaction(async (tx) => {
      const family = await (tx as any)['familyTree'].findUnique({ where: { id: familyId } });
      if (!family) throw new Error('Family not found');
      if (String(family.createdByUserId) !== userId) throw new Error('Forbidden');

      // Attach as parent of an existing member (root can move up)
      if (childMemberId) {
        const child = await (tx as any)['familyTreeMember'].findFirst({ where: { id: childMemberId, familyTreeId: familyId } });
        if (!child) throw new Error('Child member not found');

        if (child.parentMemberId) {
          const existingParent = await (tx as any)['familyTreeMember'].findFirst({ where: { id: child.parentMemberId, familyTreeId: familyId } });
          if (existingParent?.isPlaceholder) {
            const claimed = await (tx as any)['familyTreeMember'].update({
              where: { id: existingParent.id },
              data: {
                fullName,
                isPlaceholder: false,
                // verification can be handled later via a dedicated claim/verify flow
              },
            });

            const shouldMoveRoot = String(family.rootMemberId || '') === String(child.id);
            const updatedFamily = shouldMoveRoot
              ? await (tx as any)['familyTree'].update({
                  where: { id: familyId },
                  data: { rootMemberId: claimed.id, groupName: `${claimed.fullName} Family` },
                })
              : family;

            return { family: updatedFamily, member: claimed, mode: 'claim-placeholder-parent' };
          }
          throw new Error('Child already has a parent');
        }

        const parent = await (tx as any)['familyTreeMember'].create({
          data: {
            familyTreeId: familyId,
            fullName,
            ...(kinRelationId ? { kinRelationId } : {}),
            parentMemberId: null,
            isPlaceholder: false,
            isVerified: false,
          },
        });

        await (tx as any)['familyTreeMember'].update({ where: { id: child.id }, data: { parentMemberId: parent.id } });

        const shouldMoveRoot = String(family.rootMemberId || '') === String(child.id);
        const updatedFamily = shouldMoveRoot
          ? await (tx as any)['familyTree'].update({
              where: { id: familyId },
              data: { rootMemberId: parent.id, groupName: `${parent.fullName} Family` },
            })
          : family;

        return { family: updatedFamily, member: parent, mode: 'attach-parent' };
      }

      // Default: add a child under a parent
      let resolvedParentId = parentMemberId;
      let placeholderParent: any = null;

      if (!resolvedParentId && parentName) {
        placeholderParent = await (tx as any)['familyTreeMember'].findFirst({
          where: {
            familyTreeId: familyId,
            isPlaceholder: true,
            fullName: { equals: parentName, mode: 'insensitive' },
          },
        });

        if (!placeholderParent) {
          placeholderParent = await (tx as any)['familyTreeMember'].create({
            data: {
              familyTreeId: familyId,
              fullName: parentName,
              isPlaceholder: true,
              isVerified: false,
            },
          });
        }

        resolvedParentId = placeholderParent.id;
      }

      if (resolvedParentId) {
        const parent = await (tx as any)['familyTreeMember'].findFirst({ where: { id: resolvedParentId, familyTreeId: familyId } });
        if (!parent) throw new Error('Parent member not found');
      }

      const child = await (tx as any)['familyTreeMember'].create({
        data: {
          familyTreeId: familyId,
          fullName,
          ...(kinRelationId ? { kinRelationId } : {}),
          ...(resolvedParentId ? { parentMemberId: resolvedParentId } : {}),
          isPlaceholder: false,
          isVerified: false,
        },
      });

      return { family, member: child, mode: 'attach-child', placeholderParent };
    });

    return res.json(out);
  } catch (err: any) {
    const msg = String(err?.message || 'Failed');
    const code = msg === 'Forbidden' ? 403 : msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('Invalid') ? 400 : 400;
    return res.status(code).json({ error: msg });
  }
});

/**
 * @swagger
 * /family/{familyId}:
 *   get:
 *     summary: Get a family tree with members
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: familyId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: languageCode
 *         schema: { type: string, description: "Optional label language for kinRelation display" }
 *     responses:
 *       200: { description: OK }
 */
router.get('/:familyId', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const familyId = String(req.params.familyId || '').trim();
    const languageCode = req.query.languageCode ? String(req.query.languageCode).trim().toLowerCase() : '';

    const family = await (prisma as any)['familyTree'].findUnique({
      where: { id: familyId },
      include: {
        surname: { select: { id: true, surnameEn: true, surnameNative: true, stateId: true } },
        members: {
          orderBy: { createdAt: 'asc' },
          include: languageCode
            ? {
                kinRelation: {
                  select: {
                    id: true,
                    code: true,
                    category: true,
                    gender: true,
                    side: true,
                    generationUp: true,
                    generationDown: true,
                    en: true,
                    te: true,
                    names: { where: { languageCode }, select: { displayName: true, altNames: true } },
                  },
                },
              }
            : { kinRelation: true },
        },
      },
    });

    if (!family) return res.status(404).json({ error: 'Family not found' });
    if (String(family.createdByUserId) !== userId) return res.status(403).json({ error: 'Forbidden' });

    const members = family.members.map((m: any) => {
      const kr = m.kinRelation;
      const translated = languageCode && kr?.names?.[0] ? kr.names[0] : null;
      const displayName = translated?.displayName || kr?.en || null;
      return {
        id: m.id,
        userId: m.userId,
        fullName: m.fullName,
        parentMemberId: m.parentMemberId,
        isPlaceholder: m.isPlaceholder,
        isVerified: m.isVerified,
        kinRelation: kr
          ? {
              id: kr.id,
              code: kr.code,
              displayName,
              altNames: translated?.altNames || [],
              category: kr.category,
              gender: kr.gender,
              side: kr.side,
              generationUp: kr.generationUp,
              generationDown: kr.generationDown,
            }
          : null,
        createdAt: m.createdAt,
      };
    });

    return res.json({
      family: {
        id: family.id,
        side: family.side,
        groupName: family.groupName,
        rootMemberId: family.rootMemberId,
        surname: family.surname,
        villageId: family.villageId,
        createdByUserId: family.createdByUserId,
        createdAt: family.createdAt,
        updatedAt: family.updatedAt,
      },
      members,
    });
  } catch (err) {
    console.error('get family tree error', err);
    return res.status(500).json({ error: 'Failed to fetch family' });
  }
});

/**
 * @swagger
 * /family/member/claim:
 *   post:
 *     summary: Claim a placeholder member as the current user
 *     tags: [Family]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [familyId, memberId]
 *             properties:
 *               familyId: { type: string }
 *               memberId: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/member/claim', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const familyId = String(req.body?.familyId || '').trim();
    const memberId = String(req.body?.memberId || '').trim();
    if (!familyId || !memberId) return res.status(400).json({ error: 'familyId and memberId are required' });

    const userName = String(req.user?.profile?.fullName || '').trim();

    const result = await prisma.$transaction(async (tx) => {
      const family = await (tx as any)['familyTree'].findUnique({ where: { id: familyId } });
      if (!family) throw new Error('Family not found');
      if (String(family.createdByUserId) !== userId) throw new Error('Forbidden');

      // Prevent the same user being attached twice to the same family
      const existing = await (tx as any)['familyTreeMember'].findFirst({ where: { familyTreeId: familyId, userId } });
      if (existing) throw new Error('You are already a member in this family');

      const member = await (tx as any)['familyTreeMember'].findFirst({ where: { id: memberId, familyTreeId: familyId } });
      if (!member) throw new Error('Member not found');
      if (!member.isPlaceholder) throw new Error('Member is not a placeholder');
      if (member.userId) throw new Error('Placeholder already claimed');

      const updated = await (tx as any)['familyTreeMember'].update({
        where: { id: member.id },
        data: {
          userId,
          isPlaceholder: false,
          isVerified: true,
          ...(userName ? { fullName: userName } : {}),
        },
      });

      return { family, member: updated };
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    const msg = String(err?.message || 'Failed');
    const code = msg === 'Forbidden' ? 403 : msg.includes('not found') ? 404 : 400;
    return res.status(code).json({ error: msg });
  }
});

/**
 * @swagger
 * /family/search:
 *   get:
 *     summary: Search existing families by member name (duplicate prevention helper)
 *     tags: [Family]
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: surname
 *         schema: { type: string }
 *       - in: query
 *         name: villageId
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200: { description: OK }
 */
router.get('/search', async (req: any, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'name is required' });

  const surname = req.query.surname ? String(req.query.surname).trim() : '';
  const villageId = req.query.villageId ? String(req.query.villageId).trim() : '';
  const take = Math.max(1, Math.min(50, Number(req.query.limit || 20)));

  // Basic name matching. If surname provided, also allow "<name> <surname>" matches.
  const orName: any[] = [{ fullName: { contains: name, mode: 'insensitive' } }];
  if (surname) {
    orName.push({ fullName: { contains: `${name} ${surname}`, mode: 'insensitive' } });
    orName.push({ fullName: { contains: `${surname} ${name}`, mode: 'insensitive' } });
  }

  const rows = await (prisma as any)['familyTreeMember'].findMany({
    where: {
      OR: orName,
      ...(villageId ? { familyTree: { villageId } } : {}),
    },
    take,
    include: {
      familyTree: { select: { id: true, side: true, groupName: true, rootMemberId: true, villageId: true, surnameId: true, createdByUserId: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const byFamily = new Map<string, any>();
  for (const r of rows) {
    const fid = r.familyTree?.id;
    if (!fid) continue;
    if (!byFamily.has(fid)) byFamily.set(fid, { family: r.familyTree, matchedMember: { id: r.id, fullName: r.fullName }, matchedAt: r.createdAt });
  }

  const items = Array.from(byFamily.values());
  return res.json({ count: items.length, items });
});

export default router;
