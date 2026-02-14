/**
 * Monthly Billing Cron Job
 * Generates invoices for all active tenants on the 1st of every month
 * 
 * Schedule: 0 0 1 * * (Midnight on 1st of every month)
 * 
 * Usage:
 *   node src/workers/monthlyBilling.ts
 *   OR
 *   npm run jobs:monthly-billing
 */

import prisma from '../lib/prisma';
import { generateMonthlyInvoice, getPreviousMonthPeriod } from '../services/wallet/billing.service';

async function runMonthlyBilling() {
  const startTime = new Date();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 Starting monthly billing job...');
  console.log(`📅 Started at: ${startTime.toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const previousMonth = getPreviousMonthPeriod();
  console.log(`📊 Billing period: ${previousMonth.start.toISOString()} to ${previousMonth.end.toISOString()}\n`);

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      prgiNumber: true,
      subscriptionLocked: true,
    },
  });

  console.log(`Found ${tenants.length} active tenants to process\n`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let lockedCount = 0;

  const results = [];

  for (const tenant of tenants) {
    console.log(`📌 Processing: ${tenant.name} (${tenant.prgiNumber})`);

    try {
      if (tenant.subscriptionLocked) {
        console.log(`   ⚠️  Skipped - Tenant is locked`);
        lockedCount++;
        results.push({
          tenant: tenant.name,
          status: 'locked',
          invoice: null,
        });
        console.log('');
        continue;
      }

      const invoice = await generateMonthlyInvoice(tenant.id, previousMonth.start, previousMonth.end);

      if (invoice) {
        console.log(`   ✓ Invoice generated: ${invoice.id}`);
        console.log(`   💰 Amount: ₹${invoice.totalAmountMinor / 100}`);
        console.log(`   📋 Status: ${invoice.status}`);
        successCount++;
        results.push({
          tenant: tenant.name,
          status: 'success',
          invoice: invoice.id,
          amount: invoice.totalAmountMinor,
          invoiceStatus: invoice.status,
        });
      } else {
        console.log(`   ℹ No charges for this period`);
        skippedCount++;
        results.push({
          tenant: tenant.name,
          status: 'no_charges',
          invoice: null,
        });
      }
    } catch (error: any) {
      console.error(`   ✗ Error: ${error.message}`);
      errorCount++;
      results.push({
        tenant: tenant.name,
        status: 'error',
        error: error.message,
      });
    }

    console.log('');
  }

  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Monthly Billing Summary:');
  console.log(`   Total tenants: ${tenants.length}`);
  console.log(`   ✓ Invoices generated: ${successCount}`);
  console.log(`   ℹ No charges: ${skippedCount}`);
  console.log(`   🔒 Locked tenants: ${lockedCount}`);
  console.log(`   ✗ Errors: ${errorCount}`);
  console.log(`   ⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Detailed results
  if (errorCount > 0) {
    console.log('❌ Errors:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`   - ${r.tenant}: ${r.error}`);
      });
    console.log('');
  }

  if (lockedCount > 0) {
    console.log('🔒 Locked tenants (insufficient balance):');
    results
      .filter((r) => r.status === 'locked')
      .forEach((r) => {
        console.log(`   - ${r.tenant}`);
      });
    console.log('');
  }

  console.log('✅ Monthly billing job completed\n');

  // Log summary to database (optional - can create a JobLog table)
  // await prisma.billingJobLog.create({
  //   data: {
  //     jobType: 'MONTHLY_BILLING',
  //     periodStart: previousMonth.start,
  //     periodEnd: previousMonth.end,
  //     tenantsProcessed: tenants.length,
  //     successCount,
  //     errorCount,
  //     duration,
  //     results: JSON.stringify(results)
  //   }
  // });
}

// Run immediately if called directly
if (require.main === module) {
  runMonthlyBilling()
    .catch((error) => {
      console.error('❌ Monthly billing job failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export default runMonthlyBilling;
