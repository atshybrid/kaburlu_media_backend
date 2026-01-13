const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const [tenants, domains, domainCats, categories] = await Promise.all([
      prisma.tenant.count().catch((e) => `ERR:${e.message}`),
      prisma.domain.count().catch((e) => `ERR:${e.message}`),
      prisma.domainCategory.count().catch((e) => `ERR:${e.message}`),
      prisma.category.count().catch((e) => `ERR:${e.message}`),
    ]);
    console.log(JSON.stringify({ tenants, domains, domainCategories: domainCats, categories }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
