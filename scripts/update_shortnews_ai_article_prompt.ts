import prisma from '../src/lib/prisma';
import { getPrompt, getDefaultPrompt } from '../src/lib/prompts';

async function main() {
  const key = 'SHORTNEWS_AI_ARTICLE';
  // Just ensure row exists so future dashboard edits override default
  // Always use code default (not cached DB) so refinements propagate
  const content = getDefaultPrompt(key as any);
  // Force upsert (always update content so refinements propagate)
  await (prisma as any).prompt.upsert({
    where: { key },
    update: { content },
    create: { key, content },
  });
  console.log(`[prompt] ${key} upserted/refreshed.`);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
