#!/usr/bin/env node
/**
 * Local `DATABASE_URL` often points at DO Managed Postgres (:25060) which is not reachable from Mac → P1001.
 * Production migrations run on the droplet (localhost:5432).
 */
const url = process.env.DATABASE_URL || '';
const isManagedDo = /ondigitalocean\.com:25060/.test(url);

console.error(`
Prisma migrate — use the correct target:

  Production (API server DB):  npm run migrate:droplet
  Deploy code + migrate:       npm run deploy:droplet   (now syncs prisma/ to server)

  Do NOT run "npx prisma migrate deploy" on Mac if .env uses DO Managed DB :25060
  (Error P1001: Can't reach database server).

  Optional — tunnel to droplet Postgres:
    ./tunnel_db.sh
    DATABASE_URL=postgresql://USER:PASS@localhost:5433/kaburlutoday npx prisma migrate deploy --schema prisma/schema.prisma
`);

if (isManagedDo) {
  process.exit(1);
}

const { execSync } = require('child_process');
execSync('npx prisma migrate deploy --schema prisma/schema.prisma', {
  stdio: 'inherit',
  env: process.env,
});
