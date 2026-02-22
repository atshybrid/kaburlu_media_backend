/**
 * dedup_ap_mandals.ts
 *
 * Problem: Some mandals like "Gangavaram", "Yelamanchili" etc. exist as
 * duplicate rows (same name, same districtId) under Andhra Pradesh.
 *
 * Fix: For each district in AP, find mandals with duplicate names and
 * keep only ONE row (the one with most translations / oldest id).
 * All other duplicate rows are deleted.
 *
 * Run:
 *   npx ts-node scripts/dedup_ap_mandals.ts
 */

import prisma from '../src/lib/prisma';

const STATE_NAME = 'Andhra Pradesh';

async function main() {
  console.log('='.repeat(70));
  console.log('AP Mandal Duplicate Cleanup Script');
  console.log('='.repeat(70));

  const apState = await prisma.state.findFirst({ where: { name: STATE_NAME } });
  if (!apState) {
    console.error(`❌ State "${STATE_NAME}" not found.`);
    process.exit(1);
  }

  const districts = await prisma.district.findMany({
    where: { stateId: apState.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  console.log(`✅ Found ${districts.length} AP districts\n`);

  let totalDeleted = 0;
  let totalKept = 0;

  for (const district of districts) {
    // Get all mandals for this district
    const mandals = await prisma.mandal.findMany({
      where: { districtId: district.id },
      select: {
        id: true,
        name: true,
        translations: { select: { id: true } },
      },
      orderBy: { name: 'asc' },
    });

    // Group by name
    const grouped: Record<string, typeof mandals> = {};
    for (const m of mandals) {
      if (!grouped[m.name]) grouped[m.name] = [];
      grouped[m.name].push(m);
    }

    let districtDeleted = 0;

    for (const [name, rows] of Object.entries(grouped)) {
      if (rows.length <= 1) {
        totalKept++;
        continue;
      }

      // Keep the row with most translations; on tie keep the first (oldest) id
      rows.sort((a, b) => b.translations.length - a.translations.length || a.id.localeCompare(b.id));
      const [keep, ...duplicates] = rows;

      for (const dup of duplicates) {
        // Delete translations first (cascade may handle it, but be explicit)
        await prisma.mandalTranslation.deleteMany({ where: { mandalId: dup.id } });
        await prisma.mandal.delete({ where: { id: dup.id } });
        districtDeleted++;
        totalDeleted++;
        console.log(`   🗑  Deleted duplicate "${name}" (id: ${dup.id}) in ${district.name} — kept ${keep.id}`);
      }
      totalKept++;
    }

    if (districtDeleted > 0) {
      console.log(`📍 ${district.name}: deleted ${districtDeleted} duplicates\n`);
    }
  }

  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`🗑  Duplicate mandals deleted : ${totalDeleted}`);
  console.log(`✓  Unique mandals kept        : ${totalKept}`);
  console.log('='.repeat(70));
}

main()
  .catch((e) => {
    console.error('Script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
