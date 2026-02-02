import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcrypt';
import { requireSuperAdmin } from '../middlewares/authz';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * tags:
 *   - name: Tenant Admins
 *     description: Simplified CRUD for Tenant Admin management
 */

/**
 * @swagger
 * /tenant-admins:
 *   post:
 *     summary: Create Tenant Admin (SUPER_ADMIN only)
 *     description: |
 *       One-step tenant admin creation. Creates:
 *       - User with TENANT_ADMIN role
 *       - UserProfile with fullName
 *       - Reporter record linking user to tenant
 *       
 *       If user with mobile already exists, updates role and links to tenant.
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, mobileNumber, fullName]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: Tenant ID to link admin to
 *               mobileNumber:
 *                 type: string
 *                 description: 10-digit mobile number
 *                 example: "9876543210"
 *               fullName:
 *                 type: string
 *                 description: Full name
 *                 example: "Srinivas Reddy"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email address (optional)
 *               mpin:
 *                 type: string
 *                 description: 4-digit MPIN (defaults to last 4 digits of mobile)
 *                 example: "1234"
 *               designationId:
 *                 type: string
 *                 description: Reporter designation ID (optional)
 *               stateId:
 *                 type: string
 *                 description: State ID (optional)
 *               profilePhotoUrl:
 *                 type: string
 *                 description: Profile photo URL (optional)
 *           examples:
 *             basic:
 *               summary: Basic tenant admin
 *               value:
 *                 tenantId: "cmkh94g0s01eykb21toi1oucu"
 *                 mobileNumber: "9876543210"
 *                 fullName: "Srinivas Reddy"
 *             complete:
 *               summary: With all optional fields
 *               value:
 *                 tenantId: "cmkh94g0s01eykb21toi1oucu"
 *                 mobileNumber: "9876543210"
 *                 fullName: "Srinivas Reddy"
 *                 email: "srinivas@kaburlumedia.com"
 *                 mpin: "5678"
 *                 profilePhotoUrl: "https://cdn.example.com/photos/srinivas.jpg"
 *     responses:
 *       201:
 *         description: Tenant admin created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId: { type: string }
 *                     mobileNumber: { type: string }
 *                     fullName: { type: string }
 *                     email: { type: string, nullable: true }
 *                     tenantId: { type: string }
 *                     tenantName: { type: string }
 *                     reporterId: { type: string }
 *                     profilePhotoUrl: { type: string, nullable: true }
 *                     designation: { type: object, nullable: true }
 *                     loginCredentials:
 *                       type: object
 *                       properties:
 *                         mobileNumber: { type: string }
 *                         mpin: { type: string }
 *       400:
 *         description: Validation error
 *       404:
 *         description: Tenant not found
 *       409:
 *         description: User already linked to another tenant as admin
 */
