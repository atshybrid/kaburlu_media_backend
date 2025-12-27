// Thin wrapper to run the existing Prisma-based AI queue worker.
// It invokes the job processor implemented in src/jobs/aiQueue.worker.ts.
// Build with tsc and run: node dist/workers/webRewrite.worker.js

import '../jobs/aiQueue.worker';
