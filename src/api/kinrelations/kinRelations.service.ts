import prisma from '../../lib/prisma';
import { CreateKinRelationDto, UpdateKinRelationDto, BulkUpsertKinRelation } from './kinRelations.dto';

export async function listKinRelations(params?: { category?: string; side?: string; gender?: string; search?: string; }): Promise<any[]> {
  const { category, side, gender, search } = params || {};
  return (prisma as any)['kinRelation'].findMany({
    where: {
      ...(category ? { category } : {}),
      ...(side ? { side } : {}),
      ...(gender ? { gender } : {}),
      ...(search ? { OR: [ { en: { contains: search, mode: 'insensitive' } }, { te: { contains: search } }, { code: { contains: search, mode: 'insensitive' } } ] } : {}),
    },
    orderBy: [{ category: 'asc' }, { generationUp: 'asc' }, { generationDown: 'asc' }, { code: 'asc' }],
  } as any);
}

export async function getKinRelationByCode(code: string) {
  return (prisma as any)['kinRelation'].findUnique({ where: { code } } as any);
}

export async function createKinRelation(data: CreateKinRelationDto) {
  return (prisma as any)['kinRelation'].create({ data: {
    code: data.code,
    category: data.category,
    gender: data.gender ?? null,
    side: data.side ?? null,
    generationUp: data.generationUp ?? 0,
    generationDown: data.generationDown ?? 0,
    en: data.en,
    te: data.te,
    isCommon: data.isCommon ?? true,
  } } as any);
}

export async function updateKinRelation(code: string, data: UpdateKinRelationDto) {
  return (prisma as any)['kinRelation'].update({ where: { code }, data } as any);
}

export async function deleteKinRelation(code: string) {
  return (prisma as any)['kinRelation'].delete({ where: { code } } as any);
}

export async function bulkUpsertKinRelations(items: BulkUpsertKinRelation[]) {
  const ops = items.map((k) =>
    (prisma as any)['kinRelation'].upsert({
      where: { code: k.code },
      update: {
        category: k.category,
        gender: k.gender ?? null,
        side: k.side ?? null,
        generationUp: k.generationUp ?? 0,
        generationDown: k.generationDown ?? 0,
        en: k.en,
        te: k.te,
        isCommon: k.isCommon ?? true,
      },
      create: {
        code: k.code,
        category: k.category,
        gender: k.gender ?? null,
        side: k.side ?? null,
        generationUp: k.generationUp ?? 0,
        generationDown: k.generationDown ?? 0,
        en: k.en,
        te: k.te,
        isCommon: k.isCommon ?? true,
      }
    } as any)
  );
  await prisma.$transaction(ops as any);
  return { count: ops.length };
}
