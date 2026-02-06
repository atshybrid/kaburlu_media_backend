import { PrismaClient } from '@prisma/client';

// Fallback DB override similar to main seed if environment flag set
try {
  if (String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true' && process.env.DATABASE_URL_FALLBACK) {
    process.env.DATABASE_URL = process.env.DATABASE_URL_FALLBACK;
  }
} catch {}

const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

async function main() {
  console.log('--- RC_INCHARGE → DIVISION migration ---');

  const designations: Array<{ id: string; tenantId: string | null; level: string; levelOrder: number; code: string }> = await p.reporterDesignation.findMany({
    where: { code: 'RC_INCHARGE' },
    select: { id: true, tenantId: true, level: true, levelOrder: true, code: true },
  });

  if (!designations.length) {
    console.log('No RC_INCHARGE designation found. Nothing to migrate.');
    return;
  }

  const toUpdate = designations.filter((d) => String(d.level) !== 'DIVISION');
  for (const d of toUpdate) {
    await p.reporterDesignation.update({
      where: { id: d.id },
      data: { level: 'DIVISION' },
    });
  }
  console.log(`Updated designations: ${toUpdate.length}/${designations.length}`);

  const designationIds = designations.map((d) => d.id);

  const reporters: Array<{ id: string; tenantId: string; level: string | null; divisionId: string | null; districtId: string | null; mandalId: string | null; assemblyConstituencyId: string | null }> =
    await p.reporter.findMany({
      where: { designationId: { in: designationIds } },
      select: {
        id: true,
        tenantId: true,
        level: true,
        divisionId: true,
        districtId: true,
        mandalId: true,
        assemblyConstituencyId: true,
      },
    });

  if (!reporters.length) {
    console.log('No reporters found for RC_INCHARGE designation. Done.');
    return;
  }

  let migrated = 0;
  let skipped = 0;

  for (const r of reporters) {
    const currentLevel = String(r.level || '');
    // Only migrate reporters that are still not DIVISION.
    if (currentLevel === 'DIVISION') continue;

    let resolvedDivisionId: string | null = r.divisionId ? String(r.divisionId) : null;

    if (!resolvedDivisionId && r.districtId) resolvedDivisionId = String(r.districtId);
    if (!resolvedDivisionId && r.mandalId) resolvedDivisionId = String(r.mandalId);

    if (!resolvedDivisionId && r.assemblyConstituencyId) {
      const assembly = await p.assemblyConstituency
        .findUnique({ where: { id: String(r.assemblyConstituencyId) }, select: { districtId: true } })
        .catch(() => null);
      if (assembly?.districtId) resolvedDivisionId = String(assembly.districtId);
    }

    if (!resolvedDivisionId) {
      skipped++;
      console.warn(`Skip reporter ${r.id} (tenant ${r.tenantId}): cannot resolve divisionId from existing fields`);
      continue;
    }

    await p.reporter.update({
      where: { id: r.id },
      data: {
        level: 'DIVISION',
        divisionId: resolvedDivisionId,
        stateId: null,
        districtId: null,
        constituencyId: null,
        mandalId: null,
        assemblyConstituencyId: null,
      },
    });

    migrated++;
  }

  console.log(`Reporter rows updated: ${migrated}`);
  if (skipped) console.log(`Reporter rows skipped (needs manual review): ${skipped}`);

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error('Migration error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
