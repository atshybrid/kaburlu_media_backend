import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const rows = await prisma.prompt.findMany({ orderBy: { key: 'asc' } });
    if (!rows.length) {
      console.log('No prompts found.');
      return;
    }
    console.log('Prompts:');
    for (const r of rows) {
      const snippet = r.content.replace(/\s+/g, ' ').slice(0, 90);
      console.log(`- ${r.key}: ${snippet}${r.content.length > 90 ? '…' : ''}`);
    }
  } catch (e: any) {
    console.error('Failed to list prompts:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
