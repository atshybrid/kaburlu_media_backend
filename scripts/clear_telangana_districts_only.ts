/**
 * Clear only Telangana Districts and DistrictTranslations
 * Keeps Mandals and Villages intact
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🧹 Clearing Telangana Districts Only\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found');
  }

  // Count current
  const districtCount = await prisma.district.count({
    where: { stateId: telangana.id }
  });
  
  const districtTransCount = await prisma.districtTranslation.count({
    where: { district: { stateId: telangana.id } }
  });

  console.log(`\nCurrent Telangana data:`);
  console.log(`   Districts: ${districtCount}`);
  console.log(`   District Translations: ${districtTransCount}\n`);

  // Delete mandal translations first
  const delMandalTrans = await prisma.mandalTranslation.deleteMany({
    where: { mandal: { district: { stateId: telangana.id } } }
  });
  console.log(`✓ Deleted ${delMandalTrans.count} mandal translations`);

  // Delete mandals
  const delMandals = await prisma.$executeRaw`
    DELETE FROM "Mandal" WHERE "districtId" IN (
      SELECT id FROM "District" WHERE "stateId" = ${telangana.id}
    )
  `;
  console.log(`✓ Deleted ${delMandals} mandals`);

  // Delete district translations
  const delTrans = await prisma.districtTranslation.deleteMany({
    where: { district: { stateId: telangana.id } }
  });
  console.log(`✓ Deleted ${delTrans.count} district translations`);

  // Delete districts
  const delDistricts = await prisma.$executeRaw`
    DELETE FROM "District" WHERE "stateId" = ${telangana.id}
  `;
  console.log(`✓ Deleted ${delDistricts} districts`);

  console.log('\n' + '='.repeat(70));
  console.log('✅ DISTRICTS CLEARED! Ready to test API.\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
