import prisma from '../src/lib/prisma';

/*
  Usage:
  npx ts-node scripts/list_category_translations.ts te app.kaburlumedia.com

  Args:
    1: language code (e.g. te)
    2: domain (optional). If provided, restrict to categories allocated to that domain.
*/
async function main() {
  const languageCode = process.argv[2];
  const domainName = process.argv[3];
  if (!languageCode) {
    console.error('Language code required. Example: npx ts-node scripts/list_category_translations.ts te app.kaburlumedia.com');
    process.exit(1);
  }

  const lang = await prisma.language.findUnique({ where: { code: languageCode } });
  if (!lang) {
    console.error('Language not found for code:', languageCode);
    process.exit(1);
  }

  let categoryIds: string[] | undefined;
  if (domainName) {
    const domain = await prisma.domain.findUnique({ where: { domain: domainName } });
    if (!domain) {
      console.error('Domain not found:', domainName);
      process.exit(1);
    }
    const dcats = await prisma.domainCategory.findMany({ where: { domainId: domain.id } });
    categoryIds = dcats.map(d => d.categoryId);
  }

  const categories = await prisma.category.findMany({ where: categoryIds ? { id: { in: categoryIds } } : {} });
  const translations = await prisma.categoryTranslation.findMany({ where: { language: languageCode } });
  const translationsMap = new Map(translations.map(t => [t.categoryId, t.name]));

  const rows = categories.map(c => ({
    id: c.id,
    baseName: c.name,
    slug: c.slug,
    translated: translationsMap.get(c.id) || null
  }));

  console.table(rows);
  const missing = rows.filter(r => !r.translated).length;
  console.log(`Total categories: ${rows.length}, translated: ${rows.length - missing}, missing: ${missing}`);
}

main().catch(e => { console.error(e); process.exit(1); });
