/**
 * BEST PRACTICE: Seed Telangana mandals from verified JSON + AI translations
 * 
 * Approach:
 * 1. Load verified mandal names from JSON files (official data)
 * 2. Use AI ONLY for Telugu/Hindi translations of verified names
 * 3. Store with proper associations
 * 
 * To add more districts:
 * - Create location/{district}_mandals.json with verified mandal names
 * - Add to DISTRICT_FILES array below
 */

import prisma from '../src/lib/prisma';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr'];

// List all JSON files for districts
const DISTRICT_FILES = [
  { district: 'Adilabad', file: 'adilabad_mandals.json' }
  // Add more as you create them:
  // { district: 'Hyderabad', file: 'hyderabad_mandals.json' },
  // { district: 'Warangal', file: 'warangal_mandals.json' },
];

async function askChatGPT(prompt: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a Telugu language expert. Provide accurate translations for Indian place names. Return only valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
    }
  );
  return resp?.data?.choices?.[0]?.message?.content || '';
}

function parseJSON(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

async function translateMandals(mandalNames: string[], languages: string[]): Promise<any> {
  const langNames = languages.map(l => {
    const map: any = { te: 'Telugu', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', mr: 'Marathi' };
    return map[l] || l;
  }).join(', ');

  const prompt = `Translate these Telangana mandal names from English to ${langNames}.
Mandals: ${JSON.stringify(mandalNames)}

Return ONLY valid JSON in this format:
{
  "translations": {
    "Mandal Name": { "te": "తెలుగు", "hi": "हिंदी", "kn": "ಕನ್ನಡ", "ta": "தமிழ்", "mr": "मराठी" }
  }
}`;

  const result = await askChatGPT(prompt);
  return parseJSON(result);
}

async function main() {
  console.log('📚 BEST PRACTICE: Seeding from Official JSON + AI Translations\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found');
  }

  let totalMandals = 0;

  for (const { district: districtName, file } of DISTRICT_FILES) {
    console.log(`\n📍 ${districtName}`);
    console.log('─'.repeat(70));

    // Find district
    const district = await prisma.district.findFirst({
      where: {
        name: { equals: districtName, mode: 'insensitive' },
        stateId: telangana.id,
        isDeleted: false
      }
    });

    if (!district) {
      console.log(`   ❌ District not found in database - skipping`);
      continue;
    }

    // Load verified JSON data
    const jsonPath = path.join(__dirname, '..', 'location', file);
    if (!fs.existsSync(jsonPath)) {
      console.log(`   ❌ JSON file not found: ${file}`);
      continue;
    }

    const mandalData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`   ✓ Loaded ${mandalData.length} verified mandals from JSON`);

    // Extract mandal names
    const mandalNames = mandalData.map((m: any) => m.name);

    // Get translations from AI (batch request for efficiency)
    console.log(`   🤖 Translating ${mandalNames.length} mandals to 5 languages...`);
    const translationResult = await translateMandals(mandalNames, AUTO_LANGUAGES);

    if (!translationResult?.translations) {
      console.log(`   ❌ Translation failed - skipping`);
      continue;
    }

    const translations = translationResult.translations;

    // Create mandals with translations
    for (const mandalInfo of mandalData) {
      const mandalName = mandalInfo.name;

      // Create mandal
      const mandal = await prisma.mandal.create({
        data: {
          name: mandalName,
          districtId: district.id,
          isDeleted: false
        }
      });

      totalMandals++;

      // Create translations
      const mandalTranslations = translations[mandalName];
      if (mandalTranslations) {
        for (const lang of AUTO_LANGUAGES) {
          if (mandalTranslations[lang]) {
            await prisma.mandalTranslation.create({
              data: {
                mandalId: mandal.id,
                language: lang,
                name: mandalTranslations[lang]
              }
            });
          }
        }
      }

      console.log(`      ✓ ${mandalName}`);
    }

    console.log(`   ✅ Created ${mandalData.length} mandals`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ SEED COMPLETE!`);
  console.log(`   📍 Total mandals created: ${totalMandals}`);
  console.log(`   🌐 Translations per mandal: ${AUTO_LANGUAGES.length}`);
  console.log(`\n📝 To add more districts:`);
  console.log(`   1. Create location/{district}_mandals.json with verified data`);
  console.log(`   2. Add to DISTRICT_FILES array in this script`);
  console.log(`   3. Run: npx ts-node scripts/seed_from_json.ts\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
