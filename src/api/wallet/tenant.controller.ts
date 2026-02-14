/**
 * Tenant Self-Service Wallet APIs
 * For tenant admins to check their own wallet balance and usage
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { getWalletBalance, getWalletTransactions } from '../../services/wallet/wallet.service';
import {
  calculateMonthlyCharge,
  checkTenantBalance,
  getCurrentMonthPeriod,
} from '../../services/wallet/billing.service';

/**
 * Get tenant ID from authenticated user
 */
async function getTenantIdFromUser(user: any): Promise<string | null> {
  if (!user) return null;

  if (user.role?.name === 'SUPER_ADMIN') {
    return null; // Super admin doesn't have a tenant
  }

  const reporter = await prisma.reporter.findFirst({
    where: { userId: user.id },
  });

  return reporter?.tenantId || null;
}

/**
 * Get my wallet balance
 * GET /api/v1/tenant/wallet/balance
 */
export async function getMyWalletBalance(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenantId = await getTenantIdFromUser(user);

    if (!tenantId) {
      return res.status(403).json({ error: 'Only tenant users can access this endpoint' });
    }

    const balance = await getWalletBalance(tenantId);
    const balanceCheck = await checkTenantBalance(tenantId);

    return res.json({
      balance: {
        total: balance.balanceMinor,
        locked: balance.lockedBalanceMinor,
        available: balance.availableBalanceMinor,
        currency: balance.currency,
        formatted: {
          total: `₹${(balance.balanceMinor / 100).toFixed(2)}`,
          available: `₹${(balance.availableBalanceMinor / 100).toFixed(2)}`,
        },
      },
      monthlyCharge: balanceCheck.monthlyCharge,
      monthsRemaining: parseFloat(balanceCheck.monthsRemaining.toFixed(2)),
      hasSufficientBalance: balanceCheck.hasSufficientBalance,
      requiredMinimumBalance: balanceCheck.requiredBalance,
      warning: balanceCheck.monthsRemaining < 1.5 ? 'Low balance. Please top up soon.' : null,
    });
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return res.status(500).json({ error: 'Failed to get wallet balance' });
  }
}

/**
 * Get my wallet transactions
 * GET /api/v1/tenant/wallet/transactions
 */
export async function getMyWalletTransactions(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenantId = await getTenantIdFromUser(user);

    if (!tenantId) {
      return res.status(403).json({ error: 'Only tenant users can access this endpoint' });
    }

    const { page, pageSize, type } = req.query;

    const result = await getWalletTransactions(tenantId, {
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      type: type as any,
    });

    return res.json(result);
  } catch (error) {
    console.error('Error getting transactions:', error);
    return res.status(500).json({ error: 'Failed to get transactions' });
  }
}

/**
 * Get my current month usage
 * GET /api/v1/tenant/usage/current-month
 */
export async function getMyCurrentUsage(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenantId = await getTenantIdFromUser(user);

    if (!tenantId) {
      return res.status(403).json({ error: 'Only tenant users can access this endpoint' });
    }

    const period = getCurrentMonthPeriod();
    const calculation = await calculateMonthlyCharge(tenantId, period.start, period.end);

    return res.json({
      period: {
        start: period.start,
        end: period.end,
        month: period.start.toISOString().substring(0, 7),
      },
      usage: {
        epaper: {
          pageCount: calculation.epaperPageCount,
          charge: calculation.epaperChargeMinor,
          chargeFormatted: `₹${(calculation.epaperChargeMinor / 100).toFixed(2)}`,
        },
        newsWebsite: {
          charge: calculation.newsWebsiteChargeMinor,
          chargeFormatted: `₹${(calculation.newsWebsiteChargeMinor / 100).toFixed(2)}`,
        },
        print: {
          charge: calculation.printChargeMinor,
          chargeFormatted: `₹${(calculation.printChargeMinor / 100).toFixed(2)}`,
        },
        other: {
          charge: calculation.otherChargesMinor,
          chargeFormatted: `₹${(calculation.otherChargesMinor / 100).toFixed(2)}`,
        },
        total: {
          charge: calculation.totalChargeMinor,
          chargeFormatted: `₹${(calculation.totalChargeMinor / 100).toFixed(2)}`,
        },
      },
      requiredAdvanceBalance: calculation.requiredBalanceMinor,
      requiredAdvanceBalanceFormatted: `₹${(calculation.requiredBalanceMinor / 100).toFixed(2)}`,
      minimumAdvanceMonths: calculation.minimumAdvanceMonths,
    });
  } catch (error) {
    console.error('Error getting current usage:', error);
    return res.status(500).json({ error: 'Failed to get usage' });
  }
}

/**
 * Get my invoices
 * GET /api/v1/tenant/invoices
 */
export async function getMyInvoices(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenantId = await getTenantIdFromUser(user);

    if (!tenantId) {
      return res.status(403).json({ error: 'Only tenant users can access this endpoint' });
    }

    const { page, pageSize, status } = req.query;
    const currentPage = page ? parseInt(page as string) : 1;
    const currentPageSize = pageSize ? parseInt(pageSize as string) : 20;

    const where: any = { tenantId };
    if (status) {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.billingInvoice.findMany({
        where,
        include: { lineItems: true },
        orderBy: { createdAt: 'desc' },
        skip: (currentPage - 1) * currentPageSize,
        take: currentPageSize,
      }),
      prisma.billingInvoice.count({ where }),
    ]);

    return res.json({
      invoices,
      pagination: {
        page: currentPage,
        pageSize: currentPageSize,
        total,
        totalPages: Math.ceil(total / currentPageSize),
      },
    });
  } catch (error) {
    console.error('Error getting invoices:', error);
    return res.status(500).json({ error: 'Failed to get invoices' });
  }
}

/**
 * Request top-up (generate Razorpay order)
 * POST /api/v1/tenant/wallet/topup-request
 */
export async function requestTopup(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const tenantId = await getTenantIdFromUser(user);

    if (!tenantId) {
      return res.status(403).json({ error: 'Only tenant users can access this endpoint' });
    }

    const { amountMinor, months } = req.body;

    if (!amountMinor || amountMinor <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    // TODO: Integrate with Razorpay order creation
    // For now, just return the request details

    return res.json({
      message: 'Top-up request created. Please contact administrator for payment.',
      amountMinor,
      amount: `₹${(amountMinor / 100).toFixed(2)}`,
      months,
      tenantId,
      // razorpayOrderId: order.id,  // To implement when Razorpay integration is added
    });
  } catch (error) {
    console.error('Error requesting top-up:', error);
    return res.status(500).json({ error: 'Failed to create top-up request' });
  }
}
