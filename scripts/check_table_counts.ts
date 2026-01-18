/**
 * Check table counts
 */
import prisma from '../src/lib/prisma';

async function main() {
  const d = await prisma.district.count();
  const dt = await prisma.districtTranslation.count();
  const m = await prisma.mandal.count();
  const mt = await prisma.mandalTranslation.count();
  const v = await prisma.village.count();
  const vt = await prisma.villageTranslation.count();

  console.log('\n📊 Table Counts:\n');
  console.log(`Districts: ${d}`);
  console.log(`DistrictTranslations: ${dt}`);
  console.log(`Mandals: ${m}`);
  console.log(`MandalTranslations: ${mt}`);
  console.log(`Villages: ${v}`);
  console.log(`VillageTranslations: ${vt}\n`);
}

main().finally(() => prisma.$disconnect());
