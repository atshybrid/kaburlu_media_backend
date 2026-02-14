import prisma from '../src/lib/prisma';
import { searchGeoLocations } from '../src/api/locations/locations.service';

async function testSpellingMistakes() {
  console.log('\n🧪 Testing Location Search with Spelling Mistakes\n');
  console.log('='.repeat(80));

  const testCases = [
    // Common spelling mistakes
    { query: 'vizag', expected: 'Visakhapatnam' },
    { query: 'guntur', expected: 'Guntur' },
    { query: 'gunttur', expected: 'Guntur' },  // Double consonant
    { query: 'kadapa', expected: 'YSR Kadapa' },
    { query: 'kaddapa', expected: 'YSR Kadapa' }, // Double consonant
    { query: 'tirupathi', expected: 'Tirupati' }, // th vs t
    { query: 'chittoor', expected: 'Chittoor' },
    { query: 'chittor', expected: 'Chittoor' }, // Missing 'o'
    { query: 'nellor', expected: 'SPSR Nellore' }, // Missing 'e'
    { query: 'nellore', expected: 'SPSR Nellore' },
    { query: 'srikakulam', expected: 'Srikakulam' },
    { query: 'shrikakulam', expected: 'Srikakulam' }, // sri vs shri
    { query: 'anantapur', expected: 'Ananthapuramu' }, // Missing 'h'
    { query: 'ananthapuram', expected: 'Ananthapuramu' },
    { query: 'prakasam', expected: 'Prakasam' },
    { query: 'elur', expected: 'Eluru' }, // Missing 'u'
    { query: 'eluru', expected: 'Eluru' },
    { query: 'kurnool', expected: 'Kurnool' },
    { query: 'kurnul', expected: 'Kurnool' }, // Different vowel
    
    // Telugu transliteration variations
    { query: 'vishakapatnam', expected: 'Visakhapatnam' }, // sha vs sa
    { query: 'anakapalli', expected: 'Anakapalli' },
    { query: 'anakapalle', expected: 'Anakapalli' }, // e vs i ending
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    try {
      const results = await searchGeoLocations({
        q: testCase.query,
        limit: 10,
        types: ['DISTRICT']
      });

      const found = results.find(r => 
        r.name.toLowerCase().includes(testCase.expected.toLowerCase()) ||
        testCase.expected.toLowerCase().includes(r.name.toLowerCase())
      );

      if (found) {
        console.log(`✅ "${testCase.query}" → "${found.name}" (expected: ${testCase.expected})`);
        passed++;
      } else {
        console.log(`❌ "${testCase.query}" → No match (expected: ${testCase.expected})`);
        if (results.length > 0) {
          console.log(`   Top result: "${results[0].name}"`);
        }
        failed++;
      }
    } catch (error) {
      console.log(`❌ "${testCase.query}" → Error: ${error}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed (${testCases.length} total)`);
  console.log(`   Success Rate: ${((passed / testCases.length) * 100).toFixed(1)}%`);
  console.log('='.repeat(80) + '\n');

  await prisma.$disconnect();
}

testSpellingMistakes().catch(console.error);
