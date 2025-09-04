
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
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error('Profile not found for the specified user.');
  }

  return profile;
}

export async function createProfile(userId: string, data: CreateProfileDto) {
  const existingProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (existingProfile) {
    throw new Error('A profile already exists for this user.');
  }

  const dob = data.dob ? parseDate(data.dob) : null;

  const profileData: any = {
    ...data,
    userId,
    dob,
  };

  // Remove empty string IDs to avoid database errors
  for (const key of ['stateId', 'districtId', 'assemblyId', 'mandalId', 'villageId']) {
    if (profileData[key] === '') {
      profileData[key] = null;
    }
  }

  return prisma.userProfile.create({
    data: profileData,
  });
}

export async function updateProfile(userId: string, data: UpdateProfileDto) {
  const dob = data.dob ? parseDate(data.dob) : undefined;

  const profileData: any = {
    ...data,
    dob,
  };

  // Remove empty string IDs to avoid database errors
  for (const key of ['stateId', 'districtId', 'assemblyId', 'mandalId', 'villageId']) {
    if (profileData[key] === '') {
      profileData[key] = null;
    }
  }

  try {
    return await prisma.userProfile.update({
      where: { userId },
      data: profileData,
    });
  } catch (error) {
    throw new Error('Profile not found for the specified user.');
  }
}
