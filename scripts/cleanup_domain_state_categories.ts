import { PrismaClient } from '@prisma/client';
import { defaultCategorySlugify, listDefaultCategorySlugs } from '../src/lib/defaultCategories';
import { CORE_NEWS_CATEGORIES } from '../src/lib/categoryAuto';

const prisma = new PrismaClient();

function usage(): never {
  // eslint-disable-next-line no-console
  console.log('Usage: ts-node scripts/cleanup_domain_state_categories.ts <domainId>');
  process.exit(1);
}

async function main() {
  const domainId = process.argv[2];
  if (!domainId) usage();

  const domain = await (prisma as any).domain.findUnique({
    where: { id: domainId },
    include: { tenant: { include: { state: true } } },
  });
  if (!domain) throw new Error('Domain not found');

  const tenantStateName = String(domain?.tenant?.state?.name || '').trim();
  const desiredStateSlug = tenantStateName
    ? `state-news-${defaultCategorySlugify(tenantStateName)}`.slice(0, 60)
    : null;

  const slugSet = new Set<string>([
    ...listDefaultCategorySlugs({ includeChildren: true }),
    ...CORE_NEWS_CATEGORIES.map(c => c.slug),
    'state-news',
    ...(desiredStateSlug ? [desiredStateSlug] : []),
  ]);

  const desiredCategories = await (prisma as any).category.findMany({
    where: { slug: { in: Array.from(slugSet) }, isDeleted: false },
    select: { id: true, slug: true },
  });

  // Remove extra state categories currently linked to the domain.
  const existing = await (prisma as any).domainCategory.findMany({
    where: { domainId },
    include: { category: { select: { id: true, slug: true } } },
  });

  const idsToRemove: string[] = [];
  for (const dc of existing || []) {
    const slug = String(dc?.category?.slug || '');
    if (!slug) continue;
    if (slug.startsWith('state-news-') && slug !== desiredStateSlug) {
      idsToRemove.push(String(dc.categoryId));
    }
  }

  if (idsToRemove.length) {
    await (prisma as any).domainCategory.deleteMany({
      where: { domainId, categoryId: { in: idsToRemove } },
    });
  }

  // Ensure desired default + tenant state categories are linked.
  if (desiredCategories.length) {
    await (prisma as any).domainCategory.createMany({
      data: desiredCategories.map((c: any) => ({ domainId, categoryId: c.id })),
      skipDuplicates: true,
    });
  }

  const finalCount = await (prisma as any).domainCategory.count({ where: { domainId } });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    ok: true,
    domainId,
    tenantId: String(domain.tenantId),
    tenantStateName: tenantStateName || null,
    desiredStateSlug,
    removedStateCategoryLinks: idsToRemove.length,
    ensuredCategoryLinks: desiredCategories.length,
    finalDomainCategoryCount: finalCount,
  }, null, 2));
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
