

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const roles = [
    'SUPER_ADMIN',
    'LANGUAGE_ADMIN',
    'NEWS_DESK',
    'REPORTER',
    'ADMIN',
    'CITIZEN_REPORTER',
    'GUEST'
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

const defaultPermissions: Record<string, string[]> = {
    SUPER_ADMIN: ['create', 'read', 'update', 'delete', 'approve', 'reject'],
    LANGUAGE_ADMIN: ['articles:create', 'articles:read', 'articles:update', 'articles:delete', 'articles:approve', 'articles:reject', 'users:read'],
    NEWS_DESK: [],
    REPORTER: [],
    ADMIN: [],
    CITIZEN_REPORTER: [],
    GUEST: [],
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
        await prisma.reporterPayment.deleteMany({}).catch(()=>{});
        await prisma.reporterIDCard.deleteMany({}).catch(()=>{});
        await prisma.reporter.deleteMany({}).catch(()=>{});
        await prisma.domainCheckLog.deleteMany({}).catch(()=>{});
        await prisma.domainCategory.deleteMany({}).catch(()=>{});
        await prisma.domainLanguage.deleteMany({}).catch(()=>{});
        await prisma.domain.deleteMany({}).catch(()=>{});
        await prisma.tenantTheme.deleteMany({}).catch(()=>{});
        await prisma.tenant.deleteMany({}).catch(()=>{});
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
        const newRole = await prisma.role.upsert({
            where: { name: roleName },
            update: {},
            create: {
                name: roleName,
                permissions: defaultPermissions[roleName]
            },
        });
        roleMap[roleName] = newRole.id;
    }
    console.log(`Seeded ${roles.length} roles.`);

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
    const tenant = await prisma.tenant.upsert({
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
    const activeDomain = await prisma.domain.upsert({
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
    await prisma.domain.upsert({
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
            await prisma.domainCategory.upsert({
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
            await prisma.domainLanguage.upsert({
                where: { domainId_languageId: { domainId: activeDomain.id, languageId: lang.id } },
                update: {},
                create: { domainId: activeDomain.id, languageId: lang.id }
            });
        } catch {}
    }

    // Theme
    await prisma.tenantTheme.upsert({
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

    // Reporter hierarchy
    // Create a tenant admin reporter
    const adminReporter = await prisma.reporter.upsert({
        where: { email: 'admin@greennews.local' },
        update: {},
        create: {
            tenantId: tenant.id,
            role: 'TENANT_ADMIN',
            level: 'STATE',
            stateId: telanganaState?.id,
            name: 'Green Admin',
            email: 'admin@greennews.local',
            passwordHash: await bcrypt.hash('AdminPass123!', 10)
        }
    });
    // Parent Reporter
    const parentReporter = await prisma.reporter.upsert({
        where: { email: 'parent@greennews.local' },
        update: {},
        create: {
            tenantId: tenant.id,
            role: 'PARENT_REPORTER',
            level: 'DISTRICT',
            name: 'District Lead',
            email: 'parent@greennews.local',
            passwordHash: await bcrypt.hash('ParentPass123!', 10)
        }
    });
    // Child Reporter
    await prisma.reporter.upsert({
        where: { email: 'reporter1@greennews.local' },
        update: {},
        create: {
            tenantId: tenant.id,
            role: 'REPORTER',
            level: 'MANDAL',
            parentId: parentReporter.id,
            name: 'Field Reporter 1',
            email: 'reporter1@greennews.local',
            passwordHash: await bcrypt.hash('ReporterPass123!', 10)
        }
    });

    // Reporter payment & ID card for parent reporter
    const currentYear = new Date().getUTCFullYear();
    await prisma.reporterPayment.upsert({
        where: { reporterId_year: { reporterId: parentReporter.id, year: currentYear } },
        update: { status: 'PAID' },
        create: {
            reporterId: parentReporter.id,
            year: currentYear,
            amount: 1500,
            status: 'PAID',
            expiresAt: new Date(new Date().setUTCFullYear(currentYear + 1))
        }
    });
    await prisma.reporterIDCard.upsert({
        where: { reporterId: parentReporter.id },
        update: {},
        create: {
            reporterId: parentReporter.id,
            cardNumber: `GREENNEWS-${currentYear}-0001`,
            issuedAt: new Date(),
            expiresAt: new Date(new Date().setUTCFullYear(currentYear + 1))
        }
    });

    console.log('Multi-tenant demo seed complete.');

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


