import prisma from '../src/lib/prisma';
import { OPENAI_KEY } from '../src/lib/aiConfig';

// Only Telugu translations
const AUTO_LANGUAGES = ['te'];

const MAX_DISTRICTS_PER_STATE = 50;
const MAX_MANDALS_PER_DISTRICT = 40;
const DELAY_BETWEEN_DISTRICTS = 1000; // 1 second

/**
 * Helper to call ChatGPT
 */
async function askChatGPT(prompt: string, model = 'gpt-4o-mini'): Promise<string> {
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 300_000); // 5 minutes
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a geographic data expert. Provide accurate Indian administrative location data in valid JSON format only.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      }
    );
    return resp?.data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(t);
  }
}

function parseJSON(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try { return JSON.parse(cleaned.slice(objStart, objEnd + 1)); } catch {}
    }
  }
  return null;
}

async function processState(stateName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Processing State: ${stateName}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Step 1: Get or create India and state
    const india = await prisma.country.findFirst({ where: { name: 'India' } });
    if (!india) throw new Error('India country not found in database');

    let state = await prisma.state.findFirst({
      where: { name: { equals: stateName, mode: 'insensitive' }, isDeleted: false }
    });

    if (!state) {
      console.log(`  ➕ Creating state: ${stateName}`);
      state = await prisma.state.create({
        data: { name: stateName, countryId: india.id, isDeleted: false }
      });
    } else {
      console.log(`  ✓ State exists: ${stateName}`);
    }

    // Step 2: Create state Telugu translation
    console.log(`  📝 Creating Telugu translation for state...`);
    const stateTransPrompt = `Translate the Indian state name "${stateName}" to Telugu. Return JSON: { "name": "తెలుగు పేరు" }`;
    const stateTransResult = await askChatGPT(stateTransPrompt);
    const stateTransData = parseJSON(stateTransResult);

    if (stateTransData?.name) {
      const existing = await prisma.stateTranslation.findFirst({
        where: { stateId: state.id, language: 'te' }
      });

      if (!existing) {
        await prisma.stateTranslation.create({
          data: { stateId: state.id, language: 'te', name: stateTransData.name }
        });
        console.log(`    ✓ Telugu translation: ${stateTransData.name}`);
      }
    }

    // Step 3: Get all districts
    console.log(`  🏘️  Fetching districts for ${stateName}...`);

    const districtPrompt = `List ALL districts ONLY in ${stateName} state, India.

STRICT RULES:
- ONLY return districts that belong to ${stateName} state
- DO NOT include districts from other states
- Use official government Census 2011 data

For each district, provide the name in English and Telugu translation.
Return ONLY valid JSON:
{
  "state": "${stateName}",
  "districts": [
    { "en": "District Name", "te": "తెలుగు పేరు" }
  ]
}
Maximum ${MAX_DISTRICTS_PER_STATE} districts.`;

    const districtResult = await askChatGPT(districtPrompt);
    const districtData = parseJSON(districtResult);

    if (!districtData?.districts || !Array.isArray(districtData.districts)) {
      throw new Error('Invalid district data from ChatGPT');
    }

    // Validation
    if (districtData.state && districtData.state.toLowerCase() !== stateName.toLowerCase()) {
      console.warn(`  ⚠️  WARNING: ChatGPT returned data for "${districtData.state}" instead of "${stateName}"`);
    }

    const districts = districtData.districts.slice(0, MAX_DISTRICTS_PER_STATE);
    console.log(`  📊 Found ${districts.length} districts`);

    let districtsCreated = 0;
    let mandalsCreated = 0;
    let translationsCreated = 0;

    // Process each district
    for (let i = 0; i < districts.length; i++) {
      const distData = districts[i];
      console.log(`\n  [${i + 1}/${districts.length}] Processing District: ${distData.en}`);

      // Verify district belongs to state
      const verifyPrompt = `Is "${distData.en}" district located in ${stateName} state, India? Answer with JSON: {"valid": true/false, "actualState": "state name if different"}`;
      const verifyResult = await askChatGPT(verifyPrompt);
      const verification = parseJSON(verifyResult);
      
      if (verification && verification.valid === false) {
        console.log(`    ⚠️  SKIPPED: ${distData.en} does not belong to ${stateName} (belongs to ${verification.actualState})`);
        continue;
      }

      // Create or find district
      let district = await prisma.district.findFirst({
        where: {
          name: { equals: distData.en, mode: 'insensitive' },
          stateId: state.id,
          isDeleted: false
        }
      });

      if (!district) {
        district = await prisma.district.create({
          data: { name: distData.en, stateId: state.id, isDeleted: false }
        });
        districtsCreated++;
        console.log(`    ➕ Created district: ${distData.en}`);
      } else {
        console.log(`    ✓ District exists: ${distData.en}`);
      }

      // Create Telugu translation
      if (distData.te) {
        const existing = await prisma.districtTranslation.findFirst({
          where: { districtId: district.id, language: 'te' }
        });

        if (!existing) {
          await prisma.districtTranslation.create({
            data: { districtId: district.id, language: 'te', name: distData.te }
          });
          translationsCreated++;
          console.log(`    📝 Telugu: ${distData.te}`);
        }
      }

      // Step 4: Get mandals for this district
      try {
        const mandalPrompt = `List mandals/tehsils in ${distData.en} district, ${stateName} state, India.

STRICT RULES:
- ONLY return mandals from ${distData.en} district
- Use official Census 2011 data
- Return accurate mandal count

For each mandal, provide English name and Telugu translation.
Return ONLY valid JSON:
{
  "district": "${distData.en}",
  "state": "${stateName}",
  "mandals": [
    { "en": "Mandal Name", "te": "తెలుగు పేరు" }
  ]
}
Maximum ${MAX_MANDALS_PER_DISTRICT} mandals.`;

        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DISTRICTS));

        const mandalResult = await askChatGPT(mandalPrompt);
        const mandalData = parseJSON(mandalResult);

        if (!mandalData?.mandals || !Array.isArray(mandalData.mandals)) {
          console.log(`    ⚠️  No mandals returned for ${distData.en}`);
          continue;
        }

        const mandals = mandalData.mandals.slice(0, MAX_MANDALS_PER_DISTRICT);
        console.log(`    📊 Found ${mandals.length} mandals`);

        // Create mandals
        for (const manData of mandals) {
          let mandal = await prisma.mandal.findFirst({
            where: {
              name: { equals: manData.en, mode: 'insensitive' },
              districtId: district.id,
              isDeleted: false
            }
          });

          if (!mandal) {
            mandal = await prisma.mandal.create({
              data: { name: manData.en, districtId: district.id, isDeleted: false }
            });
            mandalsCreated++;
          }

          // Create Telugu translation
          if (manData.te) {
            const existing = await prisma.mandalTranslation.findFirst({
              where: { mandalId: mandal.id, language: 'te' }
            });

            if (!existing) {
              await prisma.mandalTranslation.create({
                data: { mandalId: mandal.id, language: 'te', name: manData.te }
              });
              translationsCreated++;
            }
          }
        }

        console.log(`    ✓ Created ${mandals.length} mandals for ${distData.en}`);
      } catch (mandalError: any) {
        console.error(`    ❌ Error getting mandals for ${distData.en}:`, mandalError.message);
        console.log(`    ⏭️  Continuing with next district...`);
      }
    }

    console.log(`\n✅ ${stateName} completed:`);
    console.log(`   Districts: ${districtsCreated} created`);
    console.log(`   Mandals: ${mandalsCreated} created`);
    console.log(`   Translations: ${translationsCreated} created`);

  } catch (error: any) {
    console.error(`\n❌ Error processing ${stateName}:`, error.message);
    throw error;
  }
}

async function main() {
  const states = ['Telangana', 'Andhra Pradesh'];

  for (const stateName of states) {
    await processState(stateName);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('✅ All states processed successfully!');
  console.log(`${'='.repeat(80)}\n`);

  // Show final counts
  const finalCounts = {
    states: await prisma.state.count(),
    districts: await prisma.district.count(),
    mandals: await prisma.mandal.count(),
    stateTranslations: await prisma.stateTranslation.count(),
    districtTranslations: await prisma.districtTranslation.count(),
    mandalTranslations: await prisma.mandalTranslation.count(),
  };

  console.log('Final counts:');
  console.log(JSON.stringify(finalCounts, null, 2));

  await prisma.$disconnect();
}

main().catch(console.error);
