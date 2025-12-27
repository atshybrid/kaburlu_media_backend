import cron from 'node-cron';
import prisma from '../lib/prisma';
import { runOnce } from './aiQueue.worker';

const schedule = String(process.env.AI_QUEUE_CRON || '*/1 * * * *');

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    await prisma.$connect();
    const processed = await runOnce();
    // eslint-disable-next-line no-console
    console.log(`[ai-queue-cron] tick processed=${processed}`);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ai-queue-cron] tick error', (e as any)?.message || e);
  } finally {
    running = false;
  }
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`[ai-queue-cron] started schedule=${schedule}`);

  cron.schedule(schedule, () => {
    void tick();
  });

  // Run once immediately on startup
  await tick();

  const graceful = async (signal?: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[ai-queue-cron] Received ${signal ?? 'signal'}, shutting down...`);
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', () => void graceful('SIGINT'));
  process.on('SIGTERM', () => void graceful('SIGTERM'));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[ai-queue-cron] failed to start', e);
  process.exit(1);
});
