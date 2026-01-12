const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function getEnvFromDotenv(name) {
  const envPath = path.join(process.cwd(), '.env');
  const txt = fs.readFileSync(envPath, 'utf8');
  const line = txt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && l.startsWith(name + '='));
  if (!line) return null;
  let v = line.slice(name.length + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

async function main() {
  const url = process.env.DATABASE_URL || getEnvFromDotenv('DATABASE_URL');
  if (!url) {
    throw new Error('DATABASE_URL not found in environment or .env');
  }

  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const epaper = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%epaper%' ORDER BY table_name;"
    );

    const publication = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%publication%' ORDER BY table_name;"
    );

    console.log('Connected DATABASE_URL host:', url.replace(/:\/\/.*?:.*?@/, '://***:***@'));
    console.log('\nEPAPER TABLES (public schema):');
    for (const r of epaper) console.log('-', r.table_name);

    console.log('\nPUBLICATION TABLES (public schema):');
    for (const r of publication) console.log('-', r.table_name);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
