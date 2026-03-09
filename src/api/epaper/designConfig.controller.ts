import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { resolveAdminTenantContext } from './adminTenantContext';
import { randomUUID } from 'crypto';
import { putPublicObject } from '../../lib/objectStorage';

type IssueCounterMode = 'DAY_OF_YEAR' | 'SEQUENTIAL';
type SerialType = 'HEADER' | 'SUBHEADER';

const MAX_SERIAL_COUNT = 20;
const MAX_DESIGN_IMAGE_BYTES = Math.max(1, Number(process.env.MEDIA_MAX_IMAGE_MB || 10)) * 1024 * 1024;

const TEMPLATE_CODE_ALIASES: Record<string, string> = {
  cm_main_header: 'BT_MAIN_HEADER',
  cm_inner_header: 'BT_INNER_HEADER',
  cm_footer: 'BT_LAST_PAGE_FOOTER',
};

type EpaperDesignSerialRow = {
  type: SerialType;
  sequenceNo: number;
  serialCode: string;
};

type DesignConfig = {
  headerData: string | null;
  subHeaderData: string | null;
  headerLogoUrl: string | null;
  subHeaderImageUrl: string | null;
  headerLeftImageUrl: string | null;
  headerRightImageUrl: string | null;
  footerText: string | null;
  headerTemplateStyleId: string | null;
  subHeaderTemplateStyleId: string | null;
  mainHeaderTemplateId: string | null;
  innerHeaderTemplateId: string | null;
  footerTemplateId: string | null;
  paperSellCost: number | null;
  defaultPageCount: number | null;
  volumeStartYear: number;
  startVolumeNumber: number;
  issueCounterMode: IssueCounterMode;
  issueStartNumber: number;
  updatedAt: string;
  updatedBy: string | null;
};

type IssueEntry = {
  issueDate: string;
  volumeNumber: number;
  issueNumber: number;
  pageCount: number;
  paperSellCost: number | null;
  headerData: string | null;
  subHeaderData: string | null;
  footerText: string | null;
  headerLogoUrl: string | null;
  subHeaderImageUrl: string | null;
  headerLeftImageUrl: string | null;
  headerRightImageUrl: string | null;
  headerTemplateStyleId: string | null;
  subHeaderTemplateStyleId: string | null;
  mainHeaderTemplateId: string | null;
  innerHeaderTemplateId: string | null;
  footerTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
};

function asObject(value: any): Record<string, any> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, any>;
  return {};
}

function normalizeText(value: any): string | null {
  if (value === undefined) return null;
  const text = String(value ?? '').trim();
  return text ? text : null;
}

function normalizeOptionalInt(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.trunc(parsed));
}

function normalizeOptionalFloat(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseDateOnlyOrNull(value: any): Date | null {
  const s = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86400000) + 1;
}

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeIssueMode(value: any): IssueCounterMode {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SEQUENTIAL') return 'SEQUENTIAL';
  return 'DAY_OF_YEAR';
}

function getMulterFile(req: Request, fieldName: string): any | null {
  const files: any = (req as any)?.files;
  if (!files) return null;

  if (Array.isArray(files)) {
    return files.find((f: any) => String(f?.fieldname || '') === fieldName) || null;
  }

  const group = files[fieldName];
  if (Array.isArray(group) && group[0]) return group[0];
  return null;
}

function imageExtFromMime(mime: string, fallbackName: string): string {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  if (m === 'image/webp') return 'webp';
  if (m === 'image/gif') return 'gif';
  if (m === 'image/svg+xml') return 'svg';

  const fallback = String(fallbackName || '').trim();
  if (fallback.includes('.')) {
    const ext = fallback.split('.').pop() || 'bin';
    return ext.toLowerCase();
  }
  return 'bin';
}

