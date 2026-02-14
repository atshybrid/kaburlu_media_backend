/**
 * Backfill script to create wallets and default pricing for existing tenants
 * Run this after migration to set up all existing tenants
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Default pricing configuration (can be customized per tenant later)
const DEFAULT_CONFIG = {
  epaper: {
    minPages: 8,
    pricePerPageMinor: 200000, // ₹2000 per page in paise
    discount6Month: 5.0,
    discount12Month: 15.0,
  },
};

async function backfillTenantWallets() {
  console.log('🚀 Starting tenant wallet and pricing backfill...\n');

  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      prgiNumber: true,
    },
  });

  console.log(`Found ${tenants.length} tenants to process\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const tenant of tenants) {
    console.log(`📌 Processing: ${tenant.name} (${tenant.prgiNumber})`);

    try {
      // 1. Create or get wallet
      const wallet = await prisma.tenantWallet.upsert({
        where: { tenantId: tenant.id },
        create: {
          tenantId: tenant.id,
          balanceMinor: 0,
          lockedBalanceMinor: 0,
          currency: 'INR',
        },
        update: {}, // Don't update if exists
      });

      const isNewWallet = wallet.createdAt.getTime() === wallet.updatedAt.getTime();
      if (isNewWallet) {
        console.log(`   ✓ Wallet created (Balance: ₹0)`);
      } else {
        console.log(`   ℹ Wallet already exists (Balance: ₹${wallet.balanceMinor / 100})`);
      }

      // 2. Check if pricing already exists
      const existingPricing = await prisma.tenantPricing.findFirst({
        where: {
          tenantId: tenant.id,
          service: 'EPAPER',
          isActive: true,
        },
      });

      if (existingPricing) {
        console.log(`   ℹ Pricing already configured`);
        skipCount++;
      } else {
        // Create default ePaper pricing
        const pricing = await prisma.tenantPricing.create({
          data: {
            tenantId: tenant.id,
            service: 'EPAPER',
            minEpaperPages: DEFAULT_CONFIG.epaper.minPages,
            pricePerPageMinor: DEFAULT_CONFIG.epaper.pricePerPageMinor,
            discount6MonthPercent: DEFAULT_CONFIG.epaper.discount6Month,
            discount12MonthPercent: DEFAULT_CONFIG.epaper.discount12Month,
            isActive: true,
            effectiveFrom: new Date(),
          },
        });

        const monthlyCharge = DEFAULT_CONFIG.epaper.minPages * DEFAULT_CONFIG.epaper.pricePerPageMinor;
        const requiredAdvance = monthlyCharge * 3; // 3 months

        console.log(`   ✓ Pricing configured:`);
        console.log(`     - Min pages: ${DEFAULT_CONFIG.epaper.minPages}`);
        console.log(`     - Price per page: ₹${DEFAULT_CONFIG.epaper.pricePerPageMinor / 100}`);
        console.log(`     - Monthly charge: ₹${monthlyCharge / 100}`);
        console.log(`     - Required advance (3 months): ₹${requiredAdvance / 100}`);
        console.log(`     - 6-month discount: ${DEFAULT_CONFIG.epaper.discount6Month}%`);
        console.log(`     - 12-month discount: ${DEFAULT_CONFIG.epaper.discount12Month}%`);

        successCount++;
      }

      console.log('');
    } catch (error) {
      console.error(`   ✗ Error processing tenant:`, error.message);
      errorCount++;
      console.log('');
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Backfill Summary:');
  console.log(`   Total tenants: ${tenants.length}`);
  console.log(`   ✓ Successfully configured: ${successCount}`);
  console.log(`   ℹ Skipped (already configured): ${skipCount}`);
  console.log(`   ✗ Errors: ${errorCount}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (successCount > 0) {
    console.log('⚠️  IMPORTANT NEXT STEPS:');
    console.log('   1. Super admin must add initial wallet balance for each tenant');
    console.log('   2. Recommended: 3 months advance payment');
    console.log(`   3. Example: POST /api/v1/admin/tenants/{tenantId}/wallet/topup`);
    console.log('      {');
    console.log('        "amountMinor": 4800000,  // ₹48,000 for 8 pages @ ₹2000');
    console.log('        "description": "Initial 3-month advance"');
    console.log('      }\n');
  }
}

backfillTenantWallets()
  .catch((error) => {
    console.error('❌ Backfill failed:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
