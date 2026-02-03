/**
 * Reporter Subscription Auto-Activation
 * 
 * Automatically activates reporter subscriptions when their scheduled date arrives.
 * Used for payment-based subscriptions where activation should happen on a specific date.
 */

import prisma from './prisma';

export async function activateReporterSubscriptions() {
  const now = new Date();
  
  try {
    console.log('[ReporterSubscriptionActivator] Checking for scheduled reporter subscriptions...');
    
    // Find reporters with subscriptionActivationDate <= now and subscriptionActive = false
    const reporters = await (prisma as any).reporter.findMany({
      where: {
        subscriptionActive: false,
        subscriptionActivationDate: {
          lte: now,
          not: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            mobile: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        designation: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (reporters.length === 0) {
      console.log('[ReporterSubscriptionActivator] No subscriptions to activate');
      return { activated: 0, failed: 0 };
    }
    
    console.log(`[ReporterSubscriptionActivator] Found ${reporters.length} subscription(s) to activate`);
    
    let activated = 0;
    let failed = 0;
    
    for (const reporter of reporters) {
      try {
        // Activate subscription
        await (prisma as any).reporter.update({
          where: { id: reporter.id },
          data: {
            subscriptionActive: true,
            updatedAt: now,
          },
        });
        
        const userName = reporter.user?.mobile || 'Unknown';
        const tenantName = reporter.tenant?.name || 'Unknown tenant';
        const designation = reporter.designation?.name || 'Reporter';
        
        console.log(
          `[ReporterSubscriptionActivator] ✓ Activated subscription for ${designation} ${userName} in ${tenantName}`
        );
        activated++;
      } catch (e: any) {
        console.error(
          `[ReporterSubscriptionActivator] ✗ Failed to activate reporter ${reporter.id}:`,
          e.message
        );
        failed++;
      }
    }
    
    console.log(`[ReporterSubscriptionActivator] Complete. Activated: ${activated}, Failed: ${failed}`);
    return { activated, failed };
  } catch (e: any) {
    console.error('[ReporterSubscriptionActivator] Error:', e);
    return { activated: 0, failed: 0, error: e.message };
  }
}

// If run directly
if (require.main === module) {
  activateReporterSubscriptions()
    .then((result) => {
      console.log('[ReporterSubscriptionActivator] Done:', result);
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch((e) => {
      console.error('[ReporterSubscriptionActivator] Fatal error:', e);
      process.exit(1);
    });
}
