/**
 * Tenant Billing Service
 * Handles monthly billing, usage tracking, and invoice generation
 */

import prisma from '../../lib/prisma';
import { TenantService, InvoiceStatus, BillingComponent, BillingInvoiceKind } from '@prisma/client';
import { debitWallet, lockBalance, unlockBalance } from './wallet.service';
import { Decimal } from '@prisma/client/runtime/library';

export interface MonthlyChargeCalculation {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
  epaperPageCount: number;
  epaperChargeMinor: number;
  newsWebsiteChargeMinor: number;
  printChargeMinor: number;
  otherChargesMinor: number;
  totalChargeMinor: number;
  minimumAdvanceMonths: number;
  requiredBalanceMinor: number;
}

/**
 * Get active tenant pricing for a service
 */
export async function getTenantPricing(tenantId: string, service: TenantService, date: Date = new Date()) {
  return prisma.tenantPricing.findFirst({
    where: {
      tenantId,
      service,
      isActive: true,
      effectiveFrom: { lte: date },
      OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: date } }],
    },
    orderBy: { effectiveFrom: 'desc' },
  });
}

/**
 * Calculate monthly charge for a tenant
 */
export async function calculateMonthlyCharge(
  tenantId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<MonthlyChargeCalculation> {
  // Get usage for the period
  let usage = await prisma.tenantUsageMonthly.findUnique({
    where: {
      tenantId_periodStart: { tenantId, periodStart },
    },
  });

  if (!usage) {
    usage = await prisma.tenantUsageMonthly.create({
      data: {
        tenantId,
        periodStart,
        periodEnd,
        epaperPageCount: 0,
        epaperChargeMinor: 0,
        newsWebsiteActive: false,
        newsWebsiteChargeMinor: 0,
        printChargeMinor: 0,
        otherChargesMinor: 0,
        totalChargeMinor: 0,
      },
    });
  }

  // Get ePaper pricing
  const epaperPricing = await getTenantPricing(tenantId, TenantService.EPAPER, periodStart);
  let epaperChargeMinor = 0;

  if (epaperPricing) {
    const pageCount = Math.max(usage.epaperPageCount, epaperPricing.minEpaperPages || 8);
    epaperChargeMinor = pageCount * (epaperPricing.pricePerPageMinor || 0);
  }

  // Get news website pricing
  const newsWebsitePricing = await getTenantPricing(tenantId, TenantService.NEWS_WEBSITE, periodStart);
  let newsWebsiteChargeMinor = 0;

  if (newsWebsitePricing && usage.newsWebsiteActive) {
    newsWebsiteChargeMinor = newsWebsitePricing.monthlyFeeMinor || 0;
  }

  // Get print service pricing
  const printPricing = await getTenantPricing(tenantId, TenantService.PRINT_SERVICE, periodStart);
  let printChargeMinor = 0;

  if (printPricing) {
    printChargeMinor = printPricing.monthlyFeeMinor || 0;
  }

  const totalChargeMinor =
    epaperChargeMinor + newsWebsiteChargeMinor + printChargeMinor + usage.otherChargesMinor;

  // Update usage charges
  await prisma.tenantUsageMonthly.update({
    where: { id: usage.id },
    data: {
      epaperChargeMinor,
      newsWebsiteChargeMinor,
      printChargeMinor,
      totalChargeMinor,
    },
  });

  const minimumAdvanceMonths = 3; // Hardcoded for now, can move to config
  const requiredBalanceMinor = totalChargeMinor * minimumAdvanceMonths;

  return {
    tenantId,
    periodStart,
    periodEnd,
    epaperPageCount: epaperPricing ? Math.max(usage.epaperPageCount, epaperPricing.minEpaperPages || 8) : 0,
    epaperChargeMinor,
    newsWebsiteChargeMinor,
    printChargeMinor,
    otherChargesMinor: usage.otherChargesMinor,
    totalChargeMinor,
    minimumAdvanceMonths,
    requiredBalanceMinor,
  };
}

/**
 * Generate monthly invoice
 */
export async function generateMonthlyInvoice(tenantId: string, periodStart: Date, periodEnd: Date) {
  // Calculate charges
  const calculation = await calculateMonthlyCharge(tenantId, periodStart, periodEnd);

  if (calculation.totalChargeMinor === 0) {
    console.log(`No charges for tenant ${tenantId} for period ${periodStart} - ${periodEnd}`);
    return null;
  }

  // Create invoice
  const invoice = await prisma.billingInvoice.create({
    data: {
      tenantId,
      kind: BillingInvoiceKind.SUBSCRIPTION,
      status: InvoiceStatus.OPEN,
      periodStart,
      periodEnd,
      totalAmountMinor: calculation.totalChargeMinor,
      lineItems: {
        create: buildInvoiceLineItems(calculation),
      },
    },
    include: { lineItems: true },
  });

  // Link invoice to usage
  await prisma.tenantUsageMonthly.update({
    where: { tenantId_periodStart: { tenantId, periodStart } },
    data: { invoiceId: invoice.id },
  });

  // Try to deduct from wallet
  try {
    await debitWallet({
      tenantId,
      amountMinor: calculation.totalChargeMinor,
      description: `Monthly charges for ${periodStart.toISOString().substring(0, 7)}`,
      referenceType: 'INVOICE',
      referenceId: invoice.id,
    });

    // Mark invoice as paid
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PAID, paidAt: new Date() },
    });
  } catch (error) {
    // Insufficient balance - mark as PAST_DUE
    await prisma.billingInvoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.PAST_DUE },
    });

    // Lock tenant access
    await lockTenantAccess(
      tenantId,
      `Insufficient balance for monthly charges (Required: ₹${calculation.totalChargeMinor / 100})`
    );
  }

  return invoice;
}

