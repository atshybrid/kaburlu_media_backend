
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Prefer local fallback DB for seeding if requested via env
try {
    if (String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true' && process.env.DATABASE_URL_FALLBACK) {
        const original = process.env.DATABASE_URL || '';
        const fb = process.env.DATABASE_URL_FALLBACK!;
        const mask = (s: string) => s.replace(/:\/\/.*?:.*?@/, '://***:***@');
        console.log(`[Prisma Seed] PRISMA_PREFER_FALLBACK=true -> Using fallback datasource`);
        console.log(`[Prisma Seed] From: ${mask(original)}\n[Prisma Seed] To:   ${mask(fb)}`);
        process.env.DATABASE_URL = fb;
    }
} catch {}

const prisma = new PrismaClient();
// Temporary any-cast accessor for newly added multi-tenant delegates while TS language server cache refreshes.
// Once editor picks up regenerated @prisma/client types, replace p.<model> with prisma.<model>.
// This avoids noisy transient TS2339 errors.
// TODO: Remove 'p' indirection when types stabilize.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p: any = prisma;

// Core and extended roles. Added TENANT_ADMIN & PUBLISHER for tenant-scoped management and publishing workflow.
const roles = [
    'SUPER_ADMIN',
    'TENANT_ADMIN',
    'PUBLISHER',
    'LANGUAGE_ADMIN',
    'NEWS_DESK',
    'REPORTER',
    'ADMIN',
    'CITIZEN_REPORTER',
    'GUEST',
    // Added best-practice granular roles
    'EDITOR',           // Create & edit articles, submit for review
    'REVIEWER',         // Review and approve/reject submitted articles
    'MODERATOR',        // Content & community moderation
    'ANALYST',          // Read-only analytics & content visibility
    'SEO_EDITOR'        // Manage SEO metadata & tags
];
// Default reporter designations (global). Tenant-specific overrides seeded via API seed endpoint.
// Keep codes stable (used by client & API when referencing designationCode).
const reporterDesignationsDefaults: { level: string; code: string; name: string }[] = [
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
    { level: 'MANDAL', code: 'MANDAL_STRINGER', name: 'Mandal Stringer' }
];
// Extend with South India languages (Tamil, Kannada, Malayalam) and keep structure consistent
const languages: { name: string; code: string; nativeName: string; direction: string; isDeleted: boolean }[] = [
    { name: 'English', code: 'en', nativeName: 'English', direction: 'ltr', isDeleted: false },
    { name: 'Hindi', code: 'hi', nativeName: 'हिन्दी', direction: 'ltr', isDeleted: false },
    { name: 'Telugu', code: 'te', nativeName: 'తెలుగు', direction: 'ltr', isDeleted: false },
    { name: 'Tamil', code: 'ta', nativeName: 'தமிழ்', direction: 'ltr', isDeleted: false },
    { name: 'Kannada', code: 'kn', nativeName: 'ಕನ್ನಡ', direction: 'ltr', isDeleted: false },
    { name: 'Malayalam', code: 'ml', nativeName: 'മലയാളം', direction: 'ltr', isDeleted: false },
];

const categories = [
    { key: 'NATIONAL' },
    { key: 'INTERNATIONAL' },
    { key: 'SPORTS' },
    { key: 'TECHNOLOGY' },
    { key: 'ENTERTAINMENT' },
    { key: 'BUSINESS' },
];

