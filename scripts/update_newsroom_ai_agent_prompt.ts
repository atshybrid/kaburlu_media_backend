import prisma from '../src/lib/prisma';
import { DEFAULT_PROMPTS } from '../src/lib/defaultPrompts';

async function main() {
  const key = 'newsroom_ai_agent';
  const prompt = DEFAULT_PROMPTS.find(p => p.key === key);
  if (!prompt?.content?.trim()) {
    throw new Error(`Default prompt not found or empty for key: ${key}`);
  }

  const upserted = await (prisma as any).prompt.upsert({
    where: { key },
    update: { content: prompt.content },
    create: { key, content: prompt.content },
  });

  console.log('Upserted prompt', upserted.key);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await (prisma as any).$disconnect();
  });
