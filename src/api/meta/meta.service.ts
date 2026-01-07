import prisma from '../../lib/prisma';

export async function listSurnames(params: { suggest?: string; stateId?: string; limit?: number }) {
  const suggest = params.suggest ? String(params.suggest).trim() : '';
  const stateId = params.stateId ? String(params.stateId).trim() : '';
  const take = Math.max(1, Math.min(50, Number(params.limit || 10)));

  const where: any = {};
  if (stateId) where.stateId = stateId;
  if (suggest) where.surnameEn = { startsWith: suggest, mode: 'insensitive' };

  return (prisma as any)['surname'].findMany({
    where,
    take,
    orderBy: [{ surnameEn: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      surnameEn: true,
      surnameNative: true,
      stateId: true,
      isVerified: true,
      createdAt: true,
    },
  });
}

export async function findOrCreateSurname(params: { surnameEn: string; surnameNative?: string; stateId?: string; createdByUserId?: string }) {
  const surnameEn = String(params.surnameEn || '').trim();
  if (!surnameEn) throw new Error('surnameEn is required');

  const surnameNative = params.surnameNative ? String(params.surnameNative).trim() : undefined;
  const stateId = params.stateId ? String(params.stateId).trim() : '';
  if (!stateId) throw new Error('stateId is required');
  const createdByUserId = params.createdByUserId ? String(params.createdByUserId).trim() : undefined;

  const existing = await (prisma as any)['surname'].findFirst({
    where: {
      surnameEn: { equals: surnameEn, mode: 'insensitive' },
      stateId,
    },
    select: { id: true, surnameEn: true, surnameNative: true, stateId: true, isVerified: true, createdAt: true },
  });
  if (existing) return existing;

  try {
    return await (prisma as any)['surname'].create({
      data: {
        surnameEn,
        ...(surnameNative ? { surnameNative } : {}),
        stateId,
        ...(createdByUserId ? { createdByUserId } : {}),
        isVerified: false,
      },
      select: { id: true, surnameEn: true, surnameNative: true, stateId: true, isVerified: true, createdAt: true },
    });
  } catch (e: any) {
    // In case of a concurrent insert, try to return existing.
    const again = await (prisma as any)['surname'].findFirst({
      where: {
        surnameEn: { equals: surnameEn, mode: 'insensitive' },
        stateId,
      },
      select: { id: true, surnameEn: true, surnameNative: true, stateId: true, isVerified: true, createdAt: true },
    });
    if (again) return again;
    throw e;
  }
}
