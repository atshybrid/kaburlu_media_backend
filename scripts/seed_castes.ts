import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Sample caste/subcaste data (adjust as needed)
const data: { name: string; subCastes: string[] }[] = [
  { name: 'Kamma', subCastes: ['Illi', 'Chowdary'] },
  { name: 'Reddy', subCastes: ['Pakanati', 'Pedakanti'] },
  { name: 'Brahmin', subCastes: ['Niyogi', 'Vaidiki', 'Smartha'] },
  { name: 'Velama', subCastes: ['Padmanayaka'] },
  { name: 'Yadav', subCastes: ['Golla', 'Kuruba'] }
];

async function main() {
  console.log('Seeding castes & subcastes...');
  for (const entry of data) {
  const caste = await (prisma as any)['caste'].upsert({
      where: { name: entry.name },
      update: {},
      create: { name: entry.name }
    });
    for (const sub of entry.subCastes) {
  await (prisma as any)['subCaste'].upsert({
        where: { casteId_name: { casteId: caste.id, name: sub } },
        update: {},
        create: { name: sub, casteId: caste.id }
      });
    }
  }
  console.log('Caste seeding complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
