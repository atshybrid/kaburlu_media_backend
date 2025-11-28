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

export const createUser = async (data: any) => {
    const {
        mobileNumber,
        mpin,
        languageId,
        roleId,
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

    return prisma.user.create({
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
};

export const findAllUsers = async () => {
  return prisma.user.findMany({ include: { role: true } });
};

export const findUserById = async (id: string) => {
    return prisma.user.findUnique({ where: { id }, include: { role: true, language: true } });
};

export const findUserByMobileNumber = async (mobileNumber: string) => {
  return prisma.user.findUnique({ where: { mobileNumber }, include: { role: true } });
};

export const updateUser = async (id: string, data: any) => {
    const { roleId, languageId, ...rest } = data;
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

    return prisma.user.update({
        where: { id },
        data: updateData,
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
