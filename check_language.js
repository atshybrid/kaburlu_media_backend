const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const lang = await prisma.language.findFirst({
    where: { OR: [
      { id: 'cmk74fubb0014ugy41ec79nq4' },
      { code: 'te' }
    ]}
  });
  console.log('Language found:', lang);
  await prisma.$disconnect();
}

check().catch(console.error);
