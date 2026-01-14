import { PrismaClient } from '@prisma/client';
import { DEFAULT_PROMPTS } from '../src/lib/defaultPrompts';

const prisma = new PrismaClient();

async function seedAllPrompts() {
  console.log(`Seeding ${DEFAULT_PROMPTS.length} default prompts to production database...`);
  
  let seeded = 0;
  let updated = 0;
  
  for (const prompt of DEFAULT_PROMPTS) {
    const existing = await prisma.prompt.findUnique({
      where: { key: prompt.key }
    });
    
    const result = await prisma.prompt.upsert({
      where: { key: prompt.key },
      update: { 
        content: prompt.content,
        description: prompt.description 
      },
      create: {
        key: prompt.key,
        content: prompt.content,
        description: prompt.description
      }
    });
    
    if (existing) {
      console.log(`✓ Updated: ${prompt.key}`);
      updated++;
    } else {
      console.log(`+ Created: ${prompt.key}`);
      seeded++;
    }
  }
  
  console.log(`\nCompleted: ${seeded} created, ${updated} updated`);
  
  // Verify the critical prompt for /ainewspaper_rewrite exists
  const criticalPrompt = await prisma.prompt.findUnique({
    where: { key: 'daily_newspaper_ai_article_dynamic_language' }
  });
  
  if (criticalPrompt) {
    console.log('✅ Critical prompt daily_newspaper_ai_article_dynamic_language exists');
  } else {
    console.log('❌ Critical prompt daily_newspaper_ai_article_dynamic_language MISSING');
  }
  
  await prisma.$disconnect();
}

seedAllPrompts().catch(e => {
  console.error('Error seeding prompts:', e.message);
  process.exit(1);
});