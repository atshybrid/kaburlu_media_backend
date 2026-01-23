#!/usr/bin/env node
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenantId = 'cmk7e7tg401ezlp22wkz5rxky';
  
  // Total count
  const total = await prisma.article.count({
    where: { 
      tenantId,
      tags: { has: 'bootstrap' }
    }
  });
  
  console.log('📊 Total Bootstrap Articles:', total);
  console.log('');
  
  // Sample articles
  const articles = await prisma.article.findMany({
    where: { 
      tenantId,
      tags: { has: 'bootstrap' }
    },
    include: {
      language: true,
      categories: true
    },
    take: 10,
    orderBy: { createdAt: 'desc' }
  });
  
  console.log('📰 Sample Articles (Latest 10):');
  console.log('');
  articles.forEach((a, i) => {
    console.log(`${i+1}. ${a.title}`);
    console.log(`   Language: ${a.language?.name} (${a.language?.code})`);
    console.log(`   Category: ${a.categories.map(c => c.name).join(', ')}`);
    console.log(`   Status: ${a.status}`);
    console.log('');
  });
  
  // Count by language
  const teCount = await prisma.article.count({
    where: { 
      tenantId,
      tags: { has: 'bootstrap' },
      language: { code: 'te' }
    }
  });
  
  const enCount = await prisma.article.count({
    where: { 
      tenantId,
      tags: { has: 'bootstrap' },
      language: { code: 'en' }
    }
  });
  
  console.log('📊 Language Distribution:');
  console.log(`   Telugu: ${teCount} articles`);
  console.log(`   English: ${enCount} articles`);
  console.log('');
  
  // Count by category
  const categories = await prisma.category.findMany({
    where: {
      articles: {
        some: {
          tenantId,
          tags: { has: 'bootstrap' }
        }
      }
    },
    include: {
      _count: {
        select: {
          articles: {
            where: {
              tenantId,
              tags: { has: 'bootstrap' }
            }
          }
        }
      }
    },
    take: 15
  });
  
  console.log('📁 Articles by Category:');
  categories.forEach(c => {
    console.log(`   ${c.name}: ${c._count.articles} articles`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
