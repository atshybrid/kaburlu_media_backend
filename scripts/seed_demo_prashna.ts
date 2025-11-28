import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Standalone demo seed for a single tenant mapped to prashnaayudham.com
// Safe to run multiple times (upserts everywhere)

const prisma = new PrismaClient();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

async function main() {
  console.log('Seeding demo tenant for prashnaayudham.com ...');

  // Ensure base data exists (languages, categories, roles, a super admin)
  // This script assumes prisma/seed.ts has been executed at least once.

  // Resolve basic refs
  const [langEn, langTe] = await Promise.all([
    prisma.language.findFirst({ where: { code: 'en' } }),
    prisma.language.findFirst({ where: { code: 'te' } }),
  ]);
  if (!langEn || !langTe) {
    throw new Error('Base languages missing. Run: npm run seed (executes prisma/seed.ts)');
  }

  const india = await prisma.country.findFirst({ where: { code: 'IN' } });
  const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } });
  if (!india || !telangana) {
    throw new Error('Base country/states missing. Run: npm run seed');
  }

  // Upsert tenant
  const tenant = await p.tenant.upsert({
    where: { slug: 'prashna' },
    update: {},
    create: {
      name: 'Prashna Ayudham',
      slug: 'prashna',
      stateId: telangana.id,
      prgiNumber: 'PRGI-TS-2025-01001',
      prgiStatus: 'VERIFIED',
      prgiVerifiedAt: new Date(),
    }
  });

  // Link and activate domain
  const domain = await p.domain.upsert({
    where: { domain: 'prashnaayudham.com' },
    update: { tenantId: tenant.id, status: 'ACTIVE', verifiedAt: new Date(), lastCheckAt: new Date(), lastCheckStatus: 'OK' },
    create: {
      domain: 'prashnaayudham.com',
      tenantId: tenant.id,
      isPrimary: true,
      status: 'ACTIVE',
      verifiedAt: new Date(),
      lastCheckAt: new Date(),
      lastCheckStatus: 'OK'
    }
  });

  // Map first two categories to domain
  const categories = await prisma.category.findMany({ orderBy: { createdAt: 'asc' }, take: 2 });
  for (const cat of categories) {
    await p.domainCategory.upsert({
      where: { domainId_categoryId: { domainId: domain.id, categoryId: cat.id } },
      update: {},
      create: { domainId: domain.id, categoryId: cat.id }
    });
  }

  // Allow EN & TE on the domain
  for (const lang of [langEn, langTe]) {
    await p.domainLanguage.upsert({
      where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } },
      update: {},
      create: { domainId: domain.id, languageId: lang.id }
    });
  }

  // Tenant Entity (PRGI details) – minimal demo values
  await p.tenantEntity.upsert({
    where: { tenantId: tenant.id },
    update: {
      registrationTitle: 'Prashna Daily',
      periodicity: 'DAILY',
      registrationDate: new Date('2024-06-01'),
      languageId: langTe.id,
      ownerName: 'Prashna Media Pvt Ltd',
      publisherName: 'Prashna Publisher',
      editorName: 'Prashna Editor',
      publicationCountryId: india.id,
      publicationStateId: telangana.id,
      printingCityName: 'Hyderabad',
      address: 'Road No. 1, Hyderabad, Telangana',
    },
    create: {
      tenantId: tenant.id,
      prgiNumber: 'PRGI-TS-2025-01001',
      registrationTitle: 'Prashna Daily',
      periodicity: 'DAILY',
      registrationDate: new Date('2024-06-01'),
      languageId: langTe.id,
      ownerName: 'Prashna Media Pvt Ltd',
      publisherName: 'Prashna Publisher',
      editorName: 'Prashna Editor',
      publicationCountryId: india.id,
      publicationStateId: telangana.id,
      printingCityName: 'Hyderabad',
      address: 'Road No. 1, Hyderabad, Telangana',
    }
  });

  // Ensure a simple author user exists
  const authorMobile = '9999900001';
  const authorRole = await prisma.role.findFirst({ where: { name: 'SUPER_ADMIN' } });
  const author = await prisma.user.upsert({
    where: { mobileNumber: authorMobile },
    update: {},
    create: {
      mobileNumber: authorMobile,
      mpin: await bcrypt.hash('1234', 10),
      roleId: authorRole!.id,
      languageId: langEn.id,
      status: 'ACTIVE'
    }
  });

  // Create 2 published articles scoped to this tenant in allowed categories/languages
  const [cat1, cat2] = categories;
  const article1 = await prisma.article.upsert({
    where: { id: 'seed-prashna-article-1' },
    update: {},
    create: {
      id: 'seed-prashna-article-1',
      title: 'Prashna: Welcome to the new portal',
      content: 'This is a demo article to verify tenant domain-based APIs locally.',
      type: 'reporter',
      authorId: author.id,
      languageId: langEn.id,
      tenantId: tenant.id,
      status: 'PUBLISHED',
      categories: { connect: [{ id: cat1.id }] },
      tags: ['demo','welcome']
    }
  });

  const article2 = await prisma.article.upsert({
    where: { id: 'seed-prashna-article-2' },
    update: {},
    create: {
      id: 'seed-prashna-article-2',
      title: 'ప్రశ్న: స్థానిక పరీక్ష వ్యాసం',
      content: 'ఇది డొమెయిన్ ఆధారిత టెనెంట్ APIs ని స్థానికంగా పరిశీలించడానికి డెమో వ్యాసం.',
      type: 'reporter',
      authorId: author.id,
      languageId: langTe.id,
      tenantId: tenant.id,
      status: 'PUBLISHED',
      categories: { connect: [{ id: cat2.id }] },
      tags: ['డెమో','స్థానిక']
    }
  });

  console.log('Seeded tenant:', tenant.slug, 'domain:', domain.domain, 'articles:', [article1.id, article2.id]);
}

main()
  .catch((e) => {
    console.error('Seed demo prashna failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
