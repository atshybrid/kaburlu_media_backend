/**
 * One-time migration: Create Polavaram district and move 10 mandals from Alluri Sitharama Raju.
 * Also adds Nellipaka (new) and renames Chintoor→Chinturu, Vararamachandrapuram→Vara Ramachandrapuram.
 */
import prisma from '../src/lib/prisma';

const MANDALS_FROM_ALLURI = [
  { old: 'Rampachodavaram',       new: 'Rampachodavaram' },
  { old: 'Maredumilli',           new: 'Maredumilli' },
  { old: 'Devipatnam',            new: 'Devipatnam' },
  { old: 'Gangavaram',            new: 'Gangavaram' },
  { old: 'Addateegala',           new: 'Addateegala' },
  { old: 'Y. Ramavaram',          new: 'Y. Ramavaram' },
  { old: 'Chintoor',              new: 'Chinturu' },              // rename
  { old: 'Kunavaram',             new: 'Kunavaram' },
  { old: 'Vararamachandrapuram',  new: 'Vara Ramachandrapuram' }, // rename
  { old: 'Yetapaka',              new: 'Yetapaka' },
];

const NEW_MANDALS = ['Nellipaka'];

async function main() {
  console.log('\n🚀 Moving mandals from Alluri Sitharama Raju → Polavaram district...\n');

  const apState = await prisma.state.findFirst({ where: { name: 'Andhra Pradesh' } });
  if (!apState) throw new Error('Andhra Pradesh state not found');

  const alluri = await prisma.district.findFirst({ where: { name: 'Alluri Sitharama Raju', stateId: apState.id } });
  if (!alluri) throw new Error('Alluri Sitharama Raju district not found');

  let polavaram = await prisma.district.findFirst({ where: { name: 'Polavaram', stateId: apState.id } });
  if (!polavaram) {
    polavaram = await prisma.district.create({ data: { name: 'Polavaram', stateId: apState.id } });
    console.log('✅ Created Polavaram district');
    await prisma.districtTranslation.createMany({
      data: [
        { districtId: polavaram.id, language: 'te', name: 'పోలవరం' },
        { districtId: polavaram.id, language: 'hi', name: 'पोलावरम' },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Added district translations\n');
  } else {
    console.log('✅ Polavaram district already exists\n');
  }

  let moved = 0, renamed = 0, created = 0, skipped = 0;

  for (const entry of MANDALS_FROM_ALLURI) {
    const alreadyThere = await prisma.mandal.findFirst({ where: { name: entry.new, districtId: polavaram.id } });
    if (alreadyThere) {
      console.log(`  ⏭  ${entry.new} — already in Polavaram`);
      skipped++; continue;
    }
    const inAlluri = await prisma.mandal.findFirst({ where: { name: entry.old, districtId: alluri.id } });
    if (inAlluri) {
      await prisma.mandal.update({ where: { id: inAlluri.id }, data: { districtId: polavaram.id, name: entry.new } });
      const tag = entry.old !== entry.new ? ` (renamed: ${entry.old} → ${entry.new})` : '';
      console.log(`  ✅ Moved${tag}: ${entry.new}`);
      moved++; if (entry.old !== entry.new) renamed++;
    } else {
      await prisma.mandal.create({ data: { name: entry.new, districtId: polavaram.id } });
      console.log(`  ➕ Created (not found in Alluri): ${entry.new}`);
      created++;
    }
  }

  console.log('\n  Adding new mandals:');
  for (const name of NEW_MANDALS) {
    const exists = await prisma.mandal.findFirst({ where: { name, districtId: polavaram.id } });
    if (exists) { console.log(`  ⏭  ${name} — already exists`); skipped++; continue; }
    await prisma.mandal.create({ data: { name, districtId: polavaram.id } });
    console.log(`  ➕ Created: ${name}`);
    created++;
  }

  console.log('\n══════════════════════════════════════');
  console.log(`  Moved from Alluri: ${moved} (${renamed} renamed)`);
  console.log(`  Newly created:     ${created}`);
  console.log(`  Already correct:   ${skipped}`);
  console.log('══════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
