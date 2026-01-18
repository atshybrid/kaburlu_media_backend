/**
 * Resume populating mandals for districts that don't have any yet
 * Uses production-grade prompts with better error handling
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
  return resp?.data?.choices?.[0]?.message?.content || '';
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
  console.log('🔄 Resuming Mandal Population for Remaining Districts\n');
  console.log('='.repeat(70));

  const telangana = await prisma.state.findFirst({
    where: { name: 'Telangana' }
  });

  if (!telangana) {
    throw new Error('Telangana state not found');
  }

  // Get districts without mandals
  const districts = await prisma.district.findMany({
    where: {
      stateId: telangana.id,
      isDeleted: false
    },
    include: {
      _count: { select: { mandals: true } }
    },
    orderBy: { name: 'asc' }
  });

  const needMandals = districts.filter(d => d._count.mandals === 0);
  
  console.log(`\n📊 Status: ${districts.length - needMandals.length}/${districts.length} districts completed`);
  console.log(`📋 Processing ${needMandals.length} districts without mandals\n`);
  console.log('='.repeat(70));

  let totalCreated = 0;

  for (let i = 0; i < needMandals.length; i++) {
    const district = needMandals[i];
    console.log(`\n[${i + 1}/${needMandals.length}] 📍 ${district.name}`);
    console.log('─'.repeat(70));

    try {
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

      console.log(`   ⏳ Calling AI for mandals...`);
      const mandalResult = await askChatGPT(mandalPrompt);
      const mandalData = parseJSON(mandalResult);

      if (!mandalData?.mandals || !Array.isArray(mandalData.mandals)) {
        console.log(`   ❌ Invalid AI response - skipping`);
        continue;
      }

      console.log(`   ✓ AI returned ${mandalData.mandals.length} mandals`);

      if (mandalData.mandals.length === 0) {
        console.log(`   ⚠️  No mandals returned - skipping`);
        continue;
      }

      // Translate
      const mandalNames = mandalData.mandals.map((m: any) => m.mandalName);
      console.log(`   🤖 Translating to 5 languages...`);
      
      let mandalTrans: any = null;
      try {
        mandalTrans = await translateNames(mandalNames, AUTO_LANGUAGES);
      } catch (err: any) {
        console.log(`   ⚠️  Translation failed: ${err.message} - continuing without translations`);
      }

      // Create mandals
      let created = 0;
      for (const mand of mandalData.mandals) {
        try {
          const mandal = await prisma.mandal.create({
            data: {
              name: mand.mandalName,
              districtId: district.id,
              isDeleted: false
            }
          });
          created++;

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

      totalCreated += created;
      console.log(`   ✅ Created ${created} mandals`);

      // Delay to avoid rate limits
      if (i < needMandals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

    } catch (err: any) {
      console.log(`   ❌ Error processing ${district.name}: ${err.message}`);
      console.log(`   Continuing to next district...`);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`\n✅ COMPLETED!`);
  console.log(`   📍 Processed: ${needMandals.length} districts`);
  console.log(`   🏢 Created: ${totalCreated} mandals\n`);
}

main()
  .catch((e) => {
    console.error('\n❌ Fatal Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
