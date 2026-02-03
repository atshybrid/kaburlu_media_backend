const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const domain = await prisma.domain.findFirst({
    where: { domain: { contains: 'api.kaburlumedia.com' } },
    include: { tenant: true }
  });
  console.log('api.kaburlumedia.com domain:', domain);
  
  const allDomains = await prisma.domain.findMany({
    where: { status: 'VERIFIED' },
    include: { tenant: { select: { name: true } } },
    take: 10
  });
  console.log('\nActive domains:', allDomains.map(d => ({
    domain: d.domain,
    tenant: d.tenant?.name,
    status: d.status
  })));
  
  await prisma.$disconnect();
}

check().catch(console.error);