router.post('/', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, mobileNumber, fullName, email, mpin, designationId, stateId, profilePhotoUrl } = req.body || {};

    // Validation
    if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId is required' });
    if (!mobileNumber) return res.status(400).json({ success: false, error: 'mobileNumber is required' });
    if (!fullName) return res.status(400).json({ success: false, error: 'fullName is required' });

    const cleanMobile = String(mobileNumber).replace(/\D/g, '');
    if (cleanMobile.length < 10) {
      return res.status(400).json({ success: false, error: 'Invalid mobile number' });
    }

    // Check tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true }
    });
    if (!tenant) {
      return res.status(404).json({ success: false, error: 'Tenant not found' });
    }

    // Get or create TENANT_ADMIN role
    let role = await prisma.role.findFirst({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } }
    });
    if (!role) {
      role = await prisma.role.create({
        data: {
          name: 'TENANT_ADMIN',
          permissions: {
            tenant: ['read', 'update'],
            reporters: ['create', 'read', 'update', 'delete'],
            articles: ['create', 'read', 'update', 'delete', 'approve'],
            settings: ['read', 'update'],
          }
        }
      });
    }

    // Get default language (English or first available)
    const language = await prisma.language.findFirst({
      where: { code: { in: ['en', 'en_US', 'english'] } },
      orderBy: { createdAt: 'asc' }
    }) || await prisma.language.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!language) {
      return res.status(500).json({ success: false, error: 'No language found in system' });
    }

    // Get state
    let state = null;
    if (stateId) {
      state = await prisma.state.findUnique({ where: { id: stateId } });
    }
    if (!state) {
      state = await prisma.state.findFirst({ orderBy: { name: 'asc' } });
    }

    // Get designation (prefer TENANT_ADMIN designation)
    let designation = null;
    if (designationId) {
      designation = await prisma.reporterDesignation.findUnique({ where: { id: designationId } });
    }
    if (!designation) {
      // First try to find TENANT_ADMIN designation (global/null tenantId)
      designation = await prisma.reporterDesignation.findFirst({
        where: { tenantId: null, code: 'TENANT_ADMIN' }
      });
    }
    if (!designation) {
      // Fallback to any admin/chief designation
      designation = await prisma.reporterDesignation.findFirst({
        where: {
          OR: [
            { name: { contains: 'admin', mode: 'insensitive' } },
            { name: { contains: 'chief', mode: 'insensitive' } },
          ]
        }
      });
    }
    if (!designation) {
      // Last resort: any designation
      designation = await prisma.reporterDesignation.findFirst();
    }

    // MPIN: use provided or default to last 4 digits
    const finalMpin = mpin || cleanMobile.slice(-4);
    const hashedMpin = await bcrypt.hash(finalMpin, 10);

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: { mobileNumber: cleanMobile }
    });

    let userCreated = false;
    let profile: any;
    let reporter: any;

    if (user) {
      // Check if already reporter in this tenant
      const existingReporter = await prisma.reporter.findFirst({
        where: { userId: user.id, tenantId }
      });
      
      if (existingReporter) {
        // Update user role
        await prisma.user.update({
          where: { id: user.id },
          data: { roleId: role.id }
        });

        // Update or create profile
        profile = await prisma.userProfile.upsert({
          where: { userId: user.id },
          update: { fullName: String(fullName).trim() },
          create: { userId: user.id, fullName: String(fullName).trim() }
        });

        return res.status(200).json({
          success: true,
          message: 'User already linked to this tenant, role updated to TENANT_ADMIN',
          data: {
            userId: user.id,
            mobileNumber: cleanMobile,
            fullName: profile.fullName,
            email: user.email,
            tenantId,
            tenantName: tenant.name,
            reporterId: existingReporter.id,
            profilePhotoUrl: existingReporter.profilePhotoUrl,
            designation: designation ? { id: designation.id, name: designation.name } : null,
            loginCredentials: { mobileNumber: cleanMobile, mpin: '(existing - not changed)' }
          }
        });
      }

      // Check if already linked to ANOTHER tenant as TENANT_ADMIN
      const otherTenantReporter = await prisma.reporter.findFirst({
        where: { userId: user.id, tenantId: { not: tenantId } },
        include: { tenant: { select: { id: true, name: true } } }
      });

      const currentRole = await prisma.role.findUnique({ where: { id: user.roleId } });
      if (otherTenantReporter && currentRole?.name?.toUpperCase() === 'TENANT_ADMIN') {
        return res.status(409).json({
          success: false,
          error: 'User already linked as TENANT_ADMIN to another tenant',
          existingTenant: {
            id: otherTenantReporter.tenant.id,
            name: otherTenantReporter.tenant.name
          }
        });
      }

      // Update role
      user = await prisma.user.update({
        where: { id: user.id },
        data: { roleId: role.id, email: email || user.email }
      });
    } else {
      // Create new user
      user = await prisma.user.create({
        data: {
          mobileNumber: cleanMobile,
          mpin: hashedMpin,
          email: email || null,
          roleId: role.id,
          languageId: language.id,
          status: 'ACTIVE',
        }
      });
      userCreated = true;
    }

    // Create or update profile
    profile = await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { fullName: String(fullName).trim() },
      create: { userId: user.id, fullName: String(fullName).trim() }
    });

    // Create Reporter link
    reporter = await prisma.reporter.create({
      data: {
        tenantId,
        userId: user.id,
        designationId: designation?.id,
        level: 'STATE',
        stateId: state?.id,
        active: true,
        subscriptionActive: false,
        profilePhotoUrl: profilePhotoUrl || null,
        manualLoginEnabled: false,
      }
    });

    // Auto-create or update TenantEntity with admin contact info
    let tenantEntity = await prisma.tenantEntity.findUnique({
      where: { tenantId }
    });
    if (!tenantEntity) {
      // Create new TenantEntity with admin contact info
      // Generate temporary PRGI number (will be updated later via PATCH)
      const tempPrgiNumber = `TEMP-${tenantId.slice(0, 8)}`;
      tenantEntity = await prisma.tenantEntity.create({
        data: {
          tenantId,
          prgiNumber: tempPrgiNumber,
          contactPerson: fullName,
          contactMobile: cleanMobile,
          contactEmail: email || null,
        }
      });
      console.log(`[TenantAdmins] Auto-created TenantEntity for tenant=${tenant.name}`);
    } else if (!tenantEntity.contactMobile || !tenantEntity.contactPerson) {
      // Update existing TenantEntity if contact info is missing
      tenantEntity = await prisma.tenantEntity.update({
        where: { tenantId },
        data: {
          contactPerson: tenantEntity.contactPerson || fullName,
          contactMobile: tenantEntity.contactMobile || cleanMobile,
          contactEmail: tenantEntity.contactEmail || email || null,
        }
      });
      console.log(`[TenantAdmins] Updated TenantEntity contact info for tenant=${tenant.name}`);
    }

    console.log(`[TenantAdmins] Created: userId=${user.id}, reporterId=${reporter.id}, tenant=${tenant.name}`);

    res.status(201).json({
      success: true,
      message: userCreated ? 'Tenant admin created successfully' : 'Existing user linked as tenant admin',
      data: {
        userId: user.id,
        mobileNumber: cleanMobile,
        fullName: profile.fullName,
        email: user.email,
        tenantId,
        tenantName: tenant.name,
        reporterId: reporter.id,
        profilePhotoUrl: reporter.profilePhotoUrl,
        designation: designation ? { id: designation.id, name: designation.name } : null,
        loginCredentials: {
          mobileNumber: cleanMobile,
          mpin: userCreated ? finalMpin : '(existing - not changed)'
        }
      }
    });
  } catch (e: any) {
    console.error('Tenant admin create error:', e);
    res.status(500).json({ success: false, error: 'Failed to create tenant admin', details: e.message });
  }
});

