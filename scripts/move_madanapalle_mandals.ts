/**
 * One-time migration: Create Madanapalle district and move 11 mandals from Annamayya.
 */
import prisma from '../src/lib/prisma';

const MANDALS_TO_MOVE = [
  'Madanapalle',
  'Nimmanapalle',
  'Ramasamudram',
  'Thamballapalle',
  'Mulakalacheruvu',
  'Pedda Thippasamudram',
  'Kurabalakota',
  'Peddamandyam',
  'Kalakada',
  'Kambhamvaripalle',
  'T. Sundupalle',
];

async function main() {
  console.log('\n🚀 Moving mandals from Annamayya → Madanapalle district...\n');

  // 1. Find AP state
  const apState = await prisma.state.findFirst({ where: { name: 'Andhra Pradesh' } });
  if (!apState) throw new Error('Andhra Pradesh state not found');

  // 2. Find Annamayya district
  const annamayya = await prisma.district.findFirst({
    where: { name: 'Annamayya', stateId: apState.id },
  });
  if (!annamayya) throw new Error('Annamayya district not found');

  // 3. Find or create Madanapalle district
  let madanapalle = await prisma.district.findFirst({
    where: { name: 'Madanapalle', stateId: apState.id },
  });

  if (!madanapalle) {
    madanapalle = await prisma.district.create({
      data: { name: 'Madanapalle', stateId: apState.id },
    });
    console.log('✅ Created Madanapalle district\n');

    // Add translations
    await prisma.districtTranslation.createMany({
      data: [
        { districtId: madanapalle.id, language: 'te', name: 'మదనపల్లె' },
        { districtId: madanapalle.id, language: 'hi', name: 'मदनपल्ले' },
      ],
      skipDuplicates: true,
    });
    console.log('✅ Added district translations (Telugu & Hindi)\n');
  } else {
    console.log('✅ Madanapalle district already exists\n');
  }

  // 4. Move mandals
  let moved = 0;
  let alreadyCorrect = 0;
  let notFound = 0;

  for (const mandalName of MANDALS_TO_MOVE) {
    // Check if already under Madanapalle
    const alreadyInMadanapalle = await prisma.mandal.findFirst({
      where: { name: mandalName, districtId: madanapalle.id },
    });
    if (alreadyInMadanapalle) {
      console.log(`  ⏭  ${mandalName} — already in Madanapalle`);
      alreadyCorrect++;
      continue;
    }

    // Find in Annamayya
    const inAnnamayya = await prisma.mandal.findFirst({
      where: { name: mandalName, districtId: annamayya.id },
    });

    if (inAnnamayya) {
      await prisma.mandal.update({
        where: { id: inAnnamayya.id },
        data: { districtId: madanapalle.id },
      });
      console.log(`  ✅ Moved: ${mandalName}`);
      moved++;
    } else {
      // Not found anywhere — create under Madanapalle
      await prisma.mandal.create({
        data: { name: mandalName, districtId: madanapalle.id },
      });
      console.log(`  ➕ Created (not found in Annamayya): ${mandalName}`);
      moved++;
    }
  }

  console.log('\n══════════════════════════════════════');
  console.log(`  Moved:           ${moved}`);
  console.log(`  Already correct: ${alreadyCorrect}`);
  console.log(`  Not found:       ${notFound}`);
  console.log('══════════════════════════════════════\n');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
