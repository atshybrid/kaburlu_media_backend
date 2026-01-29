import { PrismaClient } from '@prisma/client';
import { DEFAULT_PROMPTS } from '../src/lib/defaultPrompts';

const prisma = new PrismaClient();

async function main() {
  const promptKey = 'newsroom_ai_agent';
  
  // Get the updated prompt from defaultPrompts.ts
  const defaultPrompt = DEFAULT_PROMPTS.find(p => p.key === promptKey);
  
  if (!defaultPrompt) {
    console.error('Prompt not found in DEFAULT_PROMPTS');
    return;
  }

  console.log('Updating database prompt:', promptKey);
  console.log('New content length:', defaultPrompt.content.length);

  // Upsert - update if exists, create if not
  const result = await prisma.prompt.upsert({
    where: { key: promptKey },
    update: {
      content: defaultPrompt.content,
      description: defaultPrompt.description || null,
    },
    create: {
      key: promptKey,
      content: defaultPrompt.content,
      description: defaultPrompt.description || null,
    },
  });

  console.log('✅ Database prompt updated successfully!');
  console.log('Prompt ID:', result.id);
  console.log('Key:', result.key);
  console.log('Content length:', result.content.length);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
