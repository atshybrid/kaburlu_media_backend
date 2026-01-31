const axios = require('axios');

async function main() {
  const tenantId = 'cmk7e7tg401ezlp22wkz5rxky';
  const reporterId = 'cml1b4zw80006bzyjmv35ytnk';
  
  // Use production API
  const baseUrl = process.env.API_BASE_URL || 'https://api.kaburlumedia.com/api/v1';
  
  console.log('Reporter ID:', reporterId);
  console.log('Tenant ID:', tenantId);
  
  // Direct WhatsApp API call
  const { sendWhatsappIdCardTemplate } = require('../dist/lib/whatsapp');
  
  const result = await sendWhatsappIdCardTemplate({
    toMobileNumber: '9118191991',
    pdfUrl: 'https://api.kaburlumedia.com/api/v1/id-cards/pdf?reporterId=' + reporterId,
    cardType: 'Reporter ID',
    organizationName: 'Kaburlu today',
    documentType: 'ID Card',
    pdfFilename: 'Reporter_ID_Card_KM0002.pdf',
  });
  
  console.log('\nWhatsApp Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
