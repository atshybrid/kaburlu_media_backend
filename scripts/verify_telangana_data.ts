import * as fs from 'fs';
import * as path from 'path';

/**
 * Cross-check all Telangana district JSON files
 */

const EXPECTED_DISTRICTS = 33;

// Official mandal counts (from your correct data)
const OFFICIAL_MANDAL_COUNTS: Record<string, number> = {
  'Adilabad': 18,
  'Bhadradri Kothagudem': 24,
  'Hanumakonda': 14,
  'Hyderabad': 16,
  'Jagtial': 18,
  'Jangaon': 12,
  'Jayashankar Bhupalpally': 12,
  'Jogulamba Gadwal': 12,
  'Kamareddy': 22,
  'Karimnagar': 16,
  'Khammam': 21,
  'Komaram Bheem Asifabad': 12,
  'Mahabubabad': 16,
  'Mahabubnagar': 16,
  'Mancherial': 18,
  'Medak': 18,
  'Medchal–Malkajgiri': 11,
  'Mulugu': 9,
  'Nagarkurnool': 13,
  'Nalgonda': 31,
  'Narayanpet': 9,
  'Nirmal': 19,
  'Nizamabad': 19,
  'Peddapalli': 14,
  'Rajanna Sircilla': 13,
  'Ranga Reddy': 27,
  'Sangareddy': 26,
  'Siddipet': 22,
  'Suryapet': 23,
  'Vikarabad': 18,
  'Wanaparthy': 7,
  'Warangal': 14,
  'Yadadri Bhuvanagiri': 17
};

function main() {
  const locationDir = path.join(__dirname, '../location');
  
  const files = fs.readdirSync(locationDir)
    .filter(f => f.endsWith('.json') && !f.includes('template') && !f.includes('andhra_pradesh'));

  console.log('📊 Telangana Districts & Mandals Data Verification\n');
  console.log(`Expected: ${EXPECTED_DISTRICTS} districts`);
  console.log(`Found: ${files.length} JSON files\n`);
  
  if (files.length !== EXPECTED_DISTRICTS) {
    console.log(`⚠️  WARNING: District count mismatch!\n`);
  }

  let totalMandals = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  const errors: string[] = [];
  const missingDistricts: string[] = [];
  
  // Check which official districts are missing
  for (const districtName of Object.keys(OFFICIAL_MANDAL_COUNTS)) {
    const fileName = `${districtName}.json`;
    if (!files.includes(fileName)) {
      missingDistricts.push(districtName);
    }
  }

  console.log('District Name'.padEnd(35) + 'Expected'.padEnd(12) + 'Actual'.padEnd(12) + 'Status');
  console.log('='.repeat(75));

  for (const file of files.sort()) {
    const filePath = path.join(locationDir, file);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    const districtName = data.district.name_en;
    const actualCount = data.mandals.length;
    const expectedCount = OFFICIAL_MANDAL_COUNTS[districtName];

    totalMandals += actualCount;

    let status = '';
    if (expectedCount === undefined) {
      status = '⚠️  UNKNOWN';
      errors.push(`${districtName}: Not in official list`);
    } else if (actualCount === expectedCount) {
      status = '✅ OK';
      correctCount++;
    } else {
      status = `❌ MISMATCH (off by ${actualCount - expectedCount})`;
      incorrectCount++;
      errors.push(`${districtName}: Expected ${expectedCount}, got ${actualCount}`);
    }

    const expectedStr = expectedCount !== undefined ? expectedCount.toString() : 'N/A';
    console.log(
      districtName.padEnd(35) + 
      expectedStr.padEnd(12) + 
      actualCount.toString().padEnd(12) + 
      status
    );
  }

  console.log('\n' + '='.repeat(75));
  console.log(`\n📈 Summary:`);
  console.log(`   Total Districts: ${files.length}`);
  console.log(`   Total Mandals: ${totalMandals}`);
  console.log(`   Correct: ${correctCount} ✅`);
  console.log(`   Incorrect: ${incorrectCount} ❌`);

  if (missingDistricts.length > 0) {
    console.log(`\n⚠️  Missing Districts:`);
    missingDistricts.forEach(d => console.log(`   - ${d}`));
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errors Found:`);
    errors.forEach(e => console.log(`   - ${e}`));
  } else {
    console.log(`\n✅ All district mandal counts are correct!`);
  }

  // Check for Telugu translations
  console.log(`\n📝 Translation Check:`);
  let missingTranslations = 0;
  for (const file of files) {
    const filePath = path.join(locationDir, file);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    if (!data.district.name_te) {
      console.log(`   ⚠️  ${data.district.name_en}: Missing district Telugu translation`);
      missingTranslations++;
    }

    for (const mandal of data.mandals) {
      if (!mandal.name_te) {
        console.log(`   ⚠️  ${data.district.name_en} > ${mandal.name_en}: Missing Telugu translation`);
        missingTranslations++;
      }
    }
  }

  if (missingTranslations === 0) {
    console.log(`   ✅ All translations present`);
  } else {
    console.log(`   ❌ ${missingTranslations} missing translations`);
  }
}

main();
