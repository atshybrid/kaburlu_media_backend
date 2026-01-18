/**
 * Check what mandals were stored for Adilabad district
 */

import prisma from '../src/lib/prisma';

async function main() {
  const adilabad = await prisma.district.findFirst({
    where: { name: 'Adilabad', isDeleted: false },
    include: {
      mandals: {
        where: { isDeleted: false },
        orderBy: { name: 'asc' }
      }
    }
  });

  if (!adilabad) {
    console.log('Adilabad district not found');
    return;
  }

  console.log(`\n📍 Adilabad District - Stored Mandals: ${adilabad.mandals.length}\n`);
  console.log('='.repeat(60));
  
  adilabad.mandals.forEach((m, i) => {
    console.log(`${(i + 1).toString().padStart(2)}. ${m.name}`);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`\n✅ Actual count from AI: ${adilabad.mandals.length}`);
  console.log(`❌ Expected count: 18`);
  console.log(`⚠️  Extra mandals: ${adilabad.mandals.length - 18}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
