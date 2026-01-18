/**
 * Fix missing Telangana mandals and villages using Location AI
 * This script triggers the AI populate system to fill gaps
 */

import prisma from '../src/lib/prisma';

async function main() {
  console.log('🔍 Checking Telangana location data...\n');

  // Get Telangana state
  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    console.error('❌ Telangana state not found!');
    console.log('Run: npm run seed to create states first.');
    return;
  }

  // Check districts
  const districts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    include: {
      _count: {
        select: { mandals: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  console.log(`📊 Found ${districts.length} districts in Telangana\n`);

  let totalMandals = 0;
  let districtsWithoutMandals = 0;
  let districtsWithFewMandals = 0;

  for (const district of districts) {
    const mandalCount = district._count.mandals;
    totalMandals += mandalCount;

    if (mandalCount === 0) {
      console.log(`❌ ${district.name}: NO mandals`);
      districtsWithoutMandals++;
    } else if (mandalCount < 10) {
      console.log(`⚠️  ${district.name}: ${mandalCount} mandals (might be incomplete)`);
      districtsWithFewMandals++;
    } else {
      console.log(`✅ ${district.name}: ${mandalCount} mandals`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total districts: ${districts.length}`);
  console.log(`   Total mandals: ${totalMandals}`);
  console.log(`   Districts without mandals: ${districtsWithoutMandals}`);
  console.log(`   Districts with <10 mandals: ${districtsWithFewMandals}`);

  // Check villages
  const villages = await prisma.village.count({
    where: {
      mandal: {
        district: {
          stateId: telangana.id
        }
      },
      isDeleted: false
    }
  });

  console.log(`   Total villages: ${villages}`);

  if (districtsWithoutMandals > 0 || villages < 1000) {
    console.log(`\n⚠️  Missing data detected!`);
    console.log(`\n🔧 To fix, run ONE of these:\n`);
    console.log(`Option 1: Use Location AI API (Recommended)`);
    console.log(`-----------------------------------------`);
    console.log(`POST /location/ai/populate/state`);
    console.log(`{ "stateName": "Telangana", "languages": ["te", "hi"] }\n`);
    
    console.log(`Option 2: Use Cron Worker (Background)`);
    console.log(`-----------------------------------------`);
    console.log(`npm run jobs:location-populate Telangana\n`);

    console.log(`Option 3: Re-seed from JSON files`);
    console.log(`-----------------------------------------`);
    console.log(`npm run seed:telangana-mandals\n`);
  } else {
    console.log(`\n✅ Telangana data looks good!`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
