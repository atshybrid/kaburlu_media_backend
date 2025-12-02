import prisma from '../src/lib/prisma';

// Basic Telugu translations for existing English category names.
// Adjust or extend as needed.
const teluguMap: Record<string, string> = {
  NATIONAL: 'జాతీయ',
  INTERNATIONAL: 'అంతర్జాతీయ',
  SPORTS: 'క్రీడలు',
  TECHNOLOGY: 'సాంకేతికం',
  ENTERTAINMENT: 'వినోదం',
  BUSINESS: 'వ్యాపారం',
  Political: 'రాజకీయాలు'
};

async function main() {
  // Ensure language row exists
  const lang = await prisma.language.upsert({
    where: { code: 'te' },
    update: {},
    create: { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', direction: 'ltr' }
  });

  // Resolve domain. Replace this domain if production differs.
  const domain = await prisma.domain.findUnique({ where: { domain: 'app.kaburlumedia.com' } })
    || await prisma.domain.findUnique({ where: { domain: 'localhost' } });
  if (!domain) {
    console.error('Domain not found: create domain "app.kaburlumedia.com" or "localhost" first.');
    return;
  }

  // Link domain to Telugu if not already
  await prisma.domainLanguage.upsert({
    where: { domainId_languageId: { domainId: domain.id, languageId: lang.id } },
    update: {},
    create: { domainId: domain.id, languageId: lang.id }
  });

  // Fetch categories allocated to the domain; if none, seed fails gracefully
  const domainCats = await prisma.domainCategory.findMany({
    where: { domainId: domain.id },
    include: { category: true }
  });
  if (!domainCats.length) {
    console.warn('No domain categories found for this domain. Assign categories before translating.');
  }

  // All tenant categories (fallback if domain-specific is empty)
  const categories = domainCats.length
    ? domainCats.map(dc => dc.category)
    : await prisma.category.findMany();

  let created = 0; let updated = 0; let skipped = 0;
  for (const c of categories) {
    const telugu = teluguMap[c.name];
    if (!telugu) { skipped++; continue; }
    await prisma.categoryTranslation.upsert({
      where: { categoryId_language: { categoryId: c.id, language: 'te' } },
      update: { name: telugu },
      create: { categoryId: c.id, language: 'te', name: telugu }
    }).then(r => {
      // crude detection: if updatedAt differs we assume update; prisma doesn't return info on upsert type
      if (r.name === telugu) created++; else updated++;
    });
  }

  console.log(`Telugu translations processed. created=${created} updated=${updated} skipped(no-map)=${skipped}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(()=>process.exit());
