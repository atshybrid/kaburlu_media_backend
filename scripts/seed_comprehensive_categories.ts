import { PrismaClient } from '@prisma/client';

// Direct Prisma client instance for seeding (avoids pooler issues)
const prisma = new PrismaClient();

// Comprehensive category list with translations
const comprehensiveCategories = [
  // National/Global categories
  { key: 'NATIONAL', translations: { en: 'National', te: 'జాతీయం', hi: 'राष्ट्रीय', ta: 'தேசியம்', kn: 'ರಾಷ್ಟ್ರೀಯ', ml: 'ദേശീയ' } },
  { key: 'INTERNATIONAL', translations: { en: 'International', te: 'అంతర్జాతీయం', hi: 'अंतरराष्ट्रीय', ta: 'சர்வதேசம்', kn: 'ಅಂತರರಾಷ್ಟ್ರೀಯ', ml: 'അന്താരാഷ്ട്ര' } },
  { key: 'POLITICS', translations: { en: 'Politics', te: 'రాజకీయాలు', hi: 'राजनीति', ta: 'அரசியல்', kn: 'ರಾಜಕೀಯ', ml: 'രാഷ്ട്രീയം' } },
  { key: 'SPORTS', translations: { en: 'Sports', te: 'క్రీడలు', hi: 'खेल', ta: 'விளையாட்டு', kn: 'ಕ್ರೀಡೆ', ml: 'കായികം' } },
  { key: 'BUSINESS', translations: { en: 'Business', te: 'వ్యాపారం', hi: 'व्यापार', ta: 'வணிகம்', kn: 'ವ್ಯಾಪಾರ', ml: 'ബിസിനസ്സ്' } },
  { key: 'TECHNOLOGY', translations: { en: 'Technology', te: 'సాంకేతికం', hi: 'प्रौद्योगिकी', ta: 'தொழில்நுட்பம்', kn: 'ತಂತ್ರಜ್ಞಾನ', ml: 'സാങ്കേതികം' } },
  { key: 'ENTERTAINMENT', translations: { en: 'Entertainment', te: 'వినోదం', hi: 'मनोरंजन', ta: 'பொழுதுபோக்கு', kn: 'ಮನರಂಜನೆ', ml: 'വിനോദം' } },
  { key: 'HEALTH', translations: { en: 'Health', te: 'ఆరోగ్యం', hi: 'स्वास्थ्य', ta: 'சுகாதாரம்', kn: 'ಆರೋಗ್ಯ', ml: 'ആരോഗ്യം' } },
  { key: 'EDUCATION', translations: { en: 'Education', te: 'విద్య', hi: 'शिक्षा', ta: 'கல்வி', kn: 'ಶಿಕ್ಷಣ', ml: 'വിദ്യാഭ്യാസം' } },
  { key: 'CRIME', translations: { en: 'Crime', te: 'నేరం', hi: 'अपराध', ta: 'குற்றம்', kn: 'ಅಪರಾಧ', ml: 'കുറ്റകൃത്യം' } },
  { key: 'AGRICULTURE', translations: { en: 'Agriculture', te: 'వ్యవసాయం', hi: 'कृषि', ta: 'விவசாயம்', kn: 'ಕೃಷಿ', ml: 'കൃഷി' } },
  { key: 'ENVIRONMENT', translations: { en: 'Environment', te: 'పర్యావరణం', hi: 'पर्यावरण', ta: 'சுற்றுச்சூழல்', kn: 'ಪರಿಸರ', ml: 'പരിസ്ഥിതി' } },
  { key: 'SCIENCE', translations: { en: 'Science', te: 'విజ్ఞానం', hi: 'विज्ञान', ta: 'அறிவியல்', kn: 'ವಿಜ್ಞಾನ', ml: 'ശാസ്ത്രം' } },
  { key: 'WEATHER', translations: { en: 'Weather', te: 'వాతావరణం', hi: 'मौसम', ta: 'வானிலை', kn: 'ಹವಾಮಾನ', ml: 'കാലാവസ്ഥ' } },
  { key: 'OPINION', translations: { en: 'Opinion', te: 'అభిప్రాయం', hi: 'राय', ta: 'கருத்து', kn: 'ಅಭಿಪ್ರಾಯ', ml: 'അഭിപ്രായം' } },
  { key: 'LIFESTYLE', translations: { en: 'Lifestyle', te: 'జీవనశైలి', hi: 'जीवन शैली', ta: 'வாழ்க்கை முறை', kn: 'ಜೀವನಶೈಲಿ', ml: 'ജീവിതശൈലി' } },

  // State-specific categories (36 Indian states/UTs)
  { key: 'ANDHRA_PRADESH', translations: { en: 'Andhra Pradesh', te: 'ఆంధ్ర ప్రదేశ్', hi: 'आंध्र प्रदेश' } },
  { key: 'ARUNACHAL_PRADESH', translations: { en: 'Arunachal Pradesh', hi: 'अरुणाचल प्रदेश' } },
  { key: 'ASSAM', translations: { en: 'Assam', as: 'অসম', hi: 'असम' } },
  { key: 'BIHAR', translations: { en: 'Bihar', hi: 'बिहार' } },
  { key: 'CHHATTISGARH', translations: { en: 'Chhattisgarh', hi: 'छत्तीसगढ़' } },
  { key: 'GOA', translations: { en: 'Goa', hi: 'गोवा' } },
  { key: 'GUJARAT', translations: { en: 'Gujarat', gu: 'ગુજરાત', hi: 'गुजरात' } },
  { key: 'HARYANA', translations: { en: 'Haryana', hi: 'हरियाणा' } },
  { key: 'HIMACHAL_PRADESH', translations: { en: 'Himachal Pradesh', hi: 'हिमाचल प्रदेश' } },
  { key: 'JHARKHAND', translations: { en: 'Jharkhand', hi: 'झारखंड' } },
  { key: 'KARNATAKA', translations: { en: 'Karnataka', kn: 'ಕರ್ನಾಟಕ', hi: 'कर्नाटक' } },
  { key: 'KERALA', translations: { en: 'Kerala', ml: 'കേരളം', hi: 'केरल' } },
  { key: 'MADHYA_PRADESH', translations: { en: 'Madhya Pradesh', hi: 'मध्य प्रदेश' } },
  { key: 'MAHARASHTRA', translations: { en: 'Maharashtra', mr: 'महाराष्ट्र', hi: 'महाराष्ट्र' } },
  { key: 'MANIPUR', translations: { en: 'Manipur', hi: 'मणिपुर' } },
  { key: 'MEGHALAYA', translations: { en: 'Meghalaya', hi: 'मेघालय' } },
  { key: 'MIZORAM', translations: { en: 'Mizoram', hi: 'मिजोरम' } },
  { key: 'NAGALAND', translations: { en: 'Nagaland', hi: 'नागालैंड' } },
  { key: 'ODISHA', translations: { en: 'Odisha', or: 'ଓଡ଼ିଶା', hi: 'ओडिशा' } },
  { key: 'PUNJAB', translations: { en: 'Punjab', pa: 'ਪੰਜਾਬ', hi: 'पंजाब' } },
  { key: 'RAJASTHAN', translations: { en: 'Rajasthan', hi: 'राजस्थान' } },
  { key: 'SIKKIM', translations: { en: 'Sikkim', hi: 'सिक्किम' } },
  { key: 'TAMIL_NADU', translations: { en: 'Tamil Nadu', ta: 'தமிழ்நாடு', hi: 'तमिलनाडु' } },
  { key: 'TELANGANA', translations: { en: 'Telangana', te: 'తెలంగాణ', hi: 'तेलंगाना' } },
  { key: 'TRIPURA', translations: { en: 'Tripura', bn: 'ত্রিপুরা', hi: 'त्रिपुरा' } },
  { key: 'UTTAR_PRADESH', translations: { en: 'Uttar Pradesh', hi: 'उत्तर प्रदेश' } },
  { key: 'UTTARAKHAND', translations: { en: 'Uttarakhand', hi: 'उत्तराखंड' } },
  { key: 'WEST_BENGAL', translations: { en: 'West Bengal', bn: 'পশ্চিমবঙ্গ', hi: 'पश्चिम बंगाल' } },
  
  // Union Territories
  { key: 'ANDAMAN_NICOBAR', translations: { en: 'Andaman & Nicobar', hi: 'अंडमान और निकोबार' } },
  { key: 'CHANDIGARH', translations: { en: 'Chandigarh', hi: 'चंडीगढ़' } },
  { key: 'DADRA_NAGAR_HAVELI_DAMAN_DIU', translations: { en: 'Dadra & Nagar Haveli and Daman & Diu', hi: 'दादरा और नगर हवेली और दमन और दीव' } },
  { key: 'DELHI', translations: { en: 'Delhi', hi: 'दिल्ली' } },
  { key: 'JAMMU_KASHMIR', translations: { en: 'Jammu & Kashmir', hi: 'जम्मू और कश्मीर' } },
  { key: 'LADAKH', translations: { en: 'Ladakh', hi: 'लद्दाख' } },
  { key: 'LAKSHADWEEP', translations: { en: 'Lakshadweep', ml: 'ലക്ഷദ്വീപ്', hi: 'लक्षद्वीप' } },
  { key: 'PUDUCHERRY', translations: { en: 'Puducherry', ta: 'புதுச்சேரி', hi: 'पुदुच्चेरी' } },
];

async function main() {
  console.log('Seeding comprehensive categories with state-specific categories...');
  
  let created = 0;
  let updated = 0;
  
  for (const cat of comprehensiveCategories) {
    // Generate slug from key (lowercase with hyphens)
    const slug = cat.key.toLowerCase().replace(/_/g, '-');
    
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name: cat.key },
      create: { name: cat.key, slug }
    });
    
    const isNew = category.createdAt.getTime() === category.updatedAt.getTime();
    if (isNew) created++; else updated++;
    
    // Seed translations for all languages
    for (const [langCode, translatedName] of Object.entries(cat.translations)) {
      await prisma.categoryTranslation.upsert({
        where: { categoryId_language: { categoryId: category.id, language: langCode } },
        update: { name: translatedName },
        create: { categoryId: category.id, language: langCode, name: translatedName }
      });
    }
  }
  
  console.log(`✅ Comprehensive categories seeded!`);
  console.log(`   Created: ${created} new categories`);
  console.log(`   Updated: ${updated} existing categories`);
  console.log(`   Total: ${comprehensiveCategories.length} categories with translations`);
  console.log(`   Includes: 16 general + 36 state-specific categories`);
}

main()
  .catch((e) => {
    console.error('Error seeding comprehensive categories:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
