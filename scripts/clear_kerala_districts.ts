import prisma from '../src/lib/prisma';

async function main() {
  console.log('🗑️  Clearing Kerala districts...\n');

  // Find Kerala state
  const kerala = await prisma.state.findFirst({
    where: { name: 'Kerala' }
  });

  if (!kerala) {
    console.log('No Kerala state found');
    return;
  }

  // Get all Kerala districts
  const districts = await prisma.district.findMany({
    where: { stateId: kerala.id },
    include: {
      _count: {
        select: { mandals: true }
      }
    }
  });

  console.log(`Found ${districts.length} Kerala districts`);

  for (const d of districts) {
    console.log(`  Deleting: ${d.name} (${d._count.mandals} mandals)`);
    
    // Delete district translations
    await prisma.districtTranslation.deleteMany({
      where: { districtId: d.id }
    });
    
    // Delete district (cascades to mandals/villages if configured)
    await prisma.district.delete({
      where: { id: d.id }
    });
  }

  console.log(`\n✅ Deleted ${districts.length} Kerala districts`);
  
  await prisma.$disconnect();
}

main().catch(console.error);
