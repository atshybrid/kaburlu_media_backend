/**
 * Populate mandals for all Telangana districts using AI
 * This will create mandals + villages for each district that has none
 */

import prisma from '../src/lib/prisma';
import axios from 'axios';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr'];

async function askChatGPT(prompt: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
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
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch {}
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Populating Telangana Mandals & Villages\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found!');
  }

  const districts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    orderBy: { name: 'asc' }
  });

  console.log(`\n📍 Found ${districts.length} districts in Telangana`);
  console.log(`🌐 Will generate data in: English, Telugu, Hindi, Kannada, Tamil, Marathi\n`);

  const langNames = 'Telugu, Hindi, Kannada, Tamil, Marathi';
  const langKeys = 'te, hi, kn, ta, mr';

  let totalMandals = 0;
  let totalVillages = 0;

  for (let i = 0; i < districts.length; i++) {
    const district = districts[i];
    console.log(`\n[${i + 1}/${districts.length}] 📍 ${district.name}`);
    console.log('─'.repeat(70));

    // Check if mandals already exist
    const existingMandals = await prisma.mandal.count({
      where: { districtId: district.id, isDeleted: false }
    });

    if (existingMandals > 0) {
      console.log(`   ✓ Already has ${existingMandals} mandals - SKIPPING`);
      totalMandals += existingMandals;
      continue;
    }

    // Fetch mandals from ChatGPT
    console.log(`   🤖 Fetching ALL mandals from AI...`);
    
    const mandalPrompt = `List ALL mandals/tehsils in ${district.name} district, Telangana state, India.
Telangana has 612 mandals total across 33 districts. Provide COMPLETE list for ${district.name} district.
For each mandal, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON in this exact format:
{
  "mandals": [
    { "en": "Mandal Name", "te": "తెలుగు", "hi": "हिंदी", "kn": "ಕನ್ನಡ", "ta": "தமிழ்", "mr": "मराठी" }
  ]
}
IMPORTANT: Include ALL mandals for this district (some districts have 50+ mandals).`;

    const mandalResult = await askChatGPT(mandalPrompt);
    const mandalData = parseJSON(mandalResult);

    if (!mandalData?.mandals || !Array.isArray(mandalData.mandals)) {
      console.log(`   ❌ Invalid AI response - skipping`);
      continue;
    }

    const mandals = mandalData.mandals; // Get ALL mandals
    console.log(`   ✓ Got ${mandals.length} mandals from AI`);

    // Create each mandal
    for (const mandalInfo of mandals) {
      const mandal = await prisma.mandal.create({
        data: { 
          name: mandalInfo.en, 
          districtId: district.id, 
          isDeleted: false 
        }
      });

      totalMandals++;

      // Create translations
      for (const lang of AUTO_LANGUAGES) {
        if (mandalInfo[lang]) {
          await prisma.mandalTranslation.create({
            data: { 
              mandalId: mandal.id, 
              language: lang, 
              name: mandalInfo[lang] 
            }
          });
        }
      }

      console.log(`      ✓ ${mandalInfo.en} (+ ${AUTO_LANGUAGES.length} translations)`);
    }

    // Small delay to avoid rate limits
    if (i < districts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ COMPLETED!`);
  console.log(`   📍 Processed: ${districts.length} districts`);
  console.log(`   📍 Created: ${totalMandals} mandals`);
  console.log(`   🌐 Translations: ${totalMandals * AUTO_LANGUAGES.length}\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
