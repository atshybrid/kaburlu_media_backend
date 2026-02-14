/**
 * Tenant Subscription Access Middleware
 * Checks if tenant has sufficient balance before allowing login
 */

import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { checkTenantBalance } from '../services/wallet/billing.service';

/**
 * Check if tenant has sufficient balance to continue access
 * Applied to TENANT_ADMIN and REPORTER roles
 */
export async function checkTenantSubscriptionAccess(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    // Only apply to TENANT_ADMIN and REPORTER roles
    if (!user || !['TENANT_ADMIN', 'REPORTER'].includes(user.role?.name)) {
      return next();
    }

    // Get tenant from reporter profile
    const reporter = await prisma.reporter.findFirst({
      where: { userId: user.id },
      include: {
        tenant: {
          include: {
            wallet: true,
          },
        },
      },
    });

    if (!reporter?.tenant) {
      return next();
    }

    const tenant = reporter.tenant;

    // Check if tenant is locked
    if (tenant.subscriptionLocked) {
      return res.status(403).json({
        error: 'Account locked',
        code: 'ACCOUNT_LOCKED',
        reason: tenant.lockedReason,
        lockedAt: tenant.lockedAt,
        message: 'Your account has been locked. Please contact administrator to recharge your account balance.',
      });
    }

    // Check minimum balance requirement (1 month charge)
    const balanceCheck = await checkTenantBalance(tenant.id);

    if (!balanceCheck.hasSufficientBalance) {
      // Lock access
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          subscriptionLocked: true,
          lockedReason: `Insufficient balance. Minimum ₹${balanceCheck.requiredBalance / 100} required.`,
          lockedAt: new Date(),
        },
      });

      return res.status(402).json({
        error: 'Payment required',
        code: 'INSUFFICIENT_BALANCE',
        minimumBalance: balanceCheck.requiredBalance,
        currentBalance: balanceCheck.currentBalance,
        monthlyCharge: balanceCheck.monthlyCharge,
        monthsRemaining: balanceCheck.monthsRemaining,
        message:
          'Your account balance is below the minimum required amount (1 month). Please top up to continue access.',
      });
    }

    // Warn if balance is low (< 1.5 months)
    if (balanceCheck.monthsRemaining < 1.5) {
      // Add warning header but allow access
      res.setHeader('X-Balance-Warning', 'low');
      res.setHeader('X-Months-Remaining', balanceCheck.monthsRemaining.toFixed(1));
    }

    next();
  } catch (error) {
    console.error('Error checking tenant subscription access:', error);
    // Don't block access on error, just log
    next();
  }
}

/**
 * Require active subscription (strict check)
 * Use this for sensitive operations
 */
export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const user = (req as any).user;

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get tenant
    let tenantId: string | undefined;

    if (user.role?.name === 'SUPER_ADMIN') {
      // Super admin can pass tenantId as param or body
      tenantId = req.params.tenantId || req.body.tenantId;
    } else {
      // Get tenant from reporter profile
      const reporter = await prisma.reporter.findFirst({
        where: { userId: user.id },
      });
      tenantId = reporter?.tenantId;
    }

    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant not found' });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { wallet: true },
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.subscriptionLocked) {
      return res.status(403).json({
        error: 'Subscription locked',
        code: 'SUBSCRIPTION_LOCKED',
        reason: tenant.lockedReason,
        message: 'This operation requires an active subscription.',
      });
    }

    // Store tenant in request for controllers
    (req as any).tenant = tenant;

    next();
  } catch (error) {
    console.error('Error checking active subscription:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Super admin only middleware
 */
export async function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user;

  if (!user || user.role?.name !== 'SUPER_ADMIN') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This operation requires super admin access',
    });
  }

  next();
}
