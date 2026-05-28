/**
 * PRGI registered newspaper titles — parse, validate, search helpers.
 */
import prisma from './prisma';

export type PrgiNewspaperInput = {
  serialNumber?: number | null;
  title: string;
  registrationNumber: string;
  registrationDate?: string | Date | null;
  language?: string | null;
  periodicity?: string | null;
  publisher?: string | null;
  owner?: string | null;
  publicationState: string;
  publicationDistrict?: string | null;
  sourceFile?: string | null;
};

export function cleanText(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s || null;
}

export function normalizeRegistrationNumber(raw: unknown): string {
  return String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRegistrationDate(raw: unknown): Date | null {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const s = cleanText(raw);
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day) {
      return d;
    }
    return null;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** RFC4180-style CSV row parser. */
export function parseCsvRow(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (c === ',' && !inQuotes) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function rowFromCsvColumns(cols: string[], sourceFile?: string): PrgiNewspaperInput | null {
  if (cols.length < 10) return null;
  const reg = normalizeRegistrationNumber(cols[2]);
  const title = cleanText(cols[1]);
  const state = cleanText(cols[8]);
  if (!reg || !title || !state) return null;
  const sn = parseInt(cols[0], 10);
  return {
    serialNumber: Number.isFinite(sn) ? sn : null,
    title,
    registrationNumber: reg,
    registrationDate: parseRegistrationDate(cols[3]),
    language: cleanText(cols[4]),
    periodicity: cleanText(cols[5]),
    publisher: cleanText(cols[6]),
    owner: cleanText(cols[7]),
    publicationState: state,
    publicationDistrict: cleanText(cols[9]),
    sourceFile: sourceFile || null,
  };
}

export function parseCsvText(content: string, sourceFile?: string): PrgiNewspaperInput[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const out: PrgiNewspaperInput[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = rowFromCsvColumns(parseCsvRow(lines[i]), sourceFile);
    if (row) out.push(row);
  }
  return out;
}

export function parseBodyToInput(body: any): PrgiNewspaperInput {
  const registrationNumber = normalizeRegistrationNumber(
    body?.registrationNumber ?? body?.prgiNumber ?? body?.prgi_number,
  );
  const title = cleanText(body?.title);
  const publicationState = cleanText(body?.publicationState ?? body?.state);
  if (!registrationNumber) throw new Error('registrationNumber (PRGI number) is required');
  if (!title) throw new Error('title is required');
  if (!publicationState) throw new Error('publicationState is required');

  const snRaw = body?.serialNumber ?? body?.sn;
  const sn = snRaw == null || snRaw === '' ? null : parseInt(String(snRaw), 10);

  return {
    serialNumber: Number.isFinite(sn as number) ? (sn as number) : null,
    title,
    registrationNumber,
    registrationDate: parseRegistrationDate(body?.registrationDate),
    language: cleanText(body?.language),
    periodicity: cleanText(body?.periodicity ?? body?.type),
    publisher: cleanText(body?.publisher),
    owner: cleanText(body?.owner),
    publicationState,
    publicationDistrict: cleanText(body?.publicationDistrict ?? body?.district),
    sourceFile: cleanText(body?.sourceFile),
  };
}

export function toPrismaData(input: PrgiNewspaperInput) {
  return {
    serialNumber: input.serialNumber ?? null,
    title: input.title,
    registrationNumber: input.registrationNumber,
    registrationDate: input.registrationDate ?? null,
    language: input.language ?? null,
    periodicity: input.periodicity ?? null,
    publisher: input.publisher ?? null,
    owner: input.owner ?? null,
    publicationState: input.publicationState,
    publicationDistrict: input.publicationDistrict ?? null,
    sourceFile: input.sourceFile ?? null,
  };
}

export function formatPrgiNewspaper(row: any) {
  const regDate = row.registrationDate;
  return {
    id: row.id,
    serialNumber: row.serialNumber,
    title: row.title,
    registrationNumber: row.registrationNumber,
    prgiNumber: row.registrationNumber,
    registrationDate:
      regDate instanceof Date ? regDate.toISOString().slice(0, 10) : regDate ? String(regDate).slice(0, 10) : null,
    language: row.language,
    periodicity: row.periodicity,
    type: row.periodicity,
    publisher: row.publisher,
    owner: row.owner,
    publicationState: row.publicationState,
    state: row.publicationState,
    publicationDistrict: row.publicationDistrict,
    district: row.publicationDistrict,
    sourceFile: row.sourceFile,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PrgiSearchQuery = {
  q?: string | null;
  title?: string | null;
  registrationNumber?: string | null;
  prgiNumber?: string | null;
  publisher?: string | null;
  owner?: string | null;
  publicationState?: string | null;
  state?: string | null;
  publicationDistrict?: string | null;
  district?: string | null;
  periodicity?: string | null;
  type?: string | null;
  language?: string | null;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export function buildSearchWhere(query: PrgiSearchQuery): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  const q = cleanText(query.q);
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { registrationNumber: { contains: q, mode: 'insensitive' } },
        { publisher: { contains: q, mode: 'insensitive' } },
        { owner: { contains: q, mode: 'insensitive' } },
        { publicationState: { contains: q, mode: 'insensitive' } },
        { publicationDistrict: { contains: q, mode: 'insensitive' } },
        { periodicity: { contains: q, mode: 'insensitive' } },
        { language: { contains: q, mode: 'insensitive' } },
      ],
    });
  }

  const title = cleanText(query.title);
  if (title) and.push({ title: { contains: title, mode: 'insensitive' } });

  const reg = normalizeRegistrationNumber(query.registrationNumber ?? query.prgiNumber ?? '');
  if (reg) and.push({ registrationNumber: { contains: reg, mode: 'insensitive' } });

  const publisher = cleanText(query.publisher);
  if (publisher) and.push({ publisher: { contains: publisher, mode: 'insensitive' } });

  const owner = cleanText(query.owner);
  if (owner) and.push({ owner: { contains: owner, mode: 'insensitive' } });

  const state = cleanText(query.publicationState ?? query.state);
  if (state) and.push({ publicationState: { equals: state, mode: 'insensitive' } });

  const district = cleanText(query.publicationDistrict ?? query.district);
  if (district) and.push({ publicationDistrict: { contains: district, mode: 'insensitive' } });

  const periodicity = cleanText(query.periodicity ?? query.type);
  if (periodicity) and.push({ periodicity: { contains: periodicity, mode: 'insensitive' } });

  const language = cleanText(query.language);
  if (language) and.push({ language: { contains: language, mode: 'insensitive' } });

  if (and.length === 0) return {};
  if (and.length === 1) return and[0];
  return { AND: and };
}

