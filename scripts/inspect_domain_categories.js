const { PrismaClient } = require('@prisma/client');

async function main() {
  const domainId = process.argv[2];
  if (!domainId) {
    console.log('Usage: node -r dotenv/config scripts/inspect_domain_categories.js <domainId>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const d = await prisma.domain.findUnique({
      where: { id: domainId },
      include: { tenant: { include: { state: true } } },
    });

    console.log(JSON.stringify({
      domainId,
      host: d?.host ?? null,
      tenantId: d?.tenantId ?? null,
      tenantState: d?.tenant?.state?.name ?? null,
      kind: d?.kind ?? null,
      status: d?.status ?? null,
      verifiedAt: d?.verifiedAt ?? null,
    }, null, 2));

    const dcs = await prisma.domainCategory.findMany({
      where: { domainId },
      include: { category: { select: { slug: true } } },
    });

    const slugs = dcs.map(x => x.category?.slug).filter(Boolean);
    const stateSlugs = slugs.filter(s => s.startsWith('state-news-')).sort();

    console.log('has state-news:', slugs.includes('state-news'));
    console.log('state-news-* slugs:', stateSlugs);
    console.log('state-news-* count:', stateSlugs.length);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
