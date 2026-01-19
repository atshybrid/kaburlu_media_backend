import prisma from '../src/lib/prisma';

async function main() {
  console.log('🗑️  Clearing all districts and location data...\n');

  // Step 1: Delete all translations
  console.log('Deleting village translations...');
  const villageTransDeleted = await prisma.villageTranslation.deleteMany({});
  console.log(`  ✓ Deleted ${villageTransDeleted.count} village translations`);

  console.log('Deleting mandal translations...');
  const mandalTransDeleted = await prisma.mandalTranslation.deleteMany({});
  console.log(`  ✓ Deleted ${mandalTransDeleted.count} mandal translations`);

  console.log('Deleting district translations...');
  const districtTransDeleted = await prisma.districtTranslation.deleteMany({});
  console.log(`  ✓ Deleted ${districtTransDeleted.count} district translations`);

  console.log('Deleting state translations...');
  const stateTransDeleted = await prisma.stateTranslation.deleteMany({});
  console.log(`  ✓ Deleted ${stateTransDeleted.count} state translations`);

  // Step 2: Delete villages
  console.log('\nDeleting villages...');
  const villagesDeleted = await prisma.village.deleteMany({});
  console.log(`  ✓ Deleted ${villagesDeleted.count} villages`);

  // Step 3: Delete mandals
  console.log('Deleting mandals...');
  const mandalsDeleted = await prisma.mandal.deleteMany({});
  console.log(`  ✓ Deleted ${mandalsDeleted.count} mandals`);

  // Step 4: Delete assembly constituencies (foreign key to districts)
  console.log('Deleting assembly constituencies...');
  const assemblyDeleted = await prisma.assemblyConstituency.deleteMany({});
  console.log(`  ✓ Deleted ${assemblyDeleted.count} assembly constituencies`);

  // Step 5: Delete districts
  console.log('Deleting districts...');
  const districtsDeleted = await prisma.district.deleteMany({});
  console.log(`  ✓ Deleted ${districtsDeleted.count} districts`);

  // Step 6: Delete states
  console.log('Deleting states...');
  const statesDeleted = await prisma.state.deleteMany({});
  console.log(`  ✓ Deleted ${statesDeleted.count} states`);

  console.log('\n✅ All location data cleared successfully!\n');
  
  // Show final counts
  const finalCounts = {
    states: await prisma.state.count(),
    districts: await prisma.district.count(),
    mandals: await prisma.mandal.count(),
    villages: await prisma.village.count(),
    stateTranslations: await prisma.stateTranslation.count(),
    districtTranslations: await prisma.districtTranslation.count(),
    mandalTranslations: await prisma.mandalTranslation.count(),
    villageTranslations: await prisma.villageTranslation.count(),
  };

  console.log('Final counts:');
  console.log(JSON.stringify(finalCounts, null, 2));
  
  await prisma.$disconnect();
}

main().catch(console.error);
