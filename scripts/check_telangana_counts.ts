import prisma from '../src/lib/prisma';

async function main() {
  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    console.log('Telangana state not found');
    return;
  }

  const districts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    include: {
      _count: { select: { mandals: true } }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n📊 Telangana Location Data Summary\n');
  console.log(`State: ${telangana.name}`);
  console.log(`Total Districts: ${districts.length}`);
  
  let totalMandals = 0;
  console.log('\n📍 Districts and Mandal Counts:\n');
  
  for (const district of districts) {
    console.log(`  ${district.name.padEnd(30)} - ${district._count.mandals} mandals`);
    totalMandals += district._count.mandals;
  }

  console.log(`\n✅ Total Mandals: ${totalMandals}`);

  // Check translations
  const stateTranslations = await prisma.stateTranslation.count({
    where: { stateId: telangana.id }
  });
  
  const districtTranslations = await prisma.districtTranslation.count({
    where: { district: { stateId: telangana.id } }
  });
  
  const mandalTranslations = await prisma.mandalTranslation.count({
    where: { mandal: { district: { stateId: telangana.id } } }
  });

  console.log('\n📝 Translation Counts:');
  console.log(`  State: ${stateTranslations} (Telugu)`);
  console.log(`  Districts: ${districtTranslations} (Telugu)`);
  console.log(`  Mandals: ${mandalTranslations} (Telugu)`);

  await prisma.$disconnect();
}

main().catch(console.error);
