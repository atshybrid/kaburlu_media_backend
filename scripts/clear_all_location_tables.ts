/**
 * Clear ALL location data from ALL tables
 * (Districts, Mandals, Villages and their translations)
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🧹 Clearing ALL Location Data from ALL Tables\n');
  console.log('='.repeat(70));

  // Count current data
  const villageTransCount = await prisma.villageTranslation.count();
  const villageCount = await prisma.village.count();
  const mandalTransCount = await prisma.mandalTranslation.count();
  const mandalCount = await prisma.mandal.count();
  const districtTransCount = await prisma.districtTranslation.count();
  const districtCount = await prisma.district.count();

  console.log(`\nCurrent data across ALL states:`);
  console.log(`   Districts: ${districtCount}`);
  console.log(`   District Translations: ${districtTransCount}`);
  console.log(`   Mandals: ${mandalCount}`);
  console.log(`   Mandal Translations: ${mandalTransCount}`);
  console.log(`   Villages: ${villageCount}`);
  console.log(`   Village Translations: ${villageTransCount}\n`);

  // Step 1: Delete all village translations
  console.log('\n🗑️  Step 1: Deleting VillageTranslations...');
  const delVillageTrans = await prisma.villageTranslation.deleteMany({});
  console.log(`   ✓ Deleted ${delVillageTrans.count} village translations`);

  // Step 2: Delete all villages (HARD DELETE)
  console.log('🗑️  Step 2: Deleting Villages...');
  const delVillages = await prisma.$executeRaw`DELETE FROM "Village"`;
  console.log(`   ✓ Deleted ${delVillages} villages`);

  // Step 3: Delete all mandal translations
  console.log('🗑️  Step 3: Deleting MandalTranslations...');
  const delMandalTrans = await prisma.mandalTranslation.deleteMany({});
  console.log(`   ✓ Deleted ${delMandalTrans.count} mandal translations`);

  // Step 4: Delete all mandals (HARD DELETE)
  console.log('🗑️  Step 4: Deleting Mandals...');
  const delMandals = await prisma.$executeRaw`DELETE FROM "Mandal"`;
  console.log(`   ✓ Deleted ${delMandals} mandals`);

  // Step 5: Delete all district translations
  console.log('🗑️  Step 5: Deleting DistrictTranslations...');
  const delDistrictTrans = await prisma.districtTranslation.deleteMany({});
  console.log(`   ✓ Deleted ${delDistrictTrans.count} district translations`);

  // Step 6: Delete AssemblyConstituency (foreign key dependency)
  console.log('🗑️  Step 6: Deleting AssemblyConstituencies...');
  const delAC = await prisma.$executeRaw`DELETE FROM "AssemblyConstituency"`;
  console.log(`   ✓ Deleted ${delAC} assembly constituencies`);

  // Step 7: Delete all districts (HARD DELETE)
  console.log('🗑️  Step 7: Deleting Districts...');
  const delDistricts = await prisma.$executeRaw`DELETE FROM "District"`;
  console.log(`   ✓ Deleted ${delDistricts} districts`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ ALL TABLES CLEARED!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
