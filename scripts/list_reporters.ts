/**
 * List all reporters and their payment status
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const reporters = await prisma.reporter.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      idCardCharge: true,
      subscriptionActive: true,
      createdAt: true,
    },
  });

  console.log(`Found ${reporters.length} reporters (showing latest 10):\n`);
  reporters.forEach((r, i) => {
    console.log(`${i + 1}. ID: ${r.id}`);
    console.log(`   Tenant: ${r.tenantId}`);
    console.log(`   idCardCharge: ${r.idCardCharge}`);
    console.log(`   subscriptionActive: ${r.subscriptionActive}`);
    console.log(`   Created: ${r.createdAt.toISOString().split('T')[0]}\n`);
  });

  // Check if the specific reporter exists
  const targetId = 'cmllt73z200qbbzob01n14scp';
  const exists = await prisma.reporter.count({ where: { id: targetId } });
  console.log(`Reporter ${targetId} exists: ${exists > 0}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
