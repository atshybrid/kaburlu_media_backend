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
  // Seed major Indian languages so a fresh DB has a usable built-in language set.
  // Codes are ISO 639-1 where available.
  const coreLanguages: Array<{ code: string; name: string; nativeName?: string; direction?: 'ltr' | 'rtl' }> = [
    { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', direction: 'ltr' },
    { code: 'en', name: 'English', nativeName: 'English', direction: 'ltr' },
    { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', direction: 'ltr' },
    { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', direction: 'ltr' },
    { code: 'mr', name: 'Marathi', nativeName: 'मराठी', direction: 'ltr' },
    { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', direction: 'ltr' },
    { code: 'ur', name: 'Urdu', nativeName: 'اردو', direction: 'rtl' },
    { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', direction: 'ltr' },
    { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', direction: 'ltr' },
    { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', direction: 'ltr' },
    { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', direction: 'ltr' },
    { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', direction: 'ltr' },
    { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', direction: 'ltr' },
  ];

  const langCodes = coreLanguages.map(l => l.code);
  const existingLangs = await prisma.language.findMany({
    where: { code: { in: langCodes } },
    select: { id: true, code: true, name: true, nativeName: true, direction: true, isDeleted: true }
  });
  const existingByCode = new Map(existingLangs.map(l => [l.code, l] as const));

  const toCreate = coreLanguages
    .filter(l => !existingByCode.has(l.code))
    .map(l => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      direction: l.direction || 'ltr',
      isDeleted: false,
    }));

  if (toCreate.length) {
    await prisma.language.createMany({ data: toCreate, skipDuplicates: true });
  }

  // If a language exists but was soft-deleted or missing metadata, normalize it.
  const updates: any[] = [];
  for (const l of coreLanguages) {
    const row = existingByCode.get(l.code);
    if (!row) continue;

    const nextDirection = l.direction || 'ltr';
    const nextNative = l.nativeName ?? null;
    const needsUpdate =
      row.isDeleted === true ||
      row.name !== l.name ||
      (nextNative && row.nativeName !== nextNative) ||
      (row.direction || 'ltr') !== nextDirection;

    if (needsUpdate) {
      updates.push(
        prisma.language.update({
          where: { id: row.id },
          data: {
            name: l.name,
            nativeName: nextNative,
            direction: nextDirection,
            isDeleted: false,
          },
        })
      );
    }
  }
  if (updates.length) await prisma.$transaction(updates);

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
      // --- STATE LEVEL ---
      { level: 'STATE', code: 'EDITOR_IN_CHIEF', name: 'Editor-in-Chief' },
      { level: 'STATE', code: 'STATE_EDITOR', name: 'State Editor' },
      { level: 'STATE', code: 'CHIEF_EDITOR', name: 'Chief Editor' },
      { level: 'STATE', code: 'EXECUTIVE_EDITOR', name: 'Executive Editor' },
      { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief' },
      { level: 'STATE', code: 'STATE_POLITICAL_EDITOR', name: 'State Political Editor' },
      { level: 'STATE', code: 'STATE_SPECIAL_CORRESPONDENT', name: 'State Special Correspondent' },
      { level: 'STATE', code: 'STATE_REPORTER', name: 'State Reporter' },
      { level: 'STATE', code: 'STATE_INVESTIGATIVE_REPORTER', name: 'Investigative Reporter (State Level)' },
      { level: 'STATE', code: 'STATE_CRIME_REPORTER', name: 'State Crime Reporter' },
      { level: 'STATE', code: 'STATE_FEATURES_EDITOR', name: 'State Features Editor' },

      // --- DISTRICT LEVEL ---
      { level: 'DISTRICT', code: 'DISTRICT_BUREAU_CHIEF', name: 'District Bureau Chief' },
      { level: 'DISTRICT', code: 'DISTRICT_EDITOR', name: 'District Editor' },
      { level: 'DISTRICT', code: 'DISTRICT_CORRESPONDENT', name: 'District Correspondent' },
      { level: 'DISTRICT', code: 'SENIOR_DISTRICT_REPORTER', name: 'Senior District Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_POLITICAL_REPORTER', name: 'District Political Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_CRIME_REPORTER', name: 'District Crime Reporter' },
      { level: 'DISTRICT', code: 'DISTRICT_SPECIAL_CORRESPONDENT', name: 'District Special Correspondent' },
      { level: 'DISTRICT', code: 'DISTRICT_STRINGER', name: 'District Stringer' },
      { level: 'DISTRICT', code: 'DISTRICT_PHOTO_JOURNALIST', name: 'District Photo Journalist' },

      // --- ASSEMBLY CONSTITUENCY LEVEL ---
      { level: 'ASSEMBLY', code: 'ASSEMBLY_CONSTITUENCY_REPORTER', name: 'Assembly Constituency Reporter' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_CORRESPONDENT', name: 'Assembly Correspondent' },
      { level: 'ASSEMBLY', code: 'CONSTITUENCY_INCHARGE', name: 'Constituency In-Charge' },
      { level: 'ASSEMBLY', code: 'SENIOR_CONSTITUENCY_REPORTER', name: 'Senior Constituency Reporter' },
      { level: 'ASSEMBLY', code: 'POLITICAL_CONSTITUENCY_REPORTER', name: 'Political Constituency Reporter' },
      { level: 'ASSEMBLY', code: 'ASSEMBLY_BEAT_REPORTER', name: 'Assembly Beat Reporter' },
      { level: 'ASSEMBLY', code: 'LOCAL_POLITICAL_REPORTER', name: 'Local Political Reporter' },

      // --- MANDAL LEVEL ---
      { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter' },
      { level: 'MANDAL', code: 'MANDAL_CORRESPONDENT', name: 'Mandal Correspondent' },
      { level: 'MANDAL', code: 'MANDAL_INCHARGE_REPORTER', name: 'Mandal In-Charge Reporter' },
      { level: 'MANDAL', code: 'SENIOR_MANDAL_REPORTER', name: 'Senior Mandal Reporter' },
      { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' },
      { level: 'MANDAL', code: 'LOCAL_NEWS_REPORTER', name: 'Local News Reporter' },
      { level: 'MANDAL', code: 'VILLAGE_MANDAL_REPORTER', name: 'Village & Mandal Reporter' },
      { level: 'MANDAL', code: 'RURAL_REPORTER_MANDAL', name: 'Rural Reporter (Mandal Focus)' },

      // --- VILLAGE / RURAL ADD-ON DESIGNATIONS (stored under MANDAL level) ---
      { level: 'MANDAL', code: 'VILLAGE_REPORTER', name: 'Village Reporter' },
      { level: 'MANDAL', code: 'RURAL_CORRESPONDENT', name: 'Rural Correspondent' },
      { level: 'MANDAL', code: 'GRAM_PANCHAYAT_REPORTER', name: 'Gram Panchayat Reporter' },
      { level: 'MANDAL', code: 'FIELD_REPORTER', name: 'Field Reporter' },
      { level: 'MANDAL', code: 'FREELANCE_REPORTER', name: 'Freelance Reporter (Village / Mandal)' },
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
