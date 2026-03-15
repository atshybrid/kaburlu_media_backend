// src/api/journalist/journalist.routes.ts
// Journalist Union Module – clean add-on, no existing code changed.

import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdmin, requireSuperAdmin } from '../middlewares/authz';

const router = Router();

const jwtAuth = passport.authenticate('jwt', { session: false });

// ─── helpers ────────────────────────────────────────────────────────────────

function currentUser(req: Request): { id: string; role: { name: string } } {
  return (req as any).user;
}

/** Auto-expire cards whose expiryDate has passed. Lightweight, runs on-read. */
async function syncCardExpiry(profileId: string) {
  await (prisma as any).journalistCard.updateMany({
    where: {
      profileId,
      status: 'ACTIVE',
      expiryDate: { lt: new Date() },
    },
    data: { status: 'EXPIRED' },
  });
}

// ─── USER ROUTES ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   - name: Journalist Union
 *     description: Journalist union membership, press cards, complaints and union updates
 */

/**
 * @swagger
 * /journalist/apply:
 *   post:
 *     summary: Apply for journalist union membership
 *     description: Authenticated user submits a membership application. One application per user.
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [designation, district, organization]
 *             properties:
 *               designation:
 *                 type: string
 *                 example: Reporter
 *               district:
 *                 type: string
 *                 example: Karimnagar
 *               organization:
 *                 type: string
 *                 example: TV9
 *               unionName:
 *                 type: string
 *                 example: Telangana Working Journalists Federation
 *     responses:
 *       201:
 *         description: Application submitted
 *       400:
 *         description: Already applied or missing fields
 *       401:
 *         description: Unauthorized
 */
