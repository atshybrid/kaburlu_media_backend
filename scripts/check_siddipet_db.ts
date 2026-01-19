import prisma from '../src/lib/prisma';

async function checkSiddipetInDB() {
  try {
    // Find Siddipet district
    const district = await prisma.district.findFirst({
      where: { name: 'Siddipet' }
    });

    if (!district) {
      console.log('❌ Siddipet district not found in database');
      return;
    }

    // Get Telugu translation
    const districtTranslation = await prisma.districtTranslation.findFirst({
      where: { 
        districtId: district.id,
        language: 'te'
      }
    });

    // Get all mandals for this district
    const mandals = await prisma.mandal.findMany({
      where: { districtId: district.id },
      orderBy: { name: 'asc' }
    });

    // Get Telugu translations for mandals
    const mandalTranslations = await prisma.mandalTranslation.findMany({
      where: {
        mandalId: { in: mandals.map(m => m.id) },
        language: 'te'
      }
    });

    const translationMap = new Map(mandalTranslations.map(t => [t.mandalId, t.name]));

    console.log('\n📊 Siddipet District in Database:\n');
    console.log(`District: ${district.name}`);
    console.log(`Telugu: ${districtTranslation?.name || 'N/A'}`);
    console.log(`Total Mandals in DB: ${mandals.length}\n`);
    
    console.log('Mandals:');
    console.log('='.repeat(80));
    mandals.forEach((mandal, idx) => {
      const teluguName = translationMap.get(mandal.id) || 'N/A';
      console.log(`${(idx + 1).toString().padStart(2)}. ${mandal.name.padEnd(35)} | ${teluguName}`);
    });
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSiddipetInDB();
