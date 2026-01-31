import prisma from './prisma';
import { CORE_NEWS_CATEGORIES } from './categoryAuto';
import { DEFAULT_CATEGORY_TREE, defaultCategorySlugify } from './defaultCategories';
import { DEFAULT_PROMPTS } from './defaultPrompts';

export async function ensureCoreSeeds() {
  console.log('[Bootstrap] Starting core seeds...');
  // 1. Roles
  // We support two role families:
  // - Kaburlu platform roles (Superadmin, moderator, admin editor, guest/citizen/public-figure)
  // - Newspaper/tenant roles (Tenant Admin, Chief/Desk editors, reporter)
  // Also seed legacy aliases used in older code paths (e.g., SUPERADMIN, NEWS_DESK_ADMIN).
  const coreRoles: Array<{ name: string; permissions: Record<string, any> }> = [
    // --- Kaburlu (platform) ---
    { name: 'SUPER_ADMIN', permissions: { all: true } },
    { name: 'NEWS_MODERATOR', permissions: { moderation: ['ai_review', 'manual_review'] } },
    { name: 'ADMIN_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
    { name: 'CITIZEN_REPORTER', permissions: { shortNews: ['create', 'edit_own'] } },
    { name: 'PUBLIC_FIGURE', permissions: { shortNews: ['create', 'edit_own'] } },

    // --- Newspaper / tenant editorial ---
    { name: 'TENANT_ADMIN', permissions: { tenants: ['manage'], domains: ['manage'], reporters: ['manage'], articles: ['approve'], shortNews: ['approve'], webArticles: ['approve'] } },
    // Existing code gates on TENANT_EDITOR for many approval flows; keep it as canonical editor role.
    { name: 'TENANT_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
    // Requested naming for newspaper product
    { name: 'CHIEF_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
    { name: 'DESK_EDITOR', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
    { name: 'REPORTER', permissions: { articles: ['create', 'edit_own'], webArticles: ['create', 'edit_own'] } },

    // --- Other roles referenced in code ---
    { name: 'LANGUAGE_ADMIN', permissions: { languages: ['manage'], prompts: ['manage'] } },
    { name: 'NEWS_DESK', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'] } },
    { name: 'NEWS_DESK_ADMIN', permissions: { articles: ['edit', 'approve'], shortNews: ['edit', 'approve'], webArticles: ['edit', 'approve'], prompts: ['manage'] } },
  ];

  // IMPORTANT: non-destructive seeding.
  // - Create missing core roles.
  // - Never overwrite permissions for roles that already exist (avoids resetting real data).
  const coreRoleNames = coreRoles.map(r => r.name);
  const existing = await prisma.role.findMany({ where: { name: { in: coreRoleNames } }, select: { name: true } });
  const existingNames = new Set(existing.map(r => r.name));
  const missing = coreRoles.filter(r => !existingNames.has(r.name));
  if (missing.length) {
    await prisma.role.createMany({
      data: missing.map(r => ({ name: r.name, permissions: r.permissions })),
      skipDuplicates: true,
    });
  }
  console.log('[Bootstrap] 1. Roles done');

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
  console.log('[Bootstrap] 2. Languages done');

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
  console.log('[Bootstrap] 3-5. Country/States/Districts done');

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

    // Ensure translation rows exist for core categories (all active languages).
    // Trigger background translation only if placeholders were missing.
    const languageCodes = (await prisma.language.findMany({ where: { isDeleted: false }, select: { code: true } }))
      .map(l => String(l.code || '').trim())
      .filter(Boolean);
    if (languageCodes.length) {
      const coreCats = await prisma.category.findMany({
        where: { slug: { in: CORE_NEWS_CATEGORIES.map(c => c.slug) }, isDeleted: false },
        select: { id: true, name: true },
      });

      // Current translation counts per category (for deciding whether to kick translation).
      const existingTr = await prisma.categoryTranslation.findMany({
        where: { categoryId: { in: coreCats.map(c => c.id) }, language: { in: languageCodes as any } },
        select: { categoryId: true },
      }).catch(() => [] as any);
      const countByCategory = new Map<string, number>();
      for (const t of existingTr as any[]) {
        const k = String(t.categoryId);
        countByCategory.set(k, (countByCategory.get(k) || 0) + 1);
      }

      await prisma.categoryTranslation.createMany({
        data: coreCats.flatMap(c =>
          languageCodes.map(code => ({ categoryId: c.id, language: code as any, name: c.name }))
        ),
        skipDuplicates: true,
      });

      // Fire-and-forget translations for categories that were missing placeholders.
      try {
        const mod = await import('../api/categories/categories.service');
        if (typeof mod.translateAndSaveCategoryInBackground === 'function') {
          for (const c of coreCats) {
            const existingCount = countByCategory.get(c.id) || 0;
            if (existingCount < languageCodes.length) {
              void mod.translateAndSaveCategoryInBackground(c.id, c.name);
            }
          }
        }
      } catch {
        // best-effort
      }
    }
  } catch {
    // best-effort; categories can be seeded later via scripts
  }
  console.log('[Bootstrap] 6. Core categories done');

  // 6b. Default Categories + Subcategories (product defaults)
  // - Non-destructive: create missing only.
  // - Translations: create placeholders for all active languages and translate in background for newly created categories.
  try {
    const languages = await prisma.language.findMany({
      where: { isDeleted: false },
      select: { code: true },
    });

    const languageCodes = languages.map(l => String(l.code || '').trim()).filter(Boolean);
    const ensureCategoryTranslations = async (categoryId: string, placeholderName: string) => {
      if (!languageCodes.length) return false;
      const existingCount = await prisma.categoryTranslation.count({
        where: { categoryId, language: { in: languageCodes as any } },
      }).catch(() => 0);
      const hadAll = existingCount >= languageCodes.length;
      const codes = languages.map(l => String(l.code || '').trim()).filter(Boolean);
      if (!codes.length) return;
      await prisma.categoryTranslation.createMany({
        data: codes.map(code => ({
          categoryId,
          language: code as any,
          name: placeholderName,
        })),
        skipDuplicates: true,
      });
      return !hadAll;
    };

    const translateInBackground = async (categoryId: string, categoryName: string) => {
      try {
        const mod = await import('../api/categories/categories.service');
        if (typeof mod.translateAndSaveCategoryInBackground === 'function') {
          void mod.translateAndSaveCategoryInBackground(categoryId, categoryName);
        }
      } catch {
        // best-effort
      }
    };

    for (const parent of DEFAULT_CATEGORY_TREE) {
      let parentRow = await prisma.category.findUnique({ where: { slug: parent.slug } });
      if (!parentRow) {
        parentRow = await prisma.category.create({
          data: { name: parent.name, slug: parent.slug },
        });
        const missingTr = await ensureCategoryTranslations(parentRow.id, parentRow.name);
        if (missingTr) await translateInBackground(parentRow.id, parentRow.name);
      } else {
        const missingTr = await ensureCategoryTranslations(parentRow.id, parentRow.name);
        if (missingTr) await translateInBackground(parentRow.id, parentRow.name);
      }

      for (const child of parent.children ?? []) {
        const existingChild = await prisma.category.findUnique({ where: { slug: child.slug } });
        if (!existingChild) {
          const createdChild = await prisma.category.create({
            data: { name: child.name, slug: child.slug, parentId: parentRow.id },
          });
          const missingTr = await ensureCategoryTranslations(createdChild.id, createdChild.name);
          if (missingTr) await translateInBackground(createdChild.id, createdChild.name);
        } else {
          // Do not override existing rows (including parentId) to avoid resetting real data.
          const missingTr = await ensureCategoryTranslations(existingChild.id, existingChild.name);
          if (missingTr) await translateInBackground(existingChild.id, existingChild.name);
        }
      }
    }

    // 6c. State Categories under state-news (dynamic from State table)
    // This is also non-destructive and translation-safe.
    const stateNewsSlug = 'state-news';
    let stateNews = await prisma.category.findUnique({ where: { slug: stateNewsSlug } });
    if (!stateNews) {
      stateNews = await prisma.category.create({ data: { name: 'State News', slug: stateNewsSlug } });
      const missingTr = await ensureCategoryTranslations(stateNews.id, stateNews.name);
      if (missingTr) await translateInBackground(stateNews.id, stateNews.name);
    } else {
      const missingTr = await ensureCategoryTranslations(stateNews.id, stateNews.name);
      if (missingTr) await translateInBackground(stateNews.id, stateNews.name);
    }

    const allStates = await prisma.state.findMany({
      where: { country: { code: 'IN' } },
      select: { name: true },
      take: 100,
    }).catch(() => [] as any);

    for (const st of allStates as any[]) {
      const stateName = String(st?.name || '').trim();
      if (!stateName) continue;
      const slug = `state-news-${defaultCategorySlugify(stateName)}`.slice(0, 60);
      const existingStateCat = await prisma.category.findUnique({ where: { slug } });
      if (!existingStateCat) {
        const created = await prisma.category.create({
          data: { name: stateName, slug, parentId: stateNews.id },
        });
        const missingTr = await ensureCategoryTranslations(created.id, created.name);
        if (missingTr) await translateInBackground(created.id, created.name);
      } else {
        const missingTr = await ensureCategoryTranslations(existingStateCat.id, existingStateCat.name);
        if (missingTr) await translateInBackground(existingStateCat.id, existingStateCat.name);
      }
    }
  } catch {
    // best-effort
  }
  console.log('[Bootstrap] 6b-6c. Default categories + state categories done');

  // 7. Global Reporter Designations
  // Clean standard Indian print newspaper reporter designations only.
  // IMPORTANT: Keep this list minimal and aligned with clean_and_seed_designations.ts
  try {
    const defaults: { level: string; code: string; name: string; nativeName: string; levelOrder: number }[] = [
      { level: 'STATE', code: 'STATE_BUREAU_CHIEF', name: 'State Bureau Chief', nativeName: 'రాష్ట్ర బ్యూరో చీఫ్', levelOrder: 1 },
      { level: 'DISTRICT', code: 'STAFF_REPORTER', name: 'Staff Reporter', nativeName: 'స్టాఫ్ రిపోర్టర్', levelOrder: 2 },
      { level: 'ASSEMBLY', code: 'RC_INCHARGE', name: 'RC In-charge', nativeName: 'ఆర్సీ ఇన్‌చార్జ్', levelOrder: 3 },
      { level: 'MANDAL', code: 'MANDAL_REPORTER', name: 'Mandal Reporter', nativeName: 'మండల రిపోర్టర్', levelOrder: 4 },
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
        ops.push((prisma as any).reporterDesignation.update({ 
          where: { id }, 
          data: { level: d.level, name: d.name, nativeName: d.nativeName, levelOrder: d.levelOrder } 
        }));
      } else {
        ops.push((prisma as any).reporterDesignation.create({ 
          data: { 
            tenantId: null, 
            level: d.level, 
            code: d.code, 
            name: d.name,
            nativeName: d.nativeName,
            levelOrder: d.levelOrder
          } 
        }));
      }
    }
    if (ops.length) await (prisma as any).$transaction(ops);
  } catch {
    // best-effort; designations can be seeded later via tenant seed endpoint
  }
  console.log('[Bootstrap] 7. Reporter designations done (4 clean designations)');

  // 8. Default AI Prompts (create missing + update existing)
  // Ensures critical prompt keys exist and are up-to-date after DB reset/new DB.
  // This now UPDATES existing prompts to sync with code changes.
  try {
    const keys = DEFAULT_PROMPTS.map(p => p.key);
    const existing = await (prisma as any).prompt?.findMany?.({ where: { key: { in: keys } }, select: { key: true, content: true } }).catch(() => [] as any);
    const existingByKey = new Map((existing as any[]).map(r => [String(r?.key), r] as const));
    
    const missing = DEFAULT_PROMPTS.filter(p => !existingByKey.has(p.key));
    if (missing.length) {
      await (prisma as any).prompt?.createMany?.({
        data: missing.map(p => ({ key: p.key, content: p.content, description: p.description || null })),
        skipDuplicates: true,
      });
    }
    
    // Update existing prompts if content has changed
    for (const p of DEFAULT_PROMPTS) {
      const existingPrompt = existingByKey.get(p.key);
      if (existingPrompt && existingPrompt.content !== p.content) {
        await (prisma as any).prompt?.update?.({
          where: { key: p.key },
          data: { content: p.content, description: p.description || null }
        }).catch(() => { /* ignore */ });
      }
    }
  } catch {
    // best-effort
  }
  console.log('[Bootstrap] 8. AI Prompts done - all seeds complete');
}
