require('dotenv').config({ path: '../.env.digitalocean' });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function sendShortNewsPush() {
  // Get a REAL published ShortNews
  const shortNews = await prisma.shortNews.findFirst({
    where: { status: { in: ['PUBLISHED', 'APPROVED', 'DESK_APPROVED', 'AI_APPROVED'] } },
    orderBy: { publishDate: 'desc' },
    select: { id: true, title: true, featuredImage: true, slug: true, content: true }
  });
  
  if (!shortNews) {
    console.log('No ShortNews found');
    await prisma.$disconnect();
    return;
  }
  
  console.log('Found ShortNews:');
  console.log('ID:', shortNews.id);
  console.log('Title:', shortNews.title);
  console.log('Slug:', shortNews.slug);
  console.log('Image:', shortNews.featuredImage);
  console.log('---');
  
  const { broadcastPush } = require('../dist/lib/push');
  
  // Build API path for fetching details
  const apiPath = `/api/v1/shortnews/public/${shortNews.id}`;
  
  const result = await broadcastPush({
    title: '🔴 BREAKING NEWS',
    body: shortNews.title,
    image: shortNews.featuredImage || undefined,
    color: '#FF0000',
    data: {
      type: 'shortnews',
      shortNewsId: shortNews.id,
      slug: shortNews.slug || '',
      apiPath: apiPath,
      action: 'view'
    }
  });
  
  console.log('API Path:', apiPath);
  
  console.log('Push Result:', JSON.stringify(result, null, 2));
  await prisma.$disconnect();
}

sendShortNewsPush().catch(e => {
  console.error(e);
  prisma.$disconnect();
});
