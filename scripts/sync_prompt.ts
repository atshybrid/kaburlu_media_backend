import prisma from '../src/lib/prisma';
import { DEFAULT_PROMPTS } from '../src/lib/defaultPrompts';

async function syncPrompt() {
  const prompt = DEFAULT_PROMPTS.find(p => p.key === 'newsroom_ai_agent');
  if (!prompt) {
    console.log('Prompt not found in defaults');
    process.exit(1);
  }
  
  console.log('Updating newsroom_ai_agent prompt in database...');
  
  const result = await prisma.prompt.upsert({
    where: { key: 'newsroom_ai_agent' },
    update: { content: prompt.content, description: prompt.description },
    create: { key: prompt.key, content: prompt.content, description: prompt.description }
  });
  
  console.log('✅ Prompt updated:', result.key);
  console.log('Content length:', result.content.length);
  
  await prisma.$disconnect();
}

syncPrompt().catch(e => {
  console.error(e);
  process.exit(1);
});
