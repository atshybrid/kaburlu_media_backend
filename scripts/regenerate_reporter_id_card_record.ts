/**
 * Regenerate (fix) a reporter ID card DB record to match TenantIdCardSettings.
 *
 * What it does:
 * - Reads reporter + tenant settings
 * - Computes correct cardNumber using settings.idPrefix + settings.idDigits
 * - Computes expiresAt using validityType/fixedValidUntil (or validityDays fallback)
 * - Updates existing ReporterIDCard row (by reporterId)
 * - Clears pdfUrl so PDF can be regenerated
 * - Optionally regenerates and uploads PDF via generateAndUploadIdCardPdf
 *
 * Usage:
 *   npx ts-node scripts/regenerate_reporter_id_card_record.ts <reporterId> [--confirm] [--pdf]
 *
 * Notes:
 * - Without --confirm, this runs as a dry-run (prints what it would do).
 */

import prisma from '../src/lib/prisma';
import { generateAndUploadIdCardPdf } from '../src/lib/idCardPdf';

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseReporterId(): string {
  const reporterId = process.argv[2];
  return String(reporterId || '').trim();
}

function parseTrailingNumber(cardNumber: string): number | null {
  const m = String(cardNumber || '').match(/(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractPreferredSequence(cardNumber: string, digits: number): number | null {
  const raw = String(cardNumber || '').trim();
  if (!raw) return null;

  // Legacy: PREFIX + YYYYMM + NNN (3-digit sequence)
  // Example: KT202602017 -> preferred sequence: 17
  const legacy = raw.match(/^[^0-9]*20\d{2}(0[1-9]|1[0-2])(\d{3})$/);
  if (legacy) {
    const seq3 = Number(legacy[2]);
    return Number.isFinite(seq3) && seq3 > 0 ? seq3 : null;
  }

  // Common: PREFIX + numeric part (often already padded to idDigits)
  const trailing = raw.match(/(\d+)$/);
  if (!trailing) return null;
  const trailingDigits = trailing[1];

  // If trailing digits look like YYYYMMNNN, take the last 3 as the sequence.
  const yyyymmNnn = trailingDigits.match(/^20\d{2}(0[1-9]|1[0-2])(\d{3})$/);
  if (yyyymmNnn) {
    const seq3 = Number(yyyymmNnn[2]);
    return Number.isFinite(seq3) && seq3 > 0 ? seq3 : null;
  }

  // Otherwise use the full trailing number.
  const n = Number(trailingDigits);
  if (!Number.isFinite(n) || n <= 0) return null;

  // Guard: if it's absurdly large compared to configured digits, treat as unknown.
  // (e.g. a combined timestamp-like number)
  if (digits > 0 && trailingDigits.length > Math.max(12, digits * 3)) return null;

  return n;
}

async function cardNumberExists(cardNumber: string, excludeReporterId?: string): Promise<boolean> {
  const where: any = { cardNumber };
  if (excludeReporterId) {
    where.NOT = { reporterId: excludeReporterId };
  }
  const existing = await (prisma as any).reporterIDCard.findFirst({ where, select: { id: true } });
  return !!existing;
}

async function main() {
  const reporterId = parseReporterId();
  const confirm = hasFlag('--confirm');
  const regenPdf = hasFlag('--pdf');

  if (!reporterId) {
    console.error('Usage: npx ts-node scripts/regenerate_reporter_id_card_record.ts <reporterId> [--confirm] [--pdf]');
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

  if (!reporter.tenantId) {
    console.error('Reporter has no tenantId:', reporterId);
    process.exit(1);
  }

  if (!reporter.idCard) {
    console.error('Reporter has no existing ID card row to update. Create it via API first. reporterId=', reporterId);
    process.exit(1);
  }

  const settings = await (prisma as any).tenantIdCardSettings.findUnique({
    where: { tenantId: reporter.tenantId },
  });

  if (!settings) {
    console.error('Tenant ID card settings not configured for tenantId=', reporter.tenantId);
    process.exit(1);
  }

  const prefix: string = settings.idPrefix || 'ID';
  const digits: number = settings.idDigits || 6;

  // Prefer keeping the numeric sequence from the existing cardNumber (e.g. KT202602017 -> 17)
  // so numbering stays consistent for already-issued cards.
  const preferredNumber = extractPreferredSequence(reporter.idCard.cardNumber, digits);

  const countExcludingThis = await (prisma as any).reporterIDCard.count({
    where: {
      reporter: { tenantId: reporter.tenantId },
      NOT: { reporterId },
    },
  });

  let nextNumber = preferredNumber && preferredNumber > 0 ? preferredNumber : countExcludingThis + 1;

  let newCardNumber = `${prefix}${String(nextNumber).padStart(digits, '0')}`;
  while (await cardNumberExists(newCardNumber, reporterId)) {
    nextNumber += 1;
    newCardNumber = `${prefix}${String(nextNumber).padStart(digits, '0')}`;
  }

  // By default, keep issuedAt unchanged. This is a correction, not necessarily a reissue.
  const issuedAt = new Date(reporter.idCard.issuedAt);

  let expiresAt: Date;
  if (settings.validityType === 'FIXED_END_DATE' && settings.fixedValidUntil) {
    expiresAt = new Date(settings.fixedValidUntil);
  } else if (typeof settings.validityDays === 'number' && settings.validityDays > 0) {
    expiresAt = new Date(issuedAt.getTime() + settings.validityDays * 24 * 60 * 60 * 1000);
  } else {
    // Last-resort fallback (should not happen with the current schema expectations)
    expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  }

  console.log('\nReporter:', reporterId);
  console.log('Tenant:', reporter.tenantId);
  console.log('Old cardNumber:', reporter.idCard.cardNumber);
  console.log('New cardNumber:', newCardNumber);
  console.log('Old expiresAt:', new Date(reporter.idCard.expiresAt).toISOString());
  console.log('New expiresAt:', expiresAt.toISOString());
  console.log('PDF regen:', regenPdf ? 'yes' : 'no');

  if (!confirm) {
    console.log('\nDry-run only. Re-run with --confirm to apply changes.');
    return;
  }

  const updated = await (prisma as any).reporterIDCard.update({
    where: { reporterId },
    data: {
      cardNumber: newCardNumber,
      issuedAt,
      expiresAt,
      pdfUrl: null,
    },
  });

  console.log('\nUpdated ReporterIDCard:', updated.id);

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
