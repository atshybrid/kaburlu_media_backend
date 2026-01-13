const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const domains = await prisma.domain.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { include: { state: true } } },
    });

    const shaped = domains.map(d => ({
      id: d.id,
      host: d.host,
      tenantId: d.tenantId,
      tenantState: d.tenant?.state?.name ?? null,
      kind: d.kind,
      status: d.status,
      verifiedAt: d.verifiedAt,
      createdAt: d.createdAt,
    }));

    console.log(JSON.stringify({ count: shaped.length, items: shaped }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
