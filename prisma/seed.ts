

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
const languages: { name: string; code: string; nativeName: string; direction: string; isDeleted: boolean }[] = [
    { name: 'English', code: 'en', nativeName: 'English', direction: 'ltr', isDeleted: false },
    { name: 'Hindi', code: 'hi', nativeName: 'हिन्दी', direction: 'ltr', isDeleted: false },
    { name: 'Telugu', code: 'te', nativeName: 'తెలుగు', direction: 'ltr', isDeleted: false }
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

    // Delete old data
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
        const newLang = await prisma.language.create({
            data: lang,
        });
        createdLanguages.push({ id: newLang.id, code: newLang.code });
    }
    console.log(`Seeded ${createdLanguages.length} languages.`);

    const languageMap: Record<string, string> = {};
    for (const lang of createdLanguages) {
        languageMap[lang.code] = lang.id;
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
        await prisma.user.create({
            data: {
                mobileNumber: userData.mobileNumber,
                mpin: hashedMpin,
                roleId: roleMap[userData.roleName],
                languageId: userData.languageId,
                status: 'ACTIVE',
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


