import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperAdmin } from '../middlewares/authz';
import bcrypt from 'bcrypt';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Platform-wide administrative endpoints
 */

/**
 * @swagger
 * /admin/razorpay-config/global:
 *   post:
 *     summary: Create global Razorpay keys (SUPER_ADMIN)
 *     description: Fails if a global config already exists. Use PUT to update.
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       201: { description: Created }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *       409: { description: Already exists }
 *   put:
 *     summary: Upsert global Razorpay keys (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [keyId, keySecret]
 *             properties:
 *               keyId: { type: string }
 *               keySecret: { type: string }
 *               active: { type: boolean, default: true }
 *     responses:
 *       200: { description: Global config upserted }
 *       400: { description: Validation error }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 *   get:
 *     summary: Get global Razorpay config (SUPER_ADMIN)
 *     tags: [Razorpay Config]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Global config (masked) }
 *       401: { description: Unauthorized }
 *       403: { description: Forbidden }
 */
router.put('/razorpay-config/global', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    console.log('[ADMIN] Upserting global RazorpayConfig');
    // Because tenantId is nullable and @@unique([tenantId]) allows many NULLs in Postgres, we cannot rely on upsert by tenantId:null.
    // Instead fetch first existing global row (tenantId == null) and update by id, else create new.
    const existing = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null }, orderBy: { createdAt: 'asc' } });
    let config;
    if (existing) {
      config = await (prisma as any).razorpayConfig.update({
        where: { id: existing.id },
        data: { keyId, keySecret, active: Boolean(active) }
      });
    } else {
      config = await (prisma as any).razorpayConfig.create({
        data: { tenantId: null, keyId, keySecret, active: Boolean(active) }
      });
    }
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e: any) {
    console.error('global razorpay-config upsert error (admin router)', e);
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Duplicate global Razorpay config' });
    }
    res.status(500).json({ error: 'Failed to upsert global Razorpay config' });
  }
});

router.post('/razorpay-config/global', auth, requireSuperAdmin, async (req, res) => {
  try {
    // Cannot use findUnique with tenantId:null reliably; use findFirst to detect existing global row.
    const existing = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null } });
    if (existing) return res.status(409).json({ error: 'Global Razorpay config already exists. Use PUT to update.' });
    const { keyId, keySecret, active = true } = req.body || {};
    if (!keyId || !keySecret) return res.status(400).json({ error: 'keyId and keySecret are required' });
    const created = await (prisma as any).razorpayConfig.create({ data: { tenantId: null, keyId, keySecret, active: Boolean(active) } });
    res.status(201).json({
      id: created.id,
      tenantId: created.tenantId,
      keyId: created.keyId,
      active: created.active,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt
    });
  } catch (e: any) {
    console.error('global razorpay-config post error', e);
    if (e.code === 'P2002') return res.status(409).json({ error: 'Duplicate global Razorpay config' });
    res.status(500).json({ error: 'Failed to create global Razorpay config' });
  }
});

router.get('/razorpay-config/global', auth, requireSuperAdmin, async (_req, res) => {
  try {
    console.log('[ADMIN] Fetching global RazorpayConfig');
    // Use findFirst because findUnique rejects nullable unique field queries with null
    const config = await (prisma as any).razorpayConfig.findFirst({ where: { tenantId: null } });
    if (!config) return res.status(404).json({ error: 'Global Razorpay config not set' });
    const maskedSecret = config.keySecret ? `${config.keySecret.slice(0,4)}***${config.keySecret.slice(-2)}` : null;
    res.json({
      id: config.id,
      tenantId: config.tenantId,
      keyId: config.keyId,
      keySecretMasked: maskedSecret,
      active: config.active,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt
    });
  } catch (e) {
    console.error('global razorpay-config get error (admin router)', e);
    res.status(500).json({ error: 'Failed to fetch global Razorpay config' });
  }
});

