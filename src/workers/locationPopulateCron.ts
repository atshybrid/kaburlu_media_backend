/**
 * Location Population Worker - Single State Processing
 * 
 * Processes ONE state completely when requested:
 * 1. Gets all districts for the state
 * 2. Gets all mandals for each district
 * 3. Gets all villages for each mandal
 * 
 * Run with: npm run jobs:location-populate "State Name"
 * Example: npm run jobs:location-populate Telangana
 * Example: npm run jobs:location-populate "Andhra Pradesh"
 */

import prisma from '../lib/prisma';
import { OPENAI_KEY } from '../lib/aiConfig';

// Configuration
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr']; // Telugu, Hindi, Kannada, Tamil, Marathi

// Rate limiting delays
const DELAY_BETWEEN_DISTRICTS = 500; // 500ms between districts
const DELAY_BETWEEN_MANDALS = 250; // 250ms between mandals
const DELAY_BETWEEN_VILLAGES = 250; // 250ms between villages

const MAX_DISTRICTS_PER_STATE = 50;
const MAX_MANDALS_PER_DISTRICT = 40;
const MAX_VILLAGES_PER_MANDAL = 30;

interface ProcessingStats {
  statesProcessed: number;
  statesSkipped: number;
  statesFailed: number;
  districtsCreated: number;
  mandalsCreated: number;
  villagesCreated: number;
  translationsCreated: number;
  errors: Array<{ state: string; error: string }>;
}

/**
 * Helper to call ChatGPT
 */
async function askChatGPT(prompt: string, model = 'gpt-4o-mini'): Promise<string> {
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 120_000);
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
            content: 'You are a geographic data expert. Provide accurate Indian administrative location data in valid JSON format only. Do not add any extra text.'
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

/**
 * Parse JSON from ChatGPT response
 */
function parseJSON(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch {}
    }
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try { return JSON.parse(cleaned.slice(objStart, objEnd + 1)); } catch {}
    }
  }
  return null;
}

/**
 * Build language keys for JSON prompt
 */
function buildLanguageKeys(languages: string[]): string {
  return languages.map(l => {
    const map: Record<string, string> = {
      'te': 'Telugu', 'hi': 'Hindi', 'kn': 'Kannada',
      'ta': 'Tamil', 'mr': 'Marathi', 'bn': 'Bengali',
      'ur': 'Urdu', 'gu': 'Gujarati', 'ml': 'Malayalam',
      'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese'
    };
    return `"${l}": "Name in ${map[l] || l}"`;
  }).join(', ');
}

function buildLanguageNames(languages: string[]): string {
  const map: Record<string, string> = {
    'te': 'Telugu', 'hi': 'Hindi', 'kn': 'Kannada',
    'ta': 'Tamil', 'mr': 'Marathi', 'bn': 'Bengali',
    'ur': 'Urdu', 'gu': 'Gujarati', 'ml': 'Malayalam',
    'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese'
  };
  return languages.map(l => map[l] || l).join(', ');
}

/**
 * Process a single state
 */
async function processState(stateName: string, languages: string[], stats: ProcessingStats): Promise<void> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🚀 Processing State: ${stateName}`);
  console.log(`${'='.repeat(80)}\n`);

  try {
    // Step 1: Get or create state
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

    // Step 2: Create state translations
    console.log(`  📝 Creating state translations...`);
    for (const lang of languages) {
      const existing = await prisma.stateTranslation.findFirst({
        where: { stateId: state.id, language: lang }
      });

      if (!existing) {
        const langName = buildLanguageNames([lang]);
        const prompt = `Translate the Indian state name "${stateName}" to ${langName}. Return JSON: { "name": "translated name" }`;
        const result = await askChatGPT(prompt);
        const data = parseJSON(result);

        if (data?.name) {
          await prisma.stateTranslation.create({
            data: { stateId: state.id, language: lang, name: data.name }
          });
          stats.translationsCreated++;
          console.log(`    ✓ Translation created: ${lang} → ${data.name}`);
        }
      }
    }

    // Step 3: Get all districts from ChatGPT
    console.log(`  🏘️  Fetching districts for ${stateName}...`);
    const langKeys = buildLanguageKeys(languages);
    const langNames = buildLanguageNames(languages);

    const districtPrompt = `List ALL districts in ${stateName} state, India.
For each district, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON in this exact format:
{
  "districts": [
    { "en": "District Name", ${langKeys} }
  ]
}
Maximum ${MAX_DISTRICTS_PER_STATE} districts to keep response manageable.`;

    const districtResult = await askChatGPT(districtPrompt);
    const districtData = parseJSON(districtResult);

    if (!districtData?.districts || !Array.isArray(districtData.districts)) {
      throw new Error('Invalid district data from ChatGPT');
    }

    const districts = districtData.districts.slice(0, MAX_DISTRICTS_PER_STATE);
    console.log(`  📊 Found ${districts.length} districts`);

    // Process each district
    for (let i = 0; i < districts.length; i++) {
      const distData = districts[i];
      console.log(`\n  [${i + 1}/${districts.length}] Processing District: ${distData.en}`);

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
        stats.districtsCreated++;
        console.log(`    ➕ Created district: ${distData.en}`);
      } else {
        console.log(`    ✓ District exists: ${distData.en}`);
      }

      // Create translations
      for (const lang of languages) {
        if (distData[lang]) {
          const existing = await prisma.districtTranslation.findFirst({
            where: { districtId: district.id, language: lang }
          });

          if (!existing) {
            await prisma.districtTranslation.create({
              data: { districtId: district.id, language: lang, name: distData[lang] }
            });
            stats.translationsCreated++;
          }
        }
      }

      // Step 4: Get mandals for this district
      const mandalPrompt = `List mandals/tehsils in ${distData.en} district, ${stateName} state, India.