async function uploadDesignImage(tenantId: string, file: any, slot: 'header-left' | 'header-right'): Promise<string> {
  const mime = String(file?.mimetype || '').toLowerCase();
  if (!mime.startsWith('image/')) {
    throw new Error(`${slot} image must be a valid image file`);
  }

  const size = Number(file?.size || 0);
  if (size <= 0 || !file?.buffer) {
    throw new Error(`${slot} image is empty or invalid`);
  }
  if (size > MAX_DESIGN_IMAGE_BYTES) {
    throw new Error(`${slot} image too large. Max ${Math.round(MAX_DESIGN_IMAGE_BYTES / (1024 * 1024))}MB`);
  }

  const ext = imageExtFromMime(mime, String(file?.originalname || 'upload.bin'));
  const d = new Date();
  const datePath = `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const key = `epaper/design-config/${tenantId}/${slot}/${datePath}/${Date.now()}-${randomUUID()}.${ext}`;

  const uploaded = await putPublicObject({
    key,
    body: file.buffer,
    contentType: mime || 'application/octet-stream',
  });

  return uploaded.publicUrl;
}

async function mergeDesignConfigInputWithUploads(req: Request, tenantId: string): Promise<Record<string, any>> {
  const input = { ...(req.body || {}) };
  const headerLeftImage = getMulterFile(req, 'headerLeftImage');
  const headerRightImage = getMulterFile(req, 'headerRightImage');

  if (headerLeftImage) {
    input.headerLeftImageUrl = await uploadDesignImage(tenantId, headerLeftImage, 'header-left');
  }
  if (headerRightImage) {
    input.headerRightImageUrl = await uploadDesignImage(tenantId, headerRightImage, 'header-right');
  }

  return input;
}

function defaultDesignConfig(userId: string | null): DesignConfig {
  const currentYear = new Date().getUTCFullYear();
  return {
    headerData: null,
    subHeaderData: null,
    headerLogoUrl: null,
    subHeaderImageUrl: null,
    headerLeftImageUrl: null,
    headerRightImageUrl: null,
    footerText: null,
    headerTemplateStyleId: null,
    subHeaderTemplateStyleId: null,
    mainHeaderTemplateId: null,
    innerHeaderTemplateId: null,
    footerTemplateId: null,
    paperSellCost: null,
    defaultPageCount: 8,
    volumeStartYear: currentYear,
    startVolumeNumber: 1,
    issueCounterMode: 'DAY_OF_YEAR',
    issueStartNumber: 1,
    updatedAt: nowIso(),
    updatedBy: userId,
  };
}

async function getOrCreateSettings(tenantId: string) {
  return prisma.epaperSettings.upsert({
    where: { tenantId },
    update: {},
    create: { tenantId },
  });
}

function hasPersistedDesignConfig(settings: any): boolean {
  const gen = asObject(settings?.generationConfig);
  const current = asObject(gen.designConfig);
  return Object.keys(current).length > 0;
}

function readDesignConfig(settings: any, userId: string | null): DesignConfig {
  const gen = asObject(settings?.generationConfig);
  const current = asObject(gen.designConfig);
  const d = defaultDesignConfig(userId);
  return {
    ...d,
    ...current,
    headerData: current.headerData === undefined ? d.headerData : normalizeText(current.headerData),
    subHeaderData: current.subHeaderData === undefined ? d.subHeaderData : normalizeText(current.subHeaderData),
    headerLogoUrl: current.headerLogoUrl === undefined ? d.headerLogoUrl : normalizeText(current.headerLogoUrl),
    subHeaderImageUrl: current.subHeaderImageUrl === undefined ? d.subHeaderImageUrl : normalizeText(current.subHeaderImageUrl),
    headerLeftImageUrl: current.headerLeftImageUrl === undefined ? d.headerLeftImageUrl : normalizeText(current.headerLeftImageUrl),
    headerRightImageUrl: current.headerRightImageUrl === undefined ? d.headerRightImageUrl : normalizeText(current.headerRightImageUrl),
    footerText: current.footerText === undefined ? d.footerText : normalizeText(current.footerText),
    headerTemplateStyleId: current.headerTemplateStyleId === undefined ? d.headerTemplateStyleId : normalizeText(current.headerTemplateStyleId),
    subHeaderTemplateStyleId: current.subHeaderTemplateStyleId === undefined ? d.subHeaderTemplateStyleId : normalizeText(current.subHeaderTemplateStyleId),
    mainHeaderTemplateId: current.mainHeaderTemplateId === undefined ? normalizeText(settings?.mainHeaderTemplateId) : normalizeText(current.mainHeaderTemplateId),
    innerHeaderTemplateId: current.innerHeaderTemplateId === undefined ? normalizeText(settings?.innerHeaderTemplateId) : normalizeText(current.innerHeaderTemplateId),
    footerTemplateId: current.footerTemplateId === undefined ? normalizeText(settings?.footerTemplateId) : normalizeText(current.footerTemplateId),
    paperSellCost: current.paperSellCost !== undefined
      ? normalizeOptionalFloat(current.paperSellCost)
      : (current.pageCost !== undefined ? normalizeOptionalFloat(current.pageCost) : d.paperSellCost),
    defaultPageCount: current.defaultPageCount === undefined
      ? (normalizeOptionalInt(settings?.defaultPageCount) ?? d.defaultPageCount)
      : normalizeOptionalInt(current.defaultPageCount),
    volumeStartYear: normalizeOptionalInt(current.volumeStartYear) || d.volumeStartYear,
    startVolumeNumber: normalizeOptionalInt(current.startVolumeNumber) || d.startVolumeNumber,
    issueCounterMode: normalizeIssueMode(current.issueCounterMode || d.issueCounterMode),
    issueStartNumber: normalizeOptionalInt(current.issueStartNumber) || d.issueStartNumber,
    updatedAt: normalizeText(current.updatedAt) || d.updatedAt,
    updatedBy: normalizeText(current.updatedBy) || d.updatedBy,
  };
}

function readIssueEntries(settings: any): IssueEntry[] {
  const gen = asObject(settings?.generationConfig);
  const list = Array.isArray(gen.issueEntries) ? gen.issueEntries : [];
  const entries: IssueEntry[] = [];

  for (const row of list) {
    const date = parseDateOnlyOrNull((row as any)?.issueDate);
    if (!date) continue;
    entries.push({
      issueDate: toDateOnly(date),
      volumeNumber: normalizeOptionalInt((row as any)?.volumeNumber) || 1,
      issueNumber: normalizeOptionalInt((row as any)?.issueNumber) || 1,
      pageCount: normalizeOptionalInt((row as any)?.pageCount) || 1,
      paperSellCost: (row as any)?.paperSellCost !== undefined
        ? normalizeOptionalFloat((row as any)?.paperSellCost)
        : normalizeOptionalFloat((row as any)?.pageCost),
      headerData: normalizeText((row as any)?.headerData),
      subHeaderData: normalizeText((row as any)?.subHeaderData),
      footerText: normalizeText((row as any)?.footerText),
      headerLogoUrl: normalizeText((row as any)?.headerLogoUrl),
      subHeaderImageUrl: normalizeText((row as any)?.subHeaderImageUrl),
      headerLeftImageUrl: normalizeText((row as any)?.headerLeftImageUrl),
      headerRightImageUrl: normalizeText((row as any)?.headerRightImageUrl),
      headerTemplateStyleId: normalizeText((row as any)?.headerTemplateStyleId),
      subHeaderTemplateStyleId: normalizeText((row as any)?.subHeaderTemplateStyleId),
      mainHeaderTemplateId: normalizeText((row as any)?.mainHeaderTemplateId),
      innerHeaderTemplateId: normalizeText((row as any)?.innerHeaderTemplateId),
      footerTemplateId: normalizeText((row as any)?.footerTemplateId),
      createdAt: normalizeText((row as any)?.createdAt) || nowIso(),
      updatedAt: normalizeText((row as any)?.updatedAt) || nowIso(),
    });
  }

  entries.sort((a, b) => b.issueDate.localeCompare(a.issueDate));
  return entries;
}

function buildVolumeNumber(cfg: DesignConfig, issueDate: Date): number {
  const yearDelta = Math.max(0, issueDate.getUTCFullYear() - cfg.volumeStartYear);
  return cfg.startVolumeNumber + yearDelta;
}

function buildIssueNumber(cfg: DesignConfig, issueDate: Date, existingYearEntries: IssueEntry[]): number {
  if (cfg.issueCounterMode === 'DAY_OF_YEAR') {
    return dayOfYear(issueDate);
  }
  return cfg.issueStartNumber + existingYearEntries.length;
}

function isHeaderSerialCode(value: string | null): boolean {
  return !!value && /^KABURLU_HEADER_\d{3}$/.test(value);
}

function isSubHeaderSerialCode(value: string | null): boolean {
  return !!value && /^KABURLU_SUBHEADER_\d{3}$/.test(value);
}

function shapeIssueEntryFromInput(input: any, fallbackCfg: DesignConfig): Partial<IssueEntry> {
  const mainHeaderCandidate = normalizeText(input.mainHeaderTemplateId ?? input.headerTemplateId ?? fallbackCfg.mainHeaderTemplateId);
  const innerHeaderCandidate = normalizeText(input.innerHeaderTemplateId ?? input.subHeaderTemplateId ?? fallbackCfg.innerHeaderTemplateId);
  const mainHeaderIsSerial = isHeaderSerialCode(mainHeaderCandidate);
  const innerHeaderIsSerial = isSubHeaderSerialCode(innerHeaderCandidate);

  return {
    pageCount: normalizeOptionalInt(input.pageCount ?? input.pages) ?? undefined,
    paperSellCost: normalizeOptionalFloat(input.paperSellCost ?? input.pageCost ?? input.paperPageCost),
    headerData: normalizeText(input.headerData),
    subHeaderData: normalizeText(input.subHeaderData),
    footerText: normalizeText(input.footerText ?? input.lastPageFooterText),
    headerLogoUrl: normalizeText(input.headerLogoUrl),
    subHeaderImageUrl: normalizeText(input.subHeaderImageUrl),
    headerLeftImageUrl: normalizeText(input.headerLeftImageUrl ?? input.headerLeftImage),
    headerRightImageUrl: normalizeText(input.headerRightImageUrl ?? input.headerRightImage),
    headerTemplateStyleId: normalizeText(input.headerTemplateStyleId ?? input.headerStyleId) || (mainHeaderIsSerial ? mainHeaderCandidate : null),
    subHeaderTemplateStyleId: normalizeText(input.subHeaderTemplateStyleId ?? input.subHeaderStyleId) || (innerHeaderIsSerial ? innerHeaderCandidate : null),
    mainHeaderTemplateId: mainHeaderIsSerial ? null : mainHeaderCandidate,
    innerHeaderTemplateId: innerHeaderIsSerial ? null : innerHeaderCandidate,
    footerTemplateId: normalizeText(input.footerTemplateId ?? fallbackCfg.footerTemplateId),
  };
}

async function resolveTemplateIdIfGiven(templateRef: string | null, expectedCategory: 'HEADER' | 'FOOTER'): Promise<string | null> {
  if (!templateRef) return null;

  const ref = String(templateRef).trim();
  if (!ref) return null;

  let template = await prisma.epaperBlockTemplate.findUnique({
    where: { id: ref },
    select: { id: true, category: true },
  });

  if (!template) {
    template = await prisma.epaperBlockTemplate.findUnique({
      where: { code: ref },
      select: { id: true, category: true },
    });
  }

  if (!template) {
    const aliasCode = TEMPLATE_CODE_ALIASES[ref.toLowerCase()];
    if (aliasCode) {
      template = await prisma.epaperBlockTemplate.findUnique({
        where: { code: aliasCode },
        select: { id: true, category: true },
      });
    }
  }

  if (!template) throw new Error(`Invalid template id: ${templateRef}`);
  if (template.category !== expectedCategory) {
    throw new Error(`Template ${templateRef} must belong to ${expectedCategory}`);
  }

  return template.id;
}

async function persistDesignConfig(
  tenantId: string,
  settings: any,
  designConfig: DesignConfig,
  issueEntries: IssueEntry[]
) {
  const gen = asObject(settings?.generationConfig);
  const nextGen = {
    ...gen,
    designConfig,
    issueEntries,
  };

  const updateData: any = {
    generationConfig: nextGen,
  };

  if (designConfig.mainHeaderTemplateId !== undefined) {
    updateData.mainHeaderTemplateId = designConfig.mainHeaderTemplateId || null;
  }
  if (designConfig.innerHeaderTemplateId !== undefined) {
    updateData.innerHeaderTemplateId = designConfig.innerHeaderTemplateId || null;
  }
  if (designConfig.footerTemplateId !== undefined) {
    updateData.footerTemplateId = designConfig.footerTemplateId || null;
  }
  if (designConfig.defaultPageCount !== null && designConfig.defaultPageCount !== undefined) {
    updateData.defaultPageCount = designConfig.defaultPageCount;
  }

  return prisma.epaperSettings.update({
    where: { tenantId },
    data: updateData,
  });
}

function extractConfigInput(body: any, current: DesignConfig, isPatch: boolean, userId: string | null): DesignConfig {
  const base = isPatch ? current : defaultDesignConfig(userId);

  const mainHeaderCandidate = body.mainHeaderTemplateId !== undefined
    ? normalizeText(body.mainHeaderTemplateId)
    : (body.headerTemplateId !== undefined ? normalizeText(body.headerTemplateId) : base.mainHeaderTemplateId);
  const innerHeaderCandidate = body.innerHeaderTemplateId !== undefined
    ? normalizeText(body.innerHeaderTemplateId)
    : (body.subHeaderTemplateId !== undefined ? normalizeText(body.subHeaderTemplateId) : base.innerHeaderTemplateId);

  const mainHeaderIsSerial = isHeaderSerialCode(mainHeaderCandidate);
  const innerHeaderIsSerial = isSubHeaderSerialCode(innerHeaderCandidate);

  const next: DesignConfig = {
    ...base,
    headerData: body.headerData !== undefined ? normalizeText(body.headerData) : base.headerData,
    subHeaderData: body.subHeaderData !== undefined ? normalizeText(body.subHeaderData) : base.subHeaderData,
    headerLogoUrl: body.headerLogoUrl !== undefined ? normalizeText(body.headerLogoUrl) : base.headerLogoUrl,
    subHeaderImageUrl: body.subHeaderImageUrl !== undefined ? normalizeText(body.subHeaderImageUrl) : base.subHeaderImageUrl,
    headerLeftImageUrl: body.headerLeftImageUrl !== undefined
      ? normalizeText(body.headerLeftImageUrl)
      : (body.headerLeftImage !== undefined ? normalizeText(body.headerLeftImage) : base.headerLeftImageUrl),
    headerRightImageUrl: body.headerRightImageUrl !== undefined
      ? normalizeText(body.headerRightImageUrl)
      : (body.headerRightImage !== undefined ? normalizeText(body.headerRightImage) : base.headerRightImageUrl),
    footerText: body.footerText !== undefined ? normalizeText(body.footerText) : (body.lastPageFooterText !== undefined ? normalizeText(body.lastPageFooterText) : base.footerText),
    headerTemplateStyleId: body.headerTemplateStyleId !== undefined
      ? normalizeText(body.headerTemplateStyleId)
      : (body.headerStyleId !== undefined
        ? normalizeText(body.headerStyleId)
        : (mainHeaderIsSerial ? mainHeaderCandidate : base.headerTemplateStyleId)),
    subHeaderTemplateStyleId: body.subHeaderTemplateStyleId !== undefined
      ? normalizeText(body.subHeaderTemplateStyleId)
      : (body.subHeaderStyleId !== undefined
        ? normalizeText(body.subHeaderStyleId)
        : (innerHeaderIsSerial ? innerHeaderCandidate : base.subHeaderTemplateStyleId)),
    mainHeaderTemplateId: mainHeaderIsSerial ? base.mainHeaderTemplateId : mainHeaderCandidate,
    innerHeaderTemplateId: innerHeaderIsSerial ? base.innerHeaderTemplateId : innerHeaderCandidate,
    footerTemplateId: body.footerTemplateId !== undefined ? normalizeText(body.footerTemplateId) : base.footerTemplateId,
    paperSellCost: body.paperSellCost !== undefined
      ? normalizeOptionalFloat(body.paperSellCost)
      : (body.pageCost !== undefined
        ? normalizeOptionalFloat(body.pageCost)
        : (body.paperPageCost !== undefined ? normalizeOptionalFloat(body.paperPageCost) : base.paperSellCost)),
    defaultPageCount: body.defaultPageCount !== undefined
      ? normalizeOptionalInt(body.defaultPageCount)
      : (body.pages !== undefined ? normalizeOptionalInt(body.pages) : base.defaultPageCount),
    volumeStartYear: body.volumeStartYear !== undefined
      ? (normalizeOptionalInt(body.volumeStartYear) || base.volumeStartYear)
      : (body.volumeYearStart !== undefined ? (normalizeOptionalInt(body.volumeYearStart) || base.volumeStartYear) : base.volumeStartYear),
    startVolumeNumber: body.startVolumeNumber !== undefined
      ? (normalizeOptionalInt(body.startVolumeNumber) || base.startVolumeNumber)
      : (body.volumeStartNumber !== undefined ? (normalizeOptionalInt(body.volumeStartNumber) || base.startVolumeNumber) : base.startVolumeNumber),
    issueCounterMode: body.issueCounterMode !== undefined
      ? normalizeIssueMode(body.issueCounterMode)
      : base.issueCounterMode,
    issueStartNumber: body.issueStartNumber !== undefined
      ? (normalizeOptionalInt(body.issueStartNumber) || base.issueStartNumber)
      : (body.issueSeedNumber !== undefined ? (normalizeOptionalInt(body.issueSeedNumber) || base.issueStartNumber) : base.issueStartNumber),
    updatedAt: nowIso(),
    updatedBy: userId,
  };

  if (!next.defaultPageCount || next.defaultPageCount < 1) next.defaultPageCount = 1;
  if (!next.startVolumeNumber || next.startVolumeNumber < 1) next.startVolumeNumber = 1;
  if (!next.issueStartNumber || next.issueStartNumber < 1) next.issueStartNumber = 1;

  return next;
}

function sendTenantRequired(res: Response) {
  return res.status(400).json({ error: 'Tenant context required' });
}

function hasExplicitTenantSelector(req: Request): boolean {
  const q: any = req.query || {};
  const b: any = req.body || {};

  return Boolean(
    normalizeText(req.headers['x-tenant-id']) ||
    normalizeText(req.headers['x-tenant-slug']) ||
    normalizeText(req.headers['x-tenant-domain']) ||
    normalizeText(q.tenantId) ||
    normalizeText(q.domain) ||
    normalizeText(b.tenantId)
  );
}

function enforceExplicitTenantSelector(req: Request, res: Response, isSuperAdmin: boolean): boolean {
  if (isSuperAdmin) return true;
  if (hasExplicitTenantSelector(req)) return true;

  res.status(400).json({
    error: 'Explicit tenant selector required',
    message: 'Pass X-Tenant-Id header (or X-Tenant-Slug/X-Tenant-Domain/tenantId query)',
  });
  return false;
}

function toBoundedCount(value: any): number {
  const n = normalizeOptionalInt(value);
  if (!n || n < 1) return MAX_SERIAL_COUNT;
  return Math.min(MAX_SERIAL_COUNT, n);
}

function buildSerialCode(type: SerialType, sequenceNo: number): string {
  const padded = String(sequenceNo).padStart(3, '0');
  if (type === 'HEADER') return `KABURLU_HEADER_${padded}`;
  return `KABURLU_SUBHEADER_${padded}`;
}

async function ensureSerialTableExists() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EpaperDesignSerial" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "serialCode" TEXT NOT NULL,
      "sequenceNo" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "EpaperDesignSerial_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
      CONSTRAINT "EpaperDesignSerial_type_check" CHECK ("type" IN ('HEADER', 'SUBHEADER')),
      CONSTRAINT "EpaperDesignSerial_tenant_type_seq_uniq" UNIQUE ("tenantId", "type", "sequenceNo"),
      CONSTRAINT "EpaperDesignSerial_tenant_code_uniq" UNIQUE ("tenantId", "serialCode")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EpaperDesignSerial_tenant_idx"
    ON "EpaperDesignSerial" ("tenantId");
  `);
}