router.post('/apply', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { designation, district, organization, unionName } = req.body;

    if (!designation || !district || !organization) {
      return res.status(400).json({ error: 'designation, district, and organization are required' });
    }

    const existing = await (prisma as any).journalistProfile.findUnique({
      where: { userId: user.id },
    });
    if (existing) {
      return res.status(400).json({ error: 'You have already applied', profile: existing });
    }

    const profile = await (prisma as any).journalistProfile.create({
      data: {
        userId: user.id,
        designation: designation.trim(),
        district: district.trim(),
        organization: organization.trim(),
        unionName: unionName ? (unionName as string).trim() : null,
      },
    });

    return res.status(201).json({ message: 'Application submitted successfully', profile });
  } catch (e: any) {
    console.error('[journalist/apply]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/profile:
 *   get:
 *     summary: Get my journalist profile
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile found
 *       404:
 *         description: No profile found
 */
router.get('/profile', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({
      where: { userId: user.id },
      include: {
        user: { select: { mobileNumber: true, email: true, profile: { select: { fullName: true } } } },
        card: true,
      },
    });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found. Please apply first.' });
    return res.json(profile);
  } catch (e: any) {
    console.error('[journalist/profile]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/profile:
 *   put:
 *     summary: Update my journalist profile (only before approval)
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               designation:
 *                 type: string
 *               district:
 *                 type: string
 *               organization:
 *                 type: string
 *               unionName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       403:
 *         description: Cannot edit after approval
 *       404:
 *         description: Profile not found
 */
router.put('/profile', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'Profile not found. Apply first.' });
    if (profile.approved) return res.status(403).json({ error: 'Profile is already approved and cannot be edited.' });

    const { designation, district, organization, unionName } = req.body;
    const updated = await (prisma as any).journalistProfile.update({
      where: { userId: user.id },
      data: {
        ...(designation && { designation: (designation as string).trim() }),
        ...(district && { district: (district as string).trim() }),
        ...(organization && { organization: (organization as string).trim() }),
        ...(unionName !== undefined && { unionName: unionName ? (unionName as string).trim() : null }),
      },
    });
    return res.json(updated);
  } catch (e: any) {
    console.error('[journalist/profile PUT]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/my-card:
 *   get:
 *     summary: Get my press card
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Card details
 *       404:
 *         description: No card issued yet
 */
router.get('/my-card', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'No journalist profile found.' });

    await syncCardExpiry(profile.id);

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId: profile.id } });
    if (!card) return res.status(404).json({ error: 'No press card issued yet. Please contact your union admin.' });
    return res.json(card);
  } catch (e: any) {
    console.error('[journalist/my-card]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/complaint:
 *   post:
 *     summary: File a complaint (approved journalists only)
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description]
 *             properties:
 *               title:
 *                 type: string
 *                 example: Police Harassment
 *               description:
 *                 type: string
 *                 example: Police stopped our reporting at the protest venue.
 *               location:
 *                 type: string
 *                 example: Hyderabad
 *     responses:
 *       201:
 *         description: Complaint filed
 *       403:
 *         description: Only approved journalists can file complaints
 */
router.post('/complaint', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { title, description, location } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'title and description are required' });
    }

    // Only approved journalists can file complaints
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile || !profile.approved) {
      return res.status(403).json({ error: 'Only approved journalist union members can file complaints.' });
    }

    const complaint = await (prisma as any).journalistComplaint.create({
      data: {
        userId: user.id,
        title: (title as string).trim(),
        description: (description as string).trim(),
        location: location ? (location as string).trim() : null,
      },
    });
    return res.status(201).json({ message: 'Complaint filed successfully', complaint });
  } catch (e: any) {
    console.error('[journalist/complaint]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/my-complaints:
 *   get:
 *     summary: List my complaints
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of complaints
 */
router.get('/my-complaints', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const complaints = await (prisma as any).journalistComplaint.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(complaints);
  } catch (e: any) {
    console.error('[journalist/my-complaints]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/directory:
 *   get:
 *     summary: Public journalist directory (approved members only)
 *     tags: [Journalist Union]
 *     parameters:
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *         description: Filter by district
 *       - in: query
 *         name: unionName
 *         schema:
 *           type: string
 *         description: Filter by union name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated journalist list
 */
router.get('/directory', async (req: Request, res: Response) => {
  try {
    const district = req.query['district'] as string | undefined;
    const unionName = req.query['unionName'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = { approved: true };
    if (district) where.district = { contains: district, mode: 'insensitive' };
    if (unionName) where.unionName = { contains: unionName, mode: 'insensitive' };

    const [total, journalists] = await Promise.all([
      (prisma as any).journalistProfile.count({ where }),
      (prisma as any).journalistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          designation: true,
          district: true,
          organization: true,
          unionName: true,
          pressId: true,
          user: {
            select: { profile: { select: { fullName: true } } },
          },
        },
      }),
    ]);

    const data = journalists.map((j: any) => ({
      id: j.id,
      name: j.user?.profile?.fullName || null,
      designation: j.designation,
      district: j.district,
      organization: j.organization,
      unionName: j.unionName,
      pressId: j.pressId,
    }));

    return res.json({ total, page, limit, data });
  } catch (e: any) {
    console.error('[journalist/directory]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/updates:
 *   get:
 *     summary: List union announcements / updates
 *     tags: [Journalist Union]
 *     parameters:
 *       - in: query
 *         name: unionName
 *         schema:
 *           type: string
 *         description: Filter by union (omit for all)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of union updates
 */
router.get('/updates', async (req: Request, res: Response) => {
  try {
    const unionName = req.query['unionName'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (unionName) where.unionName = unionName;

    const [total, updates] = await Promise.all([
      (prisma as any).journalistUnionUpdate.count({ where }),
      (prisma as any).journalistUnionUpdate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          content: true,
          unionName: true,
          imageUrl: true,
          createdAt: true,
          createdBy: {
            select: { profile: { select: { fullName: true } } },
          },
        },
      }),
    ]);

    return res.json({ total, page, limit, data: updates });
  } catch (e: any) {
    console.error('[journalist/updates]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── ADMIN ROUTES ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/admin/applications:
 *   get:
 *     summary: "[Admin] List membership applications"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: approved
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *           default: 'false'
 *       - in: query
 *         name: district
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated applications list
 */
router.get('/admin/applications', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const approvedParam = req.query['approved'] as string;
    const district = req.query['district'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (approvedParam === 'true') where.approved = true;
    else if (approvedParam === 'all') { /* no filter */ }
    else where.approved = false; // default: pending
    if (district) where.district = { contains: district, mode: 'insensitive' };

    const [total, applications] = await Promise.all([
      (prisma as any).journalistProfile.count({ where }),
      (prisma as any).journalistProfile.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { mobileNumber: true, email: true, profile: { select: { fullName: true } } } },
          card: { select: { cardNumber: true, status: true, expiryDate: true } },
        },
      }),
    ]);

    return res.json({ total, page, limit, data: applications });
  } catch (e: any) {
    console.error('[journalist/admin/applications]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/approve/{id}:
 *   patch:
 *     summary: "[Admin] Approve or reject a journalist application"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: JournalistProfile id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [approved]
 *             properties:
 *               approved:
 *                 type: boolean
 *               pressId:
 *                 type: string
 *                 description: Assign a press ID (optional)
 *     responses:
 *       200:
 *         description: Updated
 *       404:
 *         description: Profile not found
 */
router.patch('/admin/approve/:id', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, pressId } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: '`approved` must be a boolean' });
    }

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });

    const data: any = {
      approved,
      ...(approved ? { approvedAt: new Date(), rejectedAt: null } : { rejectedAt: new Date(), approvedAt: null }),
    };

    if (pressId) {
      data.pressId = (pressId as string).trim();
    }

    const updated = await (prisma as any).journalistProfile.update({ where: { id }, data });
    return res.json({ message: approved ? 'Application approved' : 'Application rejected', profile: updated });
  } catch (e: any) {
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'pressId already in use' });
    }
    console.error('[journalist/admin/approve]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/generate-card:
 *   post:
 *     summary: "[Admin] Generate press card for an approved journalist"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profileId]
 *             properties:
 *               profileId:
 *                 type: string
 *                 description: JournalistProfile id
 *               expiryDate:
 *                 type: string
 *                 format: date
 *                 example: '2027-12-31'
 *                 description: Optional; defaults to 2 years from now
 *               qrCode:
 *                 type: string
 *     responses:
 *       201:
 *         description: Card created
 *       400:
 *         description: Profile not approved or card already exists
 *       404:
 *         description: Profile not found
 */
