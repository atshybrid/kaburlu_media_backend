import { Router } from 'express';
import passport from 'passport';
import { validationMiddleware } from '../middlewares/validation.middleware';
import { UpsertInterestDto, BulkUpsertInterestDto, InviteByMobileDto } from './chat.dto';
import { listInterests, upsertInterest, bulkUpsertInterest, deleteInterest } from './chat.service';
import { getAdmin } from '../../lib/firebase';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { buildFamilyScopeUserIds } from '../family/family.service';

// Utility: ensure firebaseUid exists
async function ensureFirebaseUid(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  if (user.firebaseUid) return user.firebaseUid;
  const firebaseUid = 'u_' + user.id; // predictable mapping
  await prisma.user.update({ where: { id: user.id }, data: { firebaseUid } });
  return firebaseUid;
}

// Deterministic direct chat id
function directChatId(a: string, b: string): string {
  return 'd_' + [a, b].sort().join('_');
}

// Firestore helpers (basic; real implementation would use admin.firestore())
async function ensureFamilyChat(adminApp: any, chatId: string, memberIds: string[], meta: any) {
  const db = adminApp.firestore();
  const chatRef = db.collection('chats').doc(chatId);
  const snap = await chatRef.get();
  if (!snap.exists) {
    await chatRef.set({ chatId, kind: 'FAMILY', createdAt: Date.now(), memberCount: memberIds.length, ...meta });
  }
  const batch = db.batch();
  memberIds.forEach(uid => {
    const mRef = db.collection('chatMembers').doc(chatId + '_' + uid);
    batch.set(mRef, { chatId, userId: uid, joinedAt: Date.now() }, { merge: true });
  });
  await batch.commit();
}

async function ensureDirectChat(adminApp: any, chatId: string, userIds: string[]) {
  const db = adminApp.firestore();
  const chatRef = db.collection('chats').doc(chatId);
  const snap = await chatRef.get();
  if (!snap.exists) {
    await chatRef.set({ chatId, kind: 'DIRECT', createdAt: Date.now(), memberCount: userIds.length });
  }
  const batch = db.batch();
  userIds.forEach(uid => {
    const mRef = db.collection('chatMembers').doc(chatId + '_' + uid);
    batch.set(mRef, { chatId, userId: uid, joinedAt: Date.now() }, { merge: true });
  });
  await batch.commit();
}

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// Map KinRelation.category -> FamilyRelationType (limited to direct relations)
function kinCategoryToRelationType(category: string): 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING' | null {
  switch (category) {
    case 'PARENT': return 'PARENT';
    case 'CHILD': return 'CHILD';
    case 'SPOUSE': return 'SPOUSE';
    case 'SIBLING': return 'SIBLING';
    default: return null;
  }
}

// Inverse mapping for bidirectional edge creation
const inverseFamilyRelation: Record<string, 'PARENT' | 'CHILD' | 'SPOUSE' | 'SIBLING'> = {
  PARENT: 'CHILD',
  CHILD: 'PARENT',
  SPOUSE: 'SPOUSE',
  SIBLING: 'SIBLING'
};

/**
 * @swagger
 * /chat/users/simple:
 *   post:
 *     summary: Create (or fetch) a chat user plus immediate relatives using kin codes, then ensure family chat (INTERNAL BOOTSTRAP)
 *     description: |
 *       Public bootstrap helper. Creates a root user (if mobile not registered) with role CHAT_USER (auto-created if missing).
 *       For each relative provided, creates skeleton users and FamilyRelation edges based on KinRelation.category.
 *       Supports only direct categories: PARENT, CHILD, SPOUSE, SIBLING. Others are ignored.
 *       Finally provisions a Firestore family chat (f_{rootUserId}) and memberships.
 *     tags: [KaChat - Membership]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber, relatives]
 *             properties:
 *               mobileNumber: { type: string }
 *               fullName: { type: string }
 *               relatives:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [mobileNumber, kinCode]
 *                   properties:
 *                     mobileNumber: { type: string }
 *                     fullName: { type: string }
 *                     kinCode: { type: string, description: 'Code from KinRelation table (e.g., FATHER, MOTHER, BROTHER)' }
 *     responses:
 *       200: { description: Created / hydrated }
 */
