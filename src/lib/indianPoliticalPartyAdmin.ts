/**
 * Super Admin — IndianPoliticalParty CRUD helpers.
 */
import sharp from 'sharp';
import prisma from './prisma';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';
import { putPublicObject } from './objectStorage';
import { formatPartyRow, type PartySeedRow } from './indianPoliticalParty';

const p: any = prisma;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const RECOGNITION = new Set(['NATIONAL', 'STATE', 'REGISTERED_UNRECOGNIZED']);
const COLOR_SOURCES = new Set(['ECI', 'MANUAL', 'AI_CURATED']);

export function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s || null;
}

export function normalizeHex(v: unknown, field: string): string {
  const s = cleanText(v);
  if (!s) throw new Error(`${field} is required`);
  const hex = s.startsWith('#') ? s : `#${s}`;
  if (!HEX_RE.test(hex)) throw new Error(`${field} must be #RRGGBB`);
  return hex.toUpperCase();
}

export async function findPartyByIdOrCode(idOrCode: string, includeInactive = false) {
  const where: any = {
    OR: [{ id: idOrCode }, { shortCode: idOrCode.toUpperCase() }],
  };
  if (!includeInactive) where.isActive = true;
  return p.indianPoliticalParty.findFirst({ where });
}

export type CreatePartyInput = {
  shortCode: string;
  name: string;
  abbreviation?: string | null;
  recognition: string;
  symbolName?: string | null;
  symbolImageUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  states?: string[];
  headquartersAddress?: string | null;
  eciSerialNumber?: number | null;
  eciNotificationRef?: string | null;
  colorSource?: string;
};

export async function createParty(input: CreatePartyInput) {
  const shortCode = cleanText(input.shortCode)?.toUpperCase();
  const name = cleanText(input.name);
  if (!shortCode || !name) throw new Error('shortCode and name are required');
  const recognition = cleanText(input.recognition)?.toUpperCase();
  if (!recognition || !RECOGNITION.has(recognition)) throw new Error('Invalid recognition');

  const existing = await p.indianPoliticalParty.findUnique({ where: { shortCode } });
  if (existing) throw new Error('shortCode already exists');

  const primaryColor = input.primaryColor ? normalizeHex(input.primaryColor, 'primaryColor') : '#1A237E';
  const secondaryColor = input.secondaryColor
    ? normalizeHex(input.secondaryColor, 'secondaryColor')
    : '#FFFFFF';
  const colorSource = cleanText(input.colorSource)?.toUpperCase();
  if (colorSource && !COLOR_SOURCES.has(colorSource)) throw new Error('Invalid colorSource');

  const row = await p.indianPoliticalParty.create({
    data: {
      shortCode,
      name,
      abbreviation: cleanText(input.abbreviation),
      recognition,
      symbolName: cleanText(input.symbolName),
      symbolImageUrl: cleanText(input.symbolImageUrl),
      primaryColor,
      secondaryColor,
      states: Array.isArray(input.states) ? input.states.map(String) : [],
      headquartersAddress: cleanText(input.headquartersAddress),
      eciSerialNumber: input.eciSerialNumber ?? null,
      eciNotificationRef: cleanText(input.eciNotificationRef),
      colorSource: colorSource || 'MANUAL',
      isActive: true,
    },
  });
  return formatPartyRow(row);
}

export type UpdatePartyInput = Partial<CreatePartyInput> & { isActive?: boolean };

