/**
 * Create an ID card record for a reporter using TenantIdCardSettings.
 * Useful when API issuance fails due to cardNumber collisions (gaps) or deployment mismatch.
 *
 * Usage:
 *   npx ts-node scripts/create_reporter_id_card_record.ts <reporterId> [--confirm] [--pdf]
 */

import prisma from '../src/lib/prisma';
import { generateAndUploadIdCardPdf } from '../src/lib/idCardPdf';

async function cardNumberExists(cardNumber: string): Promise<boolean> {
  const existing = await (prisma as any).reporterIDCard.findFirst({ where: { cardNumber }, select: { id: true } });
  return !!existing;
}

async function main() {
  const reporterId = String(process.argv[2] || '').trim();
  const confirm = process.argv.includes('--confirm');
  const regenPdf = process.argv.includes('--pdf');

  if (!reporterId) {
    console.error('Usage: npx ts-node scripts/create_reporter_id_card_record.ts <reporterId> [--confirm] [--pdf]');
    process.exit(1);
  }

  const reporter = await (prisma as any).reporter.findUnique({
    where: { id: reporterId },
    include: { idCard: true },
  });

  if (!reporter) {
    console.error('Reporter not found:', reporterId);
    process.exit(1);
  }

  if (reporter.idCard) {
    console.log('Reporter already has ID card:', {
      id: reporter.idCard.id,
      cardNumber: reporter.idCard.cardNumber,
      expiresAt: reporter.idCard.expiresAt,
      pdfUrl: reporter.idCard.pdfUrl,
    });
    return;
  }

  const tenantId = reporter.tenantId;
  const settings = await (prisma as any).tenantIdCardSettings.findUnique({ where: { tenantId } });
  if (!settings) {
    console.error('Tenant ID card settings not configured for tenantId=', tenantId);
    process.exit(1);
  }

  const prefix: string = settings.idPrefix || 'ID';
  const digits: number = settings.idDigits || 6;

  // Choose a card number by starting from count+1 and skipping collisions.
  const existingCount = await (prisma as any).reporterIDCard.count({ where: { reporter: { tenantId } } });
  let nextNumber = existingCount + 1;

  let cardNumber = `${prefix}${String(nextNumber).padStart(digits, '0')}`;
  for (let attempts = 0; attempts < 200; attempts++) {
    if (!(await cardNumberExists(cardNumber))) break;
    nextNumber += 1;
    cardNumber = `${prefix}${String(nextNumber).padStart(digits, '0')}`;
  }

  if (await cardNumberExists(cardNumber)) {
    throw new Error(`Could not allocate a unique cardNumber after many attempts. Last tried: ${cardNumber}`);
  }

  const issuedAt = new Date();
  let expiresAt: Date;
  if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
    expiresAt = new Date(settings.fixedValidUntil);
  } else if (typeof settings.validityDays === 'number' && settings.validityDays > 0) {
    expiresAt = new Date(issuedAt.getTime() + settings.validityDays * 24 * 60 * 60 * 1000);
  } else {
    expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  // Use primary active domain as a fallback PDF URL.
  const primaryDomain = await (prisma as any).domain
    .findFirst({ where: { tenantId, status: 'ACTIVE', isPrimary: true }, select: { domain: true } })
    .catch(() => null);
  const anyDomain = primaryDomain || (await (prisma as any).domain.findFirst({ where: { tenantId, status: 'ACTIVE' }, select: { domain: true } }).catch(() => null));
  const baseUrl = anyDomain?.domain ? `https://${anyDomain.domain}` : (process.env.API_BASE_URL || 'https://api.kaburlumedia.com');
  const fallbackPdfUrl = `${baseUrl}/api/v1/id-cards/pdf?reporterId=${encodeURIComponent(reporterId)}&forceRender=true`;

  console.log('\nWill create ReporterIDCard:', {
    reporterId,
    tenantId,
    cardNumber,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    pdfUrl: fallbackPdfUrl,
    regenPdf,
  });

  if (!confirm) {
    console.log('\nDry-run only. Re-run with --confirm to create.');
    return;
  }

  const idCard = await (prisma as any).reporterIDCard.create({
    data: {
      reporterId,
      cardNumber,
      issuedAt,
      expiresAt,
      pdfUrl: fallbackPdfUrl,
    },
  });

  console.log('\nCreated:', { id: idCard.id, cardNumber: idCard.cardNumber, pdfUrl: idCard.pdfUrl });

  if (regenPdf) {
    const result = await generateAndUploadIdCardPdf(reporterId);
    if (result.ok) {
      console.log('PDF regenerated:', result.pdfUrl);
    } else {
      console.error('PDF regeneration failed:', result.error);
    }
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
