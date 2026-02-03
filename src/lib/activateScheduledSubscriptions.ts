/**
 * Subscription Activation Cron Job
 * 
 * Automatically activates SCHEDULED subscriptions when their start date arrives.
 * Run this periodically (e.g., every 5 minutes) via cron or scheduler.
 */

import prisma from './prisma';

export async function activateScheduledSubscriptions() {
  const now = new Date();
  
  try {
    console.log('[SubscriptionActivator] Checking for scheduled subscriptions to activate...');
    
    // Find all SCHEDULED subscriptions where currentPeriodStart <= now
    const scheduledSubs = await (prisma as any).tenantSubscription.findMany({
      where: {
        status: 'SCHEDULED',
        currentPeriodStart: {
          lte: now,
        },
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        plan: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (scheduledSubs.length === 0) {
      console.log('[SubscriptionActivator] No scheduled subscriptions to activate');
      return { activated: 0, failed: 0 };
    }
    
    console.log(`[SubscriptionActivator] Found ${scheduledSubs.length} subscription(s) to activate`);
    
    let activated = 0;
    let failed = 0;
    
    for (const sub of scheduledSubs) {
      try {
        // Update status to ACTIVE
        await (prisma as any).tenantSubscription.update({
          where: { id: sub.id },
          data: {
            status: 'ACTIVE',
            updatedAt: now,
          },
        });
        
        console.log(
          `[SubscriptionActivator] ✓ Activated subscription ${sub.id} for tenant ${sub.tenant.name} (${sub.tenant.slug}), plan: ${sub.plan.name}`
        );
        activated++;
      } catch (e: any) {
        console.error(
          `[SubscriptionActivator] ✗ Failed to activate subscription ${sub.id} for tenant ${sub.tenant.name}:`,
          e.message
        );
        failed++;
      }
    }
    
    console.log(`[SubscriptionActivator] Complete. Activated: ${activated}, Failed: ${failed}`);
    return { activated, failed };
  } catch (e: any) {
    console.error('[SubscriptionActivator] Error checking scheduled subscriptions:', e);
    return { activated: 0, failed: 0, error: e.message };
  }
}

// If run directly (e.g., node -r ts-node/register scripts/activateScheduledSubscriptions.ts)
if (require.main === module) {
  activateScheduledSubscriptions()
    .then((result) => {
      console.log('[SubscriptionActivator] Done:', result);
      process.exit(result.failed > 0 ? 1 : 0);
    })
    .catch((e) => {
      console.error('[SubscriptionActivator] Fatal error:', e);
      process.exit(1);
    });
}