export function parseSearchQuery(query: Record<string, unknown>): PrgiSearchQuery {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10) || 20));
  const sortOrder = String(query.sortOrder ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
  const sortBy = cleanText(query.sortBy) || 'title';
  return {
    q: cleanText(query.q),
    title: cleanText(query.title),
    registrationNumber: cleanText(query.registrationNumber),
    prgiNumber: cleanText(query.prgiNumber),
    publisher: cleanText(query.publisher),
    owner: cleanText(query.owner),
    publicationState: cleanText(query.publicationState),
    state: cleanText(query.state),
    publicationDistrict: cleanText(query.publicationDistrict),
    district: cleanText(query.district),
    periodicity: cleanText(query.periodicity),
    type: cleanText(query.type),
    language: cleanText(query.language),
    page,
    limit,
    sortBy,
    sortOrder,
  };
}

const SORT_FIELDS = new Set([
  'title',
  'registrationNumber',
  'registrationDate',
  'publicationState',
  'publicationDistrict',
  'periodicity',
  'publisher',
  'createdAt',
]);

export function resolveOrderBy(sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc') {
  const field = SORT_FIELDS.has(sortBy || '') ? sortBy! : 'title';
  return { [field]: sortOrder };
}

export async function searchPrgiNewspapers(query: PrgiSearchQuery) {
  const where = buildSearchWhere(query);
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const orderBy = resolveOrderBy(query.sortBy, query.sortOrder);

  const [total, rows] = await Promise.all([
    prisma.prgiRegisteredTitle.count({ where }),
    prisma.prgiRegisteredTitle.findMany({ where, orderBy, skip, take: limit }),
  ]);

  return {
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 0,
    items: rows.map(formatPrgiNewspaper),
  };
}

export async function createPrgiNewspapers(inputs: PrgiNewspaperInput[], sourceFile?: string) {
  const deduped = new Map<string, PrgiNewspaperInput>();
  for (const input of inputs) {
    const key = input.registrationNumber.toUpperCase();
    if (!deduped.has(key)) deduped.set(key, input);
  }

  const created: ReturnType<typeof formatPrgiNewspaper>[] = [];
  const skipped: { registrationNumber: string; reason: string }[] = [];
  const errors: { registrationNumber?: string; error: string }[] = [];

  for (const input of deduped.values()) {
    try {
      if (sourceFile && !input.sourceFile) input.sourceFile = sourceFile;
      const row = await prisma.prgiRegisteredTitle.create({ data: toPrismaData(input) });
      created.push(formatPrgiNewspaper(row));
    } catch (e: any) {
      if (e?.code === 'P2002') {
        skipped.push({ registrationNumber: input.registrationNumber, reason: 'DUPLICATE_REGISTRATION_NUMBER' });
      } else {
        errors.push({ registrationNumber: input.registrationNumber, error: e?.message || 'Create failed' });
      }
    }
  }

  return {
    created,
    skipped,
    errors,
    createdCount: created.length,
    skippedCount: skipped.length,
    errorCount: errors.length,
  };
}

export async function updatePrgiNewspaper(id: string, body: any) {
  const existing = await prisma.prgiRegisteredTitle.findUnique({ where: { id } });
  if (!existing) return null;

  const snRaw = body?.serialNumber ?? body?.sn;
  const snParsed = snRaw == null || snRaw === '' ? existing.serialNumber : parseInt(String(snRaw), 10);

  const row = await prisma.prgiRegisteredTitle.update({
    where: { id },
    data: {
      serialNumber: Number.isFinite(snParsed as number) ? (snParsed as number) : existing.serialNumber,
      title: cleanText(body?.title) ?? existing.title,
      registrationNumber:
        normalizeRegistrationNumber(body?.registrationNumber ?? body?.prgiNumber) || existing.registrationNumber,
      registrationDate:
        body?.registrationDate !== undefined ? parseRegistrationDate(body.registrationDate) : existing.registrationDate,
      language: body?.language !== undefined ? cleanText(body.language) : existing.language,
      periodicity:
        body?.periodicity !== undefined || body?.type !== undefined
          ? cleanText(body?.periodicity ?? body?.type)
          : existing.periodicity,
      publisher: body?.publisher !== undefined ? cleanText(body.publisher) : existing.publisher,
      owner: body?.owner !== undefined ? cleanText(body.owner) : existing.owner,
      publicationState: cleanText(body?.publicationState ?? body?.state) ?? existing.publicationState,
      publicationDistrict:
        body?.publicationDistrict !== undefined || body?.district !== undefined
          ? cleanText(body?.publicationDistrict ?? body?.district)
          : existing.publicationDistrict,
      sourceFile: body?.sourceFile !== undefined ? cleanText(body.sourceFile) : existing.sourceFile,
    },
  });
  return formatPrgiNewspaper(row);
}
