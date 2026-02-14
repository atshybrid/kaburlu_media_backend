/**
 * Daily Balance Check Cron Job
 * Checks tenant balances and sends notifications for low balance
 * 
 * Schedule: 0 8 * * * (8 AM daily IST)
 * 
 * Usage:
 *   node src/workers/balanceCheck.ts
 *   OR
 *   npm run jobs:balance-check
 */

import prisma from '../lib/prisma';
import { checkTenantBalance } from '../services/wallet/billing.service';

interface BalanceReport {
  tenant: string;
  tenantId: string;
  balance: number;
  monthlyCharge: number;
  monthsRemaining: number;
  status: 'healthy' | 'low' | 'critical' | 'insufficient';
}

async function runDailyBalanceCheck() {
  const startTime = new Date();
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💰 Starting daily balance check...');
  console.log(`📅 Started at: ${startTime.toISOString()}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      prgiNumber: true,
      subscriptionLocked: true,
    },
  });

  console.log(`Checking ${tenants.length} active tenants\n`);

  const reports: BalanceReport[] = [];
  let healthyCount = 0;
  let lowBalanceCount = 0;
  let criticalCount = 0;
  let insufficientCount = 0;
  let errorCount = 0;

  for (const tenant of tenants) {
    try {
      const balance = await checkTenantBalance(tenant.id);

      let status: BalanceReport['status'];
      let icon: string;

      if (!balance.hasSufficientBalance) {
        status = 'insufficient';
        icon = '❌';
        insufficientCount++;
      } else if (balance.monthsRemaining < 1.5) {
        status = 'critical';
        icon = '🔴';
        criticalCount++;
      } else if (balance.monthsRemaining < 2.5) {
        status = 'low';
        icon = '🟡';
        lowBalanceCount++;
      } else {
        status = 'healthy';
        icon = '✅';
        healthyCount++;
      }

      console.log(`${icon} ${tenant.name}: ₹${balance.currentBalance / 100} (${balance.monthsRemaining.toFixed(1)} months)`);

      reports.push({
        tenant: tenant.name,
        tenantId: tenant.id,
        balance: balance.currentBalance,
        monthlyCharge: balance.monthlyCharge,
        monthsRemaining: parseFloat(balance.monthsRemaining.toFixed(2)),
        status,
      });

      // TODO: Send notifications based on status
      // if (status === 'critical') {
      //   await sendLowBalanceNotification(tenant.id, 'critical');
      // } else if (status === 'low') {
      //   await sendLowBalanceNotification(tenant.id, 'low');
      // } else if (status === 'insufficient') {
      //   await sendInsufficientBalanceNotification(tenant.id);
      // }
    } catch (error: any) {
      console.error(`❌ ${tenant.name}: Error - ${error.message}`);
      errorCount++;
    }
  }

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Balance Check Summary:');
  console.log(`   Total tenants: ${tenants.length}`);
  console.log(`   ✅ Healthy (>2.5 months): ${healthyCount}`);
  console.log(`   🟡 Low (1.5-2.5 months): ${lowBalanceCount}`);
  console.log(`   🔴 Critical (<1.5 months): ${criticalCount}`);
  console.log(`   ❌ Insufficient (<1 month): ${insufficientCount}`);
  console.log(`   ⚠️  Errors: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // Detailed reports for tenants needing attention
  const needsAttention = reports.filter((r) => r.status !== 'healthy');

  if (needsAttention.length > 0) {
    console.log('⚠️  Tenants Requiring Attention:\n');

    const insufficient = needsAttention.filter((r) => r.status === 'insufficient');
    if (insufficient.length > 0) {
      console.log('❌ INSUFFICIENT BALANCE (< 1 month):');
      insufficient.forEach((r) => {
        console.log(`   - ${r.tenant}`);
        console.log(`     Balance: ₹${r.balance / 100}`);
        console.log(`     Monthly: ₹${r.monthlyCharge / 100}`);
        console.log(`     Remaining: ${r.monthsRemaining} months`);
        console.log(`     Action: TOP-UP REQUIRED IMMEDIATELY`);
        console.log('');
      });
    }

    const critical = needsAttention.filter((r) => r.status === 'critical');
    if (critical.length > 0) {
      console.log('🔴 CRITICAL BALANCE (1-1.5 months):');
      critical.forEach((r) => {
        console.log(`   - ${r.tenant}`);
        console.log(`     Balance: ₹${r.balance / 100}`);
        console.log(`     Monthly: ₹${r.monthlyCharge / 100}`);
        console.log(`     Remaining: ${r.monthsRemaining} months`);
        console.log('');
      });
    }

    const low = needsAttention.filter((r) => r.status === 'low');
    if (low.length > 0) {
      console.log('🟡 LOW BALANCE (1.5-2.5 months):');
      low.forEach((r) => {
        console.log(`   - ${r.tenant}`);
        console.log(`     Balance: ₹${r.balance / 100}`);
        console.log(`     Remaining: ${r.monthsRemaining} months`);
        console.log('');
      });
    }
  } else {
    console.log('✅ All tenants have healthy balances (>2.5 months)\n');
  }

  const endTime = new Date();
  const duration = (endTime.getTime() - startTime.getTime()) / 1000;

  console.log(`⏱️  Duration: ${duration.toFixed(2)}s`);
  console.log('✅ Daily balance check completed\n');
}

// Run immediately if called directly
if (require.main === module) {
  runDailyBalanceCheck()
    .catch((error) => {
      console.error('❌ Daily balance check failed:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect();
    });
}

export default runDailyBalanceCheck;
