/**
 * Fix reporters who have paid onboarding but still have idCardCharge > 0
 * This sets idCardCharge to 0 for reporters with PAID onboarding payment
 * 
 * Usage: npx ts-node scripts/fix_paid_reporters_idcard_charge.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding reporters with PAID onboarding but idCardCharge > 0...\n');

  // Get all PAID onboarding payments
  const paidOnboardings = await (prisma as any).reporterPayment.findMany({
    where: {
      type: 'ONBOARDING',
      status: 'PAID',
    },
    select: {
      id: true,
      reporterId: true,
      tenantId: true,
      createdAt: true,
    },
  });

  console.log(`Found ${paidOnboardings.length} PAID onboarding payments\n`);

  let fixed = 0;
  let skipped = 0;

  for (const payment of paidOnboardings) {
    const reporter = await prisma.reporter.findUnique({
      where: { id: payment.reporterId },
      select: {
        id: true,
        idCardCharge: true,
        tenantId: true,
      },
    });

    if (!reporter) {
      console.log(`⚠️  Reporter ${payment.reporterId} not found (payment orphaned)`);
      continue;
    }

    if (reporter.idCardCharge === null || reporter.idCardCharge === 0) {
      skipped++;
      continue;
    }

    // Reporter has PAID onboarding but still has idCardCharge > 0
    console.log(`🔧 Fixing reporter ${reporter.id}:`);
    console.log(`   Current idCardCharge: ${reporter.idCardCharge}`);
    console.log(`   Onboarding PAID at: ${payment.createdAt.toISOString().split('T')[0]}`);

    await prisma.reporter.update({
      where: { id: reporter.id },
      data: { idCardCharge: 0 },
    });

    console.log(`   ✅ Set idCardCharge to 0\n`);
    fixed++;
  }

  console.log('\n📊 Summary:');
  console.log(`   Fixed: ${fixed} reporters`);
  console.log(`   Skipped (already 0 or null): ${skipped} reporters`);
  console.log(`   Total PAID onboardings: ${paidOnboardings.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
