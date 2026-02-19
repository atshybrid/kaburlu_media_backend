/**
 * One-time migration: Create Markapuram district and move 14 mandals from Prakasam.
 * Also creates 7 new mandals that don't exist yet.
 */
import prisma from '../src/lib/prisma';

const MANDALS_FROM_PRAKASAM = [
  { old: 'Ardhaveedu',        new: 'Ardhaveedu' },
  { old: 'Bestavaripeta',     new: 'Bestavaripeta' },
  { old: 'Cumbum',            new: 'Cumbum' },
  { old: 'Giddalur',          new: 'Giddalur' },
  { old: 'Komarolu',          new: 'Komarolu' },
  { old: 'Konakanamitla',     new: 'Konakanamitla' },
  { old: 'Markapur',          new: 'Markapuram' },   // rename
  { old: 'Podili',            new: 'Podili' },
  { old: 'Pullalacheruvu',    new: 'Pullalacheruvu' },
  { old: 'Racherla',          new: 'Racherla' },
  { old: 'Tarlupadu',         new: 'Tarlupadu' },
  { old: 'Hanumanthunipadu',  new: 'Hanumanthunipadu' },
  { old: 'Kanigiri',          new: 'Kanigiri' },
  { old: 'Pamur',             new: 'Pamuru' },        // rename
];

const NEW_MANDALS = [
  'Dornala',
  'Pedda Araveedu',
  'Tripuranthakam',
  'Yerragondapalem',
  'Chandrasekharapuram',
  'Pedacherlopalle',
  'Veligandla',
];

async function main() {
  console.log('\n🚀 Moving mandals from Prakasam → Markapuram district...\n');

  const apState = await prisma.state.findFirst({ where: { name: 'Andhra Pradesh' } });
  if (!apState) throw new Error('Andhra Pradesh state not found');

  const prakasam = await prisma.district.findFirst({ where: { name: 'Prakasam', stateId: apState.id } });
  if (!prakasam) throw new Error('Prakasam district not found');

  // Find or create Markapuram district
  let markapuram = await prisma.district.findFirst({ where: { name: 'Markapuram', stateId: apState.id } });
  if (!markapuram) {
    markapuram = await prisma.district.create({ data: { name: 'Markapuram', stateId: apState.id } });
    console.log('✅ Created Markapuram district');
    await prisma.districtTranslation.createMany({
      data: [
        { districtId: markapuram.id, language: 'te', name: 'మార్కాపురం' },
        { districtId: markapuram.id, language: 'hi', name: 'मार्कापुरम' },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Added district translations\n');
  } else {
    console.log('✅ Markapuram district already exists\n');
  }

  let moved = 0, renamed = 0, created = 0, skipped = 0;

  // Move (and optionally rename) mandals from Prakasam
  for (const entry of MANDALS_FROM_PRAKASAM) {
    const alreadyThere = await prisma.mandal.findFirst({ where: { name: entry.new, districtId: markapuram.id } });
    if (alreadyThere) {
      console.log(`  ⏭  ${entry.new} — already in Markapuram`);
      skipped++; continue;
    }
    const inPrakasam = await prisma.mandal.findFirst({ where: { name: entry.old, districtId: prakasam.id } });
    if (inPrakasam) {
      await prisma.mandal.update({ where: { id: inPrakasam.id }, data: { districtId: markapuram.id, name: entry.new } });
      const tag = entry.old !== entry.new ? ` (renamed: ${entry.old} → ${entry.new})` : '';
      console.log(`  ✅ Moved${tag}: ${entry.new}`);
      moved++;
      if (entry.old !== entry.new) renamed++;
    } else {
      // Not in Prakasam — create directly
      await prisma.mandal.create({ data: { name: entry.new, districtId: markapuram.id } });
      console.log(`  ➕ Created (not found in Prakasam): ${entry.new}`);
      created++;
    }
  }

  // Create new mandals that never existed
  console.log('\n  Adding new mandals:');
  for (const name of NEW_MANDALS) {
    const exists = await prisma.mandal.findFirst({ where: { name, districtId: markapuram.id } });
    if (exists) { console.log(`  ⏭  ${name} — already exists`); skipped++; continue; }
    await prisma.mandal.create({ data: { name, districtId: markapuram.id } });
    console.log(`  ➕ Created: ${name}`);
    created++;
  }

  console.log('\n══════════════════════════════════════');
  console.log(`  Moved from Prakasam: ${moved} (${renamed} renamed)`);
  console.log(`  Newly created:       ${created}`);
  console.log(`  Already correct:     ${skipped}`);
  console.log('══════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