export async function updateParty(id: string, input: UpdatePartyInput) {
  const existing = await p.indianPoliticalParty.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) data.name = cleanText(input.name) || existing.name;
  if (input.abbreviation !== undefined) data.abbreviation = cleanText(input.abbreviation);
  if (input.recognition !== undefined) {
    const r = cleanText(input.recognition)?.toUpperCase();
    if (!r || !RECOGNITION.has(r)) throw new Error('Invalid recognition');
    data.recognition = r;
  }
  if (input.symbolName !== undefined) data.symbolName = cleanText(input.symbolName);
  if (input.symbolImageUrl !== undefined) data.symbolImageUrl = cleanText(input.symbolImageUrl);
  if (input.primaryColor !== undefined) data.primaryColor = normalizeHex(input.primaryColor, 'primaryColor');
  if (input.secondaryColor !== undefined) data.secondaryColor = normalizeHex(input.secondaryColor, 'secondaryColor');
  if (input.states !== undefined) data.states = Array.isArray(input.states) ? input.states.map(String) : [];
  if (input.headquartersAddress !== undefined) data.headquartersAddress = cleanText(input.headquartersAddress);
  if (input.eciSerialNumber !== undefined) data.eciSerialNumber = input.eciSerialNumber;
  if (input.eciNotificationRef !== undefined) data.eciNotificationRef = cleanText(input.eciNotificationRef);
  if (input.colorSource !== undefined) {
    const cs = cleanText(input.colorSource)?.toUpperCase();
    if (cs && !COLOR_SOURCES.has(cs)) throw new Error('Invalid colorSource');
    data.colorSource = cs || existing.colorSource;
  }
  if (input.isActive !== undefined) data.isActive = !!input.isActive;

  if (input.shortCode !== undefined) {
    const sc = cleanText(input.shortCode)?.toUpperCase();
    if (!sc) throw new Error('shortCode cannot be empty');
    if (sc !== existing.shortCode) {
      const clash = await p.indianPoliticalParty.findUnique({ where: { shortCode: sc } });
      if (clash) throw new Error('shortCode already in use');
      data.shortCode = sc;
    }
  }

  const row = await p.indianPoliticalParty.update({ where: { id }, data });
  return formatPartyRow(row);
}

export async function updatePartyColors(
  id: string,
  body: { primaryColor?: string; secondaryColor?: string; colorSource?: string },
) {
  const patch: UpdatePartyInput = {};
  if (body.primaryColor !== undefined) patch.primaryColor = body.primaryColor;
  if (body.secondaryColor !== undefined) patch.secondaryColor = body.secondaryColor;
  if (body.colorSource !== undefined) patch.colorSource = body.colorSource;
  else if (body.primaryColor || body.secondaryColor) patch.colorSource = 'MANUAL';
  return updateParty(id, patch);
}

export async function updatePartySymbolMeta(
  id: string,
  body: { symbolName?: string | null; symbolImageUrl?: string | null },
) {
  const patch: UpdatePartyInput = {};
  if (body.symbolName !== undefined) patch.symbolName = body.symbolName;
  if (body.symbolImageUrl !== undefined) patch.symbolImageUrl = body.symbolImageUrl;
  return updateParty(id, patch);
}

export async function uploadPartySymbolImage(id: string, fileBuffer: Buffer, mimeType: string) {
  const party = await p.indianPoliticalParty.findUnique({ where: { id } });
  if (!party) return null;

  const png = await sharp(fileBuffer).png().toBuffer();
  const key = `political-parties/symbols/${party.shortCode.toLowerCase()}.png`;

  let publicUrl: string;
  if (isBunnyStorageConfigured()) {
    const r = await bunnyStoragePutObject({ key, body: png, contentType: 'image/png' });
    publicUrl = r.publicUrl;
  } else {
    const r = await putPublicObject({ key, body: png, contentType: 'image/png' });
    publicUrl = r.publicUrl;
  }

  const row = await p.indianPoliticalParty.update({
    where: { id },
    data: { symbolImageUrl: publicUrl, updatedAt: new Date() },
  });
  return formatPartyRow(row);
}

export async function adminListParties(filters: {
  q?: string | null;
  state?: string | null;
  recognition?: string | null;
  isActive?: string | null;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (filters.recognition) where.recognition = filters.recognition;
  if (filters.state) where.states = { has: filters.state };
  if (filters.isActive === 'true') where.isActive = true;
  if (filters.isActive === 'false') where.isActive = false;
  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { shortCode: { contains: q, mode: 'insensitive' } },
      { symbolName: { contains: q, mode: 'insensitive' } },
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

export async function softDeleteParty(id: string) {
  return updateParty(id, { isActive: false });
}
