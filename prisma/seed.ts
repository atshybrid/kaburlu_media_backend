
import { PrismaClient, RoleName, LocationType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const roles = Object.values(RoleName);
const languages = [
    { name: 'Assamese', code: 'as', isRtl: false },
    { name: 'Bengali', code: 'bn', isRtl: false },
    { name: 'Bodo', code: 'brx', isRtl: false },
    { name: 'Dogri', code: 'doi', isRtl: false },
    { name: 'English', code: 'en', isRtl: false },
    { name: 'Gujarati', code: 'gu', isRtl: false },
    { name: 'Hindi', code: 'hi', isRtl: false },
    { name: 'Kannada', code: 'kn', isRtl: false },
    { name: 'Kashmiri', code: 'ks', isRtl: true },
    { name: 'Konkani', code: 'kok', isRtl: false },
    { name: 'Maithili', code: 'mai', isRtl: false },
    { name: 'Malayalam', code: 'ml', isRtl: false },
    { name: 'Manipuri', code: 'mni', isRtl: false },
    { name: 'Marathi', code: 'mr', isRtl: false },
    { name: 'Nepali', code: 'ne', isRtl: false },
    { name: 'Odia', code: 'or', isRtl: false },
    { name: 'Punjabi', code: 'pa', isRtl: false },
    { name: 'Sanskrit', code: 'sa', isRtl: false },
    { name: 'Santali', code: 'sat', isRtl: false },
    { name: 'Sindhi', code: 'sd', isRtl: true },
    { name: 'Tamil', code: 'ta', isRtl: false },
    { name: 'Telugu', code: 'te', isRtl: false },
    { name: 'Urdu', code: 'ur', isRtl: true },
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
    BUSINESS: { en: 'Business', te: 'వ్యాపారం', hi: 'व्यापार', ta: 'வணிகம்', kn: 'ವ್ಯಾಪಾರ', ml: 'ബിസിനസ്സ്' },
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

const defaultPermissions: Partial<Record<RoleName, any>> = {
  [RoleName.SUPER_ADMIN]: { all: ['create', 'read', 'update', 'delete', 'approve', 'reject'] },
  [RoleName.LANGUAGE_ADMIN]: { articles: ['create', 'read', 'update', 'delete', 'approve', 'reject'], users: ['read'] },
  [RoleName.NEWS_DESK]: {},
  [RoleName.REPORTER]: {},
  [RoleName.ADMIN]: {},
  [RoleName.CITIZEN_REPORTER]: {},
  [RoleName.GUEST]: {},
};

async function main() {
    console.log(`Start seeding ...`);

    // Deleting old data
    console.log('Deleting existing data...');
    await prisma.location.deleteMany({});
    await prisma.categoryTranslation.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.state.deleteMany({});
    await prisma.country.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.language.deleteMany({});
    await prisma.role.deleteMany({});

    // Seed Roles
    console.log('Seeding roles...');
    const roleMap: Record<string, string> = {};
    for (const roleName of roles) {
        const newRole = await prisma.role.create({
            data: { 
              name: roleName,
              permissions: defaultPermissions[roleName] ?? {}
            },
        });
        roleMap[roleName] = newRole.id;
    }
    console.log(`Seeded ${roles.length} roles.`);

    // Seed Languages
    console.log('Seeding languages...');
    const createdLanguages = [];
    for (const lang of languages) {
        const newLang = await prisma.language.create({
            data: lang,
        });
        createdLanguages.push(newLang);
    }
    console.log(`Seeded ${createdLanguages.length} languages.`);

    const languageMap = createdLanguages.reduce((acc, lang) => {
        acc[lang.code] = lang.id;
        return acc;
    }, {} as Record<string, string>);

    // Seed Countries
    console.log('Seeding countries...');
    const countryMap: Record<string, string> = {};
    for (const country of countries) {
        const newCountry = await prisma.country.create({ data: country });
        countryMap[country.code] = newCountry.id;
    }
    console.log(`Seeded ${countries.length} countries.`);

    // Seed States
    console.log('Seeding states...');
    const stateMap: Record<string, string> = {};
    let statesCount = 0;
    for (const stateName in indianStates) {
        const stateData = indianStates[stateName];
        const langId = languageMap[stateData.language];
        if (langId) {
            const newState = await prisma.state.create({
                data: {
                    name: stateName,
                    code: stateData.code,
                    languageId: langId,
                    countryId: countryMap['IN'],
                },
            });
            stateMap[stateData.code] = newState.id;
            statesCount++;
        }
    }
    console.log(`Seeded ${statesCount} states.`);

    // Seed Locations for Telangana
    console.log('Seeding Telangana locations...');
    const telanganaStateId = stateMap['TS'];
    if (telanganaStateId) {
        for (const districtName in telanganaLocations.districts) {
            const district = await prisma.location.create({
                data: {
                    name: districtName,
                    code: `D-${districtName.toUpperCase()}`,
                    type: LocationType.district,
                    level: 1,
                    stateId: telanganaStateId,
                },
            });

            const districtData = telanganaLocations.districts[districtName];
            for (const assemblyName in districtData.assemblies) {
                const assembly = await prisma.location.create({
                    data: {
                        name: assemblyName,
                        code: `A-${assemblyName.toUpperCase()}`,
                        type: LocationType.assembly,
                        level: 2,
                        stateId: telanganaStateId,
                        parentId: district.id,
                    },
                });

                const assemblyData = districtData.assemblies[assemblyName];
                for (const mandalName of assemblyData.mandals) {
                    await prisma.location.create({
                        data: {
                            name: mandalName,
                            code: `M-${mandalName.toUpperCase()}`,
                            type: LocationType.mandal,
                            level: 3,
                            stateId: telanganaStateId,
                            parentId: assembly.id,
                        },
                    });
                }
            }
        }
    }
    console.log('Finished seeding Telangana locations.');

    // Seed Categories and Translations
    console.log('Seeding categories and translations...');
    let categoriesCount = 0;
    let translationsCount = 0;
    let order = 0;
    for (const cat of categories) {
        const newCategory = await prisma.category.create({
            data: {
                name: cat.key,
                slug: cat.key.toLowerCase(),
                order: order++,
            },
        });
        categoriesCount++;

        const translations = categoryTranslations[cat.key];
        for (const langCode in translations) {
            const langId = languageMap[langCode];
            if (langId) {
                await prisma.categoryTranslation.create({
                    data: {
                        categoryId: newCategory.id,
                        languageId: langId,
                        name: translations[langCode],
                    },
                });
                translationsCount++;
            }
        }
    }
    console.log(`Seeded ${categoriesCount} categories and ${translationsCount} translations.`);

    // Seed Users
    console.log('Seeding users...');
    const teluguLanguageId = languageMap['te'];
    const usersToCreate = [
      { mobileNumber: '8282868389', mpin: '1947', roleName: RoleName.SUPER_ADMIN, languageId: null },
      { mobileNumber: '9502337775', mpin: '1234', roleName: RoleName.LANGUAGE_ADMIN, languageId: teluguLanguageId },
    ];

    const saltRounds = 10;
    for (const userData of usersToCreate) {
        const hashedMpin = await bcrypt.hash(userData.mpin, saltRounds);
        await prisma.user.create({
            data: {
                mobileNumber: userData.mobileNumber,
                mpin: hashedMpin,
                roleId: roleMap[userData.roleName],
                languageId: userData.languageId,
                isVerified: true,
            },
        });
    }
    console.log(`Seeded ${usersToCreate.length} users.`);


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
