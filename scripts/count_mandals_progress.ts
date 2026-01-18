/**
 * Show mandal and village counts for Telangana (live progress)
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('📊 Telangana Location Data Count\n');
  console.log('='.repeat(60));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    console.error('❌ Telangana state not found!');
    return;
  }

  // Get districts with mandal counts
  const districts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    include: {
      _count: {
        select: { mandals: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  let totalMandals = 0;
  let districtsWithMandals = 0;
  let districtDetails: any[] = [];

  for (const district of districts) {
    const mandalCount = district._count.mandals;
    totalMandals += mandalCount;
    
    if (mandalCount > 0) {
      districtsWithMandals++;
      districtDetails.push({ name: district.name, count: mandalCount });
    }
  }

  // Get total villages
  const villageCount = await prisma.village.count({
    where: {
      mandal: {
        district: {
          stateId: telangana.id
        }
      },
      isDeleted: false
    }
  });

  console.log(`\n📍 Districts: ${districts.length}`);
  console.log(`📍 Districts with mandals: ${districtsWithMandals}/${districts.length}`);
  console.log(`📍 Total Mandals: ${totalMandals}`);
  console.log(`📍 Total Villages: ${villageCount}`);

  if (districtDetails.length > 0) {
    console.log('\n✅ Districts with data:');
    console.log('─'.repeat(60));
    districtDetails.forEach(d => {
      console.log(`   ${d.name.padEnd(35)} : ${d.count} mandals`);
    });
  }

  const remaining = districts.length - districtsWithMandals;
  if (remaining > 0) {
    console.log(`\n⏳ Remaining: ${remaining} districts to process`);
  } else {
    console.log(`\n✅ ALL DISTRICTS COMPLETED!`);
  }

  console.log('\n' + '='.repeat(60));
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
