/**
 * Legacy Redis/BullMQ AI rewrite worker was removed.
 *
 * The system now uses a Postgres-backed queue represented by `Article.contentJson.aiQueue`.
 * Run one of:
 * - `npm run jobs:ai-queue` (one-shot)
 * - `npm run jobs:ai-cron` (cron / long-running)
 */

if (require.main === module) {
  // Make it obvious if someone starts the old worker in production.
  // eslint-disable-next-line no-console
  console.error('[aiRewrite.worker] Legacy worker removed. Use `npm run jobs:ai-cron`.');
  process.exitCode = 1;
}

export {};
