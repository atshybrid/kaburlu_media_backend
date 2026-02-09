/**
 * Debug why tenant reporter ID card issuance might fail (500).
 * Usage:
 *   npx ts-node scripts/debug_idcard_issue_tenant_reporter.ts <tenantId> <reporterId>
 */

import prisma from '../src/lib/prisma';

async function main() {
  const tenantId = String(process.argv[2] || '').trim();
  const reporterId = String(process.argv[3] || '').trim();
  if (!tenantId || !reporterId) {
    console.error('Usage: npx ts-node scripts/debug_idcard_issue_tenant_reporter.ts <tenantId> <reporterId>');
    process.exit(1);
  }

  const reporter = await (prisma as any).reporter.findFirst({
    where: { id: reporterId, tenantId },
    include: {
      idCard: true,
      user: { select: { mobileNumber: true } },
    },
  });

  if (!reporter) {
    console.error('Reporter not found in tenant');
    process.exit(1);
  }

  const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
  const domains = await (prisma as any).domain.findMany({
    where: { tenantId },
    select: { id: true, domain: true, status: true, isPrimary: true },
    orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
  }).catch(() => []);

  const existingCard = await (prisma as any).reporterIDCard.findFirst({
    where: { reporterId },
    select: { id: true, cardNumber: true, issuedAt: true, expiresAt: true, pdfUrl: true },
  });

  console.log('\nReporter:');
  console.log({
    id: reporter.id,
    tenantId: reporter.tenantId,
    idCardCharge: reporter.idCardCharge,
    subscriptionActive: reporter.subscriptionActive,
    monthlySubscriptionAmount: reporter.monthlySubscriptionAmount,
    profilePhotoUrl: reporter.profilePhotoUrl,
    mobileNumber: reporter.user?.mobileNumber,
  });

  console.log('\nExisting reporterIDCard row:');
  console.log(existingCard || null);

  console.log('\nTenantIdCardSettings:');
  console.log(settings || null);

  console.log('\nDomains:');
  console.log(domains);

  if (settings) {
    const prefix: string = settings.idPrefix || 'ID';
    const digits: number = settings.idDigits || 6;

    const existingCount = await (prisma as any).reporterIDCard.count({
      where: { reporter: { tenantId } },
    });

    const nextNumber = existingCount + 1;
    const padded = String(nextNumber).padStart(digits, '0');
    const candidate = `${prefix}${padded}`;

    const collision = await (prisma as any).reporterIDCard.findFirst({
      where: { cardNumber: candidate },
      select: { id: true, reporterId: true },
    });

    console.log('\nCandidate next cardNumber:');
    console.log({ existingCount, candidate, collision: collision || null });
  }
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
