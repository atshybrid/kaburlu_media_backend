
import { Prisma } from '@prisma/client';
import prisma from '../../lib/prisma';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import * as bcrypt from 'bcrypt';

// Updated function to handle the new nested profile structure and role relation.
export const createUser = async (user: CreateUserDto) => {
  // Destructure roleId to handle it as a relation.
  const { profile, mpin, roleId, ...userData } = user;

  const data: Prisma.UserCreateInput = {
    ...userData,
    // Correctly connect the user to a role using the ID.
    role: {
      connect: { id: roleId },
    },
  };

  if (mpin) {
    const saltRounds = 10;
    data.mpin = await bcrypt.hash(mpin, saltRounds);
  } else {
    data.mpin = null;
  }

  // If profile data is provided, prepare it for a nested write.
  if (profile) {
    data.profile = {
      create: profile,
    };
  }

  const newUser = await prisma.user.create({
    data,
    include: {
      profile: true, // Ensure the new profile is returned.
      role: true, // Also include role information.
    },
  });

  return newUser;
};

// Update to include the user's profile in the response.
export const getUsers = async (filters: { role?: string; languageId?: string; page: number; limit: number }) => {
  const { role, languageId, page, limit } = filters;
  const where: Prisma.UserWhereInput = {}; // Use Prisma's own type for better safety.

  if (role) {
    where.role = { name: role as any }; // RoleName enum could be used here for more safety.
  }

  if (languageId) {
    where.languageId = languageId;
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: {
        profile: true, // Include the profile in the list.
        role: true,
      },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return {
    success: true,
    message: 'Users retrieved successfully',
    data: users,
    meta: {
      total,
      page,
      limit,
    },
  };
};

// Update to include the user's profile and role in the response.
export const findUserByMobileNumber = async (mobileNumber: string) => {
  return await prisma.user.findUnique({
    where: {
      mobileNumber,
    },
    include: {
      profile: true,
      role: true,
    },
  });
};

// Update to include the user's profile and role in the response.
export const findUserById = async (id: string) => {
  return await prisma.user.findUnique({
    where: {
      id: id,
    },
    include: {
      profile: true,
      role: true,
    },
  });
};

// Updated function to handle nested profile updates and role relation.
export const updateUser = async (id: string, user: UpdateUserDto) => {
  // Destructure roleId to handle it as a relation.
  const { profile, roleId, ...userData } = user;

  const data: Prisma.UserUpdateInput = {
    ...userData,
  };

  // If a new roleId is provided, connect to the new role.
  if (roleId) {
    data.role = {
      connect: { id: roleId },
    };
  }

  // If profile data is provided, use upsert to create or update it.
  if (profile) {
    data.profile = {
      upsert: {
        create: profile,
        update: profile,
      },
    };
  }

  return await prisma.user.update({
    where: {
      id: id,
    },
    data,
    include: {
      profile: true, // Return the updated profile.
      role: true,
    },
  });
};

// Make delete operation more robust with a transaction.
export const deleteUser = async (id: string) => {
  return await prisma.$transaction(async (tx) => {
    // Check if a profile exists to avoid errors on deletion.
    const userProfile = await tx.userProfile.findUnique({
      where: { userId: id },
    });
    if (userProfile) {
      await tx.userProfile.delete({ where: { userId: id } });
    }

    // Then, delete the user.
    return await tx.user.delete({
      where: { id: id },
    });
  });
};
