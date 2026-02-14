/**
 * Wallet Controller - Admin APIs for wallet management
 */

import { Request, Response } from 'express';
import {
  getWalletBalance,
  creditWallet,
  debitWallet,
  getWalletTransactions,
  adjustBalance,
  refundWallet,
} from '../../services/wallet/wallet.service';
import {
  calculateMonthlyCharge,
  calculateBulkDiscount,
  lockTenantAccess,
  unlockTenantAccess,
  getCurrentMonthPeriod,
} from '../../services/wallet/billing.service';

/**
 * Get wallet balance
 * GET /api/v1/admin/tenants/:tenantId/wallet
 */
export async function getWallet(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const balance = await getWalletBalance(tenantId);
    const period = getCurrentMonthPeriod();
    const calculation = await calculateMonthlyCharge(tenantId, period.start, period.end);

    const monthsRemaining =
      calculation.totalChargeMinor > 0 ? balance.availableBalanceMinor / calculation.totalChargeMinor : 999;

    return res.json({
      balance,
      monthlyCharge: calculation.totalChargeMinor,
      monthsRemaining: monthsRemaining.toFixed(2),
      hasSufficientBalance: monthsRemaining >= 1,
      requiredMinimumBalance: calculation.requiredBalanceMinor,
    });
  } catch (error) {
    console.error('Error getting wallet:', error);
    return res.status(500).json({ error: 'Failed to get wallet balance' });
  }
}

/**
 * Top-up wallet
 * POST /api/v1/admin/tenants/:tenantId/wallet/topup
 */
export async function topupWallet(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { amountMinor, description, razorpayOrderId, meta } = req.body;
    const user = (req as any).user;

    if (!amountMinor || amountMinor <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await creditWallet({
      tenantId,
      amountMinor,
      description: description || 'Wallet top-up',
      referenceId: razorpayOrderId,
      createdBy: user?.id,
      meta,
    });

    // Unlock tenant if it was locked
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.subscriptionLocked) {
      await unlockTenantAccess(tenantId);
    }

    return res.json({
      message: 'Wallet topped up successfully',
      wallet: result.wallet,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error('Error topping up wallet:', error);
    return res.status(500).json({ error: 'Failed to top up wallet' });
  }
}

/**
 * Bulk payment with discount
 * POST /api/v1/admin/tenants/:tenantId/wallet/topup-bulk
 */
export async function topupBulk(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { months, razorpayOrderId } = req.body;
    const user = (req as any).user;

    if (!months || months < 1) {
      return res.status(400).json({ error: 'Invalid months' });
    }

    // Calculate with discount
    const calculation = await calculateBulkDiscount(tenantId, months);

    // Credit wallet
    const result = await creditWallet({
      tenantId,
      amountMinor: calculation.total,
      description: `${months}-month bulk payment (${calculation.discountPercent}% discount)`,
      referenceId: razorpayOrderId,
      createdBy: user?.id,
      meta: {
        months,
        monthlyCharge: calculation.monthlyCharge,
        subtotal: calculation.subtotal,
        discount: calculation.discount,
        discountPercent: calculation.discountPercent,
      },
    });

    // Unlock tenant if locked
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
    if (tenant?.subscriptionLocked) {
      await unlockTenantAccess(tenantId);
    }

    return res.json({
      message: 'Bulk payment successful',
      calculation,
      wallet: result.wallet,
      transaction: result.transaction,
    });
  } catch (error) {
    console.error('Error processing bulk payment:', error);
    return res.status(500).json({ error: 'Failed to process bulk payment' });
  }
}

/**
 * Adjust wallet balance (admin only)
 * POST /api/v1/admin/tenants/:tenantId/wallet/adjust
 */
export async function adjustWallet(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { amountMinor, description } = req.body;
    const user = (req as any).user;

    if (!amountMinor || !description) {
      return res.status(400).json({ error: 'Amount and description required' });
    }

    if (!user || user.role?.name !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only super admin can adjust wallet balance' });
    }

    const result = await adjustBalance(tenantId, amountMinor, description, user.id);

    return res.json({
      message: 'Wallet adjusted successfully',
      wallet: result.wallet,
      transaction: result.transaction,
    });
  } catch (error: any) {
    console.error('Error adjusting wallet:', error);
    return res.status(500).json({ error: error.message || 'Failed to adjust wallet' });
  }
}

/**
 * Get wallet transactions
 * GET /api/v1/admin/tenants/:tenantId/wallet/transactions
 */
export async function getTransactions(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
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
 * Lock tenant access
 * POST /api/v1/admin/tenants/:tenantId/lock
 */
export async function lockTenant(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Reason required' });
    }

    await lockTenantAccess(tenantId, reason);

    return res.json({ message: 'Tenant locked successfully' });
  } catch (error) {
    console.error('Error locking tenant:', error);
    return res.status(500).json({ error: 'Failed to lock tenant' });
  }
}

/**
 * Unlock tenant access
 * POST /api/v1/admin/tenants/:tenantId/unlock
 */
export async function unlockTenant(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    await unlockTenantAccess(tenantId);

    return res.json({ message: 'Tenant unlocked successfully' });
  } catch (error) {
    console.error('Error unlocking tenant:', error);
    return res.status(500).json({ error: 'Failed to unlock tenant' });
  }
}

/**
 * Get current month usage
 * GET /api/v1/admin/tenants/:tenantId/usage/current
 */
export async function getCurrentUsage(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const period = getCurrentMonthPeriod();

    const calculation = await calculateMonthlyCharge(tenantId, period.start, period.end);

    return res.json({
      period: {
        start: period.start,
        end: period.end,
      },
      usage: {
        epaperPageCount: calculation.epaperPageCount,
        epaperCharge: calculation.epaperChargeMinor,
        newsWebsiteCharge: calculation.newsWebsiteChargeMinor,
        printCharge: calculation.printChargeMinor,
        otherCharges: calculation.otherChargesMinor,
        totalCharge: calculation.totalChargeMinor,
      },
      minimumAdvanceMonths: calculation.minimumAdvanceMonths,
      requiredBalance: calculation.requiredBalanceMinor,
    });
  } catch (error) {
    console.error('Error getting current usage:', error);
    return res.status(500).json({ error: 'Failed to get usage' });
  }
}

/**
 * Get bulk discount calculation (preview)
 * POST /api/v1/admin/tenants/:tenantId/wallet/calculate-bulk
 */
export async function calculateBulkDiscountPreview(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const { months } = req.body;

    if (!months || months < 1) {
      return res.status(400).json({ error: 'Invalid months' });
    }

    const calculation = await calculateBulkDiscount(tenantId, months);

    return res.json(calculation);
  } catch (error) {
    console.error('Error calculating bulk discount:', error);
    return res.status(500).json({ error: 'Failed to calculate discount' });
  }
}

// Re-export prisma import
import prisma from '../../lib/prisma';
