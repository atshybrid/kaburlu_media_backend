import { PrismaClient } from '@prisma/client';

async function run() {
  const prisma = new PrismaClient();
  try {
    const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'asc' } });
    const tenantAdminRole = await prisma.role.findFirst({ where: { name: 'TENANT_ADMIN' } });
    console.log(`\n=== Tenants (${tenants.length}) ===`);
    for (const t of tenants) {
      let adminMobiles: string[] = [];
      if (tenantAdminRole) {
        const admins = await prisma.reporter.findMany({
          where: { tenantId: t.id, user: { roleId: tenantAdminRole.id } },
          include: { user: true }
        });
        adminMobiles = admins
          .map(a => (a.user && a.user.mobileNumber ? a.user.mobileNumber : null))
          .filter((m): m is string => typeof m === 'string');
      }
      const adminsLabel = adminMobiles.length ? adminMobiles.join(',') : 'none';
      console.log(`${(t.slug || '').padEnd(16)} | ${(t.name || '').padEnd(32)} | PRGI=${t.prgiNumber || '-'} | admins=[${adminsLabel}]`);
    }
  } catch (e: any) {
    console.error('Error listing tenants:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