// Debug endpoint: list all RazorpayConfig rows (SUPER_ADMIN only)
/**
 * @swagger
 * /admin/razorpay-config/_debug/list:
 *   get:
 *     summary: DEBUG ONLY - List all RazorpayConfig rows
 *     tags: [Razorpay Config]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Array of configs }
 */
router.get('/razorpay-config/_debug/list', auth, requireSuperAdmin, async (_req, res) => {
  try {
    const rows = await (prisma as any).razorpayConfig.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenantId,
      keyId: r.keyId,
      active: r.active,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    })));
  } catch (e) {
    console.error('debug list razorpay-config error', e);
    res.status(500).json({ error: 'Failed to list configs' });
  }
});

/**
 * @swagger
 * /admin/ai/usage:
 *   get:
 *     summary: List AI usage events (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *     responses:
 *       200: { description: Usage events }
 */
router.get('/ai/usage', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.query as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const limitRaw = Number((req.query as any).limit || 50);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 50;

    const rows = await (prisma as any).aiUsageEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return res.json({ tenantId, count: rows.length, items: rows });
  } catch (e) {
    console.error('admin ai usage list error', e);
    return res.status(500).json({ error: 'Failed to list AI usage' });
  }
});

/**
 * @swagger
 * /admin/ai/usage/summary:
 *   get:
 *     summary: Summarize AI usage (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: from
 *         required: false
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: false
 *         schema: { type: string, format: date-time }
 *     responses:
 *       200: { description: Totals }
 */
