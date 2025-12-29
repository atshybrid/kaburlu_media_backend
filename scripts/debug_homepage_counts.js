const { PrismaClient } = require('@prisma/client');

async function main() {
  const p = new PrismaClient();
  try {
    const tenantSlugRaw = (process.env.TENANT_SLUG || '').trim();
    const domainName = (process.env.DOMAIN || 'kaburlu.sathuva.in').trim();
    const langCode = (process.env.LANG || '').trim();

    const domain = await p.domain.findFirst({ where: { domain: domainName } });
    console.log('domain', domain && { id: domain.id, domain: domain.domain, tenantId: domain.tenantId, status: domain.status });

    let tenant = null;
    if (tenantSlugRaw) {
      tenant = await p.tenant.findUnique({ where: { slug: tenantSlugRaw } });
    } else if (domain?.tenantId) {
      tenant = await p.tenant.findUnique({ where: { id: domain.tenantId } });
    } else {
      tenant = await p.tenant.findUnique({ where: { slug: 'kaburlu' } });
    }
    console.log('tenant', tenant && { id: tenant.id, slug: tenant.slug, name: tenant.name });

    if (domain?.id) {
      const domainCats = await p.domainCategory.findMany({ where: { domainId: domain.id }, include: { category: true } });
      console.log(
        'domainCategories',
        domainCats.length,
        domainCats.map((dc) => ({ categoryId: dc.categoryId, slug: dc.category?.slug, name: dc.category?.name }))
      );

      const allowedCategoryIds = domainCats.map((dc) => dc.categoryId);
      const publishedScopedAllowedCats = await p.tenantWebArticle.count({
        where: {
          tenantId: tenant.id,
          status: 'PUBLISHED',
          OR: [{ domainId: domain.id }, { domainId: null }],
          ...(allowedCategoryIds.length ? { categoryId: { in: allowedCategoryIds } } : {}),
        },
      });
      console.log('published scoped with allowed domain categories', publishedScopedAllowedCats);
    }

    if (!tenant) return;

    const theme = await p.tenantTheme.findUnique({ where: { tenantId: tenant.id } }).catch(() => null);
    const homepageConfig = theme?.homepageConfig ?? null;
    const style2Cfg = homepageConfig && typeof homepageConfig === 'object' ? homepageConfig.style2 : null;
    console.log('tenantTheme', theme && { tenantId: theme.tenantId, hasHomepageConfig: !!homepageConfig });
    if (style2Cfg) {
      const sections = Array.isArray(style2Cfg.sections) ? style2Cfg.sections : null;
      console.log('homepageConfig.style2', {
        heroCount: style2Cfg.heroCount,
        topStoriesCount: style2Cfg.topStoriesCount,
        sectionsCount: Array.isArray(sections) ? sections.length : null,
      });
      if (Array.isArray(sections)) {
        console.log('style2.sections sample', sections.slice(0, 5));
      }
    } else {
      console.log('homepageConfig.style2', null);
    }

    const totalWA = await p.tenantWebArticle.count({ where: { tenantId: tenant.id } });
    const pubWA = await p.tenantWebArticle.count({ where: { tenantId: tenant.id, status: 'PUBLISHED' } });
    console.log('tenantWebArticle total', totalWA, 'published', pubWA);

    const sample = await p.tenantWebArticle.findMany({
      where: { tenantId: tenant.id },
      select: { id: true, status: true, domainId: true, categoryId: true, languageId: true, publishedAt: true, createdAt: true, title: true, slug: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    console.log('sample latest 10', sample);

    const sampleLanguageId = sample.find((r) => r.languageId)?.languageId || null;
    if (sampleLanguageId) {
      const langRow = await p.language.findUnique({ where: { id: sampleLanguageId } });
      console.log('sample language row', langRow && { id: langRow.id, code: langRow.code, name: langRow.name });
    }

    if (domain?.id) {
      const scoped = await p.tenantWebArticle.count({
        where: { tenantId: tenant.id, status: 'PUBLISHED', OR: [{ domainId: domain.id }, { domainId: null }] },
      });
      console.log('published scoped (domain or null)', scoped);
    }

    const lang = langCode ? await p.language.findUnique({ where: { code: langCode } }) : null;
    console.log('lang', lang && { id: lang.id, code: lang.code });

    if (lang?.id) {
      const pubLangOrNull = await p.tenantWebArticle.count({
        where: { tenantId: tenant.id, status: 'PUBLISHED', OR: [{ languageId: lang.id }, { languageId: null }] },
      });
      console.log(`published (${lang.code} or null)`, pubLangOrNull);

      if (domain?.id) {
        const combined = await p.tenantWebArticle.count({
          where: {
            tenantId: tenant.id,
            status: 'PUBLISHED',
            AND: [
              { OR: [{ domainId: domain.id }, { domainId: null }] },
              { OR: [{ languageId: lang.id }, { languageId: null }] },
            ],
          },
        });
        console.log('published (domain or null) AND (lang or null)', combined);
      }
    }

    // Also check plain Article table for sanity
    const totalArticles = await p.article.count({ where: { tenantId: tenant.id } }).catch(() => null);
    const pubArticles = await p.article.count({ where: { tenantId: tenant.id, status: 'PUBLISHED' } }).catch(() => null);
    console.log('Article total', totalArticles, 'published', pubArticles);
  } finally {
    await p.$disconnect().catch(() => undefined);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