/**
 * @swagger
 * /tenant-admins:
 *   get:
 *     summary: List all tenant admins (SUPER_ADMIN only)
 *     description: Returns all users with TENANT_ADMIN role along with their tenant linkage
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: Filter by specific tenant
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *     responses:
 *       200:
 *         description: List of tenant admins
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
 *                       userId: { type: string }
 *                       mobileNumber: { type: string }
 *                       fullName: { type: string }
 *                       email: { type: string, nullable: true }
 *                       tenantId: { type: string }
 *                       tenantName: { type: string }
 *                       reporterId: { type: string }
 *                       profilePhotoUrl: { type: string, nullable: true }
 *                       designation: { type: object, nullable: true }
 *                       createdAt: { type: string }
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page: { type: integer }
 *                     pageSize: { type: integer }
 *                     total: { type: integer }
 *                     totalPages: { type: integer }
 */
router.get('/', auth, requireSuperAdmin, async (req, res) => {
  try {
    const tenantIdFilter = req.query.tenantId ? String(req.query.tenantId) : null;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '50'), 10) || 50));

    // Get TENANT_ADMIN role IDs
    const roles = await prisma.role.findMany({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } },
      select: { id: true }
    });
    const roleIds = roles.map((r: { id: string }) => r.id);

    if (!roleIds.length) {
      return res.json({ success: true, data: [], pagination: { page, pageSize, total: 0, totalPages: 0 } });
    }

    const where: any = { roleId: { in: roleIds } };
    const reporterWhere: any = {};
    if (tenantIdFilter) {
      reporterWhere.tenantId = tenantIdFilter;
    }

    // Get users with reporter info
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          profile: { select: { fullName: true } },
          reporterProfile: {
            where: reporterWhere,
            include: {
              tenant: { select: { id: true, name: true, slug: true } },
              designation: { select: { id: true, name: true } }
            }
          }
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const data = users
      .filter((u: any) => u.reporterProfile) // Only include users with reporter linkage
      .map((u: any) => ({
        userId: u.id,
        mobileNumber: u.mobileNumber,
        fullName: u.profile?.fullName || null,
        email: u.email,
        tenantId: u.reporterProfile?.tenantId,
        tenantName: u.reporterProfile?.tenant?.name,
        reporterId: u.reporterProfile?.id,
        profilePhotoUrl: u.reporterProfile?.profilePhotoUrl,
        designation: u.reporterProfile?.designation || null,
        createdAt: u.createdAt
      }));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (e: any) {
    console.error('Tenant admins list error:', e);
    res.status(500).json({ success: false, error: 'Failed to list tenant admins', details: e.message });
  }
});

