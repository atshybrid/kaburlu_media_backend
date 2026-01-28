import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const slug = 'mpps-gargul-vidyarthula-bahumathula-pampini';
  const domainName = 'prashnaayudham.com';
  
  // Check the domain first
  const domain = await prisma.domain.findFirst({
    where: { domain: domainName },
  });
  console.log('Domain:', { id: domain?.id, tenantId: domain?.tenantId, status: (domain as any)?.status });
  
  if (!domain) {
    console.log('Domain not found!');
    return;
  }
  
  // Get domain languages
  const domainLangs = await prisma.domainLanguage.findMany({
    where: { domainId: domain.id },
    include: { language: true }
  });
  console.log('Domain Languages:', domainLangs.map((d: any) => ({ code: d.language?.code, id: d.languageId })));
  
  // Check if 'te' language exists
  const teMatch = domainLangs.find((d: any) => d.language?.code === 'te');
  console.log('Telugu language match:', teMatch ? (teMatch as any).languageId : 'NOT FOUND');
  
  // Search for article by slug in TenantWebArticle
  const article = await prisma.tenantWebArticle.findFirst({
    where: { slug },
    include: { language: true }
  });
  console.log('Article:', {
    id: article?.id,
    slug: article?.slug,
    status: article?.status,
    isLive: article?.isLive,
    tenantId: article?.tenantId,
    domainId: article?.domainId,
    languageId: article?.languageId,
    languageCode: article?.language?.code
  });
  
  // Check the exact query the API uses
  const tenantId = domain.tenantId;
  const languageIdFilter = teMatch ? (teMatch as any).languageId : undefined;
  
  const apiQuery = {
    tenantId,
    status: 'PUBLISHED',
    AND: [
      { OR: [{ domainId: domain.id }, { domainId: null }] },
      languageIdFilter ? { languageId: languageIdFilter } : {}
    ],
    OR: [{ slug }, { id: slug }]
  };
  console.log('API Query:', JSON.stringify(apiQuery, null, 2));
  
  const found = await prisma.tenantWebArticle.findFirst({
    where: apiQuery as any,
    select: { id: true, slug: true, status: true }
  });
  console.log('Found with API query:', found);
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
