import { PrismaClient } from '@prisma/client';

// Seeds Adilabad mandals and marks assembly constituency centers.
// Assembly constituencies considered here: Adilabad, Boath.
// Mandals list derived from earlier Telengana location mapping snippet; adjust if needed.

const prisma = new PrismaClient();

const assemblies = ['Adilabad', 'Boath'];
// Mandals grouped by assembly (subset sample; extend as required)
const mandalsByAssembly: Record<string, string[]> = {
  Adilabad: ['Adilabad (Urban)', 'Jainad', 'Bela'],
  Boath: ['Boath', 'Tamsi', 'Gadiguda']
};

function normalizeAssemblyName(s: string) {
  return s.replace(/\s*\(.*?\)\s*/g, '').trim().toLowerCase();
}

async function run() {
  const district = await prisma.district.findFirst({ where: { name: 'Adilabad' } });
  if (!district) {
    console.error('Adilabad district not found. Ensure districts seeded first.');
    process.exit(1);
  }
  let created = 0; let updatedAssemblyFlags = 0;
  for (const assembly of assemblies) {
    const mandals = mandalsByAssembly[assembly] || [];
    for (const mandalName of mandals) {
      const existing = await prisma.mandal.findFirst({ where: { name: mandalName, districtId: district.id } });
      const isAssemblyCenter = normalizeAssemblyName(mandalName) === assembly.toLowerCase();
      if (!existing) {
        await prisma.mandal.create({ data: { name: mandalName, districtId: district.id, isAssemblyConstituency: isAssemblyCenter } });
        created++;
        if (isAssemblyCenter) updatedAssemblyFlags++;
      } else if (isAssemblyCenter && !existing.isAssemblyConstituency) {
        await prisma.mandal.update({ where: { id: existing.id }, data: { isAssemblyConstituency: true } });
        updatedAssemblyFlags++;
      }
    }
  }
  const total = await prisma.mandal.count({ where: { districtId: district.id } });
  console.log(`[AdilabadMandals] Created ${created}, assembly flags set/updated ${updatedAssemblyFlags}, total mandals now ${total}.`);
}

run().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
