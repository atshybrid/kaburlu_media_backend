require('dotenv').config();

async function main() {
  console.log('📱 Testing WhatsApp OTP...');
  console.log('Template:', process.env.WHATSAPP_TEMPLATE_NAME || 'kaburlu_app_otp');
  console.log('Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);
  
  const { sendWhatsappOtpTemplate } = require('../dist/lib/whatsapp');
  
  const result = await sendWhatsappOtpTemplate({
    toMobileNumber: '9118191991',
    otp: '123456',
    purpose: 'Login',
    ttlText: '10 minutes',
    supportMobile: process.env.WHATSAPP_SUPPORT_MOBILE || '919347839987',
  });
  
  console.log('\nOTP Result:', JSON.stringify(result, null, 2));
  
  if (result.ok) {
    console.log('✅ OTP sent successfully!');
  } else {
    console.log('❌ OTP failed:', result.error);
  }
}

main().catch(console.error);