router.post('/admin/generate-card', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId, expiryDate, qrCode } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });
    if (!profile.approved) return res.status(400).json({ error: 'Journalist is not yet approved' });

    const existingCard = await (prisma as any).journalistCard.findUnique({ where: { profileId } });
    if (existingCard) {
      return res.status(400).json({ error: 'Press card already exists for this journalist', card: existingCard });
    }

    const cardNumber = `JU-${Date.now()}`;
    const expiry = expiryDate ? new Date(expiryDate) : (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 2);
      return d;
    })();

    if (isNaN(expiry.getTime())) {
      return res.status(400).json({ error: 'Invalid expiryDate format. Use YYYY-MM-DD.' });
    }

    const card = await (prisma as any).journalistCard.create({
      data: {
        profileId,
        cardNumber,
        expiryDate: expiry,
        qrCode: qrCode || null,
        status: new Date() > expiry ? 'EXPIRED' : 'ACTIVE',
      },
    });
    return res.status(201).json({ message: 'Press card generated', card });
  } catch (e: any) {
    console.error('[journalist/admin/generate-card]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/cards/{profileId}:
 *   patch:
 *     summary: "[Admin] Renew / update a press card"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
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
 *               expiryDate:
 *                 type: string
 *                 format: date
 *               qrCode:
 *                 type: string
 *               pdfUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Card updated
 *       404:
 *         description: Card not found
 */
router.patch('/admin/cards/:profileId', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { expiryDate, qrCode, pdfUrl } = req.body;

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    const newExpiry = expiryDate ? new Date(expiryDate) : undefined;
    if (newExpiry && isNaN(newExpiry.getTime())) {
      return res.status(400).json({ error: 'Invalid expiryDate format. Use YYYY-MM-DD.' });
    }

    const updated = await (prisma as any).journalistCard.update({
      where: { profileId },
      data: {
        ...(newExpiry && { expiryDate: newExpiry, status: new Date() > newExpiry ? 'EXPIRED' : 'ACTIVE' }),
        ...(qrCode !== undefined && { qrCode }),
        ...(pdfUrl !== undefined && { pdfUrl }),
      },
    });
    return res.json({ message: 'Card updated', card: updated });
  } catch (e: any) {
    console.error('[journalist/admin/cards PATCH]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/complaints:
 *   get:
 *     summary: "[Admin] List all complaints"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, IN_PROGRESS, CLOSED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated complaints
 */
router.get('/admin/complaints', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query['status'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && ['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) where.status = status;

    const [total, complaints] = await Promise.all([
      (prisma as any).journalistComplaint.count({ where }),
      (prisma as any).journalistComplaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
        },
      }),
    ]);

    return res.json({ total, page, limit, data: complaints });
  } catch (e: any) {
    console.error('[journalist/admin/complaints]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/complaints/{id}:
 *   patch:
 *     summary: "[Admin] Update complaint status"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [OPEN, IN_PROGRESS, CLOSED]
 *               adminNote:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: Invalid status
 */
router.patch('/admin/complaints/:id', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of OPEN, IN_PROGRESS, CLOSED' });
    }

    const complaint = await (prisma as any).journalistComplaint.findUnique({ where: { id } });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    const updated = await (prisma as any).journalistComplaint.update({
      where: { id },
      data: {
        status,
        ...(adminNote !== undefined && { adminNote: (adminNote as string).trim() }),
      },
    });
    return res.json({ message: 'Complaint updated', complaint: updated });
  } catch (e: any) {
    console.error('[journalist/admin/complaints PATCH]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/updates:
 *   post:
 *     summary: "[Admin] Post a union announcement / update"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, content]
 *             properties:
 *               title:
 *                 type: string
 *               content:
 *                 type: string
 *               unionName:
 *                 type: string
 *                 description: Target union slug; omit for global
 *               imageUrl:
 *                 type: string
 *     responses:
 *       201:
 *         description: Update posted
 */
router.post('/admin/updates', jwtAuth, requireSuperOrTenantAdmin, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { title, content, unionName, imageUrl } = req.body;

    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    const update = await (prisma as any).journalistUnionUpdate.create({
      data: {
        title: (title as string).trim(),
        content: (content as string).trim(),
        unionName: unionName ? (unionName as string).trim() : null,
        imageUrl: imageUrl || null,
        createdById: user.id,
      },
    });
    return res.status(201).json({ message: 'Update posted', update });
  } catch (e: any) {
    console.error('[journalist/admin/updates]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/updates/{id}:
 *   delete:
 *     summary: "[Admin] Delete a union update"
 *     tags: [Journalist Union]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Not found
 */
router.delete('/admin/updates/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = await (prisma as any).journalistUnionUpdate.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Update not found' });
    await (prisma as any).journalistUnionUpdate.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (e: any) {
    console.error('[journalist/admin/updates DELETE]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
