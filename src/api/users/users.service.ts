import prisma from '../../lib/prisma';
import { hashMpin } from '../auth/auth.service';

export const createUser = async (data: any) => {
  const { mpin, ...userData } = data;
  const hashedMpin = await hashMpin(mpin);
  return prisma.user.create({
    data: {
      ...userData,
      mpin: hashedMpin,
    },
  });
};

export const findAllUsers = async () => {
  return prisma.user.findMany({ include: { role: true } });
};

export const findUserById = async (id: string) => {
    return prisma.user.findUnique({ where: { id }, include: { role: true } });
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
    const { mobileNumber, name, languageId, location } = data;

    const guestRole = await prisma.role.findUnique({ where: { name: 'Guest' } });
    const citizenReporterRole = await prisma.role.findUnique({ where: { name: 'Citizen Reporter' } });

    if (!guestRole || !citizenReporterRole) {
        throw new Error('Required roles not found');
    }

    let user = await prisma.user.findFirst({
        where: {
            mobileNumber,
            roleId: guestRole.id,
        },
    });

    if (user) {
        return prisma.user.update({
            where: { id: user.id },
            data: {
                name,
                languageId,
                roleId: citizenReporterRole.id,
                deviceDetails: {
                    create: {
                        location: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                        }
                    }
                }
            },
        });
    } else {
        return prisma.user.create({
            data: {
                mobileNumber,
                name,
                languageId,
                roleId: citizenReporterRole.id,
                deviceDetails: {
                    create: {
                        location: {
                            latitude: location.latitude,
                            longitude: location.longitude,
                        }
                    }
                }
            },
        });
    }
};
