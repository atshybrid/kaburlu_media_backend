const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const roles = await prisma.role.findMany();
  console.log('Roles in DB:', roles.map(r => r.name));
  await prisma.$disconnect();
}

check().catch(console.error);