async function upsertSerialRows(tenantId: string, count: number) {
  for (const type of ['HEADER', 'SUBHEADER'] as SerialType[]) {
    for (let i = 1; i <= count; i += 1) {
      const serialCode = buildSerialCode(type, i);
      await prisma.$executeRaw`
        INSERT INTO "EpaperDesignSerial" ("id", "tenantId", "type", "serialCode", "sequenceNo", "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${tenantId}, ${type}, ${serialCode}, ${i}, NOW(), NOW())
        ON CONFLICT ("tenantId", "type", "sequenceNo")
        DO UPDATE SET
          "serialCode" = EXCLUDED."serialCode",
          "updatedAt" = NOW()
      `;
    }
  }
}

async function listSerialRows(tenantId: string): Promise<{ headerIds: string[]; subHeaderIds: string[]; countByType: { header: number; subHeader: number } }> {
  const rows = await prisma.$queryRaw<EpaperDesignSerialRow[]>`
    SELECT "type", "sequenceNo", "serialCode"
    FROM "EpaperDesignSerial"
    WHERE "tenantId" = ${tenantId}
    ORDER BY "type" ASC, "sequenceNo" ASC
  `;

  const headerIds = rows.filter((r) => r.type === 'HEADER').map((r) => String(r.serialCode));
  const subHeaderIds = rows.filter((r) => r.type === 'SUBHEADER').map((r) => String(r.serialCode));

  return {
    headerIds,
    subHeaderIds,
    countByType: {
      header: headerIds.length,
      subHeader: subHeaderIds.length,
    },
  };
}

