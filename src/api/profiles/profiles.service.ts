import { PrismaClient } from '@prisma/client';
import { CreateProfileDto, UpdateProfileDto } from './profiles.dto';

const prisma = new PrismaClient();

function parseDate(dateString: string): Date | null {
  if (!dateString) return null;
  const parts = dateString.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!parts) return null;
  const isoDate = `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}T00:00:00.000Z`;
  const date = new Date(isoDate);
  return isNaN(date.getTime()) ? null : date;
}

export async function getProfileByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('Profile not found for the specified user.');
  }

  return user;
}

export async function createProfile(userId: string, data: CreateProfileDto) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  const dob = data.dob ? parseDate(data.dob) : null;

  const updateData: any = {
    ...data,
    dob,
  };

  // Remove empty string IDs to avoid database errors
  for (const key of ['stateId', 'districtId', 'assemblyId', 'mandalId', 'villageId']) {
    if (updateData[key] === '') {
      updateData[key] = null;
    }
  }

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
  });
}

export async function updateProfile(userId: string, data: UpdateProfileDto) {
  const dob = data.dob ? parseDate(data.dob) : undefined;

  const updateData: any = {
    ...data,
    dob,
  };

  // Remove empty string IDs to avoid database errors
  for (const key of ['stateId', 'districtId', 'assemblyId', 'mandalId', 'villageId']) {
    if (updateData[key] === '') {
      updateData[key] = null;
    }
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });
  } catch (error) {
    throw new Error('Profile not found for the specified user.');
  }
}
