import prisma from '../src/lib/prisma';

async function main() {
  const key = process.argv[2] || 'SHORTNEWS_AI_ARTICLE';
  const row = await (prisma as any).prompt.findUnique({ where: { key } });
  if (!row) {
    console.log('Prompt not found:', key);
  } else {
    console.log('Key:', row.key);
    console.log('Length:', row.content.length);
    console.log('--- CONTENT START ---');
    console.log(row.content);
    console.log('--- CONTENT END ---');
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
