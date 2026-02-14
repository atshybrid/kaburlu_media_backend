/**
 * Debug script: Check reporter payments for ID card access
 * Usage: npx ts-node scripts/check_reporter_payments.ts <reporterId>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reporterId = process.argv[2] || 'cmllt73z200qbbzob01n14scp';
  
  console.log(`🔍 Checking payments for reporter: ${reporterId}\n`);

  // 1. Get reporter details
  const reporter = await prisma.reporter.findUnique({
    where: { id: reporterId },
    select: {
      id: true,
      tenantId: true,
      idCardCharge: true,
      subscriptionActive: true,
      monthlySubscriptionAmount: true,
      userId: true,
    },
  });

  if (!reporter) {
    console.error(`❌ Reporter not found: ${reporterId}`);
    process.exit(1);
  }

  console.log('📋 Reporter details:');
  console.log(JSON.stringify(reporter, null, 2));
  console.log();

  // 2. Get all payments for this reporter
  const payments = await (prisma as any).reporterPayment.findMany({
    where: { reporterId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      type: true,
      status: true,
      amountMinor: true,
      tenantId: true,
      year: true,
      month: true,
      createdAt: true,
    },
  });

  console.log(`💰 Total payments: ${payments.length}\n`);
  
  if (payments.length === 0) {
    console.log('❌ No payments found for this reporter!');
    console.log('⚠️  This is why ID card generation is failing.');
    console.log('⚠️  Reporter needs to complete onboarding payment first.\n');
  } else {
    console.log('All payments:');
    payments.forEach((p: any, i: number) => {
      console.log(`${i + 1}. ${p.type} - ${p.status} - ₹${(p.amountMinor / 100).toFixed(2)} - ${p.createdAt.toISOString().split('T')[0]}`);
      if (p.year && p.month) {
        console.log(`   Month: ${p.year}-${String(p.month).padStart(2, '0')}`);
      }
    });
    console.log();

    // 3. Check specifically for onboarding payment
    const onboardingPaid = payments.find((p: any) => 
      p.type === 'ONBOARDING' && 
      p.status === 'PAID' && 
      p.tenantId === reporter.tenantId
    );

    if (onboardingPaid) {
      console.log('✅ Onboarding payment PAID found!');
      console.log(JSON.stringify(onboardingPaid, null, 2));
      console.log();
      console.log('✅ ID card generation should work (if idCardCharge > 0)');
    } else {
      console.log('❌ No PAID onboarding payment found!');
      
      const onboardingAny = payments.find((p: any) => p.type === 'ONBOARDING');
      if (onboardingAny) {
        console.log(`⚠️  Found onboarding payment but status is: ${onboardingAny.status}`);
        console.log(JSON.stringify(onboardingAny, null, 2));
        
        if (onboardingAny.tenantId !== reporter.tenantId) {
          console.log(`⚠️  TENANT MISMATCH!`);
          console.log(`   Payment tenantId: ${onboardingAny.tenantId}`);
          console.log(`   Reporter tenantId: ${reporter.tenantId}`);
        }
      } else {
        console.log('⚠️  No onboarding payment record exists at all.');
      }
    }
  }

  console.log('\n📊 Payment requirement logic:');
  console.log(`   idCardCharge: ${reporter.idCardCharge} (if > 0, needs onboarding PAID)`);
  console.log(`   subscriptionActive: ${reporter.subscriptionActive} (if true, needs current month PAID)`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
