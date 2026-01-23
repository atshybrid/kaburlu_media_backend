import prisma from '../src/lib/prisma';

async function findDomain() {
  try {
    const domain = await (prisma as any).domain.findFirst({
      where: { 
        domain: { contains: 'kaburlutoday', mode: 'insensitive' }
      },
      include: { tenant: true }
    });
    
    if (domain) {
      console.log('\n=== Found Domain ===');
      console.log('Domain ID:', domain.id);
      console.log('Domain:', domain.domain);
      console.log('Status:', domain.status);
      console.log('Tenant ID:', domain.tenantId);
      console.log('Tenant Name:', domain.tenant.name);
      console.log('Sample Data Status:', domain.sampleDataStatus || 'null');
      console.log('Sample Data Message:', domain.sampleDataMessage || 'null');
      console.log('\nArticle Count:');
      
      const articleCount = await (prisma as any).article.count({
        where: { tenantId: domain.tenantId, tags: { hasSome: ['sample', 'bootstrap'] } }
      });
      console.log('Bootstrap Articles:', articleCount);
      
    } else {
      console.log('\nDomain not found. Searching all domains...\n');
      const allDomains = await (prisma as any).domain.findMany({
        include: { tenant: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
      
      console.log('Recent domains:');
      allDomains.forEach((d: any) => {
        console.log(`- ${d.domain} (${d.status}) - ${d.tenant.name}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await (prisma as any).$disconnect();
  }
}

findDomain();