async function ensureAndReadSerialRows(tenantId: string, count: number) {
  await ensureSerialTableExists();
  await upsertSerialRows(tenantId, count);
  return listSerialRows(tenantId);
}

async function getOrBootstrapSerialRows(tenantId: string) {
  await ensureSerialTableExists();
  const existing = await listSerialRows(tenantId);
  if (existing.countByType.header >= MAX_SERIAL_COUNT && existing.countByType.subHeader >= MAX_SERIAL_COUNT) {
    return existing;
  }
  return ensureAndReadSerialRows(tenantId, MAX_SERIAL_COUNT);
}

export const getEpaperDesignConfig = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can access ePaper design config' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const settings = await getOrCreateSettings(ctx.tenantId);
    const designConfig = readDesignConfig(settings, ctx.userId || null);
    const issueEntries = readIssueEntries(settings);

    return res.json({
      tenantId: ctx.tenantId,
      source: 'epaperSettings.generationConfig.designConfig',
      designConfig,
      issueEntries,
      totalIssues: issueEntries.length,
    });
  } catch (e: any) {
    console.error('getEpaperDesignConfig error:', e);
    return res.status(500).json({ error: 'Failed to get ePaper design config', details: e?.message || String(e) });
  }
};

export const upsertEpaperDesignConfig = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update ePaper design config' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const settings = await getOrCreateSettings(ctx.tenantId);
    const hasExistingDesignConfig = hasPersistedDesignConfig(settings);
    const current = readDesignConfig(settings, ctx.userId || null);
    const input = await mergeDesignConfigInputWithUploads(req, ctx.tenantId);
    const next = extractConfigInput(input, current, false, ctx.userId || null);

    next.mainHeaderTemplateId = await resolveTemplateIdIfGiven(next.mainHeaderTemplateId, 'HEADER');
    next.innerHeaderTemplateId = await resolveTemplateIdIfGiven(next.innerHeaderTemplateId, 'HEADER');
    next.footerTemplateId = await resolveTemplateIdIfGiven(next.footerTemplateId, 'FOOTER');

    const issueEntries = readIssueEntries(settings);
    await persistDesignConfig(ctx.tenantId, settings, next, issueEntries);

    return res.status(hasExistingDesignConfig ? 200 : 201).json({
      success: true,
      action: hasExistingDesignConfig ? 'updated' : 'created',
      tenantId: ctx.tenantId,
      designConfig: next,
      issueEntries,
      totalIssues: issueEntries.length,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (String(msg).includes('image')) {
      return res.status(400).json({ error: msg });
    }
    if (String(msg).includes('Invalid template id') || String(msg).includes('must belong')) {
      return res.status(400).json({ error: msg });
    }
    console.error('upsertEpaperDesignConfig error:', e);
    return res.status(500).json({ error: 'Failed to save ePaper design config', details: msg });
  }
};

