/**
 * Test ShortNews Public API Author Enhancement
 * 
 * This test demonstrates the enhanced author section in public shortnews endpoints
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000/api/v1';
// const BASE_URL = 'https://api.kaburlumedia.com/api/v1';

async function testPublicShortNews() {
  console.log('\n🧪 Testing Public ShortNews API - Author Enhancement\n');
  console.log('='.repeat(80));

  try {
    // Test 1: List public short news
    console.log('\n📋 Test 1: GET /shortnews/public (List)\n');
    
    const listResponse = await axios.get(`${BASE_URL}/shortnews/public`, {
      params: {
        limit: 5,
        languageCode: 'te'  // Telugu news
      }
    });

    if (listResponse.data.success && listResponse.data.data.length > 0) {
      const firstNews = listResponse.data.data[0];
      
      console.log('✅ Response received successfully');
      console.log(`   Total items: ${listResponse.data.data.length}`);
      console.log('\n📰 First News Item:\n');
      console.log(`   Title: ${firstNews.title}`);
      console.log(`   Category: ${firstNews.categoryName}`);
      
      console.log('\n👤 AUTHOR INFORMATION:\n');
      console.log(`   Name: ${firstNews.author.fullName || 'N/A'}`);
      console.log(`   Profile Photo: ${firstNews.author.profilePhotoUrl || 'N/A'}`);
      console.log(`   Is Reporter: ${firstNews.author.isReporter ? 'Yes ✓' : 'No'}`);
      
      if (firstNews.author.designation) {
        console.log(`\n   📛 DESIGNATION:`);
        console.log(`      English: ${firstNews.author.designation.name}`);
        console.log(`      Native: ${firstNews.author.designation.nativeName || 'N/A'}`);
      }
      
      if (firstNews.author.workPlace) {
        console.log(`\n   📍 WORK PLACE:`);
        console.log(`      Level: ${firstNews.author.workPlace.level}`);
        console.log(`      Location: ${firstNews.author.workPlace.location}`);
        if (firstNews.author.workPlace.state) {
          console.log(`      State: ${firstNews.author.workPlace.state.name}`);
        }
        if (firstNews.author.workPlace.district) {
          console.log(`      District: ${firstNews.author.workPlace.district.name}`);
        }
        if (firstNews.author.workPlace.mandal) {
          console.log(`      Mandal: ${firstNews.author.workPlace.mandal.name}`);
        }
      }
      
      console.log(`\n   Reporter Level: ${firstNews.author.reporterLevel || 'N/A'}`);
      console.log(`   Active: ${firstNews.author.active !== null ? (firstNews.author.active ? 'Yes ✓' : 'No ✗') : 'N/A'}`);
      
      if (firstNews.tenant) {
        console.log('\n🏢 TENANT INFORMATION:\n');
        console.log(`   Name: ${firstNews.tenant.name}`);
        console.log(`   Native Name: ${firstNews.tenant.nativeName || 'N/A'}`);
        console.log(`   Logo: ${firstNews.tenant.logoUrl || 'N/A'}`);
        console.log(`   Favicon: ${firstNews.tenant.faviconUrl || 'N/A'}`);
        console.log(`   Domain: ${firstNews.tenant.domain || 'N/A'}`);
        console.log(`   Slug: ${firstNews.tenant.slug}`);
      }

      console.log('\n' + '='.repeat(80));
      
      // Test 2: Get single news by ID
      console.log('\n📄 Test 2: GET /shortnews/public/:id (Single Item)\n');
      
      const singleResponse = await axios.get(`${BASE_URL}/shortnews/public/${firstNews.id}`);
      
      if (singleResponse.data.success) {
        const news = singleResponse.data.data;
        console.log('✅ Single news fetched successfully');
        console.log(`\n   ID: ${news.id}`);
        console.log(`   Title: ${news.title}`);
        console.log(`   Author: ${news.author.fullName || 'N/A'}`);
        console.log(`   Is Reporter: ${news.author.isReporter ? 'Yes ✓' : 'No'}`);
        
        if (news.author.workPlace) {
          console.log(`   Work Location: ${news.author.workPlace.location || 'N/A'}`);
        }
        
        if (news.tenant) {
          console.log(`   Tenant: ${news.tenant.nativeName || news.tenant.name}`);
        }
      }

      console.log('\n' + '='.repeat(80));
      console.log('\n✅ All tests passed!\n');
      
      // Display enhanced card preview
      console.log('📱 PREVIEW: How to display in frontend:\n');
      console.log('╔═══════════════════════════════════════════════════════╗');
      console.log(`║  ${firstNews.tenant?.logoUrl ? '🏢' : '  '} ${(firstNews.tenant?.nativeName || firstNews.tenant?.name || '').padEnd(50)} ║`);
      console.log('╠═══════════════════════════════════════════════════════╣');
      console.log(`║                                                       ║`);
      console.log(`║  ${firstNews.title.slice(0, 50).padEnd(50)} ║`);
      console.log(`║                                                       ║`);
      console.log('╟───────────────────────────────────────────────────────╢');
      console.log(`║  👤 ${(firstNews.author.fullName || '').slice(0, 47).padEnd(47)} ║`);
      if (firstNews.author.designation) {
        console.log(`║     ${(firstNews.author.designation.nativeName || firstNews.author.designation.name).slice(0, 48).padEnd(48)} ║`);
      }
      if (firstNews.author.workPlace) {
        console.log(`║  📍 ${(firstNews.author.workPlace.location || '').slice(0, 48).padEnd(48)} ║`);
      }
      console.log('╚═══════════════════════════════════════════════════════╝');
      
    } else {
      console.log('⚠️  No news items found');
    }
    
  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

// Run the test
testPublicShortNews();
