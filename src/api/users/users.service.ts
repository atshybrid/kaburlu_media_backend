// Push Notification CRUD
export const addPushToken = async (userId: string, deviceId: string, deviceModel: string, pushToken: string) => {
    return prisma.device.upsert({
        where: { deviceId },
        update: { pushToken, deviceModel },
        create: { deviceId, deviceModel, pushToken, userId }
    });
};

export const removePushToken = async (userId: string, pushToken: string) => {
    return prisma.device.deleteMany({
        where: { deviceId: userId, pushToken }
    });
};

// Location CRUD
export const updateLocation = async (userId: string, latitude: number, longitude: number) => {
    return prisma.userLocation.upsert({
        where: { userId },
        update: { latitude, longitude },
        create: { userId, latitude, longitude }
    });
};

export const getLocation = async (userId: string) => {
    return prisma.userLocation.findUnique({ where: { userId } });
};
import prisma from '../../lib/prisma';
import * as bcrypt from 'bcrypt';

const isTenantAdminRoleName = (roleName: unknown) => {
    const name = String(roleName || '').toUpperCase();
    return name === 'TENANT_ADMIN' || name === 'ADMIN';
};

const ensureReporterTenantLink = async (tx: any, userId: string, tenantId: string) => {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) {
        const err: any = new Error('Invalid tenantId');
        err.statusCode = 400;
        throw err;
    }

    return tx.reporter.upsert({
        where: { userId },
        update: { tenantId, active: true },
        create: {
            tenantId,
            userId,
            level: 'STATE',
            active: true,
        },
    });
};

export const createUser = async (data: any) => {
    const {
        mobileNumber,
        mpin,
        languageId,
        roleId,
        tenantId,
        skipMpinDefault,
        ...rest
    } = data || {};

    if (!languageId) {
        throw new Error('languageId is required');
    }
    // Optional: verify language exists
    const lang = await prisma.language.findUnique({ where: { id: String(languageId) } });
    if (!lang) {
        throw new Error(`Invalid languageId: '${languageId}'`);
    }

    // Check if mobile number already exists and return detailed info
    if (mobileNumber) {
        const existingUser = await prisma.user.findUnique({
            where: { mobileNumber: String(mobileNumber) },
            include: {
                role: { select: { id: true, name: true } },
                profile: { select: { fullName: true, profilePhotoUrl: true } },
            },
        });

        if (existingUser) {
            // Check if this user is a reporter or tenant admin
            const reporter = await prisma.reporter.findFirst({
                where: { userId: existingUser.id },
                select: {
                    id: true,
                    tenantId: true,
                    profilePhotoUrl: true,
                    designation: { select: { id: true, name: true } },
                    tenant: { select: { id: true, name: true, slug: true } },
                },
            });

            const errorDetails: any = {
                error: 'MOBILE_NUMBER_EXISTS',
                message: `Mobile number ${mobileNumber} is already registered`,
                existingUser: {
                    id: existingUser.id,
                    mobileNumber: existingUser.mobileNumber,
                    email: existingUser.email,
                    status: existingUser.status,
                    createdAt: existingUser.createdAt,
                    role: existingUser.role,
                    fullName: existingUser.profile?.fullName || null,
                    profilePhotoUrl: existingUser.profile?.profilePhotoUrl || null,
                },
            };

            if (reporter) {
                errorDetails.existingUser.tenantId = reporter.tenantId;
                errorDetails.existingUser.tenant = reporter.tenant;
                errorDetails.existingUser.designation = reporter.designation;
                errorDetails.existingUser.reporterId = reporter.id;
                errorDetails.existingUser.reporterProfilePhotoUrl = reporter.profilePhotoUrl;
            }

            const err = new Error(JSON.stringify(errorDetails));
            (err as any).code = 'MOBILE_NUMBER_EXISTS';
            (err as any).statusCode = 409;
            (err as any).details = errorDetails;
            throw err;
        }
    }

    let finalMpinHash: string | undefined;
    if (typeof mpin === 'string' && mpin.trim()) {
        finalMpinHash = await bcrypt.hash(mpin, 10);
    } else if (skipMpinDefault) {
        // Explicitly allow null mpin (e.g. reporter pre-registration) without defaulting to last4
        finalMpinHash = undefined;
    } else if (typeof mobileNumber === 'string' && /\d{4,}/.test(mobileNumber)) {
        const last4 = mobileNumber.slice(-4);
        finalMpinHash = await bcrypt.hash(last4, 10);
    } else {
        throw new Error('mpin is required when mobileNumber is missing or too short to derive last 4 digits');
    }

    return prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
            data: {
                ...rest,
                mobileNumber: mobileNumber ?? null,
                mpin: finalMpinHash || null,
                languageId: String(languageId),
                roleId: roleId,
                status: data?.status || 'ACTIVE'
            },
            include: { role: true }
        });

        if (roleId) {
            const role = await tx.role.findUnique({ where: { id: String(roleId) }, select: { name: true } });
            if (isTenantAdminRoleName(role?.name)) {
                const tid = String(tenantId || '').trim();
                if (!tid) {
                    const err: any = new Error('tenantId is required when creating a TENANT_ADMIN user');
                    err.statusCode = 400;
                    throw err;
                }
                await ensureReporterTenantLink(tx, created.id, tid);
            }
        }

        return created;
    });
};

