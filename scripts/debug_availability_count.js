/* eslint-disable no-console */

// Usage:
//   node -r dotenv/config scripts/debug_availability_count.js <tenantId> <level> <designationId> <locationField> <locationId>
// Example:
//   node -r dotenv/config scripts/debug_availability_count.js cmjq... DISTRICT cmit... districtId cmit...

const prisma = require('../dist/lib/prisma').default;

async function main() {
  const [tenantId, level, designationId, locationField, locationId] = process.argv.slice(2);

  if (!tenantId || !level || !designationId || !locationField || !locationId) {
    console.log('Missing args.');
    console.log('Usage: node -r dotenv/config scripts/debug_availability_count.js <tenantId> <level> <designationId> <locationField> <locationId>');
    process.exitCode = 2;
    return;
  }

  const baseWhere = {
    tenantId,
    [locationField]: locationId,
  };

  const counts = {
    exact: await prisma.reporter.count({ where: { ...baseWhere, active: true, level, designationId } }),
    noActive: await prisma.reporter.count({ where: { ...baseWhere, level, designationId } }),
    noLevel: await prisma.reporter.count({ where: { ...baseWhere, active: true, designationId } }),
    byLocationLevel: await prisma.reporter.count({ where: { ...baseWhere, active: true, level } }),
    byLocationAny: await prisma.reporter.count({ where: { ...baseWhere, active: true } }),
  };

  const sample = await prisma.reporter.findMany({
    where: { ...baseWhere },
    select: {
      id: true,
      active: true,
      level: true,
      designationId: true,
      stateId: true,
      districtId: true,
      assemblyConstituencyId: true,
      mandalId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  console.log('counts:', counts);
  console.log('sample reporters:', sample);

  const designationIdsInSample = Array.from(new Set(sample.map((r) => r.designationId).filter(Boolean)));
  const designationMeta = await prisma.reporterDesignation.findMany({
    where: { id: { in: Array.from(new Set([designationId, ...designationIdsInSample])) } },
    select: { id: true, tenantId: true, level: true, code: true, name: true },
  });

  console.log('designation meta:', designationMeta);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
