import { PrismaClient } from '@prisma/client';

/**
 * Clear tenant-related data from the database.
 *
 * Order of deletion:
 *  1) Articles scoped to tenants (tenantId NOT NULL)
 *  2) Tenant-specific ReporterDesignations (tenantId NOT NULL)
 *  3) Tenants (CASCADE removes domains, navigation, theme, feature flags, homepage sections,
 *     entity, newsletter subscriptions, reporters, reporter payments, ID cards, domain categories/languages/logs, etc.)
 *
 * Usage:
 *  - All tenants (dry run):      npx ts-node scripts/clear_tenant_data.ts
 *  - All tenants (confirm):      npx ts-node scripts/clear_tenant_data.ts --yes
 *  - Single tenant by slug:      npx ts-node scripts/clear_tenant_data.ts --tenant prashna --yes
 *  - Single tenant by id:        npx ts-node scripts/clear_tenant_data.ts --tenant cmxxxxxxx --yes
 */
async function run() {
  const prisma = new PrismaClient();
  try {
    const args = process.argv.slice(2);
    const yes = args.includes('--yes');

    const tenantArgIndex = args.findIndex(a => a === '--tenant');
    let tenantFilter: string | undefined;
    if (tenantArgIndex >= 0 && args[tenantArgIndex + 1]) {
      tenantFilter = args[tenantArgIndex + 1];
    }

    // Resolve target tenants
    let tenants: Array<{ id: string; name: string; slug: string }>; 
    if (tenantFilter) {
      // Try by id then by slug (case-insensitive)
      const byId = await prisma.tenant.findUnique({ where: { id: tenantFilter } }).catch(()=>null);
      if (byId) {
        tenants = [{ id: byId.id, name: byId.name, slug: byId.slug }];
      } else {
        const bySlug = await prisma.tenant.findFirst({ where: { slug: { equals: tenantFilter, mode: 'insensitive' } } }).catch(()=>null);
        if (!bySlug) {
          console.error(`No tenant found by id or slug: '${tenantFilter}'.`);
          return;
        }
        tenants = [{ id: bySlug.id, name: bySlug.name, slug: bySlug.slug }];
      }
    } else {
      const all = await prisma.tenant.findMany({ select: { id: true, name: true, slug: true } });
      tenants = all;
    }

    if (!tenants.length) {
      console.log('No tenants to clear.');
      return;
    }

    const tenantIds = tenants.map(t => t.id);

    // Count items
    const [articleCount, webArticleCount, tenantSpecDesignationCount] = await Promise.all([
      prisma.article.count({ where: { tenantId: { in: tenantIds } } }),
      (prisma as any).tenantWebArticle.count({ where: { tenantId: { in: tenantIds } } }),
      prisma.reporterDesignation.count({ where: { tenantId: { in: tenantIds } } }),
    ]);

    const domainCount = await prisma.domain.count({ where: { tenantId: { in: tenantIds } } });
    const reporterCount = await prisma.reporter.count({ where: { tenantId: { in: tenantIds } } });

    console.log('=== Tenant Data Clear Plan ===');
    if (tenantFilter) {
      console.log(`Scope: tenant='${tenantFilter}' -> ${tenants.map(t=>`${t.slug} (${t.id})`).join(', ')}`);
    } else {
      console.log(`Scope: ALL tenants (${tenants.length})`);
    }
    console.log(`- Tenant-scoped articles: ${articleCount}`);
    console.log(`- Tenant-specific reporter designations: ${tenantSpecDesignationCount}`);
    console.log(`- Tenant web articles: ${webArticleCount}`);
    console.log(`- Domains (cascade via tenant): ${domainCount}`);
    console.log(`- Reporters (cascade via tenant): ${reporterCount}`);
    console.log(`- Tenants to delete: ${tenantIds.length}`);

    if (!yes) {
      console.log('\nDry run only. Re-run with --yes to execute.');
      return;
    }

    // Delete in safe order
    const delArticles = await prisma.article.deleteMany({ where: { tenantId: { in: tenantIds } } });
    const delTenantDesignations = await prisma.reporterDesignation.deleteMany({ where: { tenantId: { in: tenantIds } } });
    const delWebArticles = await (prisma as any).tenantWebArticle.deleteMany({ where: { tenantId: { in: tenantIds } } });

    const delTenants = await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });

    console.log('=== Tenant Data Clear Results ===');
    console.log(`- Deleted articles: ${delArticles.count}`);
    console.log(`- Deleted tenant-specific designations: ${delTenantDesignations.count}`);
    console.log(`- Deleted tenants: ${delTenants.count}`);
    console.log(`- Deleted tenant web articles: ${delWebArticles.count}`);
    console.log('Cascade removed domains, navigation, themes, feature flags, homepage sections, entity, reporters, payments, ID cards, and domain allocations.');
  } catch (e: any) {
    console.error('Tenant data clear error:', e?.message || e);
  } finally {
    await prisma.$disconnect();
  }
}

run();
