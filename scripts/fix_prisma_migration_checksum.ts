import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

async function main() {
  const migrationName = process.argv[2];
  if (!migrationName) {
    console.error('Usage: ts-node scripts/fix_prisma_migration_checksum.ts <migration_name>');
    process.exit(1);
  }

  const migrationSqlPath = join(__dirname, '..', 'prisma', 'migrations', migrationName, 'migration.sql');
  const sql = readFileSync(migrationSqlPath, 'utf8');
  const checksum = sha256Hex(sql);

  const row = await prisma.$queryRawUnsafe<any[]>(
    'select migration_name, checksum from _prisma_migrations where migration_name = $1 limit 1',
    migrationName
  );

  if (!row?.length) {
    console.error(`Migration ${migrationName} not found in _prisma_migrations`);
    process.exit(1);
  }

  const oldChecksum = row[0].checksum;
  if (oldChecksum === checksum) {
    console.log(`[checksum] ${migrationName} already matches (${checksum})`);
    return;
  }

  await prisma.$executeRawUnsafe(
    'update _prisma_migrations set checksum = $1 where migration_name = $2',
    checksum,
    migrationName
  );

  console.log(`[checksum] updated ${migrationName}`);
  console.log(`- old: ${oldChecksum}`);
  console.log(`- new: ${checksum}`);
}

main()
  .catch((e) => {
    console.error('Failed to update migration checksum:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
