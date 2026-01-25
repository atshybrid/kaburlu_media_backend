// Using require to avoid missing type declaration issues if @types/razorpay not installed
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Razorpay = require('razorpay');
import prisma from '../../lib/prisma';

/**
 * Get Razorpay configuration for a tenant (or global fallback)
 */
export async function getRazorpayConfigForTenant(tenantId: string) {
  const config = await (prisma as any).razorpayConfig.findFirst({
    where: {
      OR: [
        { tenantId },
        { tenantId: null }
      ],
      active: true,
    },
    orderBy: { tenantId: 'desc' }, // tenant-specific preferred over global
  });

  return config;
}

/**
 * Get Razorpay client instance for a tenant
 */
export async function getRazorpayClientForTenant(tenantId: string) {
  const config = await getRazorpayConfigForTenant(tenantId);

  if (!config) {
    throw new Error('Razorpay configuration not found for tenant or global');
  }

  return new Razorpay({
    key_id: config.keyId,
    key_secret: config.keySecret,
  });
}