const categoryTranslations: Record<string, Record<string, string>> = {
    NATIONAL: { en: 'National', te: 'జాతీయం', hi: 'राष्ट्रीय', ta: 'தேசியம்', kn: 'ರಾಷ್ಟ್ರೀಯ', ml: 'ദേശീയ' },
    INTERNATIONAL: { en: 'International', te: 'అంతర్జాతీయం', hi: 'अंतरराष्ट्रीय', ta: 'சர்வதேசம்', kn: 'ಅಂತರರಾಷ್ಟ್ರೀಯ', ml: 'അന്താരാഷ്ട്ര' },
    SPORTS: { en: 'Sports', te: 'క్రీడలు', hi: 'खेल', ta: 'விளையாட்டு', kn: 'ಕ್ರೀಡೆ', ml: 'കായികം' },
    TECHNOLOGY: { en: 'Technology', te: 'సాంకేతికం', hi: 'प्रौद्योगिकी', ta: 'தொழில்நுட்பம்', kn: 'ತಂತ್ರಜ್ಞಾನ', ml: 'സാങ്കേതികം' },
    ENTERTAINMENT: { en: 'Entertainment', te: 'వినోదం', hi: 'मनोरंजन', ta: 'பொழுதுபோக்கு', kn: 'ಮನರಂಜನೆ', ml: 'വിനോദം' },
    BUSINESS: { en: 'Business', te: 'వ్యాపారం', hi: 'व्यापार', ta: 'வணிகം', kn: 'ವ್ಯಾಪಾರ', ml: 'ബിസിനസ്സ്' },
};

const countries = [{ name: 'India', code: 'IN' }];

const indianStates: Record<string, { code: string; language: string }> = {
    'Andaman and Nicobar Islands': { code: 'AN', language: 'en' },
    'Andhra Pradesh': { code: 'AP', language: 'te' },
    'Arunachal Pradesh': { code: 'AR', language: 'en' },
    'Assam': { code: 'AS', language: 'as' },
    'Bihar': { code: 'BR', language: 'hi' },
    'Chandigarh': { code: 'CH', language: 'hi' },
    'Chhattisgarh': { code: 'CG', language: 'hi' },
    'Dadra and Nagar Haveli and Daman and Diu': { code: 'DH', language: 'gu' },
    'Delhi': { code: 'DL', language: 'hi' },
    'Goa': { code: 'GA', language: 'kok' },
    'Gujarat': { code: 'GJ', language: 'gu' },
    'Haryana': { code: 'HR', language: 'hi' },
    'Himachal Pradesh': { code: 'HP', language: 'hi' },
    'Jammu and Kashmir': { code: 'JK', language: 'ks' },
    'Jharkhand': { code: 'JH', language: 'hi' },
    'Karnataka': { code: 'KA', language: 'kn' },
    'Kerala': { code: 'KL', language: 'ml' },
    'Ladakh': { code: 'LA', language: 'en' },
    'Lakshadweep': { code: 'LD', language: 'ml' },
    'Madhya Pradesh': { code: 'MP', language: 'hi' },
    'Maharashtra': { code: 'MH', language: 'mr' },
    'Manipur': { code: 'MN', language: 'mni' },
    'Meghalaya': { code: 'ML', language: 'en' },
    'Mizoram': { code: 'MZ', language: 'en' },
    'Nagaland': { code: 'NL', language: 'en' },
    'Odisha': { code: 'OR', language: 'or' },
    'Puducherry': { code: 'PY', language: 'ta' },
    'Punjab': { code: 'PB', language: 'pa' },
    'Rajasthan': { code: 'RJ', language: 'hi' },
    'Sikkim': { code: 'SK', language: 'en' },
    'Tamil Nadu': { code: 'TN', language: 'ta' },
    'Telangana': { code: 'TS', language: 'te' },
    'Tripura': { code: 'TR', language: 'bn' },
    'Uttar Pradesh': { code: 'UP', language: 'hi' },
    'Uttarakhand': { code: 'UK', language: 'hi' },
    'West Bengal': { code: 'WB', language: 'bn' },
};

interface LocationData {
    [district: string]: {
        assemblies: {
            [assembly: string]: {
                mandals: string[];
            };
        };
    };
}

