/**
 * Clear ALL Telangana location data (Districts, Mandals, Villages)
 * Fresh start for production prompts
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🧹 Clearing ALL Telangana Location Data\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found');
  }

  // Count current data
  const villageCount = await prisma.village.count({
    where: { mandal: { district: { stateId: telangana.id } } }
  });
  
  const mandalCount = await prisma.mandal.count({
    where: { district: { stateId: telangana.id } }
  });
  
  const districtCount = await prisma.district.count({
    where: { stateId: telangana.id }
  });

  console.log(`\nCurrent data:`);
  console.log(`   Districts: ${districtCount}`);
  console.log(`   Mandals: ${mandalCount}`);
  console.log(`   Villages: ${villageCount}\n`);

  // Delete villages
  const deletedVillages = await prisma.villageTranslation.deleteMany({
    where: { village: { mandal: { district: { stateId: telangana.id } } } }
  });
  console.log(`✓ Deleted ${deletedVillages.count} village translations`);
  
  await prisma.village.updateMany({
    where: { mandal: { district: { stateId: telangana.id } } },
    data: { isDeleted: true }
  });
  console.log(`✓ Soft-deleted ${villageCount} villages`);

  // Delete mandals
  const deletedMandalTrans = await prisma.mandalTranslation.deleteMany({
    where: { mandal: { district: { stateId: telangana.id } } }
  });
  console.log(`✓ Deleted ${deletedMandalTrans.count} mandal translations`);
  
  await prisma.mandal.updateMany({
    where: { district: { stateId: telangana.id } },
    data: { isDeleted: true }
  });
  console.log(`✓ Soft-deleted ${mandalCount} mandals`);

  // Delete districts
  const deletedDistrictTrans = await prisma.districtTranslation.deleteMany({
    where: { district: { stateId: telangana.id } }
  });
  console.log(`✓ Deleted ${deletedDistrictTrans.count} district translations`);
  
  await prisma.district.updateMany({
    where: { stateId: telangana.id },
    data: { isDeleted: true }
  });
  console.log(`✓ Soft-deleted ${districtCount} districts`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL CLEARED! Ready for production prompts.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
