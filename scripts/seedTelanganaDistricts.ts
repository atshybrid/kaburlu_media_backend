import { PrismaClient } from '@prisma/client';

// Honor fallback DB env like main seed script
if (String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true' && process.env.DATABASE_URL_FALLBACK) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_FALLBACK;
  console.log('[TelanganaDistricts] Using fallback datasource');
}

const prisma = new PrismaClient();

async function run() {
  const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } });
  if (!telangana) {
    console.error('State "Telangana" not found. Run main seed first (states).');
    return;
  }
  const districts: string[] = [
    'Adilabad',
    'Komaram Bheem Asifabad',
    'Mancherial',
    'Nirmal',
    'Nizamabad',
    'Jagtial',
    'Peddapalli',
    'Karimnagar',
    'Rajanna Sircilla',
    'Siddipet',
    'Medak',
    'Sangareddy',
    'Kamareddy',
    'Hyderabad',
    'Ranga Reddy',
    'Medchal-Malkajgiri',
    'Vikarabad',
    'Mahabubnagar',
    'Nagarkurnool',
    'Wanaparthy',
    'Jogulamba Gadwal',
    'Narayanpet',
    'Nalgonda',
    'Suryapet',
    'Yadadri Bhuvanagiri',
    'Khammam',
    'Bhadradri Kothagudem',
    'Warangal',
    'Hanumakonda',
    'Mahabubabad',
    'Mulugu',
    'Jayashankar Bhupalpally',
    'Jangaon'
  ];
  const existing = await prisma.district.findMany({ where: { stateId: telangana.id } });
  const existingNames = new Set(existing.map(d => d.name));
  let created = 0;
  for (const name of districts) {
    if (existingNames.has(name)) continue;
    await prisma.district.create({ data: { name, stateId: telangana.id } });
    created += 1;
  }
  const totalNow = await prisma.district.count({ where: { stateId: telangana.id } });
  console.log(`[TelanganaDistricts] Inserted ${created} new districts. Total for Telangana: ${totalNow}.`);
}

run()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