router.get('/ai/usage/summary', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.query as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });
    const fromRaw = (req.query as any).from ? String((req.query as any).from) : '';
    const toRaw = (req.query as any).to ? String((req.query as any).to) : '';
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;
    if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid from date' });
    if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid to date' });

    const where: any = { tenantId };
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = from;
      if (to) where.createdAt.lte = to;
    }

    const agg = await (prisma as any).aiUsageEvent.aggregate({
      where,
      _count: { _all: true },
      _sum: { promptTokens: true, completionTokens: true, totalTokens: true },
    });

    return res.json({
      tenantId,
      range: { from: from ? from.toISOString() : null, to: to ? to.toISOString() : null },
      count: agg?._count?._all || 0,
      tokens: {
        prompt: agg?._sum?.promptTokens || 0,
        completion: agg?._sum?.completionTokens || 0,
        total: agg?._sum?.totalTokens || 0,
      }
    });
  } catch (e) {
    console.error('admin ai usage summary error', e);
    return res.status(500).json({ error: 'Failed to summarize AI usage' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/ai-billing:
 *   patch:
 *     summary: Configure tenant AI billing enforcement (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               aiBillingEnabled: { type: boolean }
 *               aiMonthlyTokenLimit: { type: integer, nullable: true, description: 'Monthly token cap. Null disables cap (even if billing enabled).' }
 *           examples:
 *             enableCap:
 *               value: { aiBillingEnabled: true, aiMonthlyTokenLimit: 200000 }
 *             disableBilling:
 *               value: { aiBillingEnabled: false, aiMonthlyTokenLimit: null }
 *     responses:
 *       200: { description: Updated flags }
 */
router.patch('/tenants/:tenantId/ai-billing', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.params as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const aiBillingEnabled = typeof req.body?.aiBillingEnabled === 'boolean' ? req.body.aiBillingEnabled : undefined;
    const aiMonthlyTokenLimitRaw = req.body?.aiMonthlyTokenLimit;
    const aiMonthlyTokenLimit = aiMonthlyTokenLimitRaw === null || typeof aiMonthlyTokenLimitRaw === 'undefined'
      ? null
      : Number(aiMonthlyTokenLimitRaw);

    if (typeof aiBillingEnabled === 'undefined') {
      return res.status(400).json({ error: 'aiBillingEnabled boolean required' });
    }
    if (aiMonthlyTokenLimit !== null) {
      if (!Number.isFinite(aiMonthlyTokenLimit) || aiMonthlyTokenLimit < 0) {
        return res.status(400).json({ error: 'aiMonthlyTokenLimit must be a non-negative integer or null' });
      }
    }

    const upserted = await (prisma as any).tenantFeatureFlags.upsert({
      where: { tenantId },
      update: {
        aiBillingEnabled,
        aiMonthlyTokenLimit: aiMonthlyTokenLimit === null ? null : Math.floor(aiMonthlyTokenLimit),
      },
      create: {
        tenantId,
        aiBillingEnabled,
        aiMonthlyTokenLimit: aiMonthlyTokenLimit === null ? null : Math.floor(aiMonthlyTokenLimit),
      },
    });

    return res.json({ tenantId, flags: upserted });
  } catch (e) {
    console.error('admin tenant ai-billing patch error', e);
    return res.status(500).json({ error: 'Failed to update tenant AI billing' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/ai-billing/status:
 *   get:
 *     summary: Get tenant AI billing status (SUPER_ADMIN)
 *     tags: [AI Rewrite]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Billing status with current month token usage }
 */
router.get('/tenants/:tenantId/ai-billing/status', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantId = String((req.params as any).tenantId || '').trim();
    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const flags = await (prisma as any).tenantFeatureFlags.findUnique({ where: { tenantId } }).catch(() => null);
    const billingEnabled = flags?.aiBillingEnabled === true;
    const limit = typeof flags?.aiMonthlyTokenLimit === 'number' ? flags.aiMonthlyTokenLimit : null;

    const nowUtc = new Date();
    const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
    const usedAgg = await (prisma as any).aiUsageEvent?.aggregate?.({
      where: { tenantId, createdAt: { gte: monthStart } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }).catch(() => null);

    const used = Number(usedAgg?._sum?.totalTokens || 0);
    const count = Number(usedAgg?._count?._all || 0);
    const remaining = limit && limit > 0 ? Math.max(0, limit - used) : null;
    const exceeded = limit && limit > 0 ? used >= limit : false;

    return res.json({
      tenantId,
      flags: {
        aiBillingEnabled: billingEnabled,
        aiMonthlyTokenLimit: limit,
      },
      currentMonth: {
        monthStartUtc: monthStart.toISOString(),
        usageEvents: count,
        usedTokens: used,
        remainingTokens: remaining,
        exceeded,
      }
    });
  } catch (e) {
    console.error('admin tenant ai-billing status error', e);
    return res.status(500).json({ error: 'Failed to fetch tenant AI billing status' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/admins:
 *   post:
 *     summary: Create Tenant Admin for a specific tenant (SUPER_ADMIN only)
 *     description: |
 *       Creates a new user with TENANT_ADMIN role and links them to the specified tenant.
 *       If user with mobile already exists, updates their role to TENANT_ADMIN.
 *       
 *       Creates:
 *       - User (with TENANT_ADMIN role)
 *       - UserProfile (with fullName)
 *       - Reporter (links user to tenant at STATE level)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: Tenant ID to create admin for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber, fullName]
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 description: Admin mobile number (10 digits)
 *                 example: "9876543210"
 *               fullName:
 *                 type: string
 *                 description: Full name of the admin
 *                 example: "Tenant Admin Name"
 *               mpin:
 *                 type: string
 *                 description: "4-digit MPIN for login (default is last 4 digits of mobile)"
 *                 example: "1234"
 *               designationId:
 *                 type: string
 *                 description: Reporter designation ID (optional, uses first available if not provided)
 *               stateId:
 *                 type: string
 *                 description: State ID for location (optional, uses tenant's first state if not provided)
 *           examples:
 *             basic:
 *               summary: Basic tenant admin
 *               value:
 *                 mobileNumber: "9876543210"
 *                 fullName: "Srinivas Reddy"
 *             withMpin:
 *               summary: With custom MPIN
 *               value:
 *                 mobileNumber: "9876543210"
 *                 fullName: "Srinivas Reddy"
 *                 mpin: "5678"
 *     responses:
 *       201:
 *         description: Tenant admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 user:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     mobileNumber: { type: string }
 *                     role: { type: string }
 *                 profile:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     fullName: { type: string }
 *                 reporter:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     tenantId: { type: string }
 *                     level: { type: string }
 *                 tenant:
 *                   type: object
 *                   properties:
 *                     id: { type: string }
 *                     name: { type: string }
 *                 loginCredentials:
 *                   type: object
 *                   properties:
 *                     mobileNumber: { type: string }
 *                     mpin: { type: string }
 *             example:
 *               success: true
 *               message: "Tenant admin created successfully"
 *               user:
 *                 id: "cmxxx"
 *                 mobileNumber: "9876543210"
 *                 role: "TENANT_ADMIN"
 *               profile:
 *                 id: "cmyyy"
 *                 fullName: "Srinivas Reddy"
 *               reporter:
 *                 id: "cmzzz"
 *                 tenantId: "cmtenant"
 *                 level: "STATE"
 *               tenant:
 *                 id: "cmtenant"
 *                 name: "Kaburlu Today"
 *               loginCredentials:
 *                 mobileNumber: "9876543210"
 *                 mpin: "3210"
 *       400: { description: Validation error - missing mobileNumber or fullName }
 *       404: { description: Tenant not found }
 *       409: { description: User already exists as admin in this tenant }
 */
router.post('/tenants/:tenantId/admins', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { mobileNumber, fullName, mpin, designationId, stateId } = req.body || {};

    // Validation
    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });
    if (!fullName) return res.status(400).json({ error: 'fullName is required' });

    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length < 10) return res.status(400).json({ error: 'Invalid mobile number' });

    // Check tenant exists
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Find or create TENANT_ADMIN role
    let role = await (prisma as any).role.findFirst({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } }
    });
    if (!role) {
      role = await (prisma as any).role.create({
        data: {
          name: 'TENANT_ADMIN',
          permissions: {
            tenant: ['read', 'update'],
            reporters: ['create', 'read', 'update', 'delete'],
            articles: ['create', 'read', 'update', 'delete', 'approve'],
            shortnews: ['create', 'read', 'update', 'delete', 'approve'],
            idCards: ['generate', 'regenerate', 'resend'],
            settings: ['read', 'update'],
          }
        }
      });
      console.log('[Admin] Created TENANT_ADMIN role:', role.id);
    }

    // Get default language
    const language = await (prisma as any).language.findFirst({ where: { isDefault: true } }) ||
                     await (prisma as any).language.findFirst();

    // Get state (from param or tenant's first reporter's state)
    let state = null;
    if (stateId) {
      state = await (prisma as any).state.findUnique({ where: { id: stateId } });
    }
    if (!state) {
      state = await (prisma as any).state.findFirst({ orderBy: { name: 'asc' } });
    }

    // Get designation
    let designation = null;
    if (designationId) {
      designation = await (prisma as any).reporterDesignation.findUnique({ where: { id: designationId } });
    }
    if (!designation) {
      designation = await (prisma as any).reporterDesignation.findFirst({
        where: {
          OR: [
            { name: { contains: 'admin', mode: 'insensitive' } },
            { name: { contains: 'editor', mode: 'insensitive' } },
            { name: { contains: 'chief', mode: 'insensitive' } },
          ]
        }
      }) || await (prisma as any).reporterDesignation.findFirst();
    }

    // Default MPIN: last 4 digits of mobile or provided
    const finalMpin = mpin || cleanMobile.slice(-4);
    const hashedMpin = await bcrypt.hash(finalMpin, 10);

    // Check if user exists
    let user = await (prisma as any).user.findFirst({
      where: { mobileNumber: cleanMobile }
    });

    let userCreated = false;
    if (user) {
      // Check if already reporter in this tenant
      const existingReporter = await (prisma as any).reporter.findFirst({
        where: { userId: user.id, tenantId }
      });
      if (existingReporter) {
        // Update user role and return existing
        await (prisma as any).user.update({
          where: { id: user.id },
          data: { roleId: role.id }
        });
        return res.status(200).json({
          success: true,
          message: 'User already exists as reporter in this tenant, updated role to TENANT_ADMIN',
          user: { id: user.id, mobileNumber: cleanMobile, role: role.name },
          reporter: { id: existingReporter.id, tenantId, level: existingReporter.level },
          tenant: { id: tenant.id, name: tenant.name },
          loginCredentials: { mobileNumber: cleanMobile, mpin: '(existing - not changed)' }
        });
      }
      // Update role
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: { roleId: role.id }
      });
    } else {
      // Create user
      user = await (prisma as any).user.create({
        data: {
          mobileNumber: cleanMobile,
          mpin: hashedMpin,
          roleId: role.id,
          languageId: language?.id,
          status: 'ACTIVE',
        }
      });
      userCreated = true;
    }

    // Create or update UserProfile
    let profile = await (prisma as any).userProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await (prisma as any).userProfile.create({
        data: {
          userId: user.id,
          fullName: String(fullName).trim(),
        }
      });
    } else {
      profile = await (prisma as any).userProfile.update({
        where: { userId: user.id },
        data: { fullName: String(fullName).trim() }
      });
    }

    // Create Reporter (links user to tenant) - Tenant Admin has permanent access (no login days limit)
    const reporter = await (prisma as any).reporter.create({
      data: {
        tenantId,
        userId: user.id,
        designationId: designation?.id,
        level: 'STATE',
        stateId: state?.id,
        active: true,
        subscriptionActive: false,
        // Tenant Admin: no login restrictions
        manualLoginEnabled: false,
        manualLoginDays: null,
        manualLoginEndsAt: null,
      }
    });

    console.log(`[Admin] Created tenant admin: userId=${user.id}, reporterId=${reporter.id}, tenant=${tenant.name}`);

    res.status(201).json({
      success: true,
      message: userCreated ? 'Tenant admin created successfully' : 'Existing user linked as tenant admin',
      user: {
        id: user.id,
        mobileNumber: cleanMobile,
        role: role.name,
      },
      profile: {
        id: profile.id,
        fullName: profile.fullName,
      },
      reporter: {
        id: reporter.id,
        tenantId,
        level: 'STATE',
        designation: designation?.name,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      loginCredentials: {
        mobileNumber: cleanMobile,
        mpin: userCreated ? finalMpin : '(existing user - mpin not changed)',
      }
    });
  } catch (e: any) {
    console.error('create tenant admin error', e);
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'User or reporter already exists', details: e.meta });
    }
    res.status(500).json({ error: 'Failed to create tenant admin' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/admins:
 *   get:
 *     summary: List all admins for a tenant (SUPER_ADMIN only)
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of tenant admins
 */
router.get('/tenants/:tenantId/admins', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get TENANT_ADMIN role IDs
    const adminRoles = await (prisma as any).role.findMany({
      where: { name: { in: ['TENANT_ADMIN', 'Admin', 'SUPER_ADMIN', 'CHIEF_EDITOR'] } },
      select: { id: true, name: true }
    });
    const roleIds = adminRoles.map((r: any) => r.id);
    const roleMap = Object.fromEntries(adminRoles.map((r: any) => [r.id, r.name]));

    // Get reporters in this tenant with admin roles
    const reporters = await (prisma as any).reporter.findMany({
      where: {
        tenantId,
        user: { roleId: { in: roleIds } }
      },
      include: {
        user: { select: { id: true, mobileNumber: true, roleId: true, status: true } },
        designation: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get profiles
    const userIds = reporters.map((r: any) => r.userId).filter(Boolean);
    const profiles = await (prisma as any).userProfile.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, fullName: true }
    });
    const profileMap = Object.fromEntries(profiles.map((p: any) => [p.userId, p.fullName]));

    const admins = reporters.map((r: any) => ({
      reporterId: r.id,
      userId: r.userId,
      mobileNumber: r.user?.mobileNumber,
      fullName: profileMap[r.userId] || null,
      role: roleMap[r.user?.roleId] || 'UNKNOWN',
      designation: r.designation?.name,
      level: r.level,
      active: r.active,
      createdAt: r.createdAt,
    }));

    res.json({
      tenantId,
      count: admins.length,
      admins
    });
  } catch (e) {
    console.error('list tenant admins error', e);
    res.status(500).json({ error: 'Failed to list tenant admins' });
  }
});

/**
 * @swagger
 * /admin/tenants/{tenantId}/admins:
 *   put:
 *     summary: Upsert Tenant Admin - create if missing, update if exists (SUPER_ADMIN only)
 *     description: |
 *       Creates a new admin if not exists, or updates existing admin's details.
 *       Uses mobileNumber as the unique identifier.
 *       
 *       - If user with mobile doesn't exist: Creates user + profile + reporter
 *       - If user exists but not in tenant: Links to tenant as reporter
 *       - If user already admin in tenant: Updates profile/role
 *     tags: [Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mobileNumber, fullName]
 *             properties:
 *               mobileNumber:
 *                 type: string
 *                 example: "9876543210"
 *               fullName:
 *                 type: string
 *                 example: "Updated Admin Name"
 *               mpin:
 *                 type: string
 *                 description: Set new MPIN (only for new users or if resetMpin=true)
 *               resetMpin:
 *                 type: boolean
 *                 description: Force reset MPIN even for existing user
 *               active:
 *                 type: boolean
 *                 description: Set reporter active status
 *     responses:
 *       200:
 *         description: Admin upserted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 action: { type: string, enum: [created, updated, linked] }
 *                 user: { type: object }
 *                 profile: { type: object }
 *                 reporter: { type: object }
 *                 tenant: { type: object }
 *                 loginCredentials: { type: object }
 */
router.put('/tenants/:tenantId/admins', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { 
      mobileNumber, 
      fullName, 
      mpin, 
      resetMpin = false,
      active = true,
      designationId,
      stateId 
    } = req.body || {};

    // Validation
    if (!mobileNumber) return res.status(400).json({ error: 'mobileNumber is required' });
    if (!fullName) return res.status(400).json({ error: 'fullName is required' });

    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length < 10) return res.status(400).json({ error: 'Invalid mobile number' });

    // Check tenant exists
    const tenant = await (prisma as any).tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, stateId: true }
    });
    if (!tenant) return res.status(404).json({ error: 'Tenant not found' });

    // Find or create TENANT_ADMIN role
    let role = await (prisma as any).role.findFirst({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } }
    });
    if (!role) {
      role = await (prisma as any).role.create({
        data: {
          name: 'TENANT_ADMIN',
          permissions: {
            tenant: ['read', 'update'],
            reporters: ['create', 'read', 'update', 'delete'],
            articles: ['create', 'read', 'update', 'delete', 'approve'],
            shortnews: ['create', 'read', 'update', 'delete', 'approve'],
            idCards: ['generate', 'regenerate', 'resend'],
            settings: ['read', 'update'],
          }
        }
      });
    }

    // Get default language
    const language = await (prisma as any).language.findFirst({ where: { isDefault: true } }) ||
                     await (prisma as any).language.findFirst();

    // Get state
    let state = null;
    if (stateId) {
      state = await (prisma as any).state.findUnique({ where: { id: stateId } });
    }
    if (!state && tenant.stateId) {
      state = await (prisma as any).state.findUnique({ where: { id: tenant.stateId } });
    }
    if (!state) {
      state = await (prisma as any).state.findFirst({ orderBy: { name: 'asc' } });
    }

    // Get designation
    let designation = null;
    if (designationId) {
      designation = await (prisma as any).reporterDesignation.findUnique({ where: { id: designationId } });
    }
    if (!designation) {
      designation = await (prisma as any).reporterDesignation.findFirst({
        where: {
          OR: [
            { name: { contains: 'admin', mode: 'insensitive' } },
            { name: { contains: 'editor', mode: 'insensitive' } },
          ]
        }
      }) || await (prisma as any).reporterDesignation.findFirst();
    }

    // Default MPIN
    const finalMpin = mpin || cleanMobile.slice(-4);
    const hashedMpin = await bcrypt.hash(finalMpin, 10);

    let action: 'created' | 'updated' | 'linked' = 'created';
    let mpinChanged = false;

    // Check if user exists
    let user = await (prisma as any).user.findFirst({
      where: { mobileNumber: cleanMobile }
    });

    if (user) {
      // User exists - update role and optionally mpin
      const updateData: any = { roleId: role.id };
      if (resetMpin) {
        updateData.mpin = hashedMpin;
        mpinChanged = true;
      }
      user = await (prisma as any).user.update({
        where: { id: user.id },
        data: updateData
      });
      action = 'updated';
    } else {
      // Create new user
      user = await (prisma as any).user.create({
        data: {
          mobileNumber: cleanMobile,
          mpin: hashedMpin,
          roleId: role.id,
          languageId: language?.id,
          status: 'ACTIVE',
        }
      });
      mpinChanged = true;
    }

    // Upsert UserProfile
    let profile = await (prisma as any).userProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      profile = await (prisma as any).userProfile.create({
        data: {
          userId: user.id,
          fullName: String(fullName).trim(),
        }
      });
    } else {
      profile = await (prisma as any).userProfile.update({
        where: { userId: user.id },
        data: { fullName: String(fullName).trim() }
      });
    }

    // Check if reporter exists in this tenant
    let reporter = await (prisma as any).reporter.findFirst({
      where: { userId: user.id, tenantId }
    });

    if (reporter) {
      // Update existing reporter - Tenant Admin has permanent access
      reporter = await (prisma as any).reporter.update({
        where: { id: reporter.id },
        data: {
          active: Boolean(active),
          // Tenant Admin: no login restrictions
          manualLoginEnabled: false,
          manualLoginDays: null,
          manualLoginEndsAt: null,
          designationId: designation?.id || reporter.designationId,
        }
      });
      if (action === 'created') action = 'updated';
    } else {
      // Create reporter (link user to tenant) - Tenant Admin has permanent access
      reporter = await (prisma as any).reporter.create({
        data: {
          tenantId,
          userId: user.id,
          designationId: designation?.id,
          level: 'STATE',
          stateId: state?.id,
          active: Boolean(active),
          subscriptionActive: false,
          // Tenant Admin: no login restrictions
          manualLoginEnabled: false,
          manualLoginDays: null,
          manualLoginEndsAt: null,
        }
      });
      if (action === 'updated') action = 'linked';
    }

    console.log(`[Admin] Upsert tenant admin: action=${action}, userId=${user.id}, reporterId=${reporter.id}, tenant=${tenant.name}`);

    res.json({
      success: true,
      action,
      message: action === 'created' 
        ? 'Tenant admin created successfully'
        : action === 'linked'
        ? 'Existing user linked as tenant admin'
        : 'Tenant admin updated successfully',
      user: {
        id: user.id,
        mobileNumber: cleanMobile,
        role: role.name,
      },
      profile: {
        id: profile.id,
        fullName: profile.fullName,
      },
      reporter: {
        id: reporter.id,
        tenantId,
        level: reporter.level,
        active: reporter.active,
        designation: designation?.name,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
      },
      loginCredentials: {
        mobileNumber: cleanMobile,
        mpin: mpinChanged ? finalMpin : '(unchanged)',
      }
    });
  } catch (e: any) {
    console.error('upsert tenant admin error', e);
    if (e.code === 'P2002') {
      return res.status(409).json({ error: 'Conflict - duplicate record', details: e.meta });
    }
    res.status(500).json({ error: 'Failed to upsert tenant admin' });
  }
});

export default router;