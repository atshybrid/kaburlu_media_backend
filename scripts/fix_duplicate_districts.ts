/**
 * Fix duplicate districts in Telangana
 * Remove duplicates and keep the one with more mandals
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🔧 Fixing Duplicate Districts\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana not found');
  }

  // Define duplicates to fix
  const duplicates = [
    { names: ['Karimnagar'], keep: 'Karimnagar' },
    { names: ['Mahabubnagar', 'Mahbubnagar'], keep: 'Mahabubnagar' },
    { names: ['Ranga Reddy', 'Rangareddy'], keep: 'Ranga Reddy' },
    { names: ['Siddipet'], keep: 'Siddipet' }
  ];

  for (const dup of duplicates) {
    console.log(`\n📍 Fixing: ${dup.names.join(' / ')}`);
    console.log('─'.repeat(70));

    // Find all instances
    const districts = await prisma.district.findMany({
      where: {
        name: { in: dup.names },
        stateId: telangana.id,
        isDeleted: false
      },
      include: {
        _count: { select: { mandals: true } }
      }
    });

    if (districts.length <= 1) {
      console.log('   ✓ No duplicates found - skipping');
      continue;
    }

    console.log(`   Found ${districts.length} duplicates:`);
    districts.forEach(d => {
      console.log(`      - ${d.name} (ID: ${d.id}, ${d._count.mandals} mandals)`);
    });

    // Keep the one with most mandals
    const sorted = districts.sort((a, b) => b._count.mandals - a._count.mandals);
    const toKeep = sorted[0];
    const toDelete = sorted.slice(1);

    console.log(`\n   ✅ Keeping: ${toKeep.name} (${toKeep._count.mandals} mandals)`);
    console.log(`   ❌ Deleting: ${toDelete.length} duplicate(s)`);

    // Delete mandal translations for duplicates
    for (const district of toDelete) {
      const delMandalTrans = await prisma.mandalTranslation.deleteMany({
        where: { mandal: { districtId: district.id } }
      });
      console.log(`      - Deleted ${delMandalTrans.count} mandal translations`);

      const delMandals = await prisma.$executeRaw`
        DELETE FROM "Mandal" WHERE "districtId" = ${district.id}
      `;
      console.log(`      - Deleted ${delMandals} mandals`);

      const delDistrictTrans = await prisma.districtTranslation.deleteMany({
        where: { districtId: district.id }
      });
      console.log(`      - Deleted ${delDistrictTrans.count} district translations`);

      await prisma.$executeRaw`
        DELETE FROM "District" WHERE id = ${district.id}
      `;
      console.log(`      - Deleted district: ${district.name}`);
    }

    // Rename to standard name if needed
    if (toKeep.name !== dup.keep) {
      await prisma.district.update({
        where: { id: toKeep.id },
        data: { name: dup.keep }
      });
      console.log(`   ✓ Renamed "${toKeep.name}" → "${dup.keep}"`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('✅ Duplicates fixed!\n');

  // Show final count
  const finalCount = await prisma.district.count({
    where: { stateId: telangana.id, isDeleted: false }
  });
  console.log(`📊 Total unique districts: ${finalCount}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
