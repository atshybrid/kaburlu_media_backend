const { PrismaClient } = require('@prisma/client');

async function main() {
  const tenantId = process.argv[2];
  const domainId = process.argv[3];
  if (!tenantId || !domainId) {
    console.log('Usage: node -r dotenv/config scripts/inspect_epaper_public_branding.js <tenantId> <domainId>');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const [tenant, domain, tenantTheme, domainSettings] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, slug: true, name: true } }),
      prisma.domain.findUnique({ where: { id: domainId }, select: { id: true, domain: true, kind: true, status: true, verifiedAt: true, tenantId: true } }),
      prisma.tenantTheme.findUnique({ where: { tenantId } }).catch(() => null),
      prisma.domainSettings.findUnique({ where: { domainId } }).catch(() => null),
    ]);

    console.log(JSON.stringify({
      tenant,
      domain,
      tenantTheme: tenantTheme
        ? {
            hasRow: true,
            logoUrl: tenantTheme.logoUrl,
            faviconUrl: tenantTheme.faviconUrl,
            primaryColor: tenantTheme.primaryColor,
            secondaryColor: tenantTheme.secondaryColor,
            headerBgColor: tenantTheme.headerBgColor,
            footerBgColor: tenantTheme.footerBgColor,
            fontFamily: tenantTheme.fontFamily,
            seoConfig: tenantTheme.seoConfig,
            updatedAt: tenantTheme.updatedAt,
          }
        : { hasRow: false },
      domainSettings: domainSettings
        ? {
            hasRow: true,
            updatedAt: domainSettings.updatedAt,
            data: domainSettings.data,
          }
        : { hasRow: false },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
