/**
 * Test: Send ID Card PDF via WhatsApp to a Reporter
 * 
 * Usage: node scripts/test_idcard_whatsapp.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('=== WhatsApp ID Card Test ===\n');

  // Check WhatsApp config
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  
  if (!phoneNumberId || !accessToken) {
    console.error('❌ Missing WhatsApp config:');
    if (!phoneNumberId) console.error('   - WHATSAPP_PHONE_NUMBER_ID');
    if (!accessToken) console.error('   - WHATSAPP_ACCESS_TOKEN');
    process.exit(1);
  }
  console.log('✅ WhatsApp configured');

  // Find a reporter with ID card
  const reporter = await prisma.reporter.findFirst({
    where: {
      idCard: { isNot: null },
    },
    include: {
      idCard: true,
      user: { select: { mobileNumber: true, profile: { select: { fullName: true } } } },
      tenant: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reporter) {
    console.error('❌ No reporter with ID card found');
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log('\n📋 Reporter Details:');
  console.log('   ID:', reporter.id);
  console.log('   Name:', reporter.user?.profile?.fullName || 'N/A');
  console.log('   Mobile:', reporter.user?.mobileNumber || 'N/A');
  console.log('   Tenant:', reporter.tenant?.name || 'N/A');
  console.log('   Card Number:', reporter.idCard?.cardNumber);
  console.log('   PDF URL:', reporter.idCard?.pdfUrl || '(not stored - will use API)');

  if (!reporter.user?.mobileNumber) {
    console.error('❌ Reporter has no mobile number');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Build PDF URL - use the public API endpoint
  const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com';
  const pdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${reporter.id}`;
  console.log('\n📄 PDF URL:', pdfUrl);

  // Import and call the send function
  const { sendWhatsappIdCardTemplate } = require('../dist/lib/whatsapp');

  const tenantName = reporter.tenant?.name || 'Kaburlu Media';
  const reporterName = reporter.user?.profile?.fullName || 'Reporter';
  const cardNumber = reporter.idCard?.cardNumber || 'ID Card';

  console.log('\n📤 Sending WhatsApp message...');
  console.log('   To:', reporter.user.mobileNumber);
  console.log('   Template: send_idcard_reporter');
  console.log('   Params:');
  console.log('      {{1}} = "Reporter ID"');
  console.log('      {{2}} = "' + tenantName + '"');
  console.log('      {{3}} = "ID Card"');

  const result = await sendWhatsappIdCardTemplate({
    toMobileNumber: reporter.user.mobileNumber,
    pdfUrl: pdfUrl,
    cardType: 'Reporter ID',          // {{1}}
    organizationName: tenantName,      // {{2}}
    documentType: 'ID Card',           // {{3}}
    pdfFilename: `${reporterName.replace(/\s+/g, '_')}_ID_Card_${cardNumber}.pdf`,
  });

  console.log('\n📬 Result:');
  if (result.ok) {
    console.log('   ✅ SUCCESS!');
    console.log('   Message ID:', result.messageId);
  } else {
    console.log('   ❌ FAILED');
    console.log('   Error:', result.error);
    if (result.details) {
      console.log('   Details:', JSON.stringify(result.details, null, 2));
    }
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  prisma.$disconnect();
  process.exit(1);
});
