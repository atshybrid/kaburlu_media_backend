import { PrismaClient } from '@prisma/client';

// Fallback DB override similar to other scripts
try {
  if (String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true' && process.env.DATABASE_URL_FALLBACK) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_FALLBACK;
  }
} catch {}

const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

function hasArg(name: string) {
  return process.argv.includes(name);
}

type IdMap = Map<string, string>; // fromId -> toId

async function ensureGlobalDesignationFor(tenantDesignation: any): Promise<string> {
  const code = String(tenantDesignation.code);
  const level = String(tenantDesignation.level);

  const existingGlobal = await p.reporterDesignation
    .findFirst({ where: { tenantId: null, code, level }, select: { id: true } })
    .catch(() => null);
  if (existingGlobal?.id) return String(existingGlobal.id);

  const created = await p.reporterDesignation.create({
    data: {
      tenantId: null,
      code,
      level,
      name: String(tenantDesignation.name || code),
    },
    select: { id: true },
  });
  return String(created.id);
}

function rewriteSettingsDesignationIds(settingsData: any, idMap: IdMap) {
  if (!settingsData || typeof settingsData !== 'object') return settingsData;

  // reporterPricing.byDesignation[].designationId
  if (settingsData.reporterPricing && typeof settingsData.reporterPricing === 'object') {
    const byDesignation = settingsData.reporterPricing.byDesignation;
    if (Array.isArray(byDesignation)) {
      settingsData.reporterPricing.byDesignation = byDesignation.map((row: any) => {
        const from = String(row?.designationId || '');
        const to = idMap.get(from);
        if (to) return { ...row, designationId: to };
        return row;
      });
    }
  }

  // reporterLimits.rules[].designationId
  if (settingsData.reporterLimits && typeof settingsData.reporterLimits === 'object') {
    const rules = settingsData.reporterLimits.rules;
    if (Array.isArray(rules)) {
      settingsData.reporterLimits.rules = rules.map((rule: any) => {
        const from = String(rule?.designationId || '');
        const to = idMap.get(from);
        if (to) return { ...rule, designationId: to };
        return rule;
      });
    }
  }

  return settingsData;
}

async function main() {
  const apply = hasArg('--apply');

  const tenantDesignations = await p.reporterDesignation
    .findMany({
      where: { tenantId: { not: null } },
      select: { id: true, tenantId: true, level: true, code: true, name: true },
      orderBy: [{ tenantId: 'asc' }, { level: 'asc' }, { code: 'asc' }],
    })
    .catch(() => []);

  console.log(`Found ${tenantDesignations.length} tenant-specific ReporterDesignation rows.`);
  if (tenantDesignations.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  const idMap: IdMap = new Map();

  // Build mapping tenantDesignationId -> globalDesignationId
  for (const td of tenantDesignations as any[]) {
    const globalId = await ensureGlobalDesignationFor(td);
    idMap.set(String(td.id), String(globalId));
  }

  console.log(`Prepared ${idMap.size} designationId remaps (tenant -> global).`);

  if (!apply) {
    console.log('Dry-run mode. Re-run with --apply to update DB.');
    return;
  }

  // Apply changes in a transaction for consistency.
  await prisma.$transaction(async (tx) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t: any = tx;

    // 1) Update tenant settings (pricing + limits) that reference tenant-specific designation IDs.
    const settingsRows = await t.tenantSettings.findMany({ select: { tenantId: true, data: true } });
    for (const row of settingsRows as any[]) {
      const data = rewriteSettingsDesignationIds(row.data, idMap);
      await t.tenantSettings.update({ where: { tenantId: row.tenantId }, data: { data } });
    }

    // 2) Update reporters to point to global designation IDs.
    for (const [fromId, toId] of idMap.entries()) {
      await t.reporter.updateMany({ where: { designationId: fromId }, data: { designationId: toId } });
    }

    // 3) Update onboarding orders to point to global designation IDs.
    for (const [fromId, toId] of idMap.entries()) {
      await t.reporterOnboardingOrder.updateMany({ where: { designationId: fromId }, data: { designationId: toId } });
    }

    // 4) Delete tenant-specific designation rows (now unreferenced).
    await t.reporterDesignation.deleteMany({ where: { tenantId: { not: null } } });
  });

  console.log('Migration complete: tenant-specific designations removed; references updated to global.');
}

main()
  .catch((e) => {
    console.error('migrate_designations_to_global failed', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
