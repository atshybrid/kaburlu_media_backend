import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // List tenants
  console.log('=== TENANTS ===');
  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
    take: 10,
  });
  console.log(JSON.stringify(tenants, null, 2));

  // List latest articles
  console.log('\n=== LATEST ARTICLES ===');
  const articles = await prisma.tenantWebArticle.findMany({
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      tenant: { select: { slug: true, name: true } },
      language: { select: { code: true, name: true } },
      category: { select: { name: true, slug: true } },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  console.log(JSON.stringify(articles, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
