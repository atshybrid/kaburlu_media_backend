require('dotenv').config({ path: '../.env.digitalocean' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAndPushRealArticle() {
  // Get a recent published article
  const article = await prisma.tenantWebArticle.findFirst({
    where: { status: 'PUBLISHED' },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      coverImageUrl: true,
      isBreaking: true,
      slug: true,
      authorId: true
    }
  });
  
  if (!article) {
    console.log('No published article found');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Found Article:');
  console.log('ID:', article.id);
  console.log('Title:', article.title);
  console.log('Slug:', article.slug);
  console.log('Cover Image:', article.coverImageUrl);
  console.log('---');
  
  // Send push notification with REAL article ID
  const { broadcastPush } = require('../dist/lib/push');
  
  const result = await broadcastPush({
    title: '🔴 BREAKING NEWS',
    body: article.title,
    image: article.coverImageUrl || undefined,
    color: '#FF0000',
    data: {
      type: 'breaking_news',
      articleId: article.id,
      slug: article.slug || '',
      action: 'view'
    }
  });
  
  console.log('Push Result:', JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

getAndPushRealArticle().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
