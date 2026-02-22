/**
 * move_mandal.ts
 *
 * Manually move a mandal to a different district in Andhra Pradesh (or any state).
 *
 * Usage:
 *   npx ts-node scripts/move_mandal.ts "<MandalName>" "<TargetDistrict>"
 *
 * Examples:
 *   npx ts-node scripts/move_mandal.ts "Gangavaram" "Chittoor"
 *   npx ts-node scripts/move_mandal.ts "Yelamanchili" "Anakapalli"
 *
 * Optional: pass state name as 3rd arg (default: Andhra Pradesh)
 *   npx ts-node scripts/move_mandal.ts "Adilabad" "Adilabad" "Telangana"
 */

import prisma from '../src/lib/prisma';

async function main() {
  const [, , mandalArg, districtArg, stateArg] = process.argv;

  if (!mandalArg || !districtArg) {
    console.error('Usage: npx ts-node scripts/move_mandal.ts "<MandalName>" "<TargetDistrict>" [StateName]');
    console.error('Example: npx ts-node scripts/move_mandal.ts "Gangavaram" "Chittoor"');
    process.exit(1);
  }

  const stateName = stateArg || 'Andhra Pradesh';
  const mandalName = mandalArg.trim();
  const targetDistrictName = districtArg.trim();

  console.log('─'.repeat(60));
  console.log(`Mandal        : ${mandalName}`);
  console.log(`Target District: ${targetDistrictName}`);
  console.log(`State         : ${stateName}`);
  console.log('─'.repeat(60));

  // Find state
  const state = await prisma.state.findFirst({ where: { name: stateName } });
  if (!state) {
    console.error(`❌ State "${stateName}" not found in DB.`);
    process.exit(1);
  }

  // Find target district
  const targetDistrict = await prisma.district.findFirst({
    where: { name: targetDistrictName, stateId: state.id },
  });
  if (!targetDistrict) {
    console.error(`❌ District "${targetDistrictName}" not found under ${stateName}.`);

    // Show available districts to help
    const allDistricts = await prisma.district.findMany({
      where: { stateId: state.id },
      select: { name: true },
      orderBy: { name: 'asc' },
    });
    console.log(`\nAvailable districts in ${stateName}:`);
    allDistricts.forEach(d => console.log(`  - ${d.name}`));
    process.exit(1);
  }

  // Find all matching mandals in the state
  const mandals = await prisma.mandal.findMany({
    where: {
      name: mandalName,
      district: { stateId: state.id },
    },
    include: {
      district: { select: { name: true } },
    },
  });

  if (mandals.length === 0) {
    console.error(`❌ Mandal "${mandalName}" not found under ${stateName}.`);

    // Fuzzy hint
    const similar = await prisma.mandal.findMany({
      where: {
        name: { contains: mandalName.split(' ')[0], mode: 'insensitive' },
        district: { stateId: state.id },
      },
      select: { name: true, district: { select: { name: true } } },
      take: 10,
    });
    if (similar.length > 0) {
      console.log(`\nDid you mean one of these?`);
      similar.forEach(m => console.log(`  - "${m.name}" (currently in ${m.district.name})`));
    }
    process.exit(1);
  }

  console.log(`\nFound ${mandals.length} mandal(s) named "${mandalName}":\n`);
  for (const m of mandals) {
    console.log(`  ID: ${m.id}  |  Current district: ${m.district.name}`);
  }

  // If already all in target district
  const alreadyCorrect = mandals.filter(m => m.districtId === targetDistrict.id);
  const needsMove = mandals.filter(m => m.districtId !== targetDistrict.id);

  if (needsMove.length === 0) {
    console.log(`\n✅ "${mandalName}" is already in "${targetDistrictName}". Nothing to do.`);
    return;
  }

  // Move each one
  for (const m of needsMove) {
    await prisma.mandal.update({
      where: { id: m.id },
      data: { districtId: targetDistrict.id },
    });
    console.log(`\n🔀 Moved "${mandalName}" from "${m.district.name}" → "${targetDistrictName}"`);
  }

  // If there are now duplicates in the target district, clean them
  const afterMove = await prisma.mandal.findMany({
    where: { name: mandalName, districtId: targetDistrict.id },
    orderBy: { id: 'asc' },
  });

  if (afterMove.length > 1) {
    console.log(`\n⚠️  ${afterMove.length} rows with name "${mandalName}" now exist in "${targetDistrictName}". Deduplicating...`);
    const [keep, ...dups] = afterMove;
    for (const dup of dups) {
      await prisma.mandalTranslation.deleteMany({ where: { mandalId: dup.id } });
      await prisma.mandal.delete({ where: { id: dup.id } });
      console.log(`   🗑  Deleted duplicate id: ${dup.id}, kept: ${keep.id}`);
    }
  }

  console.log(`\n✅ Done.`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