const telanganaLocations: { districts: LocationData } = {
    districts: {
        'Adilabad': {
            assemblies: {
                'Adilabad': { mandals: ['Adilabad (Urban)', 'Jainad', 'Bela'] },
                'Boath': { mandals: ['Boath', 'Tamsi', 'Gadiguda'] },
            },
        },
        'Hyderabad': {
            assemblies: {
                'Amberpet': { mandals: ['Amberpet'] },
                'Nampally': { mandals: ['Nampally'] },
            },
        },
    },
};

// Permissions kept coarse-grained; refine to capability-based checks later.
const defaultPermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['create', 'read', 'update', 'delete', 'approve', 'reject', 'tenants:all'],
    TENANT_ADMIN: [
        'tenant:read',
        'tenant:update',
        'tenant:domains',
        'tenant:categories',
        'tenant:feature-flags',
        'tenant:navigation',
        'designations:manage',
        'reporters:manage',
        'roles:manage',
        'roles:assign',
        'articles:approve',
        'articles:reject'
    ],
    PUBLISHER: [
        'articles:publish',
        'articles:schedule',
        'articles:seo',
        'articles:status',
        'articles:read'
    ],
    LANGUAGE_ADMIN: ['articles:create', 'articles:read', 'articles:update', 'articles:delete', 'articles:approve', 'articles:reject', 'users:read'],
    NEWS_DESK: [],
    REPORTER: [],
    ADMIN: [],
    CITIZEN_REPORTER: [],
    GUEST: [],
    // Granular editorial workflow roles
    EDITOR: [
        'articles:create',
        'articles:read',
        'articles:update',
        'articles:submit',        // submit for review
        'articles:media'
    ],
    REVIEWER: [
        'articles:read',
        'articles:review',        // view submissions in review queue
        'articles:approve',
        'articles:reject'
    ],
    MODERATOR: [
        'comments:moderate',
        'articles:flag',
        'shortnews:flag',
        'users:restrict'
    ],
    ANALYST: [
        'analytics:read',
        'articles:read',
        'shortnews:read',
        'categories:read'
    ],
    SEO_EDITOR: [
        'articles:read',
        'articles:update',
        'articles:seo',
        'seo:tags',
        'seo:metadata'
    ]
};

