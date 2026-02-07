import 'dotenv/config';

import prisma from '../src/lib/prisma';

const ROLE_NAMES = ['TENANT_ADMIN'];
const PUBLISHER_CODE = 'PUBLISHER';

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const dryRun = hasFlag('--dry-run') || process.env.DRY_RUN === '1';

  const publisher = await prisma.reporterDesignation.findFirst({
    where: { tenantId: null, code: PUBLISHER_CODE },
    select: { id: true, code: true, name: true, level: true, tenantId: true },
  });

  if (!publisher) {
    throw new Error(
      `Global ReporterDesignation not found for code=${PUBLISHER_CODE}. Run seed/bootstrap (e.g. npm run seed:reporter-designations) and try again.`,
    );
  }

  const roles = await prisma.role.findMany({
    where: { name: { in: ROLE_NAMES } },
    select: { id: true, name: true },
  });

  if (roles.length === 0) {
    throw new Error(`No Role rows found for names: ${ROLE_NAMES.join(', ')}`);
  }

  const tenantAdminReporters = await prisma.reporter.findMany({
    where: {
      user: {
        role: {
          name: { in: ROLE_NAMES },
        },
      },
    },
    select: {
      id: true,
      tenantId: true,
      userId: true,
      active: true,
      level: true,
      designationId: true,
    },
  });

  const needsUpdate = tenantAdminReporters.filter(
    (r) => r.designationId !== publisher.id,
  );

  console.log('Assign global Publisher designation to Tenant Admin reporters');
  console.log(`Publisher: ${publisher.name} (${publisher.code}) [${publisher.id}]`);
  console.log(`Tenant Admin reporters found: ${tenantAdminReporters.length}`);
  console.log(`Need update: ${needsUpdate.length}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no DB writes)' : 'APPLY (DB writes)'}`);

  if (dryRun) {
    const sample = needsUpdate.slice(0, 20).map((r) => ({
      reporterId: r.id,
      tenantId: r.tenantId,
      userId: r.userId,
      active: r.active,
      level: r.level,
      fromDesignationId: r.designationId,
      toDesignationId: publisher.id,
    }));

    if (sample.length > 0) {
      console.log('Sample updates (first 20):');
      console.table(sample);
    }

    return;
  }

  const batchSize = 500;
  let updatedTotal = 0;

  for (let i = 0; i < needsUpdate.length; i += batchSize) {
    const batch = needsUpdate.slice(i, i + batchSize);
    const ids = batch.map((r) => r.id);

    const result = await prisma.reporter.updateMany({
      where: { id: { in: ids } },
      data: { designationId: publisher.id },
    });

    updatedTotal += result.count;
    console.log(`Updated ${updatedTotal}/${needsUpdate.length}...`);
  }

  const verifyCount = await prisma.reporter.count({
    where: {
      designationId: publisher.id,
      user: {
        role: {
          name: { in: ROLE_NAMES },
        },
      },
    },
  });

  console.log('Done.');
  console.log(`Updated reporters: ${updatedTotal}`);
  console.log(`Verify count (tenant admins with publisher designation): ${verifyCount}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
