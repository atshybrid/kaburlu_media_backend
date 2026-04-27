// src/api/journalist/journalist.routes.ts
// Journalist Union Module – clean add-on, no existing code changed.

import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import * as bcrypt from 'bcrypt';
import multer from 'multer';
import sharp from 'sharp';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { r2Client, R2_BUCKET, getPublicUrl } from '../../lib/r2';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdmin, requireSuperAdmin } from '../middlewares/authz';
import { generatePressCardBuffer, generateAndUploadPressCardPdf } from '../../lib/journalistPressCardPdf';

// Multer for union asset uploads (memory storage, image-only)
const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// Allowed settable image asset fields and their DB column mapping
const ASSET_FIELD_MAP: Record<string, string> = {
  logo:       'logoUrl',
  idCardLogo: 'idCardLogoUrl',
  stamp:      'stampImageUrl',
  forStamp:   'forStampImageUrl',
};

// State-level asset fields (stored in JournalistUnionStateSettings)
const STATE_ASSET_FIELD_MAP: Record<string, string> = {
  presidentSignature: 'presidentSignatureUrl',
  stateLogo:          'stateLogoUrl',
};

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

/**
 * Middleware: SUPER_ADMIN / TENANT_ADMIN pass through unrestricted.
 * JournalistUnionAdmin passes through scoped — sets res.locals.journalistUnionScope.
 * Everyone else gets 403.
 */
async function requireJournalistUnionAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = currentUser(req);
    const role = user.role?.name;

    // Only SUPER_ADMIN has unrestricted cross-union access
    if (role === 'SUPER_ADMIN') return next();

    // TENANT_ADMIN and all other roles must have a JournalistUnionAdmin record
    const unionAdmin = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId: user.id } });
    if (unionAdmin) {
      res.locals['journalistUnionScope'] = { unionName: unionAdmin.unionName };
      return next();
    }
    return res.status(403).json({ error: 'Forbidden: no journalist union admin assignment found for your account' });
  } catch (e) {
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

// ─── PUBLIC ROUTES (no auth) ──────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/public/apply:
 *   post:
 *     summary: Apply for journalist union membership (mobile-based, no prior login needed)
 *     description: |
 *       Checks if a user with the given mobile already exists.
 *       - If found → links the JournalistProfile to their existing account (reporter or otherwise).
 *       - If not found → creates a new account and JournalistProfile together.
 *     tags: [Journalist Union - Public]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber, mpin, designation, district, organization]
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9876543210"
 *               mpin:
 *                 type: string
 *                 description: 4-digit MPIN (used only when creating a new account)
 *                 example: "1234"
 *               designation:
 *                 type: string
 *               district:
 *                 type: string
 *               organization:
 *                 type: string
 *               unionName:
 *                 type: string
 *               languageId:
 *                 type: string
 *                 description: Required only when creating a new account
 *     responses:
 *       201:
 *         description: Application submitted
 *       400:
 *         description: Already applied or missing fields
 */
router.post('/public/apply', async (req: Request, res: Response) => {
  try {
    const { mobileNumber, mpin, designation, district, organization, unionName, languageId } = req.body;

    if (!mobileNumber || !designation || !district || !organization) {
      return res.status(400).json({ error: 'mobileNumber, designation, district, and organization are required' });
    }

    let user = await prisma.user.findUnique({ where: { mobileNumber } });
    let isNewAccount = false;

    if (user) {
      // Check for existing journalist profile
      const existing = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
      if (existing) {
        return res.status(400).json({ error: 'This mobile number already has a journalist union application', profile: existing });
      }
    } else {
      // New account — mpin required
      if (!mpin) {
        return res.status(400).json({ error: 'mpin is required when registering a new account' });
      }
      if (!/^\d{4}$/.test(mpin)) {
        return res.status(400).json({ error: 'mpin must be exactly 4 digits' });
      }

      const citizenRole = await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } });
      if (!citizenRole) return res.status(500).json({ error: 'Default role not configured' });

      let lang = languageId
        ? await prisma.language.findUnique({ where: { id: languageId } })
        : await prisma.language.findFirst({ where: { code: 'te' } }) ?? await prisma.language.findFirst();
      if (!lang) return res.status(500).json({ error: 'No language configured in the system' });

      const hashedMpin = await bcrypt.hash(mpin, 10);
      user = await prisma.user.create({
        data: {
          mobileNumber,
          mpin: hashedMpin,
          roleId: citizenRole.id,
          languageId: lang.id,
          status: 'PENDING',
        },
      });
      isNewAccount = true;
    }

    // Check if already a reporter in any tenant
    const reporter = await prisma.reporter.findUnique({
      where: { userId: user.id },
      select: { id: true, tenantId: true, tenant: { select: { name: true } } },
    });

    const profile = await (prisma as any).journalistProfile.create({
      data: {
        userId: user.id,
        designation: (designation as string).trim(),
        district: (district as string).trim(),
        organization: (organization as string).trim(),
        unionName: unionName ? (unionName as string).trim() : null,
        state:  req.body.state  ? (req.body.state  as string).trim() : null,
        mandal: req.body.mandal ? (req.body.mandal as string).trim() : null,
      },
    });

    return res.status(201).json({
      message: isNewAccount
        ? 'New account created and application submitted. Login with your mobile number and MPIN.'
        : 'Application submitted and linked to your existing account.',
      isNewAccount,
      reporterLinked: !!reporter,
      reporterTenant: reporter ? (reporter as any).tenant?.name : null,
      profile,
    });
  } catch (e: any) {
    console.error('[journalist/public/apply]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── USER ROUTES ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/apply:
 *   post:
 *     summary: Apply for journalist union membership
 *     description: Authenticated user submits a membership application. One application per user.
 *     tags: [Journalist Union - Member]
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
 *     tags: [Journalist Union - Member]
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
        insurances: {
          where:   { isActive: true },
          orderBy: { validTo: 'asc' },
          select:  { id: true, type: true, policyNumber: true, insurer: true, coverAmount: true, validFrom: true, validTo: true, notes: true },
        },
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
 *     tags: [Journalist Union - Member]
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

    const { designation, district, organization, unionName, state, mandal } = req.body;
    const updated = await (prisma as any).journalistProfile.update({
      where: { userId: user.id },
      data: {
        ...(designation && { designation: (designation as string).trim() }),
        ...(district    && { district:    (district    as string).trim() }),
        ...(organization && { organization: (organization as string).trim() }),
        ...(unionName !== undefined && { unionName: unionName ? (unionName as string).trim() : null }),
        ...(state  !== undefined && { state:  state  ? (state  as string).trim() : null }),
        ...(mandal !== undefined && { mandal: mandal ? (mandal as string).trim() : null }),
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
 *     tags: [Journalist Union - Member]
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
 * /journalist/my-card/pdf:
 *   get:
 *     summary: Download my press card as PDF
 *     description: |
 *       Streams a credit-card-sized (54mm × 85.6mm) two-sided press card PDF on the fly.
 *       Includes member photo, union logo, stamp, president signature and a QR code for verification.
 *       If a stored PDF URL already exists in R2 it is served directly; otherwise the card is
 *       rendered fresh with Puppeteer and streamed back.
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: No press card issued yet
 */
router.get('/my-card/pdf', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'No journalist profile found.' });

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId: profile.id } });
    if (!card) return res.status(404).json({ error: 'No press card issued yet.' });

    const result = await generatePressCardBuffer(profile.id);
    if (!result.ok || !result.pdfBuffer) {
      return res.status(500).json({ error: result.error || 'Failed to generate press card PDF' });
    }
    const fileName = `Press_Card_${result.cardNumber || card.cardNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Content-Length', result.pdfBuffer.length.toString());
    return res.status(200).end(result.pdfBuffer);
  } catch (e: any) {
    console.error('[journalist/my-card/pdf]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/press-card/pdf:
 *   get:
 *     summary: "[Public] Fetch a press card PDF by card number (verification / download link)"
 *     description: |
 *       Public endpoint — no auth required.
 *       Used for QR code scan landing pages or download links in WhatsApp messages.
 *       Pass either `cardNumber` or `profileId` as a query param.
 *     tags: [Journalist Union - Public]
 *     parameters:
 *       - in: query
 *         name: cardNumber
 *         schema:
 *           type: string
 *         description: Press card number (preferred)
 *       - in: query
 *         name: profileId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF binary
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Card not found
 */
router.get('/press-card/pdf', async (req: Request, res: Response) => {
  try {
    let profileId: string | null = (req.query['profileId'] as string) || null;
    const cardNumber = req.query['cardNumber'] as string | undefined;

    if (!profileId && cardNumber) {
      const card = await (prisma as any).journalistCard.findUnique({
        where: { cardNumber },
        select: { profileId: true },
      });
      if (!card) return res.status(404).json({ error: 'Press card not found' });
      profileId = card.profileId;
    }
    if (!profileId) return res.status(400).json({ error: 'cardNumber or profileId is required' });

    const result = await generatePressCardBuffer(profileId);
    if (!result.ok || !result.pdfBuffer) {
      return res.status(500).json({ error: result.error || 'Failed to generate press card PDF' });
    }
    const fileName = `Press_Card_${result.cardNumber || profileId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.setHeader('Content-Length', result.pdfBuffer.length.toString());
    return res.status(200).end(result.pdfBuffer);
  } catch (e: any) {
    console.error('[journalist/press-card/pdf]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/complaint:
 *   post:
 *     summary: File a complaint (approved journalists only)
 *     tags: [Journalist Union - Member]
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
 *     tags: [Journalist Union - Member]
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
 * /journalist/reporter-link:
 *   get:
 *     summary: Check if my journalist profile is linked to a reporter account
 *     description: Shows whether the logged-in user has both a JournalistProfile and a Reporter record in any tenant.
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Link status
 */
router.get('/reporter-link', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);

    const [journalistProfile, reporter] = await Promise.all([
      (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } }),
      prisma.reporter.findUnique({
        where: { userId: user.id },
        select: { id: true, tenantId: true, active: true, tenant: { select: { name: true } } },
      }),
    ]);

    return res.json({
      hasJournalistProfile: !!journalistProfile,
      hasReporterProfile: !!reporter,
      linked: !!journalistProfile && !!reporter,
      journalistProfile: journalistProfile || null,
      reporter: reporter || null,
    });
  } catch (e: any) {
    console.error('[journalist/reporter-link]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/directory:
 *   get:
 *     summary: Public journalist directory (approved members only)
 *     tags: [Journalist Union - Public]
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
 *     tags: [Journalist Union - Public]
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
 *     tags: [Journalist Union - Admin]
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
router.get('/admin/applications', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const approvedParam = req.query['approved'] as string;
    const district = req.query['district'] as string | undefined;
    const kycParam  = req.query['kycVerified'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (approvedParam === 'true') where.approved = true;
    else if (approvedParam === 'all') { /* no filter */ }
    else where.approved = false; // default: pending
    if (district) where.district = { contains: district, mode: 'insensitive' };
    if (kycParam === 'true')  where.kycVerified = true;
    if (kycParam === 'false') where.kycVerified = false;

    // Union admin scope: only see their union's applications
    const scope: any = res.locals['journalistUnionScope'];
    if (scope) where.unionName = scope.unionName;

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
 *     tags: [Journalist Union - Admin]
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
router.patch('/admin/approve/:id', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approved, pressId } = req.body;

    if (typeof approved !== 'boolean') {
      return res.status(400).json({ error: '`approved` must be a boolean' });
    }

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });

    // Union admin can only approve/reject journalists in their union
    const scope: any = res.locals['journalistUnionScope'];
    if (scope && profile.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: this application belongs to a different union' });
    }

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
 *     tags: [Journalist Union - Admin]
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
router.post('/admin/generate-card', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId, expiryDate, qrCode } = req.body;
    if (!profileId) return res.status(400).json({ error: 'profileId is required' });

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });
    if (!profile.approved) return res.status(400).json({ error: 'Journalist is not yet approved' });

    // Union admin can only issue cards for their union
    const scope: any = res.locals['journalistUnionScope'];
    if (scope && profile.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: profile belongs to a different union' });
    }

    const existingCard = await (prisma as any).journalistCard.findUnique({ where: { profileId } });
    if (existingCard) {
      return res.status(400).json({ error: 'Press card already exists for this journalist', card: existingCard });
    }

    const cardNumber = `JU-${Date.now()}`;
    const expiry = expiryDate ? new Date(expiryDate) : (() => {
      const d = new Date();
      d.setFullYear(d.getFullYear() + 1); // Annual renewal — 1 year validity
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

    // Trigger PDF generation + R2 upload in the background
    // (non-blocking — response is returned immediately with the card record)
    if (R2_BUCKET) {
      generateAndUploadPressCardPdf(profileId).then((pdfResult) => {
        if (!pdfResult.ok) console.error('[journalist/admin/generate-card] PDF upload failed:', pdfResult.error);
        else console.log('[journalist/admin/generate-card] PDF uploaded:', pdfResult.pdfUrl);
      }).catch((e) => console.error('[journalist/admin/generate-card] PDF bg error:', e));
    }

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
 *     tags: [Journalist Union - Admin]
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
router.patch('/admin/cards/:profileId', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const { expiryDate, qrCode, pdfUrl } = req.body;

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    // Union admin can only update cards for their union
    const scope: any = res.locals['journalistUnionScope'];
    if (scope) {
      const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: profileId } });
      if (!profile || profile.unionName !== scope.unionName) {
        return res.status(403).json({ error: 'Access denied: card belongs to a different union' });
      }
    }

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
 * /journalist/admin/cards/{profileId}/generate-pdf:
 *   post:
 *     summary: "[Admin] Re-generate press card PDF and upload to R2"
 *     description: |
 *       Useful after a member uploads a KYC photo, updates their details, or after union branding changes.
 *       Triggers fresh Puppeteer render → R2 upload → saves new pdfUrl on JournalistCard.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: PDF regenerated and URL saved
 *       404:
 *         description: Card not found
 *       500:
 *         description: PDF generation failed
 */
