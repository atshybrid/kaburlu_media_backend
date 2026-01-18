/**
 * Resume population for remaining districts
 */
import prisma from '../src/lib/prisma';

async function main() {
  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana not found');
  }

  // Get all districts
  const allDistricts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    include: {
      _count: { select: { mandals: true } }
    },
    orderBy: { name: 'asc' }
  });

  console.log('\n📊 District Status:\n');
  console.log('='.repeat(70));
  
  const withMandals: string[] = [];
  const withoutMandals: string[] = [];

  allDistricts.forEach(d => {
    if (d._count.mandals > 0) {
      withMandals.push(d.name);
      console.log(`✅ ${d.name.padEnd(35)} : ${d._count.mandals} mandals`);
    } else {
      withoutMandals.push(d.name);
    }
  });

  if (withoutMandals.length > 0) {
    console.log('\n❌ Districts WITHOUT mandals:');
    console.log('─'.repeat(70));
    withoutMandals.forEach(d => console.log(`   ${d}`));
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\nCompleted: ${withMandals.length}/33`);
  console.log(`Remaining: ${withoutMandals.length}/33\n`);
}

main().finally(() => prisma.$disconnect());
