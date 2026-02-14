/**
 * Test: Check if ID card generation works correctly when subscription is toggled ON -> OFF
 * This simulates the scenario where admin enables subscription, reporter pays, then admin disables subscription
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSubscriptionToggleLogic(reporter: any) {
  console.log('\n📊 Testing ID Card Generation Logic:');
  console.log(`   Reporter ID: ${reporter.id}`);
  console.log(`   idCardCharge: ${reporter.idCardCharge}`);
  console.log(`   subscriptionActive: ${reporter.subscriptionActive}`);
  console.log(`   monthlySubscriptionAmount: ${reporter.monthlySubscriptionAmount}\n`);

  // Check onboarding payment
  const onboardingPaid = await (prisma as any).reporterPayment.findFirst({
    where: { reporterId: reporter.id, type: 'ONBOARDING', status: 'PAID' },
    select: { id: true },
  });

  console.log('✅ Step 1: Check onboarding payment');
  if (!onboardingPaid && typeof reporter.idCardCharge === 'number' && reporter.idCardCharge > 0) {
    console.log('   ❌ BLOCKED: Onboarding payment required');
    console.log('   → ID card generation would FAIL with 403\n');
    return false;
  } else {
    console.log(`   ✅ PASS: ${onboardingPaid ? 'Onboarding payment found' : 'No onboarding payment required (idCardCharge <= 0)'}\n`);
  }

  // Check monthly subscription payment
  console.log('✅ Step 2: Check monthly subscription payment');
  if (reporter.subscriptionActive) {
    console.log('   ⚠️  subscriptionActive = true, checking for current month payment...');
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const monthlyPaid = await (prisma as any).reporterPayment.findFirst({
      where: {
        reporterId: reporter.id,
        type: 'MONTHLY_SUBSCRIPTION',
        status: 'PAID',
        year,
        month,
      },
      select: { id: true },
    });

    if (!monthlyPaid) {
      console.log(`   ❌ BLOCKED: Monthly payment for ${year}-${String(month).padStart(2, '0')} not found`);
      console.log('   → ID card generation would FAIL with 403\n');
      return false;
    } else {
      console.log(`   ✅ PASS: Monthly payment found for ${year}-${String(month).padStart(2, '0')}\n`);
    }
  } else {
    console.log('   ✅ SKIP: subscriptionActive = false, no monthly payment check needed\n');
  }

  console.log('🎉 ID card generation would SUCCEED!\n');
  return true;
}

async function main() {
  console.log('🔍 Testing subscription toggle scenario...\n');

  // Find reporters with subscriptionActive = false but have payment history
  const reporters = await prisma.reporter.findMany({
    where: {
      subscriptionActive: false, // Currently OFF
    },
    include: {
      payments: {
        where: { type: 'MONTHLY_SUBSCRIPTION' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    take: 5,
  });

  console.log(`Found ${reporters.length} reporters with subscriptionActive=false\n`);
  
  if (reporters.length === 0) {
    console.log('No reporters found with subscription turned OFF.');
    console.log('Creating test scenario...\n');
    
    // Find any reporter with subscription ON
    const activeReporter = await prisma.reporter.findFirst({
      where: { subscriptionActive: true },
    });

    if (activeReporter) {
      console.log(`Testing with reporter: ${activeReporter.id} (currently subscriptionActive=true)`);
      await testSubscriptionToggleLogic(activeReporter);
    } else {
      console.log('No reporters with subscriptionActive=true found either.');
    }
    return;
  }

  // Test each reporter
  for (const reporter of reporters) {
    const hasMonthlyPayments = reporter.payments && reporter.payments.length > 0;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Reporter: ${reporter.id}`);
    console.log(`Has previous monthly payments: ${hasMonthlyPayments}`);
    
    if (hasMonthlyPayments) {
      console.log(`Last payment: ${reporter.payments[0].createdAt.toISOString().split('T')[0]}`);
      console.log(`Payment status: ${reporter.payments[0].status}`);
    }

    const result = await testSubscriptionToggleLogic(reporter);
    
    if (!result) {
      console.log('⚠️  WARNING: This reporter would be blocked even though subscription is OFF!');
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
