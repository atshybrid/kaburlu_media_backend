import { PrismaClient } from '@prisma/client';

// Minimal seed: roles, core languages (en, te), country India, state Telangana, Telangana districts, a few categories.
// Use remote Neon (DATABASE_URL) unless PRISMA_FORCE_REMOTE=false provided.

const prisma = new PrismaClient();

async function seedRoles() {
  const roles = ['SUPER_ADMIN','LANGUAGE_ADMIN'];
  const permissions: Record<string, string[]> = {
    SUPER_ADMIN: ['create','read','update','delete'],
    LANGUAGE_ADMIN: ['articles:create','articles:read']
  };
  for (const r of roles) {
    await prisma.role.upsert({
      where: { name: r },
      update: {},
      create: { name: r, permissions: permissions[r] }
    });
  }
  console.log(`[minimal] Roles upserted: ${roles.join(', ')}`);
}

async function seedLanguages() {
  const langs = [
    { name: 'English', code: 'en', nativeName: 'English', direction: 'ltr' },
    { name: 'Telugu', code: 'te', nativeName: 'తెలుగు', direction: 'ltr' }
  ];
  for (const l of langs) {
    await prisma.language.upsert({
      where: { code: l.code },
      update: {},
      create: { ...l, isDeleted: false }
    });
  }
  console.log(`[minimal] Languages upserted: ${langs.map(l=>l.code).join(', ')}`);
}

async function seedCountryStateTelangana() {
  const india = await prisma.country.upsert({
    where: { name: 'India' },
    update: { code: 'IN' },
    create: { name: 'India', code: 'IN' }
  });
  await prisma.state.upsert({
    where: { name: 'Telangana' },
    update: {},
    create: { name: 'Telangana', countryId: india.id }
  });
  console.log('[minimal] Country India and State Telangana ensured');
}

async function seedTelanganaDistricts() {
  const ts = await prisma.state.findFirst({ where: { name: 'Telangana' } });
  if (!ts) throw new Error('Telangana state missing');
  const districtNames = [
    'Adilabad','Komaram Bheem Asifabad','Mancherial','Nirmal','Nizamabad','Jagtial','Peddapalli','Karimnagar','Rajanna Sircilla','Siddipet','Medak','Sangareddy','Kamareddy','Hyderabad','Ranga Reddy','Medchal-Malkajgiri','Vikarabad','Mahabubnagar','Nagarkurnool','Wanaparthy','Jogulamba Gadwal','Narayanpet','Nalgonda','Suryapet','Yadadri Bhuvanagiri','Khammam','Bhadradri Kothagudem','Warangal','Hanumakonda','Mahabubabad','Mulugu','Jayashankar Bhupalpally','Jangaon'
  ];
  let created = 0;
  for (const name of districtNames) {
    const exists = await prisma.district.findFirst({ where: { name, state: { name: 'Telangana' } } });
    if (exists) continue;
    await prisma.district.create({ data: { name, stateId: ts.id } });
    created++;
  }
  const total = await prisma.district.count({ where: { stateId: ts.id } });
  console.log(`[minimal] Telangana districts added: ${created}, total now: ${total}`);
}

async function seedCategories() {
  const cats = ['NATIONAL','INTERNATIONAL'];
  for (const c of cats) {
    const slug = c.toLowerCase();
    await prisma.category.upsert({
      where: { slug },
      update: { name: c },
      create: { name: c, slug }
    });
  }
  console.log('[minimal] Categories upserted: NATIONAL, INTERNATIONAL');
}

async function main() {
  console.log('--- Minimal Seed (remote) start ---');
  await seedRoles();
  await seedLanguages();
  await seedCountryStateTelangana();
  await seedTelanganaDistricts();
  await seedCategories();
  console.log('--- Minimal Seed complete ---');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
