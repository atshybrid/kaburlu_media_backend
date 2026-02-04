/**
 * Test script to force regenerate ID card PDF
 * Usage: npx ts-node scripts/test_regenerate_id_card.ts <reporterId>
 */

import { generateAndUploadIdCardPdf } from '../src/lib/idCardPdf';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reporterId = process.argv[2];
  
  if (!reporterId) {
    console.error('Usage: npx ts-node scripts/test_regenerate_id_card.ts <reporterId>');
    process.exit(1);
  }

  console.log(`\n🔄 Force regenerating ID card for reporter: ${reporterId}\n`);

  // First, clear the existing pdfUrl to force regeneration
  await prisma.reporterIDCard.update({
    where: { reporterId },
    data: { pdfUrl: null }
  });
  console.log('✓ Cleared existing PDF URL');

  // Now regenerate
  const result = await generateAndUploadIdCardPdf(reporterId);
  
  if (result.ok) {
    console.log('\n✅ SUCCESS!');
    console.log('Card Number:', result.cardNumber);
    console.log('PDF URL:', result.pdfUrl);
    console.log('\n📥 Download and check the PDF design!\n');
  } else {
    console.error('\n❌ FAILED!');
    console.error('Error:', result.error);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
