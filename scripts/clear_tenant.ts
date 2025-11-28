import prisma from '../src/lib/prisma';

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string) => {
    const idx = args.findIndex(a => a === `--${name}`);
    if (idx >= 0) return args[idx + 1];
    const kv = args.find(a => a.startsWith(`--${name}=`));
    return kv ? kv.split('=')[1] : undefined;
  };

  const tenantId = getArg('tenantId');
  const dryRun = args.includes('--dry-run');
  const confirm = args.includes('--confirm');

  if (!tenantId) {
    console.error('Usage: ts-node scripts/clear_tenant.ts --tenantId <ID> [--dry-run | --confirm]');
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) {
    console.error(`Tenant not found: ${tenantId}`);
    process.exit(1);
  }

  const entity = await prisma.tenantEntity.findUnique({ where: { tenantId } });
  const domains = await prisma.domain.findMany({ where: { tenantId } });
  const reporters = await prisma.reporter.findMany({ where: { tenantId } });
  const reporterIds = reporters.map(r => r.id);
  const idCards = await prisma.reporterIDCard.findMany({ where: { reporterId: { in: reporterIds } } });
  const payments = await prisma.reporterPayment.findMany({ where: { reporterId: { in: reporterIds } } });
  const domainCategoryLinks = await prisma.domainCategory.findMany({ where: { domainId: { in: domains.map(d => d.id) } } });

  console.log('Dry-run summary');
  console.log({
    tenant: { id: tenant.id, name: tenant.name },
    entity: entity ? 1 : 0,
    domains: domains.length,
    domainCategoryLinks: domainCategoryLinks.length,
    reporters: reporters.length,
    reporterIDCards: idCards.length,
    reporterPayments: payments.length,
  });

  if (dryRun && !confirm) {
    console.log('Dry-run only. No changes made.');
    return;
  }
  if (!confirm) {
    console.error('Refusing to delete without --confirm');
    process.exit(2);
  }

  await prisma.$transaction(async (tx) => {
    // Delete dependent resources first
    if (idCards.length) await tx.reporterIDCard.deleteMany({ where: { reporterId: { in: reporterIds } } });
    if (payments.length) await tx.reporterPayment.deleteMany({ where: { reporterId: { in: reporterIds } } });
    if (reporters.length) await tx.reporter.deleteMany({ where: { tenantId } });
    if (domainCategoryLinks.length) await tx.domainCategory.deleteMany({ where: { domainId: { in: domains.map(d => d.id) } } });
    if (domains.length) await tx.domain.deleteMany({ where: { tenantId } });
    if (entity) await tx.tenantEntity.delete({ where: { tenantId } });
    await tx.tenant.delete({ where: { id: tenantId } });
  });

  console.log('Tenant and related data deleted successfully');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