export const patchEpaperDesignConfig = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update ePaper design config' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const settings = await getOrCreateSettings(ctx.tenantId);
    const current = readDesignConfig(settings, ctx.userId || null);
    const input = await mergeDesignConfigInputWithUploads(req, ctx.tenantId);
    const next = extractConfigInput(input, current, true, ctx.userId || null);

    next.mainHeaderTemplateId = await resolveTemplateIdIfGiven(next.mainHeaderTemplateId, 'HEADER');
    next.innerHeaderTemplateId = await resolveTemplateIdIfGiven(next.innerHeaderTemplateId, 'HEADER');
    next.footerTemplateId = await resolveTemplateIdIfGiven(next.footerTemplateId, 'FOOTER');

    const issueEntries = readIssueEntries(settings);
    await persistDesignConfig(ctx.tenantId, settings, next, issueEntries);

    return res.json({
      success: true,
      tenantId: ctx.tenantId,
      designConfig: next,
      issueEntries,
      totalIssues: issueEntries.length,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (String(msg).includes('image')) {
      return res.status(400).json({ error: msg });
    }
    if (String(msg).includes('Invalid template id') || String(msg).includes('must belong')) {
      return res.status(400).json({ error: msg });
    }
    console.error('patchEpaperDesignConfig error:', e);
    return res.status(500).json({ error: 'Failed to patch ePaper design config', details: msg });
  }
};