async function main() {
    console.log(`Start seeding ...`);

    // Optional destructive wipe (NOT enabled by default)
    // Set FULL_WIPE=true to clear core reference data in correct order.
    if (process.env.FULL_WIPE === 'true') {
        console.warn('FULL_WIPE enabled: clearing existing core data...');
        // Order matters: child tables first (subset, minimal for now).
        await prisma.comment.deleteMany({});
        await prisma.like.deleteMany({});
        await prisma.dislike.deleteMany({});
        await prisma.articleView.deleteMany({});
        await prisma.articleRead.deleteMany({});
        await prisma.shortNewsRead.deleteMany({});
        await prisma.shortNewsOption.deleteMany({});
        await prisma.shortNews.deleteMany({});
        await prisma.article.deleteMany({});
        // New multi-tenant related
    await p.reporterPayment?.deleteMany({}).catch(()=>{});
    await p.reporterIDCard?.deleteMany({}).catch(()=>{});
    await p.reporter?.deleteMany({}).catch(()=>{});
    await p.domainCheckLog?.deleteMany({}).catch(()=>{});
    await p.domainCategory?.deleteMany({}).catch(()=>{});
    await p.domainLanguage?.deleteMany({}).catch(()=>{});
    await p.domain?.deleteMany({}).catch(()=>{});
    await p.tenantTheme?.deleteMany({}).catch(()=>{});
    await p.tenant?.deleteMany({}).catch(()=>{});
        await prisma.categoryTranslation.deleteMany({});
        await prisma.category.deleteMany({});
        await prisma.state.deleteMany({});
        await prisma.country.deleteMany({});
        await prisma.language.deleteMany({});
        await prisma.user.deleteMany({});
        await prisma.role.deleteMany({});
    }

    // Seed Roles
    console.log('Seeding roles...');
    const roleMap: Record<string, string> = {};
    for (const roleName of roles) {
        const perms = defaultPermissions[roleName] || [];
        const newRole = await prisma.role.upsert({
            where: { name: roleName },
            update: { permissions: perms }, // ensure permission changes are applied on reseed
            create: {
                name: roleName,
                permissions: perms
            },
        });
        roleMap[roleName] = newRole.id;
    }
    console.log(`Seeded ${roles.length} roles.`);

    // Seed global reporter designations (tenantId null). Idempotent via composite unique.
    console.log('Seeding global reporter designations...');
    for (const d of reporterDesignationsDefaults) {
        const existing = await prisma.reporterDesignation.findFirst({ where: { tenantId: null, code: d.code } });
        if (!existing) {
            await prisma.reporterDesignation.create({ data: { tenantId: null, level: d.level as any, code: d.code, name: d.name } });
        } else if (existing.name !== d.name || existing.level !== d.level) {
            await prisma.reporterDesignation.update({ where: { id: existing.id }, data: { name: d.name, level: d.level as any } });
        }
    }
    const globalDesignationsCount = await p.reporterDesignation.count({ where: { tenantId: null } });
    console.log(`Seeded ${reporterDesignationsDefaults.length} global reporter designations (total now ${globalDesignationsCount}).`);

    // Seed Languages
    console.log('Seeding languages...');
    const createdLanguages: { id: string; code: string }[] = [];
    for (const lang of languages) {
        const newLang = await prisma.language.upsert({
            where: { code: lang.code },
            update: {},
            create: lang,
        });
        createdLanguages.push({ id: newLang.id, code: newLang.code });
    }
    console.log(`Seeded ${createdLanguages.length} languages.`);

    // Seed Country (India) and States
    console.log('Seeding country and states...');
    const india = await prisma.country.upsert({
        where: { name: 'India' },
        update: { code: 'IN' },
        create: { name: 'India', code: 'IN' }
    });
    const stateNames = [
        'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu','Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry'
    ];
    for (const stateName of stateNames) {
        await prisma.state.upsert({
            where: { name: stateName },
            update: {},
            create: { name: stateName, countryId: india.id }
        });
    }
    console.log(`Seeded country India and ${stateNames.length} states.`);

    // Seed Telangana news districts (idempotent)
    async function seedTelanganaDistricts() {
        console.log('Seeding Telangana districts...');
        const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } });
        if (!telangana) {
            console.warn('Telangana state not found; skipping district seed.');
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
        let createdCount = 0;
        for (const name of districts) {
            const existing = await prisma.district.findFirst({ where: { name, stateId: telangana.id } });
            if (existing) continue;
            await prisma.district.create({ data: { name, stateId: telangana.id } });
            createdCount += 1;
        }
        console.log(`Telangana districts seed done. Added ${createdCount} new of ${districts.length}.`);
    }
    await seedTelanganaDistricts();

    const languageMap: Record<string, string> = {};
    for (const lang of createdLanguages) {
        languageMap[lang.code] = lang.id;
    }

    // Seed Categories and Translations
    console.log('Seeding categories...');
    for (const cat of categories) {
        const slug = cat.key.toLowerCase();
        const created = await prisma.category.upsert({
            where: { slug },
            update: { name: cat.key },
            create: { name: cat.key, slug }
        });
        const translations = categoryTranslations[cat.key];
        if (translations) {
            for (const [langCode, translatedName] of Object.entries(translations)) {
                if (!languageMap[langCode]) continue;
                // Upsert category translation via composite unique (categoryId, language)
                await prisma.categoryTranslation.upsert({
                    where: { categoryId_language: { categoryId: created.id, language: langCode } },
                    update: { name: translatedName },
                    create: { categoryId: created.id, language: langCode, name: translatedName }
                });
            }
        }
    }
    console.log(`Seeded ${categories.length} categories with translations.`);

    // Seed Prompts (only if table exists and empty)
    try {
        const promptCount = await prisma.prompt.count();
        if (promptCount === 0) {
            console.log('Seeding prompts...');
            await prisma.prompt.createMany({
                data: [
                    {
                        key: 'SEO_GENERATION',
                        content: `You are an SEO assistant. Given a news title and content, produce strict JSON with keys: metaTitle, metaDescription, tags, altTexts.\n- metaTitle: short, compelling, <= 70 chars.\n- metaDescription: <= 160 chars.\n- tags: 5-10 concise tags.\n- altTexts: object mapping provided image URL -> descriptive alt text.\nRespond entirely in language code: {{languageCode}}.\nTitle: {{title}}\nContent: {{content}}\nImages: {{images}}\nOutput JSON schema: {"metaTitle": string, "metaDescription": string, "tags": string[], "altTexts": { [url: string]: string }}`,
                        description: 'Generates SEO meta fields for short news',
                    },
                    {
                        key: 'MODERATION',
                        content: `Content moderation for news. Analyze the text for plagiarism likelihood and sensitive content (violence, hate, adult, personal data).\nReturn STRICT JSON: {"plagiarismScore": number (0-1), "sensitiveFlags": string[], "decision": "ALLOW"|"REVIEW"|"BLOCK", "remark": string (short, in {{languageCode}})}.\nText: {{content}}`,
                        description: 'Moderation & safety analysis',
                    },
                    {
                        key: 'CATEGORY_TRANSLATION',
                        content: `You are a translator. Translate the news category name exactly into {{targetLanguage}}.\nRules:\n- Respond with ONLY the translated category name.\n- No quotes, no extra words, no punctuation.\n- Use the native script of {{targetLanguage}}{{latinGuard}}.\nCategory: {{text}}`,
                        description: 'Translate category labels',
                    },
                ],
                skipDuplicates: true,
            });
            console.log('Seeded prompts.');
        } else {
            console.log('Prompts already present, skipping prompt seeding.');
        }
    } catch (e) {
        console.warn('Prompt table check/seed skipped (table may be missing):', (e as any)?.message);
    }

    // Seed Users
    console.log('Seeding users...');
    const teluguLanguageId = languageMap['te'];
    const usersToCreate = [
        { mobileNumber: '8282868389', mpin: '1947', roleName: 'SUPER_ADMIN', languageId: languageMap['en'] },
        { mobileNumber: '9502337775', mpin: '1234', roleName: 'LANGUAGE_ADMIN', languageId: teluguLanguageId },
    ];

    const saltRounds = 10;
    for (const userData of usersToCreate) {
        const hashedMpin = await bcrypt.hash(userData.mpin, saltRounds);
        await prisma.user.upsert({
            where: { mobileNumber: userData.mobileNumber },
            update: {},
            create: {
                mobileNumber: userData.mobileNumber,
                mpin: hashedMpin,
                roleId: roleMap[userData.roleName],
                languageId: userData.languageId,
                status: 'ACTIVE',
            },
        });
    }
    console.log(`Seeded ${usersToCreate.length} users.`);

    // ---------------- Multi-Tenant Demo Seed (idempotent) ----------------
    console.log('Seeding multi-tenant demo data...');
    // Pick a known state (Telangana) if present
    const telanganaState = await prisma.state.findFirst({ where: { name: 'Telangana' } });
    const prgiNumber = 'PRGI-TS-2025-01987';
    // Upsert Tenant
    const tenant = await p.tenant.upsert({
        where: { slug: 'greennews' },
        update: {},
        create: {
            name: 'Green News Network',
            slug: 'greennews',
            stateId: telanganaState?.id,
            prgiNumber,
            prgiStatus: 'VERIFIED',
            prgiVerifiedAt: new Date(),
        }
    });
    // Domains
    const activeDomain = await p.domain.upsert({
        where: { domain: 'news.greennews.local' },
        update: {},
        create: {
            domain: 'news.greennews.local',
            tenantId: tenant.id,
            isPrimary: true,
            status: 'ACTIVE',
            verifiedAt: new Date(),
            lastCheckAt: new Date(),
            lastCheckStatus: 'OK'
        }
    });
    await p.domain.upsert({
        where: { domain: 'beta.greennews.local' },
        update: {},
        create: {
            domain: 'beta.greennews.local',
            tenantId: tenant.id,
            isPrimary: false,
            status: 'PENDING',
            verificationToken: 'tok_demo_beta'
        }
    });

    // Map first two categories & two languages (en + te) to active domain
    const allCategories = await prisma.category.findMany({ take: 2 });
    for (const cat of allCategories) {
        try {
            await p.domainCategory.upsert({
                where: { domainId_categoryId: { domainId: activeDomain.id, categoryId: cat.id } },
                update: {},
                create: { domainId: activeDomain.id, categoryId: cat.id }
            });
        } catch (e) {
            // swallow unique race if parallel
        }
    }
    const langEn = await prisma.language.findFirst({ where: { code: 'en' } });
    const langTe = await prisma.language.findFirst({ where: { code: 'te' } });
    for (const lang of [langEn, langTe]) {
        if (!lang) continue;
        try {
            await p.domainLanguage.upsert({
                where: { domainId_languageId: { domainId: activeDomain.id, languageId: lang.id } },
                update: {},
                create: { domainId: activeDomain.id, languageId: lang.id }
            });
        } catch {}
    }

    // Theme
    await p.tenantTheme.upsert({
        where: { tenantId: tenant.id },
        update: {
            logoUrl: 'https://cdn.example/greennews/logo.png',
            faviconUrl: 'https://cdn.example/greennews/favicon.ico',
            primaryColor: '#0A7F2E',
            headerHtml: '<header>Green News</header>'
        },
        create: {
            tenantId: tenant.id,
            logoUrl: 'https://cdn.example/greennews/logo.png',
            faviconUrl: 'https://cdn.example/greennews/favicon.ico',
            primaryColor: '#0A7F2E',
            headerHtml: '<header>Green News</header>'
        }
    });

    // Reporter hierarchy seeding skipped: current Reporter model doesn't include fields like email/name/password.
    // If needed later, create Reporter records using existing columns only (tenantId, userId, level, stateId...).
    console.log('Multi-tenant demo seed complete (reporters skipped).');

    // Assembly constituencies (Telangana) seed (idempotent)
    async function seedTelanganaAssemblyConstituencies() {
        console.log('Seeding Telangana assembly constituencies...');
        const telangana = await prisma.state.findFirst({ where: { name: 'Telangana' } });
        if (!telangana) { console.warn('Telangana state not found; skipping assembly constituencies.'); return; }
        const acList: { name: string; district: string }[] = [
            { name: 'Adilabad', district: 'Adilabad' },
            { name: 'Boath (ST)', district: 'Adilabad' },
            { name: 'Nirmal', district: 'Nirmal' },
            { name: 'Khanapur (ST)', district: 'Nirmal' },
            { name: 'Sirpur (ST)', district: 'Komaram Bheem Asifabad' },
            { name: 'Asifabad (ST)', district: 'Komaram Bheem Asifabad' },
            { name: 'Mancherial', district: 'Mancherial' },
            { name: 'Chennur (SC)', district: 'Mancherial' },
            { name: 'Bellampalli (SC)', district: 'Mancherial' },
            { name: 'Mudhole', district: 'Nirmal' },
            { name: 'Armur', district: 'Nizamabad' },
            { name: 'Balkonda', district: 'Nizamabad' },
            { name: 'Korutla', district: 'Jagtial' },
            { name: 'Jagtial', district: 'Jagtial' },
            { name: 'Metpally', district: 'Jagtial' },
            { name: 'Dharmapuri (SC)', district: 'Jagtial' },
            { name: 'Ramagundam', district: 'Peddapalli' },
            { name: 'Manthani', district: 'Peddapalli' },
            { name: 'Peddapalli (SC)', district: 'Peddapalli' },
            { name: 'Karimnagar', district: 'Karimnagar' },
            { name: 'Choppadandi (SC)', district: 'Karimnagar' },
            { name: 'Vemulawada', district: 'Rajanna Sircilla' },
            { name: 'Sircilla', district: 'Rajanna Sircilla' },
            { name: 'Husnabad', district: 'Siddipet' },
            { name: 'Huzurabad', district: 'Karimnagar' },
            { name: 'Manakondur (SC)', district: 'Karimnagar' },
            { name: 'Siddipet', district: 'Siddipet' },
            { name: 'Medak', district: 'Medak' },
            { name: 'Narayankhed', district: 'Sangareddy' },
            { name: 'Andole (SC)', district: 'Sangareddy' },
            { name: 'Narsapur', district: 'Medak' },
            { name: 'Zahirabad', district: 'Sangareddy' },
            { name: 'Sangareddy', district: 'Sangareddy' },
            { name: 'Patancheru', district: 'Sangareddy' },
            { name: 'Dubbak', district: 'Siddipet' },
            { name: 'Gajwel', district: 'Siddipet' },
            { name: 'Kamareddy', district: 'Kamareddy' },
            { name: 'Yellareddy', district: 'Kamareddy' },
            { name: 'Nizamabad (Urban)', district: 'Nizamabad' },
            { name: 'Nizamabad (Rural)', district: 'Nizamabad' },
            { name: 'Bodhan', district: 'Nizamabad' },
            { name: 'Jukkal (SC)', district: 'Kamareddy' },
            { name: 'Banswada', district: 'Kamareddy' },
            { name: 'Bhuvanagiri', district: 'Yadadri Bhuvanagiri' },
            { name: 'Tungaturthi', district: 'Suryapet' },
            { name: 'Suryapet', district: 'Suryapet' },
            { name: 'Kodad', district: 'Suryapet' },
            { name: 'Huzurnagar', district: 'Suryapet' },
            { name: 'Nalgonda', district: 'Nalgonda' },
            { name: 'Nakur (Nakrekal) (SC)', district: 'Nalgonda' },
            { name: 'Munugode', district: 'Nalgonda' },
            { name: 'Devarakonda (ST)', district: 'Nalgonda' },
            { name: 'Miryalaguda', district: 'Nalgonda' },
            { name: 'Bhongir', district: 'Yadadri Bhuvanagiri' },
            { name: 'Aleru', district: 'Yadadri Bhuvanagiri' },
            { name: 'Jangaon', district: 'Jangaon' },
            { name: 'Ghanpur (Station) (SC)', district: 'Jangaon' },
            { name: 'Palakurthi', district: 'Jangaon' },
            { name: 'Warangal West', district: 'Hanumakonda' },
            { name: 'Warangal East', district: 'Hanumakonda' },
            { name: 'Wardhannapet (SC)', district: 'Hanumakonda' },
            { name: 'Parakala', district: 'Hanumakonda' },
            { name: 'Bhupalpally', district: 'Jayashankar Bhupalpally' },
            { name: 'Mulug (ST)', district: 'Mulugu' },
            { name: 'Mahabubabad (SC)', district: 'Mahabubabad' },
            { name: 'Narsampet', district: 'Warangal' },
            { name: 'Dornakal (ST)', district: 'Mahabubabad' },
            { name: 'Khammam', district: 'Khammam' },
            { name: 'Palair', district: 'Khammam' },
            { name: 'Madhira (SC)', district: 'Khammam' },
            { name: 'Wyra (ST)', district: 'Khammam' },
            { name: 'Sathupalli (SC)', district: 'Khammam' },
            { name: 'Yellandu (ST)', district: 'Bhadradri Kothagudem' },
            { name: 'Kothagudem', district: 'Bhadradri Kothagudem' },
            { name: 'Bhadrachalam (ST)', district: 'Bhadradri Kothagudem' },
            { name: 'Aswaraopeta (ST)', district: 'Bhadradri Kothagudem' },
            { name: 'Mahabubnagar', district: 'Mahabubnagar' },
            { name: 'Jadcherla', district: 'Mahabubnagar' },
            { name: 'Devarakadra', district: 'Mahabubnagar' },
            { name: 'Makthal', district: 'Narayanpet' },
            { name: 'Narayanpet', district: 'Narayanpet' },
            { name: 'Kodangal', district: 'Vikarabad' },
            { name: 'Shadnagar', district: 'Ranga Reddy' },
            { name: 'Kollapur', district: 'Nagarkurnool' },
            { name: 'Wanaparthy', district: 'Wanaparthy' },
            { name: 'Gadwal', district: 'Jogulamba Gadwal' },
            { name: 'Alampur (SC)', district: 'Jogulamba Gadwal' },
            { name: 'Nagarkurnool', district: 'Nagarkurnool' },
            { name: 'Achampet (SC)', district: 'Nagarkurnool' },
            { name: 'Kalwakurthy', district: 'Nagarkurnool' },
            { name: 'Maheshwaram', district: 'Ranga Reddy' },
            { name: 'Ibrahimpatnam', district: 'Ranga Reddy' },
            { name: 'L.B. Nagar', district: 'Ranga Reddy' },
            { name: 'Rajendranagar', district: 'Ranga Reddy' },
            { name: 'Serilingampally', district: 'Ranga Reddy' },
            { name: 'Chevella', district: 'Ranga Reddy' },
            { name: 'Pargi', district: 'Vikarabad' },
            { name: 'Vikarabad (SC)', district: 'Vikarabad' },
            { name: 'Tandur', district: 'Vikarabad' },
            { name: 'Medchal', district: 'Medchal-Malkajgiri' },
            { name: 'Malkajgiri', district: 'Medchal-Malkajgiri' },
            { name: 'Quthbullapur', district: 'Medchal-Malkajgiri' },
            { name: 'Kukatpally', district: 'Medchal-Malkajgiri' },
            { name: 'Uppal', district: 'Medchal-Malkajgiri' },
            { name: 'Amberpet', district: 'Hyderabad' },
            { name: 'Khairatabad', district: 'Hyderabad' },
            { name: 'Jubilee Hills', district: 'Hyderabad' },
            { name: 'Sanathnagar', district: 'Hyderabad' },
            { name: 'Nampally', district: 'Hyderabad' },
            { name: 'Karwan', district: 'Hyderabad' },
            { name: 'Goshamahal', district: 'Hyderabad' },
            { name: 'Charminar', district: 'Hyderabad' },
            { name: 'Chandrayangutta', district: 'Hyderabad' },
            { name: 'Yakutpura', district: 'Hyderabad' },
            { name: 'Bahadurpura', district: 'Hyderabad' },
            { name: 'Secunderabad', district: 'Hyderabad' },
            { name: 'Secunderabad Cantt (SC)', district: 'Hyderabad' },
            { name: 'Mulug? (ST)', district: 'Mulugu' }, // duplicate handled by unique constraint if exists
            { name: 'Shamshabad', district: 'Ranga Reddy' },
            { name: 'Ghatkesar', district: 'Medchal-Malkajgiri' }
        ];
        let created = 0; let skipped = 0;
        for (const ac of acList) {
            const dist = await prisma.district.findFirst({ where: { name: ac.district } });
            if (!dist) { skipped++; continue; }
            const existing = await (p as any).assemblyConstituency.findFirst({ where: { name: ac.name, districtId: dist.id } });
            if (existing) continue;
            await (p as any).assemblyConstituency.create({ data: { name: ac.name, districtId: dist.id } });
            created++;
        }
        console.log(`Telangana assembly constituencies seed complete. Created ${created}, skipped (missing district) ${skipped}.`);
    }
    await seedTelanganaAssemblyConstituencies();
    console.log(`Seeding finished.`);
}
main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });


