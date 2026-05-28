/**
 * Backfill missing theme.colors on EPAPER domainSettings rows.
 * Run: node -r dotenv/config scripts/backfill_epaper_domain_theme_colors.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const DEFAULT_PRIMARY = '#0D47A1';
const DEFAULT_SECONDARY = '#FFB300';
const DEFAULT_ACCENT = '#1976d2';

const prisma = new PrismaClient();

function pick(...vals) {
  for (const v of vals) {
    const s = String(v ?? '').trim();
    if (s) return s;
  }
  return null;
}

async function main() {
  const domains = await prisma.domain.findMany({
    where: { kind: 'EPAPER', status: 'ACTIVE' },
    select: { id: true, domain: true, tenantId: true },
  });

  let updated = 0;
  for (const domain of domains) {
    const [ds, tenantTheme] = await Promise.all([
      prisma.domainSettings.findUnique({ where: { domainId: domain.id } }),
      prisma.tenantTheme.findUnique({ where: { tenantId: domain.tenantId } }),
    ]);

    const data = ds?.data && typeof ds.data === 'object' && !Array.isArray(ds.data) ? { ...ds.data } : {};
    const theme = data.theme && typeof data.theme === 'object' ? { ...data.theme } : {};
    const colors =
      theme.colors && typeof theme.colors === 'object' ? { ...theme.colors } : {};

    const primary = pick(colors.primary, tenantTheme?.primaryColor, DEFAULT_PRIMARY);
    const secondary = pick(colors.secondary, tenantTheme?.secondaryColor, DEFAULT_SECONDARY);
    const accent = pick(colors.accent, DEFAULT_ACCENT);

    const hadPrimary = pick(colors.primary, tenantTheme?.primaryColor);
    const hadSecondary = pick(colors.secondary, tenantTheme?.secondaryColor);

    if (hadPrimary && hadSecondary && pick(colors.accent)) continue;

    theme.colors = { ...colors, primary, secondary, accent };
    data.theme = theme;

    if (!ds) {
      await prisma.domainSettings.create({
        data: { tenantId: domain.tenantId, domainId: domain.id, data },
      });
      console.log('created', domain.domain, theme.colors);
    } else {
      await prisma.domainSettings.update({ where: { id: ds.id }, data: { data } });
      console.log('updated', domain.domain, theme.colors);
    }
    updated += 1;
  }

  console.log(`Done. ${updated} domain(s) backfilled.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
