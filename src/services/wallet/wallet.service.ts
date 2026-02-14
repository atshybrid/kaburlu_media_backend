/**
 * Tenant Wallet Service
 * Handles wallet balance, transactions, and top-ups
 */

import prisma from '../../lib/prisma';
import { BillingCurrency, WalletTransactionType } from '@prisma/client';

export interface WalletBalance {
  tenantId: string;
  balanceMinor: number;
  lockedBalanceMinor: number;
  availableBalanceMinor: number;
  currency: BillingCurrency;
}

export interface TopupOptions {
  tenantId: string;
  amountMinor: number;
  description: string;
  referenceId?: string;
  createdBy?: string;
  meta?: any;
}

export interface DeductOptions {
  tenantId: string;
  amountMinor: number;
  description: string;
  referenceType: string;
  referenceId: string;
  createdBy?: string;
}

/**
 * Get or create tenant wallet
 */
export async function getOrCreateWallet(tenantId: string) {
  let wallet = await prisma.tenantWallet.findUnique({
    where: { tenantId },
  });

  if (!wallet) {
    wallet = await prisma.tenantWallet.create({
      data: {
        tenantId,
        balanceMinor: 0,
        lockedBalanceMinor: 0,
        currency: 'INR',
      },
    });
  }

  return wallet;
}

/**
 * Get current wallet balance
 */
export async function getWalletBalance(tenantId: string): Promise<WalletBalance> {
  const wallet = await getOrCreateWallet(tenantId);

  return {
    tenantId,
    balanceMinor: wallet.balanceMinor,
    lockedBalanceMinor: wallet.lockedBalanceMinor,
    availableBalanceMinor: wallet.balanceMinor - wallet.lockedBalanceMinor,
    currency: wallet.currency,
  };
}

/**
 * Add money to wallet (top-up)
 */
export async function creditWallet(options: TopupOptions) {
  const { tenantId, amountMinor, description, referenceId, createdBy, meta } = options;

  if (amountMinor <= 0) {
    throw new Error('Credit amount must be positive');
  }

  const wallet = await getOrCreateWallet(tenantId);
  const newBalance = wallet.balanceMinor + amountMinor;

  const result = await prisma.$transaction([
    prisma.tenantWallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: newBalance },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.CREDIT,
        amountMinor: amountMinor,
        balanceAfterMinor: newBalance,
        description,
        referenceType: 'TOPUP',
        referenceId,
        meta,
        createdBy,
      },
    }),
  ]);

  return {
    wallet: result[0],
    transaction: result[1],
  };
}

/**
 * Deduct money from wallet
 */
export async function debitWallet(options: DeductOptions) {
  const { tenantId, amountMinor, description, referenceType, referenceId, createdBy } = options;

  if (amountMinor <= 0) {
    throw new Error('Debit amount must be positive');
  }

  const wallet = await getOrCreateWallet(tenantId);

  if (wallet.balanceMinor < amountMinor) {
    throw new Error(
      `Insufficient balance. Required: ₹${amountMinor / 100}, Available: ₹${wallet.balanceMinor / 100}`
    );
  }

  const newBalance = wallet.balanceMinor - amountMinor;

  const result = await prisma.$transaction([
    prisma.tenantWallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: newBalance },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.DEBIT,
        amountMinor: -amountMinor, // Negative for debit
        balanceAfterMinor: newBalance,
        description,
        referenceType,
        referenceId,
        createdBy,
      },
    }),
  ]);

  return {
    wallet: result[0],
    transaction: result[1],
  };
}

/**
 * Lock balance for pending invoice
 */
export async function lockBalance(tenantId: string, amountMinor: number, referenceId: string) {
  const wallet = await getOrCreateWallet(tenantId);

  const availableBalance = wallet.balanceMinor - wallet.lockedBalanceMinor;
  if (availableBalance < amountMinor) {
    throw new Error('Insufficient available balance to lock');
  }

  const newLockedBalance = wallet.lockedBalanceMinor + amountMinor;

  const result = await prisma.$transaction([
    prisma.tenantWallet.update({
      where: { id: wallet.id },
      data: { lockedBalanceMinor: newLockedBalance },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.LOCK,
        amountMinor: amountMinor,
        balanceAfterMinor: wallet.balanceMinor,
        description: 'Balance locked for invoice',
        referenceType: 'INVOICE',
        referenceId,
      },
    }),
  ]);

  return result[0];
}

/**
 * Unlock previously locked balance
 */
export async function unlockBalance(tenantId: string, amountMinor: number, referenceId: string) {
  const wallet = await getOrCreateWallet(tenantId);

  const newLockedBalance = Math.max(0, wallet.lockedBalanceMinor - amountMinor);

  const result = await prisma.$transaction([
    prisma.tenantWallet.update({
      where: { id: wallet.id },
      data: { lockedBalanceMinor: newLockedBalance },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.UNLOCK,
        amountMinor: -amountMinor,
        balanceAfterMinor: wallet.balanceMinor,
        description: 'Balance unlocked',
        referenceType: 'INVOICE',
        referenceId,
      },
    }),
  ]);

  return result[0];
}

/**
 * Get wallet transaction history
 */
export async function getWalletTransactions(
  tenantId: string,
  options?: {
    page?: number;
    pageSize?: number;
    type?: WalletTransactionType;
  }
) {
  const wallet = await getOrCreateWallet(tenantId);
  const page = options?.page || 1;
  const pageSize = options?.pageSize || 50;

  const where: any = { walletId: wallet.id };
  if (options?.type) {
    where.type = options.type;
  }

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    transactions,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  };
}

/**
 * Refund to wallet
 */
export async function refundWallet(
  tenantId: string,
  amountMinor: number,
  description: string,
  referenceId?: string,
  createdBy?: string
) {
  return creditWallet({
    tenantId,
    amountMinor,
    description,
    referenceId,
    createdBy,
    meta: { type: 'REFUND' },
  });
}

/**
 * Manual balance adjustment (admin only)
 */
export async function adjustBalance(
  tenantId: string,
  amountMinor: number, // Can be positive or negative
  description: string,
  createdBy: string
) {
  const wallet = await getOrCreateWallet(tenantId);
  const newBalance = wallet.balanceMinor + amountMinor;

  if (newBalance < 0) {
    throw new Error('Adjustment would result in negative balance');
  }

  const result = await prisma.$transaction([
    prisma.tenantWallet.update({
      where: { id: wallet.id },
      data: { balanceMinor: newBalance },
    }),
    prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: WalletTransactionType.ADJUSTMENT,
        amountMinor: amountMinor,
        balanceAfterMinor: newBalance,
        description,
        referenceType: 'ADJUSTMENT',
        createdBy,
      },
    }),
  ]);

  return {
    wallet: result[0],
    transaction: result[1],
  };
}