/**
 * Build invoice line items from calculation
 */
function buildInvoiceLineItems(calculation: MonthlyChargeCalculation) {
  const lineItems: any[] = [];

  if (calculation.epaperChargeMinor > 0) {
    lineItems.push({
      component: BillingComponent.EPAPER_PAGE,
      description: `ePaper pages (${calculation.epaperPageCount} pages)`,
      quantity: calculation.epaperPageCount,
      unitAmountMinor: calculation.epaperChargeMinor / calculation.epaperPageCount,
      amountMinor: calculation.epaperChargeMinor,
    });
  }

  if (calculation.newsWebsiteChargeMinor > 0) {
    lineItems.push({
      component: BillingComponent.NEWS_WEBSITE_MONTHLY,
      description: 'News Website - Monthly Fee',
      quantity: 1,
      unitAmountMinor: calculation.newsWebsiteChargeMinor,
      amountMinor: calculation.newsWebsiteChargeMinor,
    });
  }

  if (calculation.printChargeMinor > 0) {
    lineItems.push({
      component: BillingComponent.PRINT_MONTHLY,
      description: 'Print Service - Monthly Fee',
      quantity: 1,
      unitAmountMinor: calculation.printChargeMinor,
      amountMinor: calculation.printChargeMinor,
    });
  }

  if (calculation.otherChargesMinor > 0) {
    lineItems.push({
      component: BillingComponent.CUSTOM_SERVICE,
      description: 'Other Charges',
      quantity: 1,
      unitAmountMinor: calculation.otherChargesMinor,
      amountMinor: calculation.otherChargesMinor,
    });
  }

  return lineItems;
}

/**
 * Track ePaper page count
 */
export async function trackEpaperPageCount(tenantId: string, pageCount: number, issueDate: Date) {
  const periodStart = new Date(issueDate.getFullYear(), issueDate.getMonth(), 1);
  const periodEnd = new Date(issueDate.getFullYear(), issueDate.getMonth() + 1, 0, 23, 59, 59, 999);

  await prisma.tenantUsageMonthly.upsert({
    where: {
      tenantId_periodStart: { tenantId, periodStart },
    },
    update: {
      epaperPageCount: { increment: pageCount },
    },
    create: {
      tenantId,
      periodStart,
      periodEnd,
      epaperPageCount: pageCount,
    },
  });
}

/**
 * Lock tenant access
 */
export async function lockTenantAccess(tenantId: string, reason: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionLocked: true,
      lockedReason: reason,
      lockedAt: new Date(),
    },
  });
}

/**
 * Unlock tenant access
 */
export async function unlockTenantAccess(tenantId: string) {
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionLocked: false,
      lockedReason: null,
      lockedAt: null,
    },
  });
}

/**
 * Check if tenant has sufficient balance
 */
export async function checkTenantBalance(tenantId: string): Promise<{
  hasSufficientBalance: boolean;
  monthlyCharge: number;
  currentBalance: number;
  requiredBalance: number;
  monthsRemaining: number;
}> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const calculation = await calculateMonthlyCharge(tenantId, periodStart, periodEnd);

  const wallet = await prisma.tenantWallet.findUnique({ where: { tenantId } });
  const currentBalance = wallet?.balanceMinor || 0;

  const monthsRemaining = calculation.totalChargeMinor > 0 ? currentBalance / calculation.totalChargeMinor : 999;
  const hasSufficientBalance = monthsRemaining >= 1; // Minimum 1 month required

  return {
    hasSufficientBalance,
    monthlyCharge: calculation.totalChargeMinor,
    currentBalance,
    requiredBalance: calculation.totalChargeMinor, // Minimum 1 month
    monthsRemaining,
  };
}

/**
 * Calculate bulk discount
 */
export async function calculateBulkDiscount(
  tenantId: string,
  months: number
): Promise<{
  monthlyCharge: number;
  months: number;
  subtotal: number;
  discountPercent: number;
  discount: number;
  total: number;
}> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const calculation = await calculateMonthlyCharge(tenantId, periodStart, periodEnd);
  const monthlyCharge = calculation.totalChargeMinor;
  const subtotal = monthlyCharge * months;

  // Get ePaper pricing for discount rates
  const pricing = await getTenantPricing(tenantId, TenantService.EPAPER);

  let discountPercent = 0;
  if (months >= 12 && pricing?.discount12MonthPercent) {
    discountPercent = Number(pricing.discount12MonthPercent);
  } else if (months >= 6 && pricing?.discount6MonthPercent) {
    discountPercent = Number(pricing.discount6MonthPercent);
  }

  const discount = Math.round((subtotal * discountPercent) / 100);
  const total = subtotal - discount;

  return {
    monthlyCharge,
    months,
    subtotal,
    discountPercent,
    discount,
    total,
  };
}

/**
 * Get billing period dates
 */
export function getPreviousMonthPeriod() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  return { start: periodStart, end: periodEnd };
}

export function getCurrentMonthPeriod() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start: periodStart, end: periodEnd };
}
