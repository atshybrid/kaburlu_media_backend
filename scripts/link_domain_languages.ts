#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding kaburlutoday domain...');
  
  const domain = await prisma.domain.findFirst({
    where: { domain: { contains: 'kaburlutoday' } },
    include: {
      languages: true,
      categories: true
    }
  });

  if (!domain) {
    throw new Error('Domain not found');
  }

  console.log(`✅ Found domain: ${domain.domain} (ID: ${domain.id})`);
  console.log(`   Current languages: ${domain.languages.length}`);
  console.log(`   Current categories: ${domain.categories.length}`);

  // Get all languages
  const allLanguages = await prisma.language.findMany();
  console.log(`\n📚 Available languages: ${allLanguages.map(l => `${l.name} (${l.code})`).join(', ')}`);

  // Link Telugu and English
  const telugu = allLanguages.find(l => l.code === 'te');
  const english = allLanguages.find(l => l.code === 'en');

  if (!telugu || !english) {
    throw new Error('Telugu or English language not found in database');
  }

  console.log('\n🔗 Linking languages to domain...');

  // Check if already linked
  const existingTelugu = await prisma.domainLanguage.findUnique({
    where: { domainId_languageId: { domainId: domain.id, languageId: telugu.id } }
  });

  const existingEnglish = await prisma.domainLanguage.findUnique({
    where: { domainId_languageId: { domainId: domain.id, languageId: english.id } }
  });

  if (!existingTelugu) {
    await prisma.domainLanguage.create({
      data: { domainId: domain.id, languageId: telugu.id }
    });
    console.log('   ✅ Linked Telugu');
  } else {
    console.log('   ⏭️  Telugu already linked');
  }

  if (!existingEnglish) {
    await prisma.domainLanguage.create({
      data: { domainId: domain.id, languageId: english.id }
    });
    console.log('   ✅ Linked English');
  } else {
    console.log('   ⏭️  English already linked');
  }

  // Check categories
  const domainCategories = await prisma.domainCategory.findMany({
    where: { domainId: domain.id },
    include: { category: true }
  });

  console.log(`\n📁 Domain has ${domainCategories.length} categories:`);
  domainCategories.forEach(dc => {
    console.log(`   - ${dc.category.name}`);
  });

  if (domainCategories.length === 0) {
    console.log('\n⚠️  WARNING: No categories linked to this domain!');
    console.log('   Run category creation/linking first.');
  }

  console.log('\n✅ Done! Domain is now ready for bootstrap.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
