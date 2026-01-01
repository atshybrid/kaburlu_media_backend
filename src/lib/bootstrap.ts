import prisma from './prisma';
import { CORE_NEWS_CATEGORIES } from './categoryAuto';

export async function ensureCoreSeeds() {
  // 1. Roles: Check existence first to avoid 9 separate upserts if not needed
  const coreRoles = [
    'SUPER_ADMIN', 'LANGUAGE_ADMIN', 'TENANT_ADMIN', 'ADMIN_EDITOR',
    'NEWS_MODERATOR', 'PARENT_REPORTER', 'REPORTER', 'CITIZEN_REPORTER', 'GUEST', 'GUEST_REPORTER'
  ];
  const existingRoles = await prisma.role.findMany({ where: { name: { in: coreRoles } }, select: { name: true } });
  const existingRoleNames = new Set(existingRoles.map(r => r.name));
  const missingRoles = coreRoles.filter(r => !existingRoleNames.has(r));

  if (missingRoles.length > 0) {
    // createMany is faster
    await prisma.role.createMany({
      data: missingRoles.map(name => ({ name, permissions: {} })),
      skipDuplicates: true
    });
  }

  // 2. Languages: Check existence
  const langCodes = ['en', 'te'];
  const existingLangs = await prisma.language.findMany({ where: { code: { in: langCodes } } });
  if (existingLangs.length < 2) {
    const hasEn = existingLangs.some(l => l.code === 'en');
    const hasTe = existingLangs.some(l => l.code === 'te');
    if (!hasEn) await prisma.language.create({ data: { code: 'en', name: 'English' } });
    if (!hasTe) await prisma.language.create({ data: { code: 'te', name: 'Telugu' } });
  }

  // 3. Country
  let country = await prisma.country.findUnique({ where: { code: 'IN' } });
  if (!country) {
    country = await prisma.country.create({ data: { code: 'IN', name: 'India' } });
  }

  // 4. States: Check count
  const hasStates = await prisma.state.count({ where: { countryId: country.id } });
  if (hasStates === 0) {
    const INDIA_STATES = [
      'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
      'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
      'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
      'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
      'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
      'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
      'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
    ];
    await prisma.state.createMany({
      data: INDIA_STATES.map(name => ({ name, countryId: country.id })),
      skipDuplicates: true
    });
  }

  // 5. Districts (Optimized)
  const ensureDistricts: Record<string, string[]> = {
    Telangana: ['Adilabad', 'Nizamabad', 'Karimnagar', 'Medak', 'Hyderabad', 'Ranga Reddy', 'Mahabubnagar', 'Nalgonda', 'Warangal', 'Khammam'],
    Kerala: ['Thiruvananthapuram', 'Kollam', 'Pathanamthitta', 'Alappuzha', 'Kottayam', 'Idukki', 'Ernakulam', 'Thrissur', 'Palakkad', 'Malappuram', 'Kozhikode', 'Wayanad', 'Kannur', 'Kasaragod'],
  };

  const stateNames = Object.keys(ensureDistricts);
  const states = await prisma.state.findMany({ where: { name: { in: stateNames }, countryId: country.id } });

  for (const state of states) {
    const targetDistricts = ensureDistricts[state.name];
    if (!targetDistricts) continue;

    // Fetch all existing districts for this state at once
    const existing = await prisma.district.findMany({
      where: { stateId: state.id, name: { in: targetDistricts } },
      select: { name: true }
    });
    const existingNames = new Set(existing.map(d => d.name));
    const toCreate = targetDistricts.filter(d => !existingNames.has(d));

    if (toCreate.length > 0) {
      await prisma.district.createMany({
        data: toCreate.map(name => ({ name, stateId: state.id })),
        skipDuplicates: true
      });
    }
  }

  // 6. Core Categories (news-industry defaults)
  try {
    const existing = await prisma.category.findMany({ where: { slug: { in: CORE_NEWS_CATEGORIES.map(c => c.slug) } }, select: { slug: true } });
    const existingSlugs = new Set(existing.map(c => c.slug));
    const missing = CORE_NEWS_CATEGORIES.filter(c => !existingSlugs.has(c.slug));
    if (missing.length) {
      await prisma.category.createMany({
        data: missing.map(c => ({ name: c.name, slug: c.slug })),
        skipDuplicates: true,
      });
    }
  } catch {
    // best-effort; categories can be seeded later via scripts
  }

  // 7. Global Reporter Designations
  // Public endpoint GET /reporter-designations returns tenantId=null rows when tenantId isn't provided.
  // Seed a sensible global default set so clients don't see an empty list on fresh databases.
  try {
    const defaults: { level: string; code: string; name: string }[] = [
      { level: 'STATE', code: 'EDITOR_IN_CHIEF', name: 'Editor-in-Chief' },
      { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief' },
      { level: 'STATE', code: 'STATE_EDITOR', name: 'State Editor' },
      { level: 'STATE', code: 'STATE_REPORTER', name: 'State Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF', name: 'District Bureau Chief' },
      { level: 'DISTRICT', code: 'SENIOR_CORRESPONDENT', name: 'Senior Correspondent' },
      { level: 'DISTRICT', code: 'DISTRICT_REPORTER', name: 'District Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_DESK', name: 'District Desk' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_INCHARGE', name: 'Assembly Incharge' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_REPORTER', name: 'Assembly Reporter' },
      { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter' },
      { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' },
    ];

    const existing = await (prisma as any).reporterDesignation.findMany({
      where: { tenantId: null, code: { in: defaults.map(d => d.code) } },
      select: { id: true, code: true },
    });
    const byCode = new Map<string, string>();
    for (const row of existing as any[]) {
      if (!byCode.has(String(row.code))) byCode.set(String(row.code), String(row.id));
    }

    const ops: any[] = [];
    for (const d of defaults) {
      const id = byCode.get(d.code);
      if (id) {
        ops.push((prisma as any).reporterDesignation.update({ where: { id }, data: { level: d.level, name: d.name } }));
      } else {
        ops.push((prisma as any).reporterDesignation.create({ data: { tenantId: null, level: d.level, code: d.code, name: d.name } }));
      }
    }
    if (ops.length) await (prisma as any).$transaction(ops);
  } catch {
    // best-effort; designations can be seeded later via tenant seed endpoint
  }
}
