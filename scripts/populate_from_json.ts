import prisma from '../src/lib/prisma';
import { OPENAI_KEY } from '../src/lib/aiConfig';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Populate database from verified JSON files
 * Uses AI ONLY for Telugu translations
 */

async function askChatGPT(prompt: string): Promise<string> {
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a Telugu translation expert. Return only valid JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 60000
    }
  );
  return resp?.data?.choices?.[0]?.message?.content || '';
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

async function translateToTelugu(name: string): Promise<string> {
  const prompt = `Translate "${name}" to Telugu script. Return JSON: { "telugu": "తెలుగు" }`;
  const result = await askChatGPT(prompt);
  const data = parseJSON(result);
  return data?.telugu || name;
}

async function populateFromJSON(jsonFilePath: string) {
  console.log(`\n📂 Reading: ${jsonFilePath}\n`);

  const rawData = fs.readFileSync(jsonFilePath, 'utf-8');
  const data = JSON.parse(rawData);

  // Support both old and new JSON formats
  const stateData = data.state;
  const stateName = typeof stateData === 'string' ? stateData : stateData.name_en;
  const stateTelugu = stateData.name_te || null;
  const districts = data.districts;

  console.log(`🚀 Processing: ${stateName}`);
  console.log(`   Districts in file: ${districts.length}\n`);

  // Get or create India
  const india = await prisma.country.findFirst({ where: { name: 'India' } });
  if (!india) throw new Error('India not found');

  // Get or create state
  let state = await prisma.state.findFirst({
    where: { name: { equals: stateName, mode: 'insensitive' } }
  });

  if (!state) {
    state = await prisma.state.create({
      data: { name: stateName, countryId: india.id, isDeleted: false }
    });
    console.log(`✅ Created state: ${stateName}`);
  } else {
    console.log(`✅ State exists: ${stateName}`);
  }

  // Create state translation (use provided Telugu or translate)
  const teluguName = stateTelugu || (await translateToTelugu(stateName));
  const existingStateTrans = await prisma.stateTranslation.findFirst({
    where: { stateId: state.id, language: 'te' }
  });

  if (!existingStateTrans) {
    await prisma.stateTranslation.create({
      data: { stateId: state.id, language: 'te', name: teluguName }
    });
    console.log(`   📝 Telugu: ${teluguName}\n`);
  }

  let stats = {
    districtsCreated: 0,
    mandalsCreated: 0,
    villagesCreated: 0,
    translationsCreated: 0
  };

  // Process each district
  for (let i = 0; i < districts.length; i++) {
    const districtData = districts[i];
    const districtName = districtData.name_en || districtData.name;
    const districtTelugu = districtData.name_te;
    
    console.log(`[${i + 1}/${districts.length}] Processing: ${districtName}`);

    // Create or find district
    let district = await prisma.district.findFirst({
      where: {
        name: { equals: districtName, mode: 'insensitive' },
        stateId: state.id
      }
    });

    if (!district) {
      district = await prisma.district.create({
        data: { name: districtName, stateId: state.id, isDeleted: false }
      });
      stats.districtsCreated++;
      console.log(`  ✅ Created district`);
    } else {
      console.log(`  ✅ District exists`);
    }

    // Create district translation (use provided Telugu or translate)
    const teluguName = districtTelugu || (await translateToTelugu(districtName));
    const existingDistTrans = await prisma.districtTranslation.findFirst({
      where: { districtId: district.id, language: 'te' }
    });

    if (!existingDistTrans) {
      await prisma.districtTranslation.create({
        data: { districtId: district.id, language: 'te', name: teluguName }
      });
      stats.translationsCreated++;
      console.log(`  📝 Telugu: ${teluguName}`);
    }

    // Process mandals (if present in new format)
    const mandals = districtData.mandals || [];
    if (mandals.length > 0) {
      console.log(`  📊 ${mandals.length} mandals to create`);

      for (const mandalData of mandals) {
        const mandalName = mandalData.name_en || mandalData.name;
        const mandalTelugu = mandalData.name_te;

        let mandal = await prisma.mandal.findFirst({
          where: {
            name: { equals: mandalName, mode: 'insensitive' },
            districtId: district.id
          }
        });

        if (!mandal) {
          mandal = await prisma.mandal.create({
            data: { name: mandalName, districtId: district.id, isDeleted: false }
          });
          stats.mandalsCreated++;
        }

        // Create mandal translation (use provided Telugu or translate)
        const mandalTeluguName = mandalTelugu || (await translateToTelugu(mandalName));
        const existingMandalTrans = await prisma.mandalTranslation.findFirst({
          where: { mandalId: mandal.id, language: 'te' }
        });

        if (!existingMandalTrans) {
          await prisma.mandalTranslation.create({
            data: { mandalId: mandal.id, language: 'te', name: mandalTeluguName }
          });
          stats.translationsCreated++;
        }

        // Process villages (if present)
        const villages = mandalData.villages || [];
        if (villages.length > 0) {
          // Get first tenant
          const firstTenant = await prisma.tenant.findFirst();
          if (!firstTenant) throw new Error('No tenant found');

          for (const villageData of villages) {
            const villageName = typeof villageData === 'string' ? villageData : villageData.name_en || villageData.name;
            const villageTelugu = typeof villageData === 'string' ? null : villageData.name_te;

            let village = await prisma.village.findFirst({
              where: {
                name: { equals: villageName, mode: 'insensitive' },
                mandalId: mandal.id
              }
            });

            if (!village) {
              village = await prisma.village.create({
                data: {
                  name: villageName,
                  mandalId: mandal.id,
                  tenantId: firstTenant.id,
                  isDeleted: false
                }
              });
              stats.villagesCreated++;
            }

            // Create village translation (use provided Telugu or translate)
            const villageTeluguName = villageTelugu || (await translateToTelugu(villageName));
            const existingVillageTrans = await prisma.villageTranslation.findFirst({
              where: { villageId: village.id, language: 'te' }
            });

            if (!existingVillageTrans) {
              await prisma.villageTranslation.create({
                data: { villageId: village.id, language: 'te', name: villageTeluguName }
              });
              stats.translationsCreated++;
            }
          }
        }
      }
    } else {
      console.log(`  ⚠️  No mandals in JSON (add them to populate mandals)`);
    }

    console.log(''); // blank line
  }

  console.log(`\n✅ ${stateName} completed:`);
  console.log(`   Districts: ${stats.districtsCreated} created`);
  console.log(`   Mandals: ${stats.mandalsCreated} created`);
  console.log(`   Villages: ${stats.villagesCreated} created`);
  console.log(`   Translations: ${stats.translationsCreated} created\n`);
}

async function main() {
  const locationDir = path.join(__dirname, '../location');

  // Check which JSON files exist
  const telanganaFile = path.join(locationDir, 'telangana_template.json');
  const apFile = path.join(locationDir, 'andhra_pradesh_template.json');

  if (fs.existsSync(telanganaFile)) {
    await populateFromJSON(telanganaFile);
  } else {
    console.log(`⚠️  ${telanganaFile} not found - skipping Telangana`);
  }

  if (fs.existsSync(apFile)) {
    await populateFromJSON(apFile);
  } else {
    console.log(`⚠️  ${apFile} not found - skipping Andhra Pradesh`);
  }

  // Show final counts
  const finalCounts = {
    states: await prisma.state.count(),
    districts: await prisma.district.count(),
    mandals: await prisma.mandal.count(),
    villages: await prisma.village.count(),
    translations:
      (await prisma.stateTranslation.count()) +
      (await prisma.districtTranslation.count()) +
      (await prisma.mandalTranslation.count()) +
      (await prisma.villageTranslation.count())
  };

  console.log('📊 Final Database Counts:');
  console.log(JSON.stringify(finalCounts, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
