import prisma from '../src/lib/prisma';

async function main() {
  const districts = await prisma.district.findMany({
    include: { state: true },
    where: { isDeleted: false },
    orderBy: { name: 'asc' }
  });

  console.log('Total districts:', districts.length);
  
  const byState: Record<string, number> = {};
  for (const d of districts) {
    if (!byState[d.state.name]) byState[d.state.name] = 0;
    byState[d.state.name]++;
  }
  
  console.log('\nDistricts by state:');
  for (const [state, count] of Object.entries(byState).sort()) {
    console.log(`  ${state}: ${count} districts`);
  }

  // Show first few districts
  console.log('\nFirst 20 districts:');
  for (const d of districts.slice(0, 20)) {
    console.log(`  - ${d.name} (${d.state.name})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
