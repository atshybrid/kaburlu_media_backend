require('dotenv').config();
const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function syncTemplates() {
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!businessAccountId) {
    console.log('❌ WHATSAPP_BUSINESS_ACCOUNT_ID not configured');
    console.log('Set it in .env to sync templates');
    return;
  }

  console.log('📥 Fetching templates from Meta API...');
  
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { limit: 100 },
      }
    );

    const templates = response.data?.data || [];
    console.log(`✅ Found ${templates.length} templates from Meta`);

    let created = 0, updated = 0;
    
    for (const t of templates) {
      const headerComponent = t.components?.find(c => c.type === 'HEADER');
      const bodyComponent = t.components?.find(c => c.type === 'BODY');
      
      const data = {
        templateId: t.id,
        name: t.name,
        language: t.language || 'en',
        category: t.category || 'UTILITY',
        status: t.status || 'PENDING',
        headerType: headerComponent?.format || null,
        headerText: headerComponent?.text || null,
        bodyText: bodyComponent?.text || null,
        components: t.components || [],
      };

      const existing = await prisma.whatsappTemplate.findUnique({
        where: { name: t.name }
      });

      if (existing) {
        await prisma.whatsappTemplate.update({
          where: { name: t.name },
          data,
        });
        updated++;
      } else {
        await prisma.whatsappTemplate.create({ data });
        created++;
      }
      
      console.log(`  - ${t.name} | ${t.status} | ${t.category}`);
    }

    console.log(`\n✅ Synced! Created: ${created}, Updated: ${updated}`);
    
  } catch (e) {
    console.error('❌ Error:', e.response?.data || e.message);
  }
}

async function testOtp() {
  console.log('\n📱 Testing OTP WhatsApp...');
  
  const { sendWhatsappOtp } = require('./dist/lib/whatsapp');
  
  if (!sendWhatsappOtp) {
    console.log('⚠️ sendWhatsappOtp function not found, checking if OTP template exists...');
    return;
  }
  
  const result = await sendWhatsappOtp({
    toMobileNumber: '9118191991',
    otp: '123456',
  });
  
  console.log('OTP Result:', JSON.stringify(result, null, 2));
}

async function main() {
  await syncTemplates();
  
  // Check templates now
  const templates = await prisma.whatsappTemplate.findMany({
    select: { name: true, status: true, category: true }
  });
  
  console.log('\n📋 Templates in DB now:', templates.length);
  templates.forEach(t => {
    console.log(`  - ${t.name} | ${t.status} | ${t.category}`);
  });
  
  // Check for OTP template
  const otpTemplate = templates.find(t => 
    t.name.toLowerCase().includes('otp') || 
    t.category === 'AUTHENTICATION'
  );
  
  if (otpTemplate) {
    console.log('\n✅ OTP Template found:', otpTemplate.name);
  } else {
    console.log('\n⚠️ No OTP template found. Need to create one in Meta Business Suite.');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