/**
 * @swagger
 * /tenant-admins/{userId}:
 *   get:
 *     summary: Get tenant admin by user ID (SUPER_ADMIN only)
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Tenant admin details
 *       404:
 *         description: User not found or not a tenant admin
 */
router.get('/:userId', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { select: { id: true, name: true } },
        profile: { select: { fullName: true } },
        reporterProfile: {
          include: {
            tenant: { select: { id: true, name: true, slug: true } },
            designation: { select: { id: true, name: true } },
            state: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const roleName = user.role?.name?.toUpperCase();
    if (roleName !== 'TENANT_ADMIN' && roleName !== 'ADMIN') {
      return res.status(404).json({ success: false, error: 'User is not a tenant admin' });
    }

    if (!user.reporterProfile) {
      return res.status(404).json({ success: false, error: 'User not linked to any tenant' });
    }

    res.json({
      success: true,
      data: {
        userId: user.id,
        mobileNumber: user.mobileNumber,
        fullName: user.profile?.fullName || null,
        email: user.email,
        status: user.status,
        tenantId: user.reporterProfile.tenantId,
        tenantName: user.reporterProfile.tenant.name,
        reporterId: user.reporterProfile.id,
        profilePhotoUrl: user.reporterProfile.profilePhotoUrl,
        designation: user.reporterProfile.designation || null,
        state: user.reporterProfile.state || null,
        active: user.reporterProfile.active,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (e: any) {
    console.error('Tenant admin get error:', e);
    res.status(500).json({ success: false, error: 'Failed to get tenant admin', details: e.message });
  }
});

/**
 * @swagger
 * /tenant-admins/{userId}:
 *   put:
 *     summary: Update tenant admin (SUPER_ADMIN only)
 *     description: Update tenant admin profile, contact info, or tenant linkage
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               email: { type: string }
 *               profilePhotoUrl: { type: string }
 *               tenantId: { type: string, description: "Change tenant linkage" }
 *               designationId: { type: string }
 *               stateId: { type: string }
 *               active: { type: boolean }
 *           examples:
 *             updateProfile:
 *               summary: Update profile info
 *               value:
 *                 fullName: "Srinivas Kumar Reddy"
 *                 email: "srinivas.new@example.com"
 *             changeTenant:
 *               summary: Change tenant linkage
 *               value:
 *                 tenantId: "new_tenant_id_here"
 *     responses:
 *       200:
 *         description: Updated successfully
 *       404:
 *         description: User not found or not a tenant admin
 */
router.put('/:userId', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, email, profilePhotoUrl, tenantId, designationId, stateId, active } = req.body || {};

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { select: { name: true } },
        reporterProfile: { select: { id: true, tenantId: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const roleName = user.role?.name?.toUpperCase();
    if (roleName !== 'TENANT_ADMIN' && roleName !== 'ADMIN') {
      return res.status(404).json({ success: false, error: 'User is not a tenant admin' });
    }

    if (!user.reporterProfile) {
      return res.status(404).json({ success: false, error: 'User not linked to any tenant' });
    }

    // Update user basic fields
    const userUpdate: any = {};
    if (email !== undefined) userUpdate.email = email;
    if (Object.keys(userUpdate).length > 0) {
      await prisma.user.update({ where: { id: userId }, data: userUpdate });
    }

    // Update profile
    if (fullName !== undefined) {
      await prisma.userProfile.upsert({
        where: { userId },
        update: { fullName: String(fullName).trim() },
        create: { userId, fullName: String(fullName).trim() }
      });
    }

    // Update reporter
    const reporterUpdate: any = {};
    if (tenantId !== undefined) reporterUpdate.tenantId = tenantId;
    if (profilePhotoUrl !== undefined) reporterUpdate.profilePhotoUrl = profilePhotoUrl;
    if (designationId !== undefined) reporterUpdate.designationId = designationId;
    if (stateId !== undefined) reporterUpdate.stateId = stateId;
    if (active !== undefined) reporterUpdate.active = Boolean(active);

    if (Object.keys(reporterUpdate).length > 0) {
      await prisma.reporter.update({
        where: { id: user.reporterProfile.id },
        data: reporterUpdate
      });
    }

    // Fetch updated data
    const updated = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: { select: { fullName: true } },
        reporterProfile: {
          include: {
            tenant: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true } }
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Tenant admin updated successfully',
      data: {
        userId: updated!.id,
        mobileNumber: updated!.mobileNumber,
        fullName: updated!.profile?.fullName,
        email: updated!.email,
        tenantId: updated!.reporterProfile?.tenantId,
        tenantName: updated!.reporterProfile?.tenant.name,
        reporterId: updated!.reporterProfile?.id,
        profilePhotoUrl: updated!.reporterProfile?.profilePhotoUrl,
        designation: updated!.reporterProfile?.designation || null,
        active: updated!.reporterProfile?.active
      }
    });
  } catch (e: any) {
    console.error('Tenant admin update error:', e);
    res.status(500).json({ success: false, error: 'Failed to update tenant admin', details: e.message });
  }
});

/**
 * @swagger
 * /tenant-admins/{userId}:
 *   delete:
 *     summary: Delete/deactivate tenant admin (SUPER_ADMIN only)
 *     description: |
 *       Removes tenant admin access by:
 *       - Deleting the Reporter linkage
 *       - Optionally changing user role back to a standard role
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: deleteUser
 *         schema: { type: boolean, default: false }
 *         description: Also delete the user record (default false)
 *     responses:
 *       200:
 *         description: Deleted successfully
 *       404:
 *         description: User not found or not a tenant admin
 */
router.delete('/:userId', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const deleteUser = req.query.deleteUser === 'true';

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { select: { name: true } },
        reporterProfile: { select: { id: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const roleName = user.role?.name?.toUpperCase();
    if (roleName !== 'TENANT_ADMIN' && roleName !== 'ADMIN') {
      return res.status(404).json({ success: false, error: 'User is not a tenant admin' });
    }

    if (user.reporterProfile) {
      // Delete reporter linkage
      await prisma.reporter.delete({ where: { id: user.reporterProfile.id } });
    }

    if (deleteUser) {
      // Delete user completely
      await prisma.user.delete({ where: { id: userId } });
      return res.json({
        success: true,
        message: 'Tenant admin and user deleted successfully'
      });
    } else {
      // Change role to basic user
      const citizenReporterRole = await prisma.role.findFirst({
        where: { name: { in: ['CITIZEN_REPORTER', 'USER'] } }
      });
      if (citizenReporterRole) {
        await prisma.user.update({
          where: { id: userId },
          data: { roleId: citizenReporterRole.id }
        });
      }

      return res.json({
        success: true,
        message: 'Tenant admin access removed, user retained with basic role'
      });
    }
  } catch (e: any) {
    console.error('Tenant admin delete error:', e);
    res.status(500).json({ success: false, error: 'Failed to delete tenant admin', details: e.message });
  }
});

/**
 * @swagger
 * /tenant-admins/backfill:
 *   post:
 *     summary: Backfill existing TENANT_ADMIN users (SUPER_ADMIN only)
 *     description: |
 *       Finds all users with TENANT_ADMIN role and ensures they have:
 *       - Reporter record linking them to a tenant
 *       - Correct TENANT_ADMIN designation
 *       
 *       This fixes users created before the new tenant-admins CRUD was implemented.
 *     tags: [Tenant Admins]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               dryRun:
 *                 type: boolean
 *                 default: false
 *                 description: If true, only reports what would be fixed without making changes
 *           examples:
 *             dryRun:
 *               summary: Preview changes
 *               value:
 *                 dryRun: true
 *             execute:
 *               summary: Execute fixes
 *               value:
 *                 dryRun: false
 *     responses:
 *       200:
 *         description: Backfill result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 dryRun: { type: boolean }
 *                 totalTenantAdmins: { type: integer }
 *                 fixed: { type: integer }
 *                 skipped: { type: integer }
 *                 errors: { type: integer }
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId: { type: string }
 *                       mobileNumber: { type: string }
 *                       action: { type: string }
 *                       status: { type: string }
 *                       message: { type: string }
 */
router.post('/backfill', auth, requireSuperAdmin, async (req, res) => {
  try {
    const { dryRun = false } = req.body || {};

    // Get all TENANT_ADMIN users
    const roles = await prisma.role.findMany({
      where: { name: { in: ['TENANT_ADMIN', 'Admin'] } },
      select: { id: true }
    });
    const roleIds = roles.map((r: { id: string }) => r.id);

    if (!roleIds.length) {
      return res.json({
        success: true,
        message: 'No TENANT_ADMIN role found in system',
        totalTenantAdmins: 0,
        fixed: 0,
        skipped: 0,
        errors: 0,
        details: []
      });
    }

    const users = await prisma.user.findMany({
      where: { roleId: { in: roleIds } },
      include: {
        reporterProfile: {
          include: {
            tenant: { select: { id: true, name: true } },
            designation: { select: { id: true, name: true, code: true } }
          }
        }
      }
    });

    // Get TENANT_ADMIN designation
    const tenantAdminDesignation = await prisma.reporterDesignation.findFirst({
      where: { tenantId: null, code: 'TENANT_ADMIN' }
    });

    const details: any[] = [];
    let fixed = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        if (!user.reporterProfile) {
          // User has no reporter linkage - CRITICAL issue
          details.push({
            userId: user.id,
            mobileNumber: user.mobileNumber,
            action: 'missing_reporter_link',
            status: 'error',
            message: 'User has TENANT_ADMIN role but no Reporter record. Cannot determine tenant. Please use PUT /users/:id with tenantId or create via POST /tenant-admins.'
          });
          errors++;
          continue;
        }

        const needsDesignationFix = tenantAdminDesignation && 
          (!user.reporterProfile.designation || user.reporterProfile.designation.code !== 'TENANT_ADMIN');

        if (!needsDesignationFix) {
          details.push({
            userId: user.id,
            mobileNumber: user.mobileNumber,
            tenantId: user.reporterProfile.tenantId,
            tenantName: user.reporterProfile.tenant.name,
            action: 'none',
            status: 'ok',
            message: 'Already properly configured'
          });
          skipped++;
          continue;
        }

        // Fix designation
        if (!dryRun && tenantAdminDesignation) {
          await prisma.reporter.update({
            where: { id: user.reporterProfile.id },
            data: { designationId: tenantAdminDesignation.id }
          });
        }

        details.push({
          userId: user.id,
          mobileNumber: user.mobileNumber,
          tenantId: user.reporterProfile.tenantId,
          tenantName: user.reporterProfile.tenant.name,
          action: dryRun ? 'would_fix_designation' : 'fixed_designation',
          status: 'fixed',
          message: dryRun 
            ? `Would update designation to TENANT_ADMIN (from ${user.reporterProfile.designation?.name || 'none'})`
            : `Updated designation to TENANT_ADMIN (was ${user.reporterProfile.designation?.name || 'none'})`
        });
        fixed++;
      } catch (e: any) {
        details.push({
          userId: user.id,
          mobileNumber: user.mobileNumber,
          action: 'error',
          status: 'error',
          message: `Failed to process: ${e.message}`
        });
        errors++;
      }
    }

    res.json({
      success: true,
      dryRun,
      totalTenantAdmins: users.length,
      fixed,
      skipped,
      errors,
      details
    });
  } catch (e: any) {
    console.error('Tenant admins backfill error:', e);
    res.status(500).json({ success: false, error: 'Failed to backfill tenant admins', details: e.message });
  }
});

export default router;
