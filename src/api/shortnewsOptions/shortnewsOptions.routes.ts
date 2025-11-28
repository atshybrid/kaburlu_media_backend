import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: ShortNews Options
 *     description: User-submitted option strings (<=50 chars) attached to short news items.
 */

/**
 * @swagger
 * /shortnews-options:
 *   post:
 *     summary: Create a short news option (one per user per shortNews)
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shortNewsId, content]
 *             properties:
 *               shortNewsId: { type: string }
 *               content: { type: string, maxLength: 50 }
 *           examples:
 *             create:
 *               summary: Create option
 *               value:
 *                 shortNewsId: "sn123"
 *                 content: "Need more water tankers"
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       404: { description: ShortNews not found }
 *       409: { description: Duplicate option for user }
 */

// Contract:
// - POST /shortnews-options
//   body: { shortNewsId: string, content: string (<= 50) }
//   one per (user, shortNews)
// - GET /shortnews-options/by-user/:userId  -> list user's options with shortNews details
// - GET /shortnews-options/by-shortnews/:shortNewsId -> list options for a shortnews with user basic profile (name + photo)
// - PUT /shortnews-options/:id -> update own option content (<= 50)
// - DELETE /shortnews-options/:id -> delete own option

function validateContent(content: unknown): string | null {
  if (typeof content !== 'string') return 'content must be a string';
  const trimmed = content.trim();
  if (!trimmed) return 'content is required';
  if (trimmed.length > 50) return 'content must be 50 characters or less';
  return null;
}

router.post('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const { shortNewsId, content } = req.body || {};
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    if (!shortNewsId || typeof shortNewsId !== 'string') return res.status(400).json({ error: 'shortNewsId is required' });

    const err = validateContent(content);
    if (err) return res.status(400).json({ error: err });

    // Ensure shortnews exists
    const exists = await prisma.shortNews.findUnique({ where: { id: shortNewsId } });
    if (!exists) return res.status(404).json({ error: 'ShortNews not found' });

    // Create or conflict if exists (unique constraint)
    try {
      const rec = await prisma.shortNewsOption.create({
        data: { shortNewsId, userId: user.id, content: String(content).trim() },
      });
      return res.status(201).json({ success: true, data: rec });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        return res.status(409).json({ error: 'You already posted an option for this short news' });
      }
      throw e;
    }
  } catch (e: any) {
    console.error('create shortnews option failed:', e);
    return res.status(500).json({ error: 'Failed to create option' });
  }
});

/**
 * @swagger
 * /shortnews-options/by-user/{userId}:
 *   get:
 *     summary: List a user's short news options
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 *       401: { description: Unauthorized }
 */

router.get('/by-user/:userId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { userId } = req.params;
    const list = await prisma.shortNewsOption.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { shortNews: { select: { id: true, title: true, content: true, mediaUrls: true, createdAt: true } } },
    });
    return res.json({ success: true, data: list });
  } catch (e) {
    console.error('list options by user failed:', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
});

/**
 * @swagger
 * /shortnews-options/by-shortnews/{shortNewsId}:
 *   get:
 *     summary: List options for a short news item (with user basic profile)
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: List }
 *       401: { description: Unauthorized }
 */

router.get('/by-shortnews/:shortNewsId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { shortNewsId } = req.params;
    const list = await prisma.shortNewsOption.findMany({
      where: { shortNewsId },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { fullName: true, profilePhotoUrl: true, profilePhotoMedia: { select: { url: true } } } },
          },
        },
      },
    });
    // Normalize photo URL
    const data = list.map((i: any) => ({
      id: i.id,
      shortNewsId: i.shortNewsId,
      userId: i.userId,
      content: i.content,
      createdAt: i.createdAt,
      user: {
        id: i.user?.id,
        name: i.user?.profile?.fullName || null,
        profilePhotoUrl: i.user?.profile?.profilePhotoUrl || i.user?.profile?.profilePhotoMedia?.url || null,
      },
    }));
    return res.json({ success: true, data });
  } catch (e) {
    console.error('list options by shortnews failed:', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
});

/**
 * @swagger
 * /shortnews-options/by-user/{userId}/shortnews/{shortNewsId}:
 *   get:
 *     summary: Get a user's option for a short news item
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Option }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */

// Get a specific user's option for a given shortNews
router.get('/by-user/:userId/shortnews/:shortNewsId', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { userId, shortNewsId } = req.params;
    const rec = await prisma.shortNewsOption.findUnique({
      where: { userId_shortNewsId: { userId, shortNewsId } as any },
      include: {
        user: {
          select: {
            id: true,
            profile: { select: { fullName: true, profilePhotoUrl: true, profilePhotoMedia: { select: { url: true } } } },
          },
        },
      },
    } as any);
    if (!rec) return res.status(404).json({ error: 'Option not found' });
    const data = {
      id: rec.id,
      shortNewsId: rec.shortNewsId,
      userId: rec.userId,
      content: rec.content,
      createdAt: rec.createdAt,
      user: {
        id: (rec as any).user?.id,
        name: (rec as any).user?.profile?.fullName || null,
        profilePhotoUrl: (rec as any).user?.profile?.profilePhotoUrl || (rec as any).user?.profile?.profilePhotoMedia?.url || null,
      },
    };
    return res.json({ success: true, data });
  } catch (e) {
    console.error('get option by user and shortnews failed:', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
});

/**
 * @swagger
 * /shortnews-options/by-shortnews/{shortNewsId}/me:
 *   get:
 *     summary: Get the authenticated user's option for a short news item
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Option }
 *       401: { description: Unauthorized }
 *       404: { description: Not found }
 */

// Get the current (authenticated) user's option for a given shortNews
router.get('/by-shortnews/:shortNewsId/me', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const { shortNewsId } = req.params;
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });
    const rec = await prisma.shortNewsOption.findUnique({
      where: { userId_shortNewsId: { userId: user.id, shortNewsId } as any },
    } as any);
    if (!rec) return res.status(404).json({ error: 'Option not found' });
    return res.json({ success: true, data: rec });
  } catch (e) {
    console.error('get my option by shortnews failed:', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
});

/**
 * @swagger
 * /shortnews-options/{id}:
 *   put:
 *     summary: Update an option (owner only)
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content: { type: string, maxLength: 50 }
 *     responses:
 *       200: { description: Updated }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */

router.put('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const { content } = req.body || {};
    if (!user?.id) return res.status(401).json({ error: 'Unauthorized' });

    const err = validateContent(content);
    if (err) return res.status(400).json({ error: err });

    const existing = await prisma.shortNewsOption.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Option not found' });
    if (existing.userId !== user.id) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.shortNewsOption.update({ where: { id }, data: { content: String(content).trim() } });
    return res.json({ success: true, data: updated });
  } catch (e) {
    console.error('update option failed:', e);
    return res.status(500).json({ error: 'Failed to update' });
  }
});

/**
 * @swagger
 * /shortnews-options/{id}:
 *   delete:
 *     summary: Delete an option (owner only)
 *     tags: [ShortNews Options]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       404: { description: Not found }
 */

router.delete('/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const user = req.user as any;
    const { id } = req.params;
    const existing = await prisma.shortNewsOption.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Option not found' });
    if (existing.userId !== user?.id) return res.status(403).json({ error: 'Forbidden' });
    await prisma.shortNewsOption.delete({ where: { id } });
    return res.json({ success: true });
  } catch (e) {
    console.error('delete option failed:', e);
    return res.status(500).json({ error: 'Failed to delete' });
  }
});

export default router;
