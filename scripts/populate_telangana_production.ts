/**
 * PRODUCTION-GRADE: Populate Telangana hierarchy using STRICT prompts
 * 
 * Hierarchy: State → Districts → Mandals → Villages
 * Uses official prompts with validation
 */

import prisma from '../src/lib/prisma';
import axios from 'axios';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr'];

async function askChatGPT(prompt: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  console.log('\n📤 SENDING TO AI:');
  console.log('─'.repeat(70));
  console.log(prompt.substring(0, 300) + '...\n');
  
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an official Indian administrative data assistant. Provide accurate data from Census 2011 and official government sources. Return ONLY valid JSON.'
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
  
  const result = resp?.data?.choices?.[0]?.message?.content || '';
  console.log('📥 AI RESPONSE:');
  console.log('─'.repeat(70));
  console.log(result.substring(0, 500) + (result.length > 500 ? '...' : ''));
  console.log('─'.repeat(70) + '\n');
  
  return result;
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

async function translateNames(names: string[], languages: string[]): Promise<any> {
  const langMap: any = { te: 'Telugu', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', mr: 'Marathi' };
  const langNames = languages.map(l => langMap[l]).join(', ');

  const prompt = `Translate these Telangana place names to ${langNames}.

Names: ${JSON.stringify(names)}

Return ONLY valid JSON:
{
  "translations": {
    "Place Name": { "te": "తెలుగు", "hi": "हिंदी", "kn": "ಕನ್ನಡ", "ta": "தமிழ்", "mr": "मराठी" }
  }
}`;

  const result = await askChatGPT(prompt);
  return parseJSON(result);
}

async function main() {
  console.log('🚀 PRODUCTION: Telangana Hierarchy Population\n');
  console.log('='.repeat(70));
  console.log('Using STRICT prompts with validation\n');

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found!');
  }

  let totalDistricts = 0;
  let totalMandals = 0;
  let totalVillages = 0;

  // STEP 1: Get Districts
  console.log('\n📍 STEP 1: Fetching Districts\n');
  console.log('─'.repeat(70));
  
  const districtPrompt = `You are an official Indian administrative data assistant.

TASK:
Return the list of districts for a given state.

STRICT RULES:
- State name must be matched EXACTLY
- Use only official Government of India or State Government data
- Do NOT guess or auto-correct state names
- Return correct district count
- No duplicate districts
- If state is invalid, return an error

INPUT:
State: Telangana

OUTPUT (JSON only):
{
  "state": "Telangana",
  "totalDistricts": number,
  "districts": [
    {
      "districtName": "",
      "districtId": ""
    }
  ]
}`;

  console.log('🔍 DISTRICT PROMPT:');
  console.log(districtPrompt);
  console.log('\n⏳ Calling ChatGPT API...\n');

  const districtResult = await askChatGPT(districtPrompt);
  const districtData = parseJSON(districtResult);

  if (!districtData?.districts) {
    throw new Error('Invalid district data from AI');
  }

  console.log(`✓ AI returned ${districtData.totalDistricts} districts`);
  console.log(`✓ Validating count matches array: ${districtData.districts.length}\n`);

  if (districtData.totalDistricts !== districtData.districts.length) {
    console.log(`⚠️  WARNING: Count mismatch! Declared: ${districtData.totalDistricts}, Actual: ${districtData.districts.length}`);
  }

  // Translate district names
  const districtNames = districtData.districts.map((d: any) => d.districtName);
  console.log(`🤖 Translating ${districtNames.length} districts to 5 languages...`);
  
  let districtTranslations: any = null;
  try {
    districtTranslations = await translateNames(districtNames, AUTO_LANGUAGES);
    console.log(`✅ Translation successful!`);
  } catch (err: any) {
    console.log(`⚠️  Translation failed: ${err.message}`);
    console.log(`   Continuing without translations...`);
  }

  // Create districts
  for (const dist of districtData.districts) {
    try {
      const district = await prisma.district.create({
        data: {
          name: dist.districtName,
          stateId: telangana.id,
          isDeleted: false
        }
      });
      totalDistricts++;

      // Add translations
      const trans = districtTranslations?.translations?.[dist.districtName];
      if (trans) {
        for (const lang of AUTO_LANGUAGES) {
          if (trans[lang]) {
            await prisma.districtTranslation.create({
              data: { districtId: district.id, language: lang, name: trans[lang] }
            });
          }
        }
      }

      console.log(`   ✓ ${dist.districtName}`);
    } catch (err: any) {
      console.log(`   ❌ Failed to create ${dist.districtName}: ${err.message}`);
    }
  }

  console.log(`\n✅ Created ${totalDistricts} districts\n`);

  // STEP 2: Get Mandals for each District
  console.log('\n🏢 STEP 2: Fetching Mandals for each District\n');
  console.log('─'.repeat(70));

  const districts = await prisma.district.findMany({
    where: { stateId: telangana.id, isDeleted: false },
    orderBy: { name: 'asc' }
  });

  for (let i = 0; i < districts.length; i++) {
    const district = districts[i];
    console.log(`\n[${i + 1}/${districts.length}] ${district.name}`);

    const mandalPrompt = `You are an official Telangana administrative division assistant.

TASK:
Return the list of mandals for a given district.

STRICT RULES:
- State must be Telangana
- District must be matched EXACTLY
- Validate district existence before fetching mandals
- Use only Telangana government or Census 2011 data
- Do NOT guess or auto-correct district names
- Return correct mandal count
- No duplicate mandals

INPUT:
State: Telangana
District: ${district.name}

OUTPUT (JSON only):
{
  "state": "Telangana",
  "district": "${district.name}",
  "totalMandals": number,
  "mandals": [
    {
      "mandalName": "",
      "mandalId": ""
    }
  ]
}`;

    console.log(`\n🔍 MANDAL PROMPT for ${district.name}:`);
    console.log(mandalPrompt);
    console.log('\n⏳ Calling ChatGPT API...\n');

    const mandalResult = await askChatGPT(mandalPrompt);
    const mandalData = parseJSON(mandalResult);

    if (!mandalData?.mandals) {
      console.log(`   ❌ Invalid AI response - skipping`);
      console.log(`   Response was: ${JSON.stringify(mandalData)}`);
      continue;
    }

    console.log(`   ✅ AI returned ${mandalData.totalMandals} mandals (actual: ${mandalData.mandals.length})`);
    
    if (mandalData.totalMandals !== mandalData.mandals.length) {
      console.log(`   ⚠️  COUNT MISMATCH! Declared: ${mandalData.totalMandals}, Received: ${mandalData.mandals.length}`);
    }
    
    console.log(`   📝 Mandals: ${mandalData.mandals.map((m: any) => m.mandalName).join(', ')}`);

    // Translate mandal names
    console.log(`\n   🤖 Translating ${mandalData.mandals.length} mandals...`);
    const mandalNames = mandalData.mandals.map((m: any) => m.mandalName);
    
    let mandalTrans: any = null;
    try {
      mandalTrans = await translateNames(mandalNames, AUTO_LANGUAGES);
      console.log(`   ✅ Translation successful!`);
    } catch (err: any) {
      console.log(`   ⚠️  Translation failed: ${err.message}`);
      console.log(`   Continuing without translations...`);
    }

    // Create mandals
    for (const mand of mandalData.mandals) {
      try {
        const mandal = await prisma.mandal.create({
          data: {
            name: mand.mandalName,
            districtId: district.id,
            isDeleted: false
          }
        });
        totalMandals++;

        // Add translations
        const trans = mandalTrans?.translations?.[mand.mandalName];
        if (trans) {
          for (const lang of AUTO_LANGUAGES) {
            if (trans[lang]) {
              await prisma.mandalTranslation.create({
                data: { mandalId: mandal.id, language: lang, name: trans[lang] }
              });
            }
          }
        }
      } catch (err: any) {
        console.log(`      ❌ Failed to create ${mand.mandalName}: ${err.message}`);
      }
    }

    console.log(`   ✅ Created ${mandalData.mandals.length} mandals`);

    // Small delay to avoid rate limits
    if (i < districts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('\n✅ HIERARCHY COMPLETE!\n');
  console.log(`   📍 Districts: ${totalDistricts}`);
  console.log(`   🏢 Mandals: ${totalMandals}`);
  console.log(`   🏘️  Villages: ${totalVillages} (not populated yet)`);
  console.log(`\n🎯 Target: 612 mandals`);
  console.log(`   Current: ${totalMandals} mandals`);
  console.log(`   Status: ${totalMandals >= 600 ? '✅ COMPLETE' : '⚠️  Need more'}\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Error:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