export const deleteEpaperDesignConfig = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can delete ePaper design config' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const settings = await getOrCreateSettings(ctx.tenantId);
    const gen = asObject(settings.generationConfig);
    const nextGen = { ...gen };

    delete (nextGen as any).designConfig;
    delete (nextGen as any).issueEntries;

    await prisma.epaperSettings.update({
      where: { tenantId: ctx.tenantId },
      data: {
        generationConfig: nextGen,
      },
    });

    return res.json({
      success: true,
      tenantId: ctx.tenantId,
      message: 'Design config and issue entries removed',
    });
  } catch (e: any) {
    console.error('deleteEpaperDesignConfig error:', e);
    return res.status(500).json({ error: 'Failed to delete ePaper design config', details: e?.message || String(e) });
  }
};

export const listEpaperIssueDesignEntries = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can view issue entries' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const yearFilter = normalizeOptionalInt((req.query as any)?.year);
    const settings = await getOrCreateSettings(ctx.tenantId);
    const allEntries = readIssueEntries(settings);

    const items = yearFilter
      ? allEntries.filter((entry) => entry.issueDate.startsWith(`${yearFilter}-`))
      : allEntries;

    return res.json({
      tenantId: ctx.tenantId,
      year: yearFilter || null,
      total: items.length,
      items,
    });
  } catch (e: any) {
    console.error('listEpaperIssueDesignEntries error:', e);
    return res.status(500).json({ error: 'Failed to list issue entries', details: e?.message || String(e) });
  }
};