export const findAllUsers = async () => {
  const users = await prisma.user.findMany({
    include: {
      role: true,
      profile: { select: { fullName: true, profilePhotoUrl: true } },
    },
  });

  // Fetch reporter and tenant admin data for enrichment
  const userIds = users.map((u) => u.id);

  const [reporters] = await Promise.all([
    prisma.reporter.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        tenantId: true,
        profilePhotoUrl: true,
        designation: { select: { id: true, name: true } },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  // Build lookup maps
  const reporterByUserId: Record<string, any> = {};
  for (const r of reporters) {
    if (r.userId) reporterByUserId[r.userId] = r;
  }

  // Enrich users with reporter/tenant admin data
  return users.map((user) => {
    const roleName = user.role?.name?.toUpperCase() || '';
    const reporter = reporterByUserId[user.id];

    let enrichment: any = {};

    if (roleName === 'REPORTER' && reporter) {
      enrichment = {
        tenantId: reporter.tenantId,
        tenant: reporter.tenant,
        fullName: user.profile?.fullName || null,
        profilePhotoUrl: reporter.profilePhotoUrl || user.profile?.profilePhotoUrl || null,
        designation: reporter.designation,
      };
    } else if (roleName === 'TENANT_ADMIN' && reporter) {
      // Tenant admins are stored as reporters with TENANT_ADMIN role
      enrichment = {
        tenantId: reporter.tenantId,
        tenant: reporter.tenant,
        fullName: user.profile?.fullName || null,
        profilePhotoUrl: reporter.profilePhotoUrl || user.profile?.profilePhotoUrl || null,
        designation: reporter.designation,
      };
    } else {
      // Regular users - just profile data
      enrichment = {
        fullName: user.profile?.fullName || null,
        profilePhotoUrl: user.profile?.profilePhotoUrl || null,
      };
    }

    const { profile: _profile, ...userWithoutProfile } = user;
    return {
      ...userWithoutProfile,
      ...enrichment,
    };
  });
};

export const findUserById = async (id: string) => {
    const user = await prisma.user.findUnique({
        where: { id },
        include: {
            role: true,
            language: true,
            profile: { select: { fullName: true, profilePhotoUrl: true } },
        },
    });

    if (!user) return null;

    // Check if user is a reporter or tenant admin
    const reporter = await prisma.reporter.findFirst({
        where: { userId: user.id },
        select: {
            id: true,
            tenantId: true,
            profilePhotoUrl: true,
            designation: { select: { id: true, name: true } },
            tenant: { select: { id: true, name: true, slug: true } },
        },
    });

    const roleName = user.role?.name?.toUpperCase() || '';
    let enrichment: any = {};

    if ((roleName === 'REPORTER' || roleName === 'TENANT_ADMIN') && reporter) {
        enrichment = {
            tenantId: reporter.tenantId,
            tenant: reporter.tenant,
            fullName: user.profile?.fullName || null,
            profilePhotoUrl: reporter.profilePhotoUrl || user.profile?.profilePhotoUrl || null,
            designation: reporter.designation,
            reporterId: reporter.id,
        };
    } else {
        enrichment = {
            fullName: user.profile?.fullName || null,
            profilePhotoUrl: user.profile?.profilePhotoUrl || null,
        };
    }

    const { profile: _profile, ...userWithoutProfile } = user;
    return {
        ...userWithoutProfile,
        ...enrichment,
    };
};

export const findUserByMobileNumber = async (mobileNumber: string) => {
  return prisma.user.findUnique({ where: { mobileNumber }, include: { role: true } });
};

export const updateUser = async (id: string, data: any) => {
    const { roleId, languageId, tenantId, ...rest } = data;
    const updateData: any = { ...rest };

    if (roleId) {
        updateData.role = {
            connect: { id: roleId },
        };
    }

    if (languageId) {
        updateData.language = {
            connect: { id: languageId },
        };
    }

    return prisma.$transaction(async (tx) => {
        const updated = await tx.user.update({
            where: { id },
            data: updateData,
        });

        const tid = String(tenantId || '').trim();

        // If caller explicitly sets TENANT_ADMIN role, require tenantId.
        if (roleId) {
            const role = await tx.role.findUnique({ where: { id: String(roleId) }, select: { name: true } });
            if (isTenantAdminRoleName(role?.name)) {
                if (!tid) {
                    const err: any = new Error('tenantId is required when setting TENANT_ADMIN role');
                    err.statusCode = 400;
                    throw err;
                }
                await ensureReporterTenantLink(tx, id, tid);
            }
        } else if (tid) {
            // Repair flow: if user is already TENANT_ADMIN and tenantId is provided, link/upsert reporter.
            const currentRole = await tx.role.findUnique({ where: { id: updated.roleId }, select: { name: true } });
            if (isTenantAdminRoleName(currentRole?.name)) {
                await ensureReporterTenantLink(tx, id, tid);
            }
        }

        return updated;
    });
};

export const deleteUser = async (id: string) => {
    return prisma.user.delete({ where: { id } });
};

export const upgradeGuest = async (data: any) => {
    const { deviceId, deviceModel, pushToken, mobileNumber, mpin, email, languageId } = data;
    // Ignore any roleId sent by client

    const guestRole = await prisma.role.findUnique({ where: { name: 'GUEST' } });
    const citizenReporterRole = await prisma.role.findUnique({ where: { name: 'CITIZEN_REPORTER' } });

    if (!guestRole || !citizenReporterRole) {
        throw new Error('Required roles not found');
    }

    let user = await prisma.user.findFirst({
        where: {
            devices: { some: { deviceId } },
            roleId: guestRole.id,
        },
        include: { devices: true }
    });

    if (user) {
        // If device already exists, just update user and mark guest as upgraded
        return prisma.user.update({
            where: { id: user.id },
            data: {
                mobileNumber,
                mpin,
                email,
                roleId: citizenReporterRole.id,
                status: 'ACTIVE',
                upgradedAt: new Date(), // If you have this field
                devices: {
                    upsert: {
                        where: { deviceId },
                        update: {
                            deviceModel,
                            pushToken
                        },
                        create: {
                            deviceId,
                            deviceModel,
                            pushToken
                        }
                    }
                }
            },
        });
    } else {
        // Create user and device together
        return prisma.user.create({
            data: {
                mobileNumber,
                mpin,
                email,
                roleId: citizenReporterRole.id,
                languageId,
                status: 'ACTIVE',
                devices: {
                    create: [{
                        deviceId,
                        deviceModel,
                        pushToken
                    }]
                }
            },
        });
    }
};
