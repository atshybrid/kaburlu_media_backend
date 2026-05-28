/**
 * Indian political parties — ECI gazette data + UI brand colors.
 */
import prisma from './prisma';

const p: any = prisma;

export type PartySeedRow = {
  shortCode: string;
  name: string;
  abbreviation?: string | null;
  recognition: 'NATIONAL' | 'STATE' | 'REGISTERED_UNRECOGNIZED';
  symbolName?: string | null;
  symbolImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  states?: string[];
  headquartersAddress?: string | null;
  eciSerialNumber?: number | null;
  eciNotificationRef?: string | null;
  eciSourceUrl?: string | null;
  colorSource?: 'ECI' | 'MANUAL' | 'AI_CURATED';
};

export function formatPartyRow(row: any) {
  return {
    id: row.id,
    shortCode: row.shortCode,
    name: row.name,
    abbreviation: row.abbreviation,
    recognition: row.recognition,
    symbolName: row.symbolName,
    symbolImageUrl: row.symbolImageUrl,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    states: row.states ?? [],
    headquartersAddress: row.headquartersAddress,
    eciSerialNumber: row.eciSerialNumber,
    eciNotificationRef: row.eciNotificationRef,
    eciSourceUrl: row.eciSourceUrl,
    colorSource: row.colorSource,
    isActive: row.isActive,
  };
}

export async function upsertPartyFromSeed(row: PartySeedRow, defaultEciUrl?: string) {
  const shortCode = row.shortCode.trim().toUpperCase();
  return p.indianPoliticalParty.upsert({
    where: { shortCode },
    create: {
      shortCode,
      name: row.name.trim(),
      abbreviation: row.abbreviation?.trim() || null,
      recognition: row.recognition,
      symbolName: row.symbolName?.trim() || null,
      symbolImageUrl: row.symbolImageUrl?.trim() || null,
      primaryColor: row.primaryColor || '#1A237E',
      secondaryColor: row.secondaryColor || '#FFFFFF',
      states: row.states ?? [],
      headquartersAddress: row.headquartersAddress?.trim() || null,
      eciSerialNumber: row.eciSerialNumber ?? null,
      eciNotificationRef: row.eciNotificationRef?.trim() || null,
      eciSourceUrl: row.eciSourceUrl?.trim() || defaultEciUrl || null,
      colorSource: row.colorSource || 'MANUAL',
      isActive: true,
    },
    update: {
      name: row.name.trim(),
      abbreviation: row.abbreviation?.trim() || null,
      recognition: row.recognition,
      symbolName: row.symbolName?.trim() || null,
      symbolImageUrl: row.symbolImageUrl?.trim() || undefined,
      primaryColor: row.primaryColor || undefined,
      secondaryColor: row.secondaryColor || undefined,
      states: row.states ?? undefined,
      headquartersAddress: row.headquartersAddress?.trim() || undefined,
      eciSerialNumber: row.eciSerialNumber ?? undefined,
      eciNotificationRef: row.eciNotificationRef?.trim() || undefined,
      eciSourceUrl: row.eciSourceUrl?.trim() || defaultEciUrl || undefined,
      colorSource: row.colorSource || undefined,
      isActive: true,
      updatedAt: new Date(),
    },
  });
}

export async function searchParties(filters: {
  q?: string | null;
  state?: string | null;
  recognition?: string | null;
  isActive?: boolean;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;

  const where: any = { isActive: filters.isActive !== false };
  if (filters.recognition) where.recognition = filters.recognition;
  if (filters.state) where.states = { has: filters.state };
  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { shortCode: { contains: q, mode: 'insensitive' } },
      { symbolName: { contains: q, mode: 'insensitive' } },
      { abbreviation: { contains: q, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    p.indianPoliticalParty.count({ where }),
    p.indianPoliticalParty.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ recognition: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
    items: rows.map(formatPartyRow),
  };
}