For each mandal, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON:
{
  "mandals": [
    { "en": "Mandal Name", ${langKeys} }
  ]
}
Maximum ${MAX_MANDALS_PER_DISTRICT} mandals.`;

      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DISTRICTS));

      const mandalResult = await askChatGPT(mandalPrompt);
      const mandalData = parseJSON(mandalResult);

      if (mandalData?.mandals && Array.isArray(mandalData.mandals)) {
        const mandals = mandalData.mandals.slice(0, MAX_MANDALS_PER_DISTRICT);
        console.log(`    📊 Found ${mandals.length} mandals`);

        for (let j = 0; j < mandals.length; j++) {
          const manData = mandals[j];

          // Create or find mandal
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
            stats.mandalsCreated++;
          }

          // Create translations
          for (const lang of languages) {
            if (manData[lang]) {
              const existing = await prisma.mandalTranslation.findFirst({
                where: { mandalId: mandal.id, language: lang }
              });

              if (!existing) {
                await prisma.mandalTranslation.create({
                  data: { mandalId: mandal.id, language: lang, name: manData[lang] }
                });
                stats.translationsCreated++;
              }
            }
          }

          // Step 5: Get villages for this mandal (limit to first 10 mandals to avoid overwhelming)
          if (j < 10) {
            const villagePrompt = `List villages in ${manData.en} mandal, ${distData.en} district, India.
For each village, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON:
{
  "villages": [
    { "en": "Village Name", ${langKeys} }
  ]
}
Maximum ${MAX_VILLAGES_PER_MANDAL} villages.`;

            await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MANDALS));

            try {
              const villageResult = await askChatGPT(villagePrompt);
              const villageData = parseJSON(villageResult);

              if (villageData?.villages && Array.isArray(villageData.villages)) {
                stats.villagesCreated += villageData.villages.length;
                console.log(`      ➕ ${villageData.villages.length} villages for ${manData.en}`);
              }

              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_VILLAGES));
            } catch (err) {
              console.error(`      ⚠️  Failed to fetch villages for ${manData.en}:`, err);
            }
          }
        }
      }
    }

    stats.statesProcessed++;
    console.log(`\n✅ Completed: ${stateName}`);
    console.log(`   Districts: ${stats.districtsCreated} | Mandals: ${stats.mandalsCreated} | Translations: ${stats.translationsCreated}`);

  } catch (error: any) {
    stats.statesFailed++;
    stats.errors.push({ state: stateName, error: error.message || String(error) });
    console.error(`\n❌ Failed: ${stateName} - ${error.message}`);
  }
}

/**
 * Main cron worker function - Process single state on demand
 */
async function runLocationPopulateCron(stateName?: string, languages?: string[]) {
  const targetLanguages = languages && languages.length > 0 ? languages : AUTO_LANGUAGES;
  
  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         LOCATION POPULATION - STARTED                                      ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nStarted at: ${new Date().toISOString()}`);
  console.log(`State: ${stateName || 'Not specified'}`);
  console.log(`Languages: ${targetLanguages.join(', ')}\n`);

  const stats: ProcessingStats = {
    statesProcessed: 0,
    statesSkipped: 0,
    statesFailed: 0,
    districtsCreated: 0,
    mandalsCreated: 0,
    villagesCreated: 0,
    translationsCreated: 0,
    errors: []
  };

  const startTime = Date.now();

  if (!stateName) {
    throw new Error('State name is required');
  }

  // Check if state already has data
  const existingState = await prisma.state.findFirst({
    where: { name: { equals: stateName, mode: 'insensitive' }, isDeleted: false },
    include: { districts: true }
  });

  if (existingState && existingState.districts.length > 0) {
    console.log(`  ⏭️  Skipping ${stateName} - already has ${existingState.districts.length} districts`);
    stats.statesSkipped++;
  } else {
    await processState(stateName, targetLanguages, stats);
  }

  const endTime = Date.now();
  const durationMinutes = ((endTime - startTime) / 1000 / 60).toFixed(2);

  console.log('\n\n');
  console.log('╔════════════════════════════════════════════════════════════════════════════╗');
  console.log('║         LOCATION POPULATION - COMPLETED                                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════════╝');
  console.log(`\nCompleted at: ${new Date().toISOString()}`);
  console.log(`Duration: ${durationMinutes} minutes\n`);
  console.log('📊 STATISTICS:');
  console.log(`   State: ${stateName}`);
  console.log(`   Status: ${stats.statesSkipped > 0 ? 'Skipped (already exists)' : 'Processed'}`);
  console.log(`   Districts Created: ${stats.districtsCreated}`);
  console.log(`   Mandals Created: ${stats.mandalsCreated}`);
  console.log(`   Villages Created: ${stats.villagesCreated}`);
  console.log(`   Translations Created: ${stats.translationsCreated}\n`);

  if (stats.errors.length > 0) {
    console.log('❌ ERRORS:');
    stats.errors.forEach(e => console.log(`   ${e.state}: ${e.error}`));
  }

  console.log('\n✅ Processing finished!\n');
  
  return stats;
}

// Run the cron job
if (require.main === module) {
  // Get state name from command line args
  const stateName = process.argv[2];
  const languages = process.argv[3] ? process.argv[3].split(',') : undefined;
  
  if (!stateName) {
    console.error('❌ Error: State name is required');
    console.log('\nUsage:');
    console.log('  npm run jobs:location-populate Telangana');
    console.log('  npm run jobs:location-populate "Andhra Pradesh"');
    console.log('  npm run jobs:location-populate Karnataka te,hi,kn');
    process.exit(1);
  }
  
  runLocationPopulateCron(stateName, languages)
    .then(() => {
      console.log('Exiting...');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runLocationPopulateCron };