router.post('/users/simple', async (req: any, res) => {
  try {
    const body = req.body || {};
    if (!body.mobileNumber) return res.status(400).json({ error: 'mobileNumber required' });
    if (!Array.isArray(body.relatives)) return res.status(400).json({ error: 'relatives array required' });
    const norm = (m: string) => String(m).replace(/\D/g, '');
    const rootMobile = norm(body.mobileNumber);
    // Ensure CHAT_USER role exists
    let chatRole = await (prisma as any).role.findUnique({ where: { name: 'CHAT_USER' } });
    if (!chatRole) {
      chatRole = await (prisma as any).role.create({ data: { name: 'CHAT_USER', permissions: [] } });
    }
    // Pick a default language (first) for simplicity
    const lang = await (prisma as any).language.findFirst();
    if (!lang) throw new Error('No languages seeded');
    // Upsert root user
    let root = await (prisma as any).user.findUnique({ where: { mobileNumber: rootMobile } });
    if (!root) {
      const hashed = await bcrypt.hash('1234', 6);
      root = await (prisma as any).user.create({ data: { mobileNumber: rootMobile, mpin: hashed, roleId: chatRole.id, languageId: lang.id, status: 'ACTIVE' } });
      if (body.fullName) await (prisma as any).userProfile.create({ data: { userId: root.id, fullName: body.fullName } }).catch(()=>{});
    }
    const kinCodes = body.relatives.map((r: any) => r.kinCode).filter(Boolean);
    const kinRows = await (prisma as any).kinRelation.findMany({ where: { code: { in: kinCodes } } });
    const kinMap: Record<string, any> = {};
    kinRows.forEach((k: any) => { kinMap[k.code] = k; });

    const createdRelatives: any[] = [];
    for (const rel of body.relatives) {
      const relMobile = norm(rel.mobileNumber || '');
      if (!relMobile || !rel.kinCode) continue;
      const kin = kinMap[rel.kinCode];
      if (!kin) continue; // unknown code
      const relationType = kinCategoryToRelationType(kin.category);
      if (!relationType) continue; // skip unsupported
      let u = await (prisma as any).user.findUnique({ where: { mobileNumber: relMobile } });
      if (!u) {
        const hashed = await bcrypt.hash('1234', 6);
        u = await (prisma as any).user.create({ data: { mobileNumber: relMobile, mpin: hashed, roleId: chatRole.id, languageId: lang.id, status: 'PENDING' } });
        if (rel.fullName) await (prisma as any).userProfile.create({ data: { userId: u.id, fullName: rel.fullName } }).catch(()=>{});
      }
      // Create edges (idempotent via upsert unique constraint)
      await (prisma as any).familyRelation.upsert({
        where: { userId_relatedUserId_relationType: { userId: root.id, relatedUserId: u.id, relationType } },
        update: {},
        create: { userId: root.id, relatedUserId: u.id, relationType }
      });
      await (prisma as any).familyRelation.upsert({
        where: { userId_relatedUserId_relationType: { userId: u.id, relatedUserId: root.id, relationType: inverseFamilyRelation[relationType] } },
        update: {},
        create: { userId: u.id, relatedUserId: root.id, relationType: inverseFamilyRelation[relationType] }
      });
      createdRelatives.push({ userId: u.id, mobileNumber: relMobile, kinCode: rel.kinCode, relationType });
    }

    // Build scope (depth 1 or 2 for immediate preview)
    const { members } = await buildFamilyScopeUserIds({ rootUserId: root.id, direction: 'both', maxDepth: 2, includeSelf: true, hardMemberCap: 500 });
    const chatId = 'f_' + root.id;
    const adminApp = getAdmin();
    await ensureFamilyChat(adminApp, chatId, members, { bootstrap: true });
    res.json({ rootUserId: root.id, chatId, members: members.length, relatives: createdRelatives });
  } catch (e: any) {
    console.error('simple chat user create error', e);
    res.status(400).json({ error: e.message });
  }
});

