/**
 * Disable monthly subscription requirement for a reporter.
 *
 * Usage:
 *   npx ts-node scripts/disable_reporter_subscription.ts <reporterId> [--confirm]
 */

import prisma from '../src/lib/prisma';

async function main() {
  const reporterId = String(process.argv[2] || '').trim();
  const confirm = process.argv.includes('--confirm');

  if (!reporterId) {
    console.error('Usage: npx ts-node scripts/disable_reporter_subscription.ts <reporterId> [--confirm]');
    process.exit(1);
  }

  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: reporterId },
    select: {
      id: true,
      tenantId: true,
      subscriptionActive: true,
      monthlySubscriptionAmount: true,
      subscriptionActivationDate: true,
      manualLoginEnabled: true,
    },
  });

  if (!reporter) {
    console.error('Reporter not found:', reporterId);
    process.exit(1);
  }

  console.log('\nReporter:', reporter.id);
  console.log('Tenant:', reporter.tenantId);
  console.log('Before:', {
    subscriptionActive: reporter.subscriptionActive,
    monthlySubscriptionAmount: reporter.monthlySubscriptionAmount,
    subscriptionActivationDate: reporter.subscriptionActivationDate,
    manualLoginEnabled: reporter.manualLoginEnabled,
  });

  const next = {
    subscriptionActive: false,
    monthlySubscriptionAmount: null,
    subscriptionActivationDate: null,
  };

  console.log('After:', next);

  if (!confirm) {
    console.log('\nDry-run only. Re-run with --confirm to apply.');
    return;
  }

  const updated = await (prisma as any).reporter.update({
    where: { id: reporterId },
    data: next,
    select: {
      id: true,
      subscriptionActive: true,
      monthlySubscriptionAmount: true,
      subscriptionActivationDate: true,
    },
  });

  console.log('\nUpdated:', updated);
}

main()
  .catch((e) => {
    console.error('Failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await (prisma as any).$disconnect();
    } catch {
      // ignore
    }
  });