export const createEpaperIssueDesignEntry = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can create issue entries' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const inputDate = parseDateOnlyOrNull((req.body as any)?.issueDate);
    if (!inputDate) return res.status(400).json({ error: 'issueDate is required in YYYY-MM-DD format' });

    const settings = await getOrCreateSettings(ctx.tenantId);
    const cfg = readDesignConfig(settings, ctx.userId || null);
    const issueEntries = readIssueEntries(settings);
    const issueDate = toDateOnly(inputDate);

    if (issueEntries.some((entry) => entry.issueDate === issueDate)) {
      return res.status(409).json({ error: `Issue entry already exists for ${issueDate}` });
    }

    const merged = shapeIssueEntryFromInput(req.body || {}, cfg);

    const yearEntries = issueEntries.filter((entry) => entry.issueDate.startsWith(`${inputDate.getUTCFullYear()}-`));
    const autoVolume = buildVolumeNumber(cfg, inputDate);
    const autoIssue = buildIssueNumber(cfg, inputDate, yearEntries);

    const volumeNumber = normalizeOptionalInt((req.body as any)?.volumeNumber) || autoVolume;
    const issueNumber = normalizeOptionalInt((req.body as any)?.issueNumber) || autoIssue;

    const resolvedMainHeaderTemplateId = await resolveTemplateIdIfGiven(merged.mainHeaderTemplateId || cfg.mainHeaderTemplateId, 'HEADER');
    const resolvedInnerHeaderTemplateId = await resolveTemplateIdIfGiven(merged.innerHeaderTemplateId || cfg.innerHeaderTemplateId, 'HEADER');
    const resolvedFooterTemplateId = await resolveTemplateIdIfGiven(merged.footerTemplateId || cfg.footerTemplateId, 'FOOTER');

    const newEntry: IssueEntry = {
      issueDate,
      volumeNumber,
      issueNumber,
      pageCount: merged.pageCount || cfg.defaultPageCount || 1,
      paperSellCost: merged.paperSellCost ?? cfg.paperSellCost,
      headerData: merged.headerData ?? cfg.headerData,
      subHeaderData: merged.subHeaderData ?? cfg.subHeaderData,
      footerText: merged.footerText ?? cfg.footerText,
      headerLogoUrl: merged.headerLogoUrl ?? cfg.headerLogoUrl,
      subHeaderImageUrl: merged.subHeaderImageUrl ?? cfg.subHeaderImageUrl,
      headerLeftImageUrl: merged.headerLeftImageUrl ?? cfg.headerLeftImageUrl,
      headerRightImageUrl: merged.headerRightImageUrl ?? cfg.headerRightImageUrl,
      headerTemplateStyleId: merged.headerTemplateStyleId ?? cfg.headerTemplateStyleId,
      subHeaderTemplateStyleId: merged.subHeaderTemplateStyleId ?? cfg.subHeaderTemplateStyleId,
      mainHeaderTemplateId: resolvedMainHeaderTemplateId,
      innerHeaderTemplateId: resolvedInnerHeaderTemplateId,
      footerTemplateId: resolvedFooterTemplateId,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const nextEntries = [...issueEntries, newEntry].sort((a, b) => b.issueDate.localeCompare(a.issueDate));
    await persistDesignConfig(ctx.tenantId, settings, cfg, nextEntries);

    return res.status(201).json({
      success: true,
      tenantId: ctx.tenantId,
      entry: newEntry,
      totalIssues: nextEntries.length,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (String(msg).includes('Invalid template id') || String(msg).includes('must belong')) {
      return res.status(400).json({ error: msg });
    }
    console.error('createEpaperIssueDesignEntry error:', e);
    return res.status(500).json({ error: 'Failed to create issue entry', details: msg });
  }
};

export const updateEpaperIssueDesignEntry = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can update issue entries' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const pathDate = parseDateOnlyOrNull((req.params as any)?.issueDate);
    if (!pathDate) return res.status(400).json({ error: 'issueDate path param must be YYYY-MM-DD' });

    const settings = await getOrCreateSettings(ctx.tenantId);
    const cfg = readDesignConfig(settings, ctx.userId || null);
    const entries = readIssueEntries(settings);

    const currentKey = toDateOnly(pathDate);
    const idx = entries.findIndex((entry) => entry.issueDate === currentKey);
    if (idx < 0) return res.status(404).json({ error: `Issue entry not found for ${currentKey}` });

    const targetDate = parseDateOnlyOrNull((req.body as any)?.issueDate) || pathDate;
    const targetKey = toDateOnly(targetDate);

    if (targetKey !== currentKey && entries.some((entry) => entry.issueDate === targetKey)) {
      return res.status(409).json({ error: `Issue entry already exists for ${targetKey}` });
    }

    const patch = shapeIssueEntryFromInput(req.body || {}, cfg);

    const mainHeaderRef = (req.body as any)?.mainHeaderTemplateId !== undefined
      ? patch.mainHeaderTemplateId || null
      : entries[idx].mainHeaderTemplateId;
    const innerHeaderRef = (req.body as any)?.innerHeaderTemplateId !== undefined
      ? patch.innerHeaderTemplateId || null
      : entries[idx].innerHeaderTemplateId;
    const footerRef = (req.body as any)?.footerTemplateId !== undefined
      ? patch.footerTemplateId || null
      : entries[idx].footerTemplateId;

    const resolvedMainHeaderTemplateId = await resolveTemplateIdIfGiven(mainHeaderRef, 'HEADER');
    const resolvedInnerHeaderTemplateId = await resolveTemplateIdIfGiven(innerHeaderRef, 'HEADER');
    const resolvedFooterTemplateId = await resolveTemplateIdIfGiven(footerRef, 'FOOTER');

    const updated: IssueEntry = {
      ...entries[idx],
      issueDate: targetKey,
      volumeNumber: normalizeOptionalInt((req.body as any)?.volumeNumber) || entries[idx].volumeNumber,
      issueNumber: normalizeOptionalInt((req.body as any)?.issueNumber) || entries[idx].issueNumber,
      pageCount: patch.pageCount || entries[idx].pageCount,
      paperSellCost: patch.paperSellCost !== null && patch.paperSellCost !== undefined
        ? patch.paperSellCost
        : entries[idx].paperSellCost,
      headerData: patch.headerData !== null && patch.headerData !== undefined ? patch.headerData : entries[idx].headerData,
      subHeaderData: patch.subHeaderData !== null && patch.subHeaderData !== undefined ? patch.subHeaderData : entries[idx].subHeaderData,
      footerText: patch.footerText !== null && patch.footerText !== undefined ? patch.footerText : entries[idx].footerText,
      headerLogoUrl: patch.headerLogoUrl !== null && patch.headerLogoUrl !== undefined ? patch.headerLogoUrl : entries[idx].headerLogoUrl,
      subHeaderImageUrl: patch.subHeaderImageUrl !== null && patch.subHeaderImageUrl !== undefined ? patch.subHeaderImageUrl : entries[idx].subHeaderImageUrl,
      headerLeftImageUrl: patch.headerLeftImageUrl !== null && patch.headerLeftImageUrl !== undefined ? patch.headerLeftImageUrl : entries[idx].headerLeftImageUrl,
      headerRightImageUrl: patch.headerRightImageUrl !== null && patch.headerRightImageUrl !== undefined ? patch.headerRightImageUrl : entries[idx].headerRightImageUrl,
      headerTemplateStyleId: patch.headerTemplateStyleId !== null && patch.headerTemplateStyleId !== undefined ? patch.headerTemplateStyleId : entries[idx].headerTemplateStyleId,
      subHeaderTemplateStyleId: patch.subHeaderTemplateStyleId !== null && patch.subHeaderTemplateStyleId !== undefined ? patch.subHeaderTemplateStyleId : entries[idx].subHeaderTemplateStyleId,
      mainHeaderTemplateId: resolvedMainHeaderTemplateId,
      innerHeaderTemplateId: resolvedInnerHeaderTemplateId,
      footerTemplateId: resolvedFooterTemplateId,
      updatedAt: nowIso(),
    };

    const next = entries.filter((_v, i) => i !== idx);
    next.push(updated);
    next.sort((a, b) => b.issueDate.localeCompare(a.issueDate));

    await persistDesignConfig(ctx.tenantId, settings, cfg, next);

    return res.json({
      success: true,
      tenantId: ctx.tenantId,
      entry: updated,
      totalIssues: next.length,
    });
  } catch (e: any) {
    const msg = e?.message || String(e);
    if (String(msg).includes('Invalid template id') || String(msg).includes('must belong')) {
      return res.status(400).json({ error: msg });
    }
    console.error('updateEpaperIssueDesignEntry error:', e);
    return res.status(500).json({ error: 'Failed to update issue entry', details: msg });
  }
};

