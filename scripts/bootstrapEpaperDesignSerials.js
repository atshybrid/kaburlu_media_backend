const { PrismaClient } = require('@prisma/client');
const { randomUUID } = require('crypto');

const prisma = new PrismaClient();

function makeCode(type, i) {
  const padded = String(i).padStart(3, '0');
  return type === 'HEADER'
    ? `KABURLU_HEADER_${padded}`
    : `KABURLU_SUBHEADER_${padded}`;
}

async function ensureTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "EpaperDesignSerial" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "serialCode" TEXT NOT NULL,
      "sequenceNo" INTEGER NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT "EpaperDesignSerial_tenant_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
      CONSTRAINT "EpaperDesignSerial_type_check" CHECK ("type" IN ('HEADER', 'SUBHEADER')),
      CONSTRAINT "EpaperDesignSerial_tenant_type_seq_uniq" UNIQUE ("tenantId", "type", "sequenceNo"),
      CONSTRAINT "EpaperDesignSerial_tenant_code_uniq" UNIQUE ("tenantId", "serialCode")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "EpaperDesignSerial_tenant_idx"
    ON "EpaperDesignSerial" ("tenantId");
  `);
}

async function main() {
  await ensureTable();

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
  });

  let processedRows = 0;
  for (const tenant of tenants) {
    for (const type of ['HEADER', 'SUBHEADER']) {
      for (let i = 1; i <= 20; i += 1) {
        await prisma.$executeRaw`
          INSERT INTO "EpaperDesignSerial" ("id", "tenantId", "type", "serialCode", "sequenceNo", "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${tenant.id}, ${type}, ${makeCode(type, i)}, ${i}, NOW(), NOW())
          ON CONFLICT ("tenantId", "type", "sequenceNo")
          DO UPDATE SET
            "serialCode" = EXCLUDED."serialCode",
            "updatedAt" = NOW()
        `;
        processedRows += 1;
      }
    }
  }

  const [{ count: totalRows }] = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count FROM "EpaperDesignSerial"
  `;

  console.log(JSON.stringify({
    tenants: tenants.length,
    processedRows,
    totalRows,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
