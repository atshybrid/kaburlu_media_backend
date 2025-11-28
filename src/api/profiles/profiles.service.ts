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
    include: {
      state: true,
      district: true,
      mandal: true,
      profilePhotoMedia: true,
    },
  });
  if (!profile) throw new Error('Profile not found for the specified user.');
  return profile;
}

export async function createProfile(userId: string, data: CreateProfileDto) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found.');
  // ensure not exists
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (existing) throw new Error('Profile already exists.');
  const dob = data.dob ? parseDate(data.dob) : null;
  const payload: any = {
    userId,
    fullName: data.fullName ?? null,
    surname: data.surname ?? null,
    lastName: data.lastName ?? null,
    gender: data.gender ?? null,
    dob,
    maritalStatus: data.maritalStatus ?? null,
    bio: data.bio ?? null,
    profilePhotoUrl: data.profilePhotoUrl ?? null,
    profilePhotoMediaId: data.profilePhotoMediaId ?? null,
    emergencyContactNumber: data.emergencyContactNumber ?? null,
    address: data.address ?? null,
    stateId: data.stateId || null,
    districtId: data.districtId || null,
    mandalId: data.mandalId || null,
    assemblyId: data.assemblyId || null,
    villageId: data.villageId || null,
    occupation: data.occupation ?? null,
    education: data.education ?? null,
    socialLinks: data.socialLinks ?? null,
    caste: data.caste ?? null,
    subCaste: data.subCaste ?? null,
    casteId: data.casteId || null,
    subCasteId: data.subCasteId || null,
  };
  for (const key of ['stateId', 'districtId', 'assemblyId', 'mandalId', 'villageId']) {
    if (payload[key] === '') payload[key] = null;
  }
  return prisma.userProfile.create({ data: payload });
}

export async function updateProfile(userId: string, data: UpdateProfileDto) {
  const dob = data.dob ? parseDate(data.dob) : undefined;
  const updateData: any = {
    fullName: data.fullName,
    surname: data.surname,
    lastName: data.lastName,
    gender: data.gender,
    dob,
    maritalStatus: data.maritalStatus,
    bio: data.bio,
    profilePhotoUrl: data.profilePhotoUrl,
    profilePhotoMediaId: data.profilePhotoMediaId,
    emergencyContactNumber: data.emergencyContactNumber,
    address: data.address,
    stateId: data.stateId === '' ? null : data.stateId,
    districtId: data.districtId === '' ? null : data.districtId,
    mandalId: data.mandalId === '' ? null : data.mandalId,
    assemblyId: data.assemblyId === '' ? null : data.assemblyId,
    villageId: data.villageId === '' ? null : data.villageId,
    occupation: data.occupation,
    education: data.education,
    socialLinks: data.socialLinks,
    caste: data.caste,
    subCaste: data.subCaste,
    casteId: data.casteId === '' ? null : data.casteId,
    subCasteId: data.subCasteId === '' ? null : data.subCasteId,
  };
  try {
    return await prisma.userProfile.update({
      where: { userId },
      data: updateData,
    });
  } catch (error) {
    throw new Error('Profile not found for the specified user.');
  }
}

export async function deleteProfile(userId: string) {
  try {
    await prisma.userProfile.delete({ where: { userId } });
    return { success: true };
  } catch (e) {
    throw new Error('Profile not found for the specified user.');
  }
}

export async function listProfiles(page = 1, pageSize = 20) {
  const skip = (page - 1) * pageSize;
  const [items, total] = await Promise.all([
    prisma.userProfile.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: { state: true, district: true, mandal: true, profilePhotoMedia: true },
    }),
    prisma.userProfile.count(),
  ]);
  const totalPages = Math.ceil(total / pageSize) || 1;
  return { items, total, page, pageSize, totalPages };
}
