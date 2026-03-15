import 'dotenv/config';

import prisma from '../src/lib/prisma';
import { ensureDomainPushVapidKeys } from '../src/lib/pushVapidKeys';

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function run() {
  const force = hasFlag('force');
  const dryRun = hasFlag('dry-run');

  try {
    const domains: Array<{ id: string; tenantId: string; domain: string }> = await (prisma as any).domain.findMany({
      select: { id: true, tenantId: true, domain: true },
      orderBy: [{ createdAt: 'asc' }],
    });

    let updated = 0;
    let createdSettings = 0;
    let skipped = 0;

    console.log(`[push-vapid-backfill] total domains: ${domains.length}, dryRun: ${dryRun}, force: ${force}`);

    for (const d of domains) {
      if (dryRun) {
        const existing = await (prisma as any).domainSettings.findUnique({ where: { domainId: d.id } }).catch(() => null);
        const push = (existing?.data as any)?.integrations?.push || {};
        const hasPublic = Boolean(push.webPushVapidPublicKey || push.vapidPublicKey);
        const hasPrivate = Boolean(push.webPushVapidPrivateKey || push.vapidPrivateKey);
        if (hasPublic && hasPrivate && !force) {
          skipped++;
        } else {
          updated++;
        }
        continue;
      }

      const result = await ensureDomainPushVapidKeys(d.id, {
        tenantId: d.tenantId,
        forceRegenerate: force,
      });

      if (result.updated) {
        updated++;
        if (result.createdSettings) createdSettings++;
      } else {
        skipped++;
      }
    }

    console.log('[push-vapid-backfill] done');
    console.log('updated:', updated);
    console.log('createdSettings:', createdSettings);
    console.log('skipped:', skipped);
  } catch (e: any) {
    console.error('[push-vapid-backfill] failed:', e?.message || e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch(() => null);
  }
}

run();