export const deleteEpaperIssueDesignEntry = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can delete issue entries' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const pathDate = parseDateOnlyOrNull((req.params as any)?.issueDate);
    if (!pathDate) return res.status(400).json({ error: 'issueDate path param must be YYYY-MM-DD' });

    const settings = await getOrCreateSettings(ctx.tenantId);
    const cfg = readDesignConfig(settings, ctx.userId || null);
    const entries = readIssueEntries(settings);
    const key = toDateOnly(pathDate);

    if (!entries.some((entry) => entry.issueDate === key)) {
      return res.status(404).json({ error: `Issue entry not found for ${key}` });
    }

    const next = entries.filter((entry) => entry.issueDate !== key);
    await persistDesignConfig(ctx.tenantId, settings, cfg, next);

    return res.json({
      success: true,
      tenantId: ctx.tenantId,
      deletedIssueDate: key,
      totalIssues: next.length,
    });
  } catch (e: any) {
    console.error('deleteEpaperIssueDesignEntry error:', e);
    return res.status(500).json({ error: 'Failed to delete issue entry', details: e?.message || String(e) });
  }
};

export const bootstrapEpaperDesignSerialIds = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can bootstrap serial IDs' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    const requested = (req.body as any)?.count ?? (req.query as any)?.count;
    const count = toBoundedCount(requested);

    const data = await ensureAndReadSerialRows(ctx.tenantId, count);

    return res.status(201).json({
      success: true,
      tenantId: ctx.tenantId,
      maxAllowed: MAX_SERIAL_COUNT,
      requestedCount: count,
      ...data,
    });
  } catch (e: any) {
    console.error('bootstrapEpaperDesignSerialIds error:', e);
    return res.status(500).json({ error: 'Failed to bootstrap serial IDs', details: e?.message || String(e) });
  }
};

export const getEpaperDesignSerialIds = async (req: Request, res: Response) => {
  try {
    const ctx = await resolveAdminTenantContext(req);
    if (!ctx.isAdmin) return res.status(403).json({ error: 'Only admins can view serial IDs' });
    if (!enforceExplicitTenantSelector(req, res, ctx.isSuperAdmin)) return;
    if (!ctx.tenantId) return sendTenantRequired(res);

    await ensureSerialTableExists();
    const data = await listSerialRows(ctx.tenantId);

    return res.json({
      tenantId: ctx.tenantId,
      maxAllowed: MAX_SERIAL_COUNT,
      ...data,
    });
  } catch (e: any) {
    console.error('getEpaperDesignSerialIds error:', e);
    return res.status(500).json({ error: 'Failed to fetch serial IDs', details: e?.message || String(e) });
  }
};
