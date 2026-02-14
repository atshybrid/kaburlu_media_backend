/**
 * Cleanup script: Fix location records that have non-English (Telugu/Hindi) in primary name field
 * 
 * This script:
 * 1. Finds all locations with non-ASCII characters in the primary name field
 * 2. Translates them to English using AI
 * 3. Updates the primary name to English
 * 4. Ensures translation record exists for the original language
 * 
 * Run: npx ts-node scripts/fix-telugu-location-names.ts
 */

import prisma from '../src/lib/prisma';
import { aiGenerateText } from '../src/lib/aiProvider';

interface LocationToFix {
  id: string;
  name: string;
  type: 'state' | 'district' | 'mandal' | 'village';
  stateId?: string;
  stateName?: string;
  districtId?: string;
}

function detectLanguage(text: string): string {
  // Telugu Unicode range: \u0C00-\u0C7F
  // Hindi/Devanagari: \u0900-\u097F
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te';
  if (/[\u0900-\u097F]/.test(text)) return 'hi';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn'; // Kannada
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta'; // Tamil
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml'; // Malayalam
  return 'unknown';
}

async function translateToEnglish(
  nativeName: string,
  languageCode: string,
  locationType: string,
  stateName?: string
): Promise<string> {
  const languageMap: { [key: string]: string } = {
    'te': 'Telugu',
    'hi': 'Hindi',
    'kn': 'Kannada',
    'ta': 'Tamil',
    'ml': 'Malayalam'
  };

  const sourceLang = languageMap[languageCode] || languageCode.toUpperCase();

  const prompt = `Translate this ${sourceLang} location name to English:

${sourceLang}: ${nativeName}
Location Type: ${locationType}
${stateName ? `State: ${stateName}` : ''}

Provide ONLY the English name, nothing else. Use proper English spelling.`;

  const response = await aiGenerateText({
    prompt,
    purpose: 'translation'
  });

  return response.text.trim().replace(/['"]/g, '');
}

async function fixStates() {
  console.log('\n📍 Checking States...');
  
  const states = await prisma.state.findMany({
    where: { isDeleted: false },
    include: { translations: true }
  });

  const toFix: LocationToFix[] = [];
  
  for (const state of states) {
    const hasNonEnglish = /[^\x00-\x7F]/.test(state.name);
    if (hasNonEnglish) {
      toFix.push({
        id: state.id,
        name: state.name,
        type: 'state'
      });
    }
  }

  console.log(`Found ${toFix.length} states with non-English names`);

  for (const item of toFix) {
    const langCode = detectLanguage(item.name);
    if (langCode === 'unknown') {
      console.log(`⚠️  Skipping ${item.name} - unknown language`);
      continue;
    }

    console.log(`\n🔧 Fixing state: ${item.name} (${langCode})`);
    
    const englishName = await translateToEnglish(item.name, langCode, 'state');
    console.log(`   → English: ${englishName}`);

    // Update primary name to English
    await prisma.state.update({
      where: { id: item.id },
      data: { name: englishName }
    });

    // Ensure translation exists
    await prisma.stateTranslation.upsert({
      where: {
        stateId_language: {
          stateId: item.id,
          language: langCode
        }
      },
      create: {
        stateId: item.id,
        language: langCode,
        name: item.name
      },
      update: {
        name: item.name
      }
    });

    console.log(`   ✅ Fixed`);
  }
}

async function fixDistricts() {
  console.log('\n📍 Checking Districts...');
  
  const districts = await prisma.district.findMany({
    where: { isDeleted: false },
    include: { 
      translations: true,
      state: true 
    }
  });

  const toFix: LocationToFix[] = [];
  
  for (const district of districts) {
    const hasNonEnglish = /[^\x00-\x7F]/.test(district.name);
    if (hasNonEnglish) {
      toFix.push({
        id: district.id,
        name: district.name,
        type: 'district',
        stateId: district.stateId,
        stateName: district.state?.name
      });
    }
  }

  console.log(`Found ${toFix.length} districts with non-English names`);

  for (const item of toFix) {
    const langCode = detectLanguage(item.name);
    if (langCode === 'unknown') {
      console.log(`⚠️  Skipping ${item.name} - unknown language`);
      continue;
    }

    console.log(`\n🔧 Fixing district: ${item.name} (${langCode})`);
    
    const englishName = await translateToEnglish(
      item.name, 
      langCode, 
      'district', 
      item.stateName
    );
    console.log(`   → English: ${englishName}`);

    // Update primary name to English
    await prisma.district.update({
      where: { id: item.id },
      data: { name: englishName }
    });

    // Ensure translation exists
    await prisma.districtTranslation.upsert({
      where: {
        districtId_language: {
          districtId: item.id,
          language: langCode
        }
      },
      create: {
        districtId: item.id,
        language: langCode,
        name: item.name
      },
      update: {
        name: item.name
      }
    });

    console.log(`   ✅ Fixed`);
  }
}

async function fixMandals() {
  console.log('\n📍 Checking Mandals...');
  
  const mandals = await prisma.mandal.findMany({
    where: { isDeleted: false },
    include: { 
      translations: true,
      district: {
        include: { state: true }
      }
    }
  });

  const toFix: LocationToFix[] = [];
  
  for (const mandal of mandals) {
    const hasNonEnglish = /[^\x00-\x7F]/.test(mandal.name);
    if (hasNonEnglish) {
      toFix.push({
        id: mandal.id,
        name: mandal.name,
        type: 'mandal',
        districtId: mandal.districtId,
        stateName: mandal.district?.state?.name
      });
    }
  }

  console.log(`Found ${toFix.length} mandals with non-English names`);

  for (const item of toFix) {
    const langCode = detectLanguage(item.name);
    if (langCode === 'unknown') {
      console.log(`⚠️  Skipping ${item.name} - unknown language`);
      continue;
    }

    console.log(`\n🔧 Fixing mandal: ${item.name} (${langCode})`);
    
    const englishName = await translateToEnglish(
      item.name, 
      langCode, 
      'mandal', 
      item.stateName
    );
    console.log(`   → English: ${englishName}`);

    // Update primary name to English
    await prisma.mandal.update({
      where: { id: item.id },
      data: { name: englishName }
    });

    // Ensure translation exists
    await prisma.mandalTranslation.upsert({
      where: {
        mandalId_language: {
          mandalId: item.id,
          language: langCode
        }
      },
      create: {
        mandalId: item.id,
        language: langCode,
        name: item.name
      },
      update: {
        name: item.name
      }
    });

    console.log(`   ✅ Fixed`);
  }
}

async function fixVillages() {
  console.log('\n📍 Checking Villages...');
  
  const villages = await prisma.village.findMany({
    where: { isDeleted: false },
    include: { 
      translations: true,
      mandal: {
        include: {
          district: {
            include: { state: true }
          }
        }
      }
    }
  });

  const toFix: LocationToFix[] = [];
  
  for (const village of villages) {
    const hasNonEnglish = /[^\x00-\x7F]/.test(village.name);
    if (hasNonEnglish) {
      toFix.push({
        id: village.id,
        name: village.name,
        type: 'village',
        stateName: village.mandal?.district?.state?.name
      });
    }
  }

  console.log(`Found ${toFix.length} villages with non-English names`);

  for (const item of toFix) {
    const langCode = detectLanguage(item.name);
    if (langCode === 'unknown') {
      console.log(`⚠️  Skipping ${item.name} - unknown language`);
      continue;
    }

    console.log(`\n🔧 Fixing village: ${item.name} (${langCode})`);
    
    const englishName = await translateToEnglish(
      item.name, 
      langCode, 
      'village', 
      item.stateName
    );
    console.log(`   → English: ${englishName}`);

    // Update primary name to English
    await prisma.village.update({
      where: { id: item.id },
      data: { name: englishName }
    });

    // Ensure translation exists
    await prisma.villageTranslation.upsert({
      where: {
        villageId_language: {
          villageId: item.id,
          language: langCode
        }
      },
      create: {
        villageId: item.id,
        language: langCode,
        name: item.name
      },
      update: {
        name: item.name
      }
    });

    console.log(`   ✅ Fixed`);
  }
}

async function main() {
  console.log('🚀 Starting location name cleanup...\n');
  console.log('This script will:');
  console.log('  1. Find locations with non-English names in primary field');
  console.log('  2. Translate them to English using AI');
  console.log('  3. Update primary name to English');
  console.log('  4. Preserve original as translation\n');

  try {
    await fixStates();
    await fixDistricts();
    await fixMandals();
    await fixVillages();

    console.log('\n✅ Cleanup completed successfully!');
  } catch (error: any) {
    console.error('\n❌ Error during cleanup:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