// Simple in-memory rate limiter (per process). For production, replace with Redis.
interface Bucket { tokens: number; updated: number; }
const buckets: Record<string, Bucket> = {};
function rateLimit(keyBase: string, capacity: number, refillPerSec: number) {
  return (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.id || 'anon';
      const key = keyBase + ':' + userId;
      const now = Date.now();
      const bucket = buckets[key] || { tokens: capacity, updated: now };
      // Refill
      const elapsed = (now - bucket.updated) / 1000;
      const refill = elapsed * refillPerSec;
      bucket.tokens = Math.min(capacity, bucket.tokens + refill);
      bucket.updated = now;
      if (bucket.tokens < 1) return res.status(429).json({ error: 'Rate limit exceeded' });
      bucket.tokens -= 1;
      buckets[key] = bucket;
      next();
    } catch (e) {
      return res.status(500).json({ error: 'Rate limiter error' });
    }
  };
}

// Basic message shape validator (minimal inline, full schema in swagger block below)
function validateMessageBody(body: any) {
  if (!body || typeof body !== 'object') throw new Error('Body required');
  if (!body.chatId) throw new Error('chatId required');
  if (!body.kind) body.kind = 'TEXT';
  const allowedKinds = ['TEXT','IMAGE','VIDEO','SYSTEM'];
  if (!allowedKinds.includes(body.kind)) throw new Error('Invalid kind');
  if (!body.text && !body.ciphertext && !body.mediaUrl && body.kind === 'TEXT') {
    throw new Error('Provide text or ciphertext');
  }
  return body;
}

// Stub moderation hook (replace with real queue / service call later)
async function moderationCheck(record: any): Promise<{ allow: boolean; reason?: string }> {
  // Example simple heuristic: block extremely long plaintext (>2000 chars)
  if (record.text && record.text.length > 2000) {
    return { allow: false, reason: 'Text too long' };
  }
  // Future: send to moderation microservice / AI classifier
  return { allow: true };
}

/**
 * @swagger
 * tags:
 *   name: KaChat - Interests
 *   description: Interest follow & filtering APIs
 */

/**
 * @swagger
 * /chat/interests:
 *   get:
 *     summary: List users you follow (interest records)
 *     tags: [KaChat - Interests]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.get('/interests', auth, async (req: any, res) => {
  const rows = await listInterests(req.user.id);
  const items = rows.map((r: any) => ({
    targetUserId: r.targetUserId,
    followed: r.followed,
    muted: r.muted,
    notes: r.notes,
    target: {
      id: r.targetUser.id,
      name: r.targetUser.profile?.fullName || null,
      mobileNumber: r.targetUser.mobileNumber || null
    },
    updatedAt: r.updatedAt
  }));
  res.json({ count: items.length, items });
});

/**
 * @swagger
 * /chat/interests:
 *   post:
 *     summary: Create/update a single interest (follow/mute)
 *     tags: [KaChat - Interests]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpsertInterest'
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/interests', auth, validationMiddleware(UpsertInterestDto), async (req: any, res) => {
  try {
    const { targetUserId, followed, muted, notes } = req.body;
    const row = await upsertInterest(req.user.id, targetUserId, { followed, muted, notes });
    res.json(row);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
* /chat/interests/bulk:
 *   post:
 *     summary: Bulk follow/mute many target users (Deprecated)
 *     deprecated: true
 *     tags: [KaChat - Interests]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkUpsertInterest'
 *     responses:
 *       200: { description: OK }
 */