router.post('/admin/cards/:profileId/generate-pdf', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId } });
    if (!card) return res.status(404).json({ error: 'Card not found' });

    if (!R2_BUCKET) return res.status(500).json({ error: 'R2 storage not configured' });

    const result = await generateAndUploadPressCardPdf(profileId);
    if (!result.ok) return res.status(500).json({ error: result.error || 'PDF generation failed' });

    return res.json({ message: 'Press card PDF generated', pdfUrl: result.pdfUrl, cardNumber: result.cardNumber });
  } catch (e: any) {
    console.error('[journalist/admin/cards/generate-pdf]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── CARD RENEWAL ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/my-card/request-renewal:
 *   post:
 *     summary: Request press card renewal (member)
 *     description: |
 *       Member requests their annual card renewal.
 *       Admin will see this in the renewal-due list and can approve.
 *       Can only be requested within 60 days before expiry or after expiry.
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Renewal request submitted
 *       400:
 *         description: Card not yet due for renewal (more than 60 days remaining)
 *       404:
 *         description: No press card found
 */
router.post('/my-card/request-renewal', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });

    const card = await (prisma as any).journalistCard.findUnique({ where: { profileId: profile.id } });
    if (!card) return res.status(404).json({ error: 'No press card found' });

    const now = new Date();
    const msUntilExpiry = card.expiryDate.getTime() - now.getTime();
    const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);

    // Allow renewal request: within 60 days before expiry, or already expired
    if (daysUntilExpiry > 60) {
      return res.status(400).json({
        error: `Card renewal can only be requested within 60 days of expiry. Your card expires on ${card.expiryDate.toLocaleDateString('en-IN')} (${Math.ceil(daysUntilExpiry)} days remaining).`,
      });
    }
    if (card.pendingRenewal) {
      return res.status(400).json({ error: 'Renewal request already submitted. Please wait for admin approval.' });
    }

    const updated = await (prisma as any).journalistCard.update({
      where: { id: card.id },
      data:  { pendingRenewal: true, pendingRenewalAt: now },
    });
    return res.json({ message: 'Renewal request submitted. Your admin will process it shortly.', card: updated });
  } catch (e: any) {
    console.error('[journalist/my-card/request-renewal]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/cards/renewal-due:
 *   get:
 *     summary: "[Admin] List cards due for renewal or with pending renewal requests"
 *     description: |
 *       Returns press cards that:
 *       - Have a pending renewal request from the member (`pendingRenewal=true`), OR
 *       - Expire within the next N days (`expiringDays` param, default 30)
 *
 *       Use this as your daily admin dashboard to proactively renew cards before they expire.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: expiringDays
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Show cards expiring within this many days
 *       - in: query
 *         name: pendingOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, only show cards with member-requested renewal
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
 *         description: List of cards due for renewal
 */
router.get('/admin/cards/renewal-due', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const expiringDays = Math.min(365, Math.max(1, parseInt(req.query['expiringDays'] as string) || 30));
    const pendingOnly  = req.query['pendingOnly'] === 'true';
    const page  = Math.max(1, parseInt(req.query['page']  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip  = (page - 1) * limit;

    const scope: any = res.locals['journalistUnionScope'];
    const cutoff = new Date(Date.now() + expiringDays * 24 * 60 * 60 * 1000);

    const profileWhere: any = {};
    if (scope) profileWhere.unionName = scope.unionName;

    const where: any = pendingOnly
      ? { pendingRenewal: true, profile: profileWhere }
      : {
          OR: [
            { pendingRenewal: true },
            { expiryDate: { lte: cutoff } },
          ],
          profile: profileWhere,
        };

    const [total, cards] = await Promise.all([
      (prisma as any).journalistCard.count({ where }),
      (prisma as any).journalistCard.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ pendingRenewal: 'desc' }, { expiryDate: 'asc' }],
        include: {
          profile: {
            select: {
              id: true, pressId: true, designation: true, district: true,
              state: true, mandal: true, organization: true, unionName: true,
              user: { select: { profile: { select: { fullName: true } } } },
            },
          },
        },
      }),
    ]);

    const data = cards.map((c: any) => ({
      cardId:            c.id,
      cardNumber:        c.cardNumber,
      profileId:         c.profileId,
      pressId:           c.profile?.pressId,
      memberName:        c.profile?.user?.profile?.fullName,
      designation:       c.profile?.designation,
      district:          c.profile?.district,
      state:             c.profile?.state,
      unionName:         c.profile?.unionName,
      expiryDate:        c.expiryDate,
      daysUntilExpiry:   Math.ceil((c.expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      pendingRenewal:    c.pendingRenewal,
      pendingRenewalAt:  c.pendingRenewalAt,
      renewalCount:      c.renewalCount,
      status:            c.status,
    }));

    return res.json({ total, page, limit, data });
  } catch (e: any) {
    console.error('[journalist/admin/cards/renewal-due]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/cards/{profileId}/renew:
 *   patch:
 *     summary: "[Admin] Approve renewal — extend card by 1 year and regenerate PDF"
 *     description: |
 *       Extends the card's `expiryDate` by exactly 1 year from today (or from current expiry if not yet expired),
 *       clears `pendingRenewal`, increments `renewalCount`, regenerates the press card PDF in R2.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Card renewed and PDF regenerated
 *       404:
 *         description: Card not found
 */
router.patch('/admin/cards/:profileId/renew', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { profileId } = req.params;
    const card = await (prisma as any).journalistCard.findUnique({
      where:   { profileId },
      include: { profile: { select: { unionName: true } } },
    });
    if (!card) return res.status(404).json({ error: 'Press card not found' });

    const scope: any = res.locals['journalistUnionScope'];
    if (scope && card.profile?.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Card belongs to a different union' });
    }

    // New expiry: 1 year from today, or from current expiry if it's still in the future
    const base = card.expiryDate > new Date() ? new Date(card.expiryDate) : new Date();
    const newExpiry = new Date(base);
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    const updated = await (prisma as any).journalistCard.update({
      where: { profileId },
      data: {
        expiryDate:     newExpiry,
        renewedAt:      new Date(),
        renewalCount:   { increment: 1 },
        pendingRenewal: false,
        pendingRenewalAt: null,
        status: 'ACTIVE',
      },
    });

    // Regenerate PDF in background
    if (R2_BUCKET) {
      generateAndUploadPressCardPdf(profileId).then((r) => {
        if (!r.ok) console.error('[renewal/pdf]', r.error);
        else console.log('[renewal/pdf] uploaded:', r.pdfUrl);
      }).catch((e) => console.error('[renewal/pdf bg]', e));
    }

    return res.json({
      message: `Card renewed. New expiry: ${newExpiry.toLocaleDateString('en-IN')}`,
      card: updated,
    });
  } catch (e: any) {
    console.error('[journalist/admin/cards/renew]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/complaints:
 *   get:
 *     summary: "[Admin] List all complaints"
 *     tags: [Journalist Union - Admin]
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
router.get('/admin/complaints', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const status = req.query['status'] as string | undefined;
    const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && ['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) where.status = status;

    // Union admin: filter complaints by journalists who belong to their union
    const scope: any = res.locals['journalistUnionScope'];
    if (scope) {
      const unionProfiles = await (prisma as any).journalistProfile.findMany({
        where: { unionName: scope.unionName },
        select: { userId: true },
      });
      where.userId = { in: unionProfiles.map((p: any) => p.userId) };
    }

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
 *     tags: [Journalist Union - Admin]
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
router.patch('/admin/complaints/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNote } = req.body;

    if (!['OPEN', 'IN_PROGRESS', 'CLOSED'].includes(status)) {
      return res.status(400).json({ error: 'status must be one of OPEN, IN_PROGRESS, CLOSED' });
    }

    const complaint = await (prisma as any).journalistComplaint.findUnique({ where: { id } });
    if (!complaint) return res.status(404).json({ error: 'Complaint not found' });

    // Union admin can only handle complaints from their union's journalists
    const scope: any = res.locals['journalistUnionScope'];
    if (scope) {
      const jp = await (prisma as any).journalistProfile.findUnique({ where: { userId: complaint.userId } });
      if (!jp || jp.unionName !== scope.unionName) {
        return res.status(403).json({ error: 'Access denied: complaint belongs to a different union' });
      }
    }

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
 *     tags: [Journalist Union - Admin]
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
router.post('/admin/updates', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { title, content, unionName, imageUrl } = req.body;

    if (!title || !content) return res.status(400).json({ error: 'title and content are required' });

    // Union admin can only post updates for their own union
    const scope: any = res.locals['journalistUnionScope'];
    const resolvedUnionName = scope ? scope.unionName : (unionName ? (unionName as string).trim() : null);

    const update = await (prisma as any).journalistUnionUpdate.create({
      data: {
        title: (title as string).trim(),
        content: (content as string).trim(),
        unionName: resolvedUnionName,
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
 *     tags: [Journalist Union - Admin]
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

    // Union admin can only delete their own union's updates
    const scope: any = res.locals['journalistUnionScope'];
    if (scope && existing.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: update belongs to a different union' });
    }

    await (prisma as any).journalistUnionUpdate.delete({ where: { id } });
    return res.json({ message: 'Deleted' });
  } catch (e: any) {
    console.error('[journalist/admin/updates DELETE]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/assign-union-admin:
 *   post:
 *     summary: "[SuperAdmin] Assign a user as union admin for a specific union/state"
 *     description: |
 *       If the user is already a TenantAdmin, they keep their existing access and also gain
 *       union admin rights. No separate login is needed — same JWT token grants both.
 *     tags: [Journalist Union - Super Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId, unionName]
 *             properties:
 *               userId:
 *                 type: string
 *               unionName:
 *                 type: string
 *                 example: Telangana Working Journalists Federation
 *               state:
 *                 type: string
 *                 example: Telangana
 *     responses:
 *       201:
 *         description: Union admin assigned
 *       400:
 *         description: Already assigned
 *       404:
 *         description: User not found
 */
router.post('/admin/assign-union-admin', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { userId, unionName, state } = req.body;
    if (!userId || !unionName) return res.status(400).json({ error: 'userId and unionName are required' });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, mobileNumber: true, role: { select: { name: true } } },
    });
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const existing = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId, unionName } });
    if (existing) return res.status(400).json({ error: 'User is already a union admin for this union' });

    const unionAdmin = await (prisma as any).journalistUnionAdmin.create({
      data: {
        userId,
        unionName: (unionName as string).trim(),
        state: state ? (state as string).trim() : null,
      },
    });

    return res.status(201).json({
      message: 'Union admin assigned successfully',
      note: targetUser.role?.name === 'TENANT_ADMIN'
        ? 'This user is also a TenantAdmin — same login grants both roles.'
        : 'User can now access journalist union admin endpoints for this union.',
      unionAdmin,
    });
  } catch (e: any) {
    console.error('[journalist/admin/assign-union-admin]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/union-admins:
 *   get:
 *     summary: "[SuperAdmin] List all union admins"
 *     tags: [Journalist Union - Super Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of union admins
 */
router.get('/admin/union-admins', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const admins = await (prisma as any).journalistUnionAdmin.findMany({
      orderBy: { unionName: 'asc' },
      include: {
        user: { select: { mobileNumber: true, email: true, role: { select: { name: true } }, profile: { select: { fullName: true } } } },
      },
    });
    return res.json(admins);
  } catch (e: any) {
    console.error('[journalist/admin/union-admins]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/union-admins/{id}:
 *   delete:
 *     summary: "[SuperAdmin] Remove a union admin"
 *     tags: [Journalist Union - Super Admin]
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
 *         description: Removed
 */
router.delete('/admin/union-admins/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const entry = await (prisma as any).journalistUnionAdmin.findUnique({ where: { id } });
    if (!entry) return res.status(404).json({ error: 'Union admin record not found' });
    await (prisma as any).journalistUnionAdmin.delete({ where: { id } });
    return res.json({ message: 'Union admin removed' });
  } catch (e: any) {
    console.error('[journalist/admin/union-admins DELETE]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST HIERARCHY — Default seed data ──────────────────────────────────────

const DEFAULT_POST_DEFINITIONS = [
  // ── STATE LEVEL — ELECTED ──────────────────────────────────────
  { title: 'State President',          nativeTitle: 'రాష్ట్ర అధ్యక్షుడు',          level: 'STATE',        type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { title: 'Working President',        nativeTitle: 'కార్యనిర్వాహక అధ్యక్షుడు',    level: 'STATE',        type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  { title: 'Vice President',           nativeTitle: 'ఉపాధ్యక్షుడు',               level: 'STATE',        type: 'ELECTED',   maxSeats: 5,  sortOrder: 3  },
  { title: 'General Secretary',        nativeTitle: 'ప్రధాన కార్యదర్శి',          level: 'STATE',        type: 'ELECTED',   maxSeats: 1,  sortOrder: 4  },
  { title: 'State Secretary',          nativeTitle: 'రాష్ట్ర కార్యదర్శి',          level: 'STATE',        type: 'ELECTED',   maxSeats: 4,  sortOrder: 5  },
  { title: 'Joint Secretary',          nativeTitle: 'సంయుక్త కార్యదర్శి',          level: 'STATE',        type: 'ELECTED',   maxSeats: 3,  sortOrder: 6  },
  { title: 'Treasurer',                nativeTitle: 'కోశాధికారి',                  level: 'STATE',        type: 'ELECTED',   maxSeats: 1,  sortOrder: 7  },
  { title: 'Organizing Secretary',     nativeTitle: 'సంఘటనా కార్యదర్శి',           level: 'STATE',        type: 'ELECTED',   maxSeats: 1,  sortOrder: 8  },
  // ── STATE LEVEL — APPOINTED ───────────────────────────────────
  { title: 'Executive Member',         nativeTitle: 'కార్యనిర్వాహక సభ్యుడు',       level: 'STATE',        type: 'APPOINTED', maxSeats: 25, sortOrder: 9  },
  { title: 'Advisory Committee Member',nativeTitle: 'సలహా కమిటీ సభ్యుడు',         level: 'STATE',        type: 'APPOINTED', maxSeats: 10, sortOrder: 10 },
  { title: 'Legal Advisor',            nativeTitle: 'న్యాయ సలహాదారు',             level: 'STATE',        type: 'APPOINTED', maxSeats: 2,  sortOrder: 11 },
  { title: 'Media Coordinator / PRO',  nativeTitle: 'మీడియా సమన్వయకర్త',          level: 'STATE',        type: 'APPOINTED', maxSeats: 2,  sortOrder: 12 },
  // ── DISTRICT LEVEL — ELECTED ──────────────────────────────────
  { title: 'District President',       nativeTitle: 'జిల్లా అధ్యక్షుడు',           level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { title: 'District General Secretary',nativeTitle:'జిల్లా ప్రధాన కార్యదర్శి',   level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  { title: 'District Vice President',  nativeTitle: 'జిల్లా ఉపాధ్యక్షుడు',        level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 2,  sortOrder: 3  },
  { title: 'District Secretary',       nativeTitle: 'జిల్లా కార్యదర్శి',           level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 2,  sortOrder: 4  },
  { title: 'District Joint Secretary', nativeTitle: 'జిల్లా సంయుక్త కార్యదర్శి',  level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 2,  sortOrder: 5  },
  { title: 'District Treasurer',       nativeTitle: 'జిల్లా కోశాధికారి',           level: 'DISTRICT',     type: 'ELECTED',   maxSeats: 1,  sortOrder: 6  },
  { title: 'District Executive Member',nativeTitle: 'జిల్లా కార్యనిర్వాహక సభ్యుడు',level: 'DISTRICT',   type: 'APPOINTED', maxSeats: 15, sortOrder: 7  },
  // ── MANDAL LEVEL — ELECTED ────────────────────────────────────
  { title: 'Mandal President',         nativeTitle: 'మండల అధ్యక్షుడు',             level: 'MANDAL',       type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { title: 'Mandal Secretary',         nativeTitle: 'మండల కార్యదర్శి',             level: 'MANDAL',       type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  { title: 'Mandal Member',            nativeTitle: 'మండల సభ్యుడు',               level: 'MANDAL',       type: 'ELECTED',   maxSeats: 10, sortOrder: 3  },
  // ── CITY LEVEL — ELECTED ──────────────────────────────────────
  { title: 'City President',           nativeTitle: 'నగర అధ్యక్షుడు',              level: 'CITY',         type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { title: 'City Secretary',           nativeTitle: 'నగర కార్యదర్శి',              level: 'CITY',         type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  // ── SPECIAL WINGS ─────────────────────────────────────────────
  { title: 'Women Wing President',     nativeTitle: 'మహిళా విభాగం అధ్యక్షురాలు',   level: 'SPECIAL_WING', type: 'ELECTED',   maxSeats: 1,  sortOrder: 1  },
  { title: 'Youth Wing President',     nativeTitle: 'యువజన విభాగం అధ్యక్షుడు',     level: 'SPECIAL_WING', type: 'ELECTED',   maxSeats: 1,  sortOrder: 2  },
  { title: 'Digital Media Wing Head',  nativeTitle: 'డిజిటల్ మీడియా విభాగం అధ్యక్షుడు', level: 'SPECIAL_WING', type: 'APPOINTED', maxSeats: 1, sortOrder: 3 },
  { title: 'Social Media Coordinator', nativeTitle: 'సోషల్ మీడియా సమన్వయకర్త',    level: 'SPECIAL_WING', type: 'APPOINTED', maxSeats: 1,  sortOrder: 4  },
];

// ─── POST HIERARCHY ROUTES ────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/admin/posts/seed-defaults:
 *   post:
 *     summary: "[SuperAdmin] Seed all default post definitions for a union"
 *     description: Creates the full state→district→mandal→city→special-wing post catalog for a union. Safe to re-run (skips existing).
 *     tags: [Journalist Union - Super Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [unionName]
 *             properties:
 *               unionName:
 *                 type: string
 *                 example: Telangana Working Journalists Federation
 *     responses:
 *       201:
 *         description: Post definitions seeded
 */
router.post('/admin/posts/seed-defaults', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { unionName } = req.body;
    if (!unionName) return res.status(400).json({ error: 'unionName is required' });

    const existing = await (prisma as any).journalistUnionPostDefinition.findMany({
      where: { unionName },
      select: { title: true, level: true },
    });
    const existingKeys = new Set(existing.map((e: any) => `${e.level}:${e.title}`));

    const toCreate = DEFAULT_POST_DEFINITIONS
      .filter(p => !existingKeys.has(`${p.level}:${p.title}`))
      .map(p => ({ ...p, unionName }));

    if (toCreate.length === 0) {
      return res.json({ message: 'All default posts already exist for this union', created: 0 });
    }

    await (prisma as any).journalistUnionPostDefinition.createMany({ data: toCreate });
    return res.status(201).json({ message: 'Default posts seeded', created: toCreate.length, total: DEFAULT_POST_DEFINITIONS.length });
  } catch (e: any) {
    console.error('[journalist/admin/posts/seed-defaults]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/posts/definitions:
 *   get:
 *     summary: List all post definitions for a union (grouped by level)
 *     tags: [Journalist Union - Public]
 *     parameters:
 *       - in: query
 *         name: unionName
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [STATE, DISTRICT, MANDAL, CITY, SPECIAL_WING]
 *     responses:
 *       200:
 *         description: Post definitions grouped by level
 */
router.get('/posts/definitions', async (req: Request, res: Response) => {
  try {
    const { unionName, level } = req.query as { unionName?: string; level?: string };

    const where: any = { isActive: true };
    if (unionName) where.unionName = unionName;
    if (level) where.level = level;

    const posts = await (prisma as any).journalistUnionPostDefinition.findMany({
      where,
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
    });

    // Group by level
    const grouped: Record<string, any[]> = {};
    for (const p of posts) {
      if (!grouped[p.level]) grouped[p.level] = [];
      grouped[p.level].push(p);
    }

    return res.json({ total: posts.length, grouped });
  } catch (e: any) {
    console.error('[journalist/posts/definitions]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/committee:
 *   get:
 *     summary: Public committee list — who holds which post in a union
 *     description: Shows current active post holders, optionally filtered by level or district/mandal.
 *     tags: [Journalist Union - Public]
 *     parameters:
 *       - in: query
 *         name: unionName
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [STATE, DISTRICT, MANDAL, CITY, SPECIAL_WING]
 *       - in: query
 *         name: districtId
 *         schema:
 *           type: string
 *       - in: query
 *         name: mandalId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Current committee with post holders
 */
router.get('/committee', async (req: Request, res: Response) => {
  try {
    const { unionName, level, districtId, mandalId } = req.query as Record<string, string | undefined>;
    if (!unionName) return res.status(400).json({ error: 'unionName is required' });

    const where: any = { unionName, isActive: true };
    if (districtId) where.districtId = districtId;
    if (mandalId) where.mandalId = mandalId;
    if (level) where.post = { level };

    const holders = await (prisma as any).journalistUnionPostHolder.findMany({
      where,
      orderBy: [{ post: { sortOrder: 'asc' } }],
      include: {
        post: { select: { id: true, title: true, nativeTitle: true, level: true, type: true, sortOrder: true } },
        profile: {
          select: {
            id: true,
            designation: true,
            district: true,
            organization: true,
            pressId: true,
            user: { select: { profile: { select: { fullName: true } }, mobileNumber: true } },
          },
        },
      },
    });

    // Group by level → then by post title
    const grouped: Record<string, any[]> = {};
    for (const h of holders) {
      const lvl = h.post.level as string;
      if (!grouped[lvl]) grouped[lvl] = [];
      grouped[lvl].push({
        holderId: h.id,
        post: h.post,
        member: {
          profileId: h.profile.id,
          name: h.profile.user?.profile?.fullName || null,
          mobile: h.profile.user?.mobileNumber || null,
          designation: h.profile.designation,
          district: h.profile.district,
          organization: h.profile.organization,
          pressId: h.profile.pressId,
        },
        termStartDate: h.termStartDate,
        termEndDate: h.termEndDate,
      });
    }

    return res.json({ unionName, grouped });
  } catch (e: any) {
    console.error('[journalist/committee]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/posts/appoint:
 *   post:
 *     summary: "[Admin] Appoint or elect a member to a union post"
 *     description: |
 *       Works for both ELECTED and APPOINTED posts.
 *       - Validates seat limit (maxSeats) before creating.
 *       - For ELECTED posts, replaces previous holder if maxSeats=1 (auto-deactivates old).
 *       - Requires the journalist to be approved.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [postId, profileId, termStartDate]
 *             properties:
 *               postId:
 *                 type: string
 *                 description: JournalistUnionPostDefinition id
 *               profileId:
 *                 type: string
 *                 description: JournalistProfile id of the member
 *               termStartDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-01-01"
 *               termEndDate:
 *                 type: string
 *                 format: date
 *                 example: "2028-12-31"
 *               districtId:
 *                 type: string
 *               mandalId:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Post assigned
 *       400:
 *         description: Seat limit reached or member not approved
 *       404:
 *         description: Post or profile not found
 */
router.post('/admin/posts/appoint', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const appointer = currentUser(req);
    const { postId, profileId, termStartDate, termEndDate, districtId, mandalId, notes } = req.body;

    if (!postId || !profileId || !termStartDate) {
      return res.status(400).json({ error: 'postId, profileId, and termStartDate are required' });
    }

    const postDef = await (prisma as any).journalistUnionPostDefinition.findUnique({ where: { id: postId } });
    if (!postDef) return res.status(404).json({ error: 'Post definition not found' });

    // Union admin scope check
    const scope: any = res.locals['journalistUnionScope'];
    if (scope && postDef.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: post belongs to a different union' });
    }

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });
    if (!profile.approved) return res.status(400).json({ error: 'Only approved journalists can be appointed to posts' });

    // Check seat limit
    const activeCount = await (prisma as any).journalistUnionPostHolder.count({
      where: { postId, unionName: postDef.unionName, isActive: true, ...(districtId ? { districtId } : {}), ...(mandalId ? { mandalId } : {}) },
    });

    if (activeCount >= postDef.maxSeats) {
      // For single-seat ELECTED posts: auto-vacate the current holder
      if (postDef.maxSeats === 1 && postDef.type === 'ELECTED') {
        await (prisma as any).journalistUnionPostHolder.updateMany({
          where: { postId, unionName: postDef.unionName, isActive: true },
          data: { isActive: false, termEndDate: new Date() },
        });
      } else {
        return res.status(400).json({
          error: `Seat limit reached. This post allows maximum ${postDef.maxSeats} active holder(s).`,
          maxSeats: postDef.maxSeats,
          currentCount: activeCount,
        });
      }
    }

    const startDate = new Date(termStartDate);
    const endDate = termEndDate ? new Date(termEndDate) : null;
    if (isNaN(startDate.getTime())) return res.status(400).json({ error: 'Invalid termStartDate format. Use YYYY-MM-DD.' });
    if (endDate && isNaN(endDate.getTime())) return res.status(400).json({ error: 'Invalid termEndDate format. Use YYYY-MM-DD.' });

    const holder = await (prisma as any).journalistUnionPostHolder.create({
      data: {
        postId,
        profileId,
        unionName: postDef.unionName,
        districtId: districtId || null,
        mandalId: mandalId || null,
        termStartDate: startDate,
        termEndDate: endDate || null,
        isActive: true,
        appointedById: appointer.id,
        notes: notes || null,
      },
      include: {
        post: { select: { title: true, nativeTitle: true, level: true, type: true } },
        profile: {
          select: { pressId: true, user: { select: { profile: { select: { fullName: true } } } } },
        },
      },
    });

    return res.status(201).json({
      message: `${holder.profile.user?.profile?.fullName || profileId} appointed as ${holder.post.title}`,
      holder,
    });
  } catch (e: any) {
    console.error('[journalist/admin/posts/appoint]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/posts/holders/{id}:
 *   patch:
 *     summary: "[Admin] Update a post holder (extend term, add notes)"
 *     tags: [Journalist Union - Admin]
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
 *             properties:
 *               termEndDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 */
router.patch('/admin/posts/holders/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { termEndDate, notes } = req.body;

    const holder = await (prisma as any).journalistUnionPostHolder.findUnique({ where: { id }, include: { post: true } });
    if (!holder) return res.status(404).json({ error: 'Post holder record not found' });

    const scope: any = res.locals['journalistUnionScope'];
    if (scope && holder.post.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: holder belongs to a different union' });
    }

    const newExpiry = termEndDate ? new Date(termEndDate) : undefined;
    if (newExpiry && isNaN(newExpiry.getTime())) {
      return res.status(400).json({ error: 'Invalid termEndDate format. Use YYYY-MM-DD.' });
    }

    const updated = await (prisma as any).journalistUnionPostHolder.update({
      where: { id },
      data: {
        ...(newExpiry !== undefined && { termEndDate: newExpiry }),
        ...(notes !== undefined && { notes }),
      },
    });
    return res.json({ message: 'Post holder updated', holder: updated });
  } catch (e: any) {
    console.error('[journalist/admin/posts/holders PATCH]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/posts/holders/{id}:
 *   delete:
 *     summary: "[Admin] Remove / vacate a post (deactivate holder)"
 *     tags: [Journalist Union - Admin]
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
 *         description: Post vacated
 */
router.delete('/admin/posts/holders/:id', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const holder = await (prisma as any).journalistUnionPostHolder.findUnique({ where: { id }, include: { post: true } });
    if (!holder) return res.status(404).json({ error: 'Post holder record not found' });

    const scope: any = res.locals['journalistUnionScope'];
    if (scope && holder.post.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Access denied: holder belongs to a different union' });
    }

    await (prisma as any).journalistUnionPostHolder.update({
      where: { id },
      data: { isActive: false, termEndDate: new Date() },
    });
    return res.json({ message: 'Post vacated successfully' });
  } catch (e: any) {
    console.error('[journalist/admin/posts/holders DELETE]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/my-posts:
 *   get:
 *     summary: Get all union posts I currently hold
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My active posts
 */
router.get('/my-posts', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'No journalist profile found' });

    const posts = await (prisma as any).journalistUnionPostHolder.findMany({
      where: { profileId: profile.id, isActive: true },
      include: {
        post: { select: { title: true, nativeTitle: true, level: true, type: true, sortOrder: true } },
      },
      orderBy: { post: { sortOrder: 'asc' } },
    });
    return res.json({ posts });
  } catch (e: any) {
    console.error('[journalist/my-posts]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── KYC & WORK DETAILS ───────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/kyc/upload:
 *   post:
 *     summary: Upload a KYC document or profile photo
 *     description: |
 *       Uploads KYC images to R2. All images are converted to WebP (except Aadhaar stays PNG for quality).
 *
 *       **field** must be one of:
 *       - `photo` — Member passport-size photo
 *       - `aadhaar` — Aadhaar card front
 *       - `aadhaarBack` — Aadhaar card back (optional)
 *
 *       R2 key: `journalist-union/kyc/{profileId}/{field}.{ext}`
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, field]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               field:
 *                 type: string
 *                 enum: [photo, aadhaar, aadhaarBack]
 *     responses:
 *       200:
 *         description: File uploaded and profile updated
 *       400:
 *         description: Invalid field or missing file
 *       404:
 *         description: Journalist profile not found
 */
router.post(
  '/kyc/upload',
  jwtAuth,
  uploadSingle.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!R2_BUCKET) return res.status(500).json({ error: 'R2 storage not configured' });

      const user = currentUser(req);
      const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
      if (!profile) return res.status(404).json({ error: 'Journalist profile not found. Apply first.' });

      const field = req.body.field as string;
      const KYC_FIELD_MAP: Record<string, string> = {
        photo:       'photoUrl',
        aadhaar:     'aadhaarUrl',
        aadhaarBack: 'aadhaarBackUrl',
      };
      if (!KYC_FIELD_MAP[field]) {
        return res.status(400).json({ error: 'field must be one of: photo, aadhaar, aadhaarBack' });
      }

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'file is required (multipart/form-data)' });

      // photo → WebP, aadhaar docs → PNG (higher fidelity for text on ID)
      const isAadhaar = field !== 'photo';
      const outBuffer = isAadhaar
        ? await sharp(file.buffer).png().toBuffer()
        : await sharp(file.buffer).webp({ quality: 85 }).toBuffer();
      const ext = isAadhaar ? 'png' : 'webp';
      const contentType = isAadhaar ? 'image/png' : 'image/webp';

      const r2Key = `journalist-union/kyc/${profile.id}/${field}.${ext}`;
      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: r2Key, Body: outBuffer,
        ContentType: contentType, CacheControl: 'private, max-age=86400',
      }));

      const publicUrl = getPublicUrl(r2Key);
      const updated = await (prisma as any).journalistProfile.update({
        where: { id: profile.id },
        data:  { [KYC_FIELD_MAP[field]]: publicUrl },
      });
      return res.json({ field, url: publicUrl, profile: updated });
    } catch (e: any) {
      console.error('[journalist/kyc/upload]', e);
      return res.status(500).json({ error: 'Upload failed', details: e.message });
    }
  },
);

/**
 * @swagger
 * /journalist/kyc/details:
 *   put:
 *     summary: Update KYC & work details (Aadhaar last-4, current newspaper, experience etc.)
 *     description: |
 *       Member updates their own work and KYC text fields. If the member is also a
 *       reporter in a tenant, pass `autoLinkReporter: true` to auto-fill
 *       `linkedTenantName` from the reporter table.
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aadhaarNumber:
 *                 type: string
 *                 description: Last 4 digits of Aadhaar only (we never store full number)
 *                 example: "4521"
 *               currentNewspaper:
 *                 type: string
 *                 example: Sakshi TV
 *               currentDesignation:
 *                 type: string
 *                 example: Senior Reporter
 *               joiningDate:
 *                 type: string
 *                 format: date
 *                 example: "2019-06-01"
 *               totalExperienceYears:
 *                 type: integer
 *                 example: 8
 *               additionalInfo:
 *                 type: string
 *               autoLinkReporter:
 *                 type: boolean
 *                 description: If true, auto-detect reporter record and fill linkedTenantName
 *     responses:
 *       200:
 *         description: Profile updated
 *       404:
 *         description: No journalist profile found
 */
router.put('/kyc/details', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'Journalist profile not found' });

    const {
      aadhaarNumber, currentNewspaper, currentDesignation,
      joiningDate, totalExperienceYears, additionalInfo,
      autoLinkReporter,
    } = req.body;

    const data: any = {};
    if (aadhaarNumber !== undefined) {
      // Validate: only last 4 digits allowed
      const last4 = String(aadhaarNumber).replace(/\D/g, '').slice(-4);
      if (last4.length !== 4) return res.status(400).json({ error: 'aadhaarNumber: provide last 4 digits only' });
      data.aadhaarNumber = last4;
    }
    if (currentNewspaper !== undefined)       data.currentNewspaper = (currentNewspaper as string).trim();
    if (currentDesignation !== undefined)     data.currentDesignation = (currentDesignation as string).trim();
    if (joiningDate !== undefined)            data.joiningDate = new Date(joiningDate);
    if (totalExperienceYears !== undefined)   data.totalExperienceYears = parseInt(String(totalExperienceYears), 10) || null;
    if (additionalInfo !== undefined)         data.additionalInfo = (additionalInfo as string).trim();

    // Auto-link reporter if requested
    if (autoLinkReporter) {
      const reporter = await prisma.reporter.findUnique({
        where: { userId: user.id },
        select: { tenantId: true, tenant: { select: { name: true } } },
      });
      if (reporter) {
        data.linkedTenantId   = reporter.tenantId;
        data.linkedTenantName = reporter.tenant?.name || null;
      }
    }

    const updated = await (prisma as any).journalistProfile.update({
      where: { id: profile.id },
      data,
    });
    return res.json({ message: 'Profile updated', profile: updated });
  } catch (e: any) {
    console.error('[journalist/kyc/details PUT]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/kyc/verify/{profileId}:
 *   patch:
 *     summary: "[Admin] Verify or reject a member's KYC"
 *     tags: [Journalist Union - Admin]
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [verify, reject]
 *               note:
 *                 type: string
 *                 example: Aadhaar matches name. Verified.
 *     responses:
 *       200:
 *         description: KYC status updated
 *       404:
 *         description: Profile not found
 */
router.patch('/admin/kyc/verify/:profileId', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const { action, note } = req.body;
    if (!['verify', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'action must be verify or reject' });
    }

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: req.params['profileId'] } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    // Scope check
    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    if (scope && profile.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Profile belongs to a different union' });
    }

    const updated = await (prisma as any).journalistProfile.update({
      where: { id: req.params['profileId'] },
      data: {
        kycVerified:   action === 'verify',
        kycVerifiedAt: action === 'verify' ? new Date() : null,
        kycNote:       note ? (note as string).trim() : null,
      },
    });
    return res.json({ message: `KYC ${action === 'verify' ? 'verified' : 'rejected'}`, profile: updated });
  } catch (e: any) {
    console.error('[journalist/admin/kyc/verify]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── INSURANCE ────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/admin/insurance:
 *   post:
 *     summary: "[Admin] Assign insurance policy to a journalist member"
 *     description: |
 *       Assigns an accidental or health insurance policy to an approved journalist.
 *       One member can have multiple policies (one ACCIDENTAL + one HEALTH, or renewals over time).
 *       Previous active policy of same type is auto-deactivated when a new one is added.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [profileId, type, policyNumber, insurer, validFrom, validTo]
 *             properties:
 *               profileId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [ACCIDENTAL, HEALTH]
 *               policyNumber:
 *                 type: string
 *                 example: "LIC/ACC/2026/00421"
 *               insurer:
 *                 type: string
 *                 example: "LIC of India"
 *               coverAmount:
 *                 type: integer
 *                 description: Cover in INR (e.g. 500000 = 5 lakh)
 *                 example: 500000
 *               premium:
 *                 type: integer
 *                 description: Annual premium in INR
 *                 example: 1200
 *               validFrom:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-01"
 *               validTo:
 *                 type: string
 *                 format: date
 *                 example: "2027-03-31"
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Insurance assigned
 *       400:
 *         description: Missing required fields
 *       404:
 *         description: Profile not found or not approved
 */
router.post('/admin/insurance', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const { profileId, type, policyNumber, insurer, coverAmount, premium, validFrom, validTo, notes } = req.body;

    if (!profileId || !type || !policyNumber || !insurer || !validFrom || !validTo) {
      return res.status(400).json({ error: 'profileId, type, policyNumber, insurer, validFrom, validTo are required' });
    }
    if (!['ACCIDENTAL', 'HEALTH'].includes(type)) {
      return res.status(400).json({ error: 'type must be ACCIDENTAL or HEALTH' });
    }

    const profile = await (prisma as any).journalistProfile.findUnique({ where: { id: profileId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (!profile.approved) return res.status(400).json({ error: 'Insurance can only be assigned to approved members' });

    // Scope check
    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    if (scope && profile.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Profile belongs to a different union' });
    }

    // Auto-deactivate previous active policy of same type for this member
    await (prisma as any).journalistInsurance.updateMany({
      where: { profileId, type, isActive: true },
      data:  { isActive: false },
    });

    const insurance = await (prisma as any).journalistInsurance.create({
      data: {
        profileId,
        type,
        policyNumber: (policyNumber as string).trim(),
        insurer:      (insurer as string).trim(),
        coverAmount:  coverAmount ? parseInt(String(coverAmount), 10) : null,
        premium:      premium     ? parseInt(String(premium), 10)     : null,
        validFrom:    new Date(validFrom),
        validTo:      new Date(validTo),
        isActive:     true,
        notes:        notes ? (notes as string).trim() : null,
        assignedById: user.id,
      },
    });
    return res.status(201).json({ message: 'Insurance assigned', insurance });
  } catch (e: any) {
    console.error('[journalist/admin/insurance POST]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/insurance/{id}:
 *   patch:
 *     summary: "[Admin] Update an insurance policy (renew, correct details)"
 *     tags: [Journalist Union - Admin]
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
 *             properties:
 *               validTo:
 *                 type: string
 *                 format: date
 *               policyNumber:
 *                 type: string
 *               insurer:
 *                 type: string
 *               coverAmount:
 *                 type: integer
 *               premium:
 *                 type: integer
 *               isActive:
 *                 type: boolean
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Insurance updated
 *       404:
 *         description: Not found
 */
router.patch('/admin/insurance/:id', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const existing = await (prisma as any).journalistInsurance.findUnique({
      where: { id: req.params['id'] },
      include: { profile: { select: { unionName: true } } },
    });
    if (!existing) return res.status(404).json({ error: 'Insurance record not found' });

    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    if (scope && existing.profile?.unionName !== scope.unionName) {
      return res.status(403).json({ error: 'Record belongs to a different union' });
    }

    const { validTo, policyNumber, insurer, coverAmount, premium, isActive, notes } = req.body;
    const data: any = {};
    if (validTo !== undefined)       data.validTo      = new Date(validTo);
    if (policyNumber !== undefined)  data.policyNumber = (policyNumber as string).trim();
    if (insurer !== undefined)       data.insurer      = (insurer as string).trim();
    if (coverAmount !== undefined)   data.coverAmount  = parseInt(String(coverAmount), 10) || null;
    if (premium !== undefined)       data.premium      = parseInt(String(premium), 10) || null;
    if (isActive !== undefined)      data.isActive     = Boolean(isActive);
    if (notes !== undefined)         data.notes        = (notes as string).trim();

    const updated = await (prisma as any).journalistInsurance.update({ where: { id: req.params['id'] }, data });
    return res.json({ message: 'Insurance updated', insurance: updated });
  } catch (e: any) {
    console.error('[journalist/admin/insurance PATCH]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/insurance/member/{profileId}:
 *   get:
 *     summary: "[Admin] Get all insurance policies for a member"
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of insurance policies
 */
router.get('/admin/insurance/member/:profileId', jwtAuth, requireJournalistUnionAdmin, async (req: Request, res: Response) => {
  try {
    const insurances = await (prisma as any).journalistInsurance.findMany({
      where:   { profileId: req.params['profileId'] },
      orderBy: { createdAt: 'desc' },
      include: { assignedBy: { select: { profile: { select: { fullName: true } } } } },
    });
    return res.json({ insurances });
  } catch (e: any) {
    console.error('[journalist/admin/insurance/member]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/my-insurance:
 *   get:
 *     summary: Get my active insurance policies
 *     tags: [Journalist Union - Member]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: My insurance policies (active only)
 *       404:
 *         description: No journalist profile found
 */
router.get('/my-insurance', jwtAuth, async (req: Request, res: Response) => {
  try {
    const user = currentUser(req);
    const profile = await (prisma as any).journalistProfile.findUnique({ where: { userId: user.id } });
    if (!profile) return res.status(404).json({ error: 'No journalist profile found' });

    // Auto-mark expired insurances
    await (prisma as any).journalistInsurance.updateMany({
      where: { profileId: profile.id, isActive: true, validTo: { lt: new Date() } },
      data:  { isActive: false },
    });

    const insurances = await (prisma as any).journalistInsurance.findMany({
      where:   { profileId: profile.id },
      orderBy: [{ isActive: 'desc' }, { validTo: 'desc' }],
      select: {
        id: true, type: true, policyNumber: true, insurer: true,
        coverAmount: true, validFrom: true, validTo: true, isActive: true, notes: true,
      },
    });
    return res.json({ insurances });
  } catch (e: any) {
    console.error('[journalist/my-insurance]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── UNION SETTINGS ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /journalist/public/settings/{unionName}:
 *   get:
 *     summary: Get public settings for a union (logo, display name, registration no, all covered states)
 *     tags: [Journalist Union - Public]
 *     parameters:
 *       - in: path
 *         name: unionName
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Union settings including stateConfigs array
 *       404:
 *         description: Settings not configured yet
 */
router.get('/public/settings/:unionName', async (req: Request, res: Response) => {
  try {
    const settings = await (prisma as any).journalistUnionSettings.findUnique({
      where:   { unionName: req.params['unionName'] },
      include: { stateConfigs: true },
    });
    if (!settings) return res.status(404).json({ error: 'No settings found for this union' });
    return res.json(settings);
  } catch (e: any) {
    console.error('[journalist/public/settings]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/public/settings/{unionName}/state/{state}:
 *   get:
 *     summary: Get state-specific settings for a union (president signature, state contact, etc.)
 *     tags: [Journalist Union - Public]
 *     parameters:
 *       - in: path
 *         name: unionName
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: state
 *         required: true
 *         schema:
 *           type: string
 *         description: "e.g. Andhra Pradesh"
 *     responses:
 *       200:
 *         description: State-specific settings
 *       404:
 *         description: No state settings found
 */
router.get('/public/settings/:unionName/state/:state', async (req: Request, res: Response) => {
  try {
    const stateConfig = await (prisma as any).journalistUnionStateSettings.findUnique({
      where: { unionName_state: { unionName: req.params['unionName'], state: req.params['state'] } },
    });
    if (!stateConfig) return res.status(404).json({ error: 'No state settings found' });
    return res.json(stateConfig);
  } catch (e: any) {
    console.error('[journalist/public/settings/state]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/settings:
 *   get:
 *     summary: "[Admin] Get this union's settings (including all state configs)"
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: unionName
 *         schema:
 *           type: string
 *         description: Required for SuperAdmin; scoped admins use their assigned union
 *     responses:
 *       200:
 *         description: Union settings with stateConfigs array
 */
router.get('/admin/settings', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    let targetUnion: string | undefined = scope?.unionName;
    if (!targetUnion) {
      targetUnion = req.query['unionName'] as string | undefined;
      if (!targetUnion) return res.status(400).json({ error: 'unionName query param required for Super Admin' });
    }
    const settings = await (prisma as any).journalistUnionSettings.findUnique({
      where:   { unionName: targetUnion },
      include: { stateConfigs: true },
    });
    return res.json(settings || { unionName: targetUnion, configured: false });
  } catch (e: any) {
    console.error('[journalist/admin/settings GET]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/settings:
 *   put:
 *     summary: "[Admin] Create or update union-level text settings"
 *     description: |
 *       Upserts the union settings record. Pass only the fields you want to update.
 *       - Use `states` array to declare all states the union covers.
 *       - For image assets (logo, stamp) use `/admin/settings/upload`.
 *       - For state-specific settings (president signature) use `/admin/settings/state`.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unionName:
 *                 type: string
 *                 description: Required for SuperAdmin
 *               displayName:
 *                 type: string
 *               registrationNumber:
 *                 type: string
 *               address:
 *                 type: string
 *               states:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Andhra Pradesh", "Telangana"]
 *               primaryState:
 *                 type: string
 *                 example: Andhra Pradesh
 *               foundedYear:
 *                 type: integer
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               websiteUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Settings saved
 */
router.put('/admin/settings', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    let targetUnion: string = scope?.unionName || (req.body.unionName as string);
    if (!targetUnion) return res.status(400).json({ error: 'unionName is required' });

    const { displayName, registrationNumber, address, states, primaryState, foundedYear, email, phone, websiteUrl } = req.body;

    const data: any = {};
    if (displayName !== undefined)        data.displayName = (displayName as string).trim();
    if (registrationNumber !== undefined) data.registrationNumber = (registrationNumber as string).trim();
    if (address !== undefined)            data.address = (address as string).trim();
    if (states !== undefined)             data.states = Array.isArray(states) ? states.map((s: string) => s.trim()) : [];
    if (primaryState !== undefined)       data.primaryState = (primaryState as string).trim();
    if (foundedYear !== undefined)        data.foundedYear = parseInt(String(foundedYear), 10) || null;
    if (email !== undefined)              data.email = (email as string).trim();
    if (phone !== undefined)              data.phone = (phone as string).trim();
    if (websiteUrl !== undefined)         data.websiteUrl = (websiteUrl as string).trim();

    const settings = await (prisma as any).journalistUnionSettings.upsert({
      where:   { unionName: targetUnion },
      create:  { unionName: targetUnion, ...data },
      update:  data,
      include: { stateConfigs: true },
    });
    return res.json({ message: 'Settings saved', settings });
  } catch (e: any) {
    console.error('[journalist/admin/settings PUT]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/settings/state:
 *   put:
 *     summary: "[Admin] Create or update state-specific settings for a union"
 *     description: |
 *       Each state unit can have its own address, contact details, and president signature.
 *       For uploading the president signature image use `/admin/settings/state/upload`.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [state]
 *             properties:
 *               unionName:
 *                 type: string
 *                 description: Required for SuperAdmin; scoped admins use their assigned union
 *               state:
 *                 type: string
 *                 example: Andhra Pradesh
 *               address:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: State settings saved
 *       400:
 *         description: Missing state or unionName
 */
router.put('/admin/settings/state', jwtAuth, requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
    const targetUnion: string = scope?.unionName || (req.body.unionName as string);
    if (!targetUnion) return res.status(400).json({ error: 'unionName is required' });

    const { state, address, email, phone } = req.body;
    if (!state) return res.status(400).json({ error: 'state is required' });

    // Scoped union admin: enforce their own state if set
    const user = currentUser(req);
    const role = user.role?.name;
    if (role !== 'SUPER_ADMIN') {
      const adminRecord = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId: user.id, unionName: targetUnion } });
      if (adminRecord?.state && adminRecord.state !== state) {
        return res.status(403).json({ error: `You are scoped to "${adminRecord.state}" — cannot modify "${state}"` });
      }
    }

    const data: any = {};
    if (address !== undefined) data.address = (address as string).trim();
    if (email !== undefined)   data.email   = (email as string).trim();
    if (phone !== undefined)   data.phone   = (phone as string).trim();

    // Ensure parent JournalistUnionSettings record exists first
    await (prisma as any).journalistUnionSettings.upsert({
      where:  { unionName: targetUnion },
      create: { unionName: targetUnion },
      update: {},
    });

    const stateConfig = await (prisma as any).journalistUnionStateSettings.upsert({
      where:  { unionName_state: { unionName: targetUnion, state } },
      create: { unionName: targetUnion, state, ...data },
      update: data,
    });
    return res.json({ message: 'State settings saved', stateConfig });
  } catch (e: any) {
    console.error('[journalist/admin/settings/state PUT]', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /journalist/admin/settings/upload:
 *   post:
 *     summary: "[Admin] Upload a union-level image asset (logo / stamp)"
 *     description: |
 *       Uploads union-wide assets. All images converted to PNG and stored in R2.
 *
 *       **field** must be one of:
 *       - `logo` — Main union logo (website, letterhead)
 *       - `idCardLogo` — Logo printed on press ID cards
 *       - `stamp` — Round rubber stamp image (transparent PNG)
 *       - `forStamp` — "For [UnionName]" text/seal stamp
 *
 *       R2 key: `journalist-union/{unionName}/assets/{field}.png`
 *
 *       For president signature (per-state), use `/admin/settings/state/upload`.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, field]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               field:
 *                 type: string
 *                 enum: [logo, idCardLogo, stamp, forStamp]
 *               unionName:
 *                 type: string
 *                 description: Required for SuperAdmin
 *     responses:
 *       200:
 *         description: Asset uploaded
 *       400:
 *         description: Invalid field or missing file
 *       500:
 *         description: R2 not configured
 */
router.post(
  '/admin/settings/upload',
  jwtAuth,
  requireSuperAdmin,
  uploadSingle.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!R2_BUCKET) return res.status(500).json({ error: 'R2 storage is not configured on this server' });

      const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
      const targetUnion: string = scope?.unionName || (req.body.unionName as string);
      if (!targetUnion) return res.status(400).json({ error: 'unionName is required' });

      const field = req.body.field as string;
      if (!field || !ASSET_FIELD_MAP[field]) {
        return res.status(400).json({ error: 'Invalid field. Must be one of: ' + Object.keys(ASSET_FIELD_MAP).join(', ') });
      }

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'file is required (multipart/form-data)' });

      const pngBuffer = await sharp(file.buffer).png().toBuffer();
      const safeUnion = targetUnion.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const r2Key = `journalist-union/${safeUnion}/assets/${field}.png`;

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: r2Key, Body: pngBuffer,
        ContentType: 'image/png', CacheControl: 'public, max-age=2592000',
      }));

      const publicUrl = getPublicUrl(r2Key);
      const settings = await (prisma as any).journalistUnionSettings.upsert({
        where:  { unionName: targetUnion },
        create: { unionName: targetUnion, [ASSET_FIELD_MAP[field]]: publicUrl },
        update: { [ASSET_FIELD_MAP[field]]: publicUrl },
      });
      return res.json({ field, url: publicUrl, settings });
    } catch (e: any) {
      console.error('[journalist/admin/settings/upload]', e);
      return res.status(500).json({ error: 'Upload failed', details: e.message });
    }
  },
);

/**
 * @swagger
 * /journalist/admin/settings/state/upload:
 *   post:
 *     summary: "[Admin] Upload a state-specific image asset (president signature / state logo)"
 *     description: |
 *       Uploads per-state assets. All images converted to PNG and stored in R2.
 *
 *       **field** must be one of:
 *       - `presidentSignature` — Ink signature of THIS state's President
 *       - `stateLogo` — State-unit logo (optional, overrides union logo for this state)
 *
 *       R2 key: `journalist-union/{unionName}/states/{state}/{field}.png`
 *
 *       Re-uploading the same field always overwrites. Scoped admins can only upload
 *       for their own state.
 *     tags: [Journalist Union - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, field, state]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               field:
 *                 type: string
 *                 enum: [presidentSignature, stateLogo]
 *               state:
 *                 type: string
 *                 example: Andhra Pradesh
 *               unionName:
 *                 type: string
 *                 description: Required for SuperAdmin
 *     responses:
 *       200:
 *         description: Asset uploaded and state settings updated
 *       400:
 *         description: Invalid field, missing file, or missing state
 *       403:
 *         description: State scope violation
 *       500:
 *         description: R2 not configured
 */
router.post(
  '/admin/settings/state/upload',
  jwtAuth,
  requireSuperAdmin,
  uploadSingle.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!R2_BUCKET) return res.status(500).json({ error: 'R2 storage is not configured on this server' });

      const scope = res.locals['journalistUnionScope'] as { unionName: string } | undefined;
      const targetUnion: string = scope?.unionName || (req.body.unionName as string);
      if (!targetUnion) return res.status(400).json({ error: 'unionName is required' });

      const state = (req.body.state as string)?.trim();
      if (!state) return res.status(400).json({ error: 'state is required' });

      const field = req.body.field as string;
      if (!field || !STATE_ASSET_FIELD_MAP[field]) {
        return res.status(400).json({ error: 'Invalid field. Must be one of: ' + Object.keys(STATE_ASSET_FIELD_MAP).join(', ') });
      }

      // Scoped admin: enforce state restriction
      const user = currentUser(req);
      const role = user.role?.name;
      if (role !== 'SUPER_ADMIN') {
        const adminRecord = await (prisma as any).journalistUnionAdmin.findFirst({ where: { userId: user.id, unionName: targetUnion } });
        if (adminRecord?.state && adminRecord.state !== state) {
          return res.status(403).json({ error: `You are scoped to "${adminRecord.state}" — cannot upload for "${state}"` });
        }
      }

      const file = req.file;
      if (!file) return res.status(400).json({ error: 'file is required (multipart/form-data)' });

      const pngBuffer = await sharp(file.buffer).png().toBuffer();
      const safeUnion = targetUnion.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const safeState = state.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
      const r2Key = `journalist-union/${safeUnion}/states/${safeState}/${field}.png`;

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET, Key: r2Key, Body: pngBuffer,
        ContentType: 'image/png', CacheControl: 'public, max-age=2592000',
      }));

      const publicUrl = getPublicUrl(r2Key);
      const dbColumn = STATE_ASSET_FIELD_MAP[field];

      // Ensure parent settings record exists
      await (prisma as any).journalistUnionSettings.upsert({
        where: { unionName: targetUnion }, create: { unionName: targetUnion }, update: {},
      });

      const stateConfig = await (prisma as any).journalistUnionStateSettings.upsert({
        where:  { unionName_state: { unionName: targetUnion, state } },
        create: { unionName: targetUnion, state, [dbColumn]: publicUrl },
        update: { [dbColumn]: publicUrl },
      });
      return res.json({ field, state, url: publicUrl, stateConfig });
    } catch (e: any) {
      console.error('[journalist/admin/settings/state/upload]', e);
      return res.status(500).json({ error: 'Upload failed', details: e.message });
    }
  },
);

export default router;
