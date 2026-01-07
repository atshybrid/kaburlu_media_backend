import prisma from '../../lib/prisma';
import { CreateKinRelationDto, UpdateKinRelationDto, BulkUpsertKinRelation, BulkUpsertKinRelationName } from './kinRelations.dto';

export async function listKinRelations(params?: { category?: string; side?: string; gender?: string; search?: string; languageCode?: string; }): Promise<any[]> {
  const { category, side, gender, search, languageCode } = params || {};
  const items = await (prisma as any)['kinRelation'].findMany({
    where: {
      ...(category ? { category } : {}),
      ...(side ? { side } : {}),
      ...(gender ? { gender } : {}),
      ...(search ? { OR: [ { en: { contains: search, mode: 'insensitive' } }, { te: { contains: search } }, { code: { contains: search, mode: 'insensitive' } } ] } : {}),
    },
    orderBy: [{ category: 'asc' }, { generationUp: 'asc' }, { generationDown: 'asc' }, { code: 'asc' }],
    ...(languageCode ? {
      include: {
        names: {
          where: { languageCode: String(languageCode) },
          select: { languageCode: true, displayName: true, altNames: true },
          take: 1,
        }
      }
    } : {}),
  } as any);

  if (!languageCode) return items;
  return items.map((it: any) => {
    const name = Array.isArray(it?.names) && it.names.length ? it.names[0] : null;
    const displayName = name?.displayName || it?.en || it?.te || it?.code;
    const altNames = name?.altNames || [];
    return { ...it, displayName, altNames };
  });
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

export async function listKinRelationNamesByCode(code: string) {
  const rel = await (prisma as any)['kinRelation'].findUnique({ where: { code }, select: { id: true, code: true } } as any);
  if (!rel) return null;
  const names = await (prisma as any)['kinRelationName']?.findMany?.({
    where: { kinRelationId: rel.id },
    orderBy: [{ languageCode: 'asc' }],
    select: { languageCode: true, displayName: true, altNames: true, updatedAt: true },
  } as any).catch(() => [] as any);
  return { code: rel.code, names };
}

export async function bulkUpsertKinRelationNames(items: BulkUpsertKinRelationName[]) {
  const uniqueCodes = Array.from(new Set(items.map(i => String(i.code || '').trim()).filter(Boolean)));
  if (!uniqueCodes.length) return { count: 0 };

  const rels = await (prisma as any)['kinRelation'].findMany({
    where: { code: { in: uniqueCodes } },
    select: { id: true, code: true },
  } as any);
  const byCode = new Map(rels.map((r: any) => [String(r.code), String(r.id)]));

  const ops = items
    .map((i) => {
      const code = String(i.code || '').trim();
      const languageCode = String(i.languageCode || '').trim();
      const displayName = String(i.displayName || '').trim();
      if (!code || !languageCode || !displayName) return null;
      const kinRelationId = byCode.get(code);
      if (!kinRelationId) return null;
      const altNames = Array.isArray((i as any).altNames)
        ? (i as any).altNames.map((x: any) => String(x || '').trim()).filter(Boolean).slice(0, 20)
        : [];
      return (prisma as any)['kinRelationName'].upsert({
        where: { kinRelationId_languageCode: { kinRelationId, languageCode } },
        update: { displayName, altNames },
        create: { kinRelationId, languageCode, displayName, altNames },
      } as any);
    })
    .filter(Boolean);

  if (!ops.length) return { count: 0 };
  await prisma.$transaction(ops as any);
  return { count: ops.length };
}