router.post('/interests/bulk', auth, validationMiddleware(BulkUpsertInterestDto), async (req: any, res) => {
  try {
    const { targetUserIds, followed, muted } = req.body;
    const out = await bulkUpsertInterest(req.user.id, targetUserIds, { followed, muted });
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/interests/{targetUserId}:
 *   delete:
 *     summary: Remove an interest (unfollow)
 *     tags: [KaChat - Interests]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/interests/:targetUserId', auth, async (req: any, res) => {
  try {
    const out = await deleteInterest(req.user.id, req.params.targetUserId);
    res.json(out);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
* /chat/token:
 *   post:
 *     summary: Get Firebase custom token for chat
 *     tags: [KaChat - Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 */
router.post('/token', auth, async (req: any, res) => {
  try {
    const firebaseUid = await ensureFirebaseUid(req.user.id);
    const adminApp = getAdmin();
    const token = await adminApp.auth().createCustomToken(firebaseUid, { role: req.user.role?.name || 'USER' });
    res.json({ firebaseUid, token });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/family:
 *   post:
 *     summary: Ensure family chat room & memberships
 *     tags: [KaChat - Membership]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               maxDepth: { type: integer, default: 2 }
 *     responses:
 *       200: { description: OK }
 */
router.post('/family', auth, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const maxDepth = Math.max(1, Math.min(5, Number(req.body?.maxDepth || 2)));
    const { members, truncated } = await buildFamilyScopeUserIds({ rootUserId: userId, direction: 'both', maxDepth, includeSelf: true, hardMemberCap: 1000 });
    const chatId = 'f_' + userId; // simple deterministic; could hash member set later
    const adminApp = getAdmin();
    await ensureFamilyChat(adminApp, chatId, members, { maxDepth, truncated });
    res.json({ chatId, memberCount: members.length, truncated });
  } catch (e: any) {
    console.error('family chat error', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/direct/{targetUserId}:
 *   post:
 *     summary: Ensure a direct chat between you and target user
 *     tags: [KaChat - Membership]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/direct/:targetUserId', auth, async (req: any, res) => {
  try {
    const targetUserId = req.params.targetUserId;
    if (targetUserId === req.user.id) return res.status(400).json({ error: 'Cannot create direct chat with self' });
    const target = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!target) return res.status(404).json({ error: 'Target user not found' });
    const chatId = directChatId(req.user.id, targetUserId);
    const adminApp = getAdmin();
    await ensureDirectChat(adminApp, chatId, [req.user.id, targetUserId]);
    res.json({ chatId });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Placeholder stubs for future endpoints: invite/mobile & sync (not yet implemented)
/**
 * @swagger
* /chat/sync:
 *   post:
 *     summary: Re-sync chat memberships & default interests (INTERNAL)
 *     tags: [KaChat - Membership]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       501: { description: Not implemented }
 */
router.post('/sync', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const maxDepth = Math.max(1, Math.min(5, Number(req.body?.maxDepth || 2)));
    const { members, truncated } = await buildFamilyScopeUserIds({ rootUserId: userId, direction: 'both', maxDepth, includeSelf: true, hardMemberCap: 1500 });
    const chatId = 'f_' + userId;
    const adminApp = getAdmin();
    await ensureFamilyChat(adminApp, chatId, members, { maxDepth, truncated, resyncAt: Date.now() });
    // Seed interests for immediate relations (depth 1) by querying relations table
    const direct = await (prisma as any)['familyRelation'].findMany({
      where: { userId, relationType: { in: ['PARENT','CHILD','SIBLING','SPOUSE'] } },
      select: { relatedUserId: true }
    });
    const interestOps = direct.map((r: any) => (prisma as any)['chatInterest'].upsert({
      where: { userId_targetUserId: { userId, targetUserId: r.relatedUserId } },
      update: { followed: true },
      create: { userId, targetUserId: r.relatedUserId, followed: true, muted: false }
    }));
    if (interestOps.length) await prisma.$transaction(interestOps).catch(()=>{});
    res.json({ chatId, memberCount: members.length, truncated, interestsSeeded: interestOps.length });
  } catch (e: any) {
    console.error('sync error', e);
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
* /chat/invite/mobile:
 *   post:
 *     summary: Invite or link a family member by mobile number (INTERNAL)
 *     tags: [KaChat - Membership]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteByMobile'
 *     responses:
 *       200: { description: OK }
 */
router.post('/invite/mobile', auth, rateLimit('chat:invite', 10, 0.1), validationMiddleware(InviteByMobileDto), async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { mobileNumber, relationType, fullName, targetUserId } = req.body as InviteByMobileDto;
    const normalizedMobile = mobileNumber.replace(/\D/g, '');
    const REL_TYPES = ['PARENT','CHILD','SPOUSE','SIBLING'];
    if (!REL_TYPES.includes(relationType)) return res.status(400).json({ error: 'Invalid relationType' });

    // If targetUserId provided: attempt to assign mobile to skeleton (if empty)
    let relatedUser: any = null;
    if (targetUserId) {
      relatedUser = await prisma.user.findUnique({ where: { id: targetUserId } });
      if (!relatedUser) return res.status(404).json({ error: 'targetUserId not found' });
      if (relatedUser.mobileNumber && relatedUser.mobileNumber !== normalizedMobile) {
        return res.status(400).json({ error: 'target user already has different mobile' });
      }
      if (!relatedUser.mobileNumber) {
        relatedUser = await prisma.user.update({ where: { id: relatedUser.id }, data: { mobileNumber: normalizedMobile } });
      }
    } else {
      // Look up by mobile
      relatedUser = await prisma.user.findUnique({ where: { mobileNumber: normalizedMobile } });
      if (!relatedUser) {
        // create skeleton user (minimal role assumption: use existing role of inviter or default role)
        const inviter = await prisma.user.findUnique({ where: { id: userId }, select: { roleId: true, languageId: true } });
        if (!inviter) return res.status(404).json({ error: 'Inviter not found' });
        relatedUser = await prisma.user.create({ data: { mobileNumber: normalizedMobile, roleId: inviter.roleId, languageId: inviter.languageId, status: 'PENDING' } });
        if (fullName) {
          await prisma.userProfile.create({ data: { userId: relatedUser.id, fullName } }).catch(()=>{});
        }
      }
    }

    // Create bidirectional family relation if not exists
    const inverseMap: any = { PARENT: 'CHILD', CHILD: 'PARENT', SPOUSE: 'SPOUSE', SIBLING: 'SIBLING' };
    const inverse = inverseMap[relationType];
    if (relatedUser.id === userId) return res.status(400).json({ error: 'Cannot relate to self' });
    const created = await prisma.$transaction(async (tx) => {
      const a = await (tx as any)['familyRelation'].upsert({
        where: { userId_relatedUserId_relationType: { userId, relatedUserId: relatedUser.id, relationType } },
        update: {},
        create: { userId, relatedUserId: relatedUser.id, relationType }
      });
      const b = await (tx as any)['familyRelation'].upsert({
        where: { userId_relatedUserId_relationType: { userId: relatedUser.id, relatedUserId: userId, relationType: inverse } },
        update: {},
        create: { userId: relatedUser.id, relatedUserId: userId, relationType: inverse }
      });
      return { a, b };
    });

    // Optionally seed an interest follow (immediate relation auto-follow)
    await (prisma as any)['chatInterest'].upsert({
      where: { userId_targetUserId: { userId, targetUserId: relatedUser.id } },
      update: { followed: true, muted: false },
      create: { userId, targetUserId: relatedUser.id, followed: true, muted: false }
    }).catch(()=>{});

    return res.json({ success: true, relatedUserId: relatedUser.id, relation: created });
  } catch (e: any) {
    console.error('invite mobile error', e);
    res.status(400).json({ error: e.message });
  }
});

// ---------------- Messaging Endpoints ----------------
/**
 * @swagger
 * /chat/messages:
 *   post:
 *     summary: Send chat message (stores in Firestore)
 *     tags: [KaChat - Messaging]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChatMessageSend'
 *     responses:
 *       200: { description: Stored }
 */
router.post('/messages', auth, rateLimit('chat:msg', 60, 1), async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const body = validateMessageBody({ ...req.body });
    const adminApp = getAdmin();
    const db = adminApp.firestore();
    // Confirm membership exists
    const memberDoc = await db.collection('chatMembers').doc(body.chatId + '_' + userId).get();
    if (!memberDoc.exists) return res.status(403).json({ error: 'Not a member of chat' });
    const id = db.collection('messages').doc().id;
    const now = Date.now();
    const record: any = {
      id,
      chatId: body.chatId,
      kind: body.kind,
      senderUserId: userId,
      createdAt: now,
      text: body.text || null,
      mediaUrl: body.mediaUrl || null,
      ciphertext: body.ciphertext || null,
      iv: body.iv || null,
      meta: body.meta || null
    };
    // Moderation stub
    const mod = await moderationCheck(record);
    if (!mod.allow) return res.status(400).json({ error: 'Rejected by moderation', reason: mod.reason });
    await db.collection('messages').doc(id).set(record);
    res.json({ id, chatId: body.chatId, createdAt: now });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/messages/{chatId}:
 *   get:
 *     summary: List messages (reverse chronological)
 *     tags: [KaChat - Messaging]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: chatId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 30, maximum: 200 }
 *       - in: query
 *         name: before
 *         schema: { type: string, description: 'Message ID (exclusive) for pagination' }
 *     responses:
 *       200: { description: OK }
 */
router.get('/messages/:chatId', auth, async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { chatId } = req.params;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 30));
    const before = req.query.before as string | undefined;
    const after = req.query.after as string | undefined; // forward pagination cursor
    const adminApp = getAdmin();
    const db = adminApp.firestore();
    const memberDoc = await db.collection('chatMembers').doc(chatId + '_' + userId).get();
    if (!memberDoc.exists) return res.status(403).json({ error: 'Not a member of chat' });
    let ref = db.collection('messages').where('chatId', '==', chatId).orderBy('createdAt', 'desc');
    if (before) {
      const beforeSnap = await db.collection('messages').doc(before).get();
      if (beforeSnap.exists) ref = ref.startAfter(beforeSnap.get('createdAt'));
    }
    if (after) {
      // Forward pagination: invert order then reverse client side
      let forwardRef = db.collection('messages').where('chatId', '==', chatId).orderBy('createdAt', 'asc');
      const afterSnap = await db.collection('messages').doc(after).get();
      if (afterSnap.exists) forwardRef = forwardRef.startAfter(afterSnap.get('createdAt'));
      const forward = await forwardRef.limit(limit).get();
      const itemsF = forward.docs.map(d => d.data());
      return res.json({ count: itemsF.length, items: itemsF });
    }
    const snap = await ref.limit(limit).get();
    const items = snap.docs.map(d => d.data());
    res.json({ count: items.length, items });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/keys/consume-one-time:
 *   post:
 *     summary: Consume (remove) a one-time pre-key of the target user and return it
 *     description: Used during initial X3DH handshake. Returns one key and removes it from the store to prevent reuse.
 *     tags: [KaChat - Crypto]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.post('/keys/consume-one-time', auth, rateLimit('chat:consumePreKey', 40, 0.5), async (req: any, res) => {
  try {
    const { targetUserId } = req.body || {};
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId required' });
    // Fetch key row
    const row = await (prisma as any).userEncryptionKey.findUnique({ where: { userId: targetUserId } });
    if (!row) return res.status(404).json({ error: 'No key bundle' });
    const list: string[] = Array.isArray(row.oneTimePreKeys) ? row.oneTimePreKeys : [];
    if (!list.length) return res.status(410).json({ error: 'No one-time pre-keys left' });
    const key = list[0];
    const remaining = list.slice(1);
    await (prisma as any).userEncryptionKey.update({ where: { userId: targetUserId }, data: { oneTimePreKeys: remaining } });
    res.json({ targetUserId, oneTimePreKey: key, remaining: remaining.length });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ---------------- Crypto (Public Key Distribution) ----------------
/**
 * @swagger
 * /chat/keys/publish:
 *   post:
 *     summary: Publish or rotate your public encryption key bundle
 *     description: Stores identity / signed pre-key / one-time pre-keys. One-time keys are consumed client-to-client; server does not manage ratchet state.
 *     tags: [KaChat - Crypto]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EncryptionKeyBundle'
 *     responses:
 *       200: { description: Stored }
 */
router.post('/keys/publish', auth, rateLimit('chat:keys', 20, 0.2), async (req: any, res) => {
  try {
    const userId = req.user.id as string;
    const { identityKey, signedPreKey, signedPreKeySig, oneTimePreKeys } = req.body || {};
    if (!identityKey) return res.status(400).json({ error: 'identityKey required' });
    const keys = await (prisma as any).userEncryptionKey.upsert({
      where: { userId },
      update: {
        identityKey,
        signedPreKey: signedPreKey || null,
        signedPreKeySig: signedPreKeySig || null,
        oneTimePreKeys: Array.isArray(oneTimePreKeys) ? oneTimePreKeys : []
      },
      create: {
        userId,
        identityKey,
        signedPreKey: signedPreKey || null,
        signedPreKeySig: signedPreKeySig || null,
        oneTimePreKeys: Array.isArray(oneTimePreKeys) ? oneTimePreKeys : []
      }
    });
    res.json({ stored: true, updatedAt: keys.updatedAt });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * /chat/keys/{userId}:
 *   get:
 *     summary: Retrieve a user's public encryption key bundle
 *     tags: [KaChat - Crypto]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get('/keys/:userId', auth, async (req: any, res) => {
  try {
    const targetUserId = req.params.userId;
    const row = await (prisma as any).userEncryptionKey.findUnique({ where: { userId: targetUserId } });
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({
      userId: row.userId,
      identityKey: row.identityKey,
      signedPreKey: row.signedPreKey,
      signedPreKeySig: row.signedPreKeySig,
      oneTimePreKeys: row.oneTimePreKeys,
      updatedAt: row.updatedAt
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

/**
 * @swagger
 * components:
 *   schemas:
 *     InviteByMobile:
 *       type: object
 *       required: [mobileNumber, relationType]
 *       properties:
 *         mobileNumber: { type: string }
 *         relationType: { type: string, enum: [PARENT, CHILD, SPOUSE, SIBLING] }
 *         fullName: { type: string }
 *         targetUserId: { type: string, description: Assign mobile to existing skeleton user }
 */

export default router;

/**
 * @swagger
 * components:
 *   schemas:
 *     UpsertInterest:
 *       type: object
 *       required: [targetUserId]
 *       properties:
 *         targetUserId: { type: string }
 *         followed: { type: boolean, default: true }
 *         muted: { type: boolean, default: false }
 *         notes: { type: string }
 *     BulkUpsertInterest:
 *       type: object
 *       required: [targetUserIds]
 *       properties:
 *         targetUserIds:
 *           type: array
 *           items: { type: string }
 *         followed: { type: boolean, default: true }
 *         muted: { type: boolean, default: false }
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     ChatMessageSend:
 *       type: object
 *       required: [chatId, kind]
 *       properties:
 *         chatId: { type: string }
 *         kind: { type: string, enum: [TEXT, IMAGE, VIDEO, SYSTEM], default: TEXT }
 *         text: { type: string }
 *         mediaUrl: { type: string }
 *         ciphertext: { type: string, description: 'Opaque encrypted payload if using end-to-end encryption' }
 *         iv: { type: string, description: 'Base64 IV when symmetric encryption used' }
 *         meta: { type: object }
 *     ChatMessage:
 *       allOf:
 *         - $ref: '#/components/schemas/ChatMessageSend'
 *         - type: object
 *           properties:
 *             id: { type: string }
 *             senderUserId: { type: string }
 *             createdAt: { type: integer, description: 'Epoch millis' }
 *     EncryptionKeyBundle:
 *       type: object
 *       required: [identityKey]
 *       properties:
 *         identityKey: { type: string, description: 'Base64 public identity key (Curve25519/X25519)' }
 *         signedPreKey: { type: string }
 *         signedPreKeySig: { type: string }
 *         oneTimePreKeys:
 *           type: array
 *           items: { type: string }
 */
