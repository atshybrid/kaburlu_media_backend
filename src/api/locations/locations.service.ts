
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto';

const prisma = new PrismaClient();

const normalizeLocationSearchText = (input: string) => {
    const s = String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '');

    // Keep letters/numbers from any script; drop punctuation/symbols.
    return s
        .replace(/[’'`\"“”]/g, '')
        .replace(/[._/\\-]+/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
};
/**
 * Calculate match score for ranking search results
 * Higher score = better match
 */
const calculateMatchScore = (query: string, itemName: string): number => {
    const normalizedQuery = normalizeLocationSearchText(query);
    const normalizedItem = normalizeLocationSearchText(itemName);
    
    // Exact match (highest priority)
    if (normalizedItem === normalizedQuery) return 1000;
    
    // Starts with query (high priority)
    if (normalizedItem.startsWith(normalizedQuery)) return 500;
    
    // Contains query (medium priority)
    if (normalizedItem.includes(normalizedQuery)) return 250;
    
    // Calculate similarity based on common characters
    const queryChars = normalizedQuery.split('');
    const itemChars = normalizedItem.split('');
    let matchingChars = 0;
    
    for (const char of queryChars) {
        if (itemChars.includes(char)) matchingChars++;
    }
    
    const similarity = matchingChars / Math.max(queryChars.length, itemChars.length);
    return similarity * 100;
};
const buildLocationSearchVariants = (rawQuery: string) => {
    const raw = String(rawQuery || '').trim();
    const normalized = normalizeLocationSearchText(raw);

    const variants = new Set<string>();
    if (raw) variants.add(raw);
    if (normalized) variants.add(normalized);
    if (normalized) variants.add(normalized.replace(/\s+/g, ''));

    // Small Latin-only spelling heuristics (common user inputs):
    // - trailing 'y' vs 'i' (e.g., reddy → reddi)
    if (/^[a-z0-9 ]+$/.test(normalized)) {
        if (normalized.endsWith('y')) variants.add(normalized.slice(0, -1) + 'i');
        if (normalized.endsWith('i')) variants.add(normalized.slice(0, -1) + 'y');

        // Initials: user types "g konduru" but DB may store "G. Konduru"
        // Add dotted variant when query starts with a single-letter token.
        const m = normalized.match(/^([a-z])\s+(.+)$/);
        if (m) variants.add(`${m[1]}. ${m[2]}`);

        // Common spelling mistakes in Indian place names (Telugu/Hindi transliteration):
        // 1. Double consonants: kadapa vs kaddapa, guntur vs gunttur
        // Remove double consonants
        const noDoubles = normalized.replace(/([bcdfghjklmnpqrstvwxyz])\1+/g, '$1');
        if (noDoubles !== normalized) variants.add(noDoubles);
        
        // Add double consonants to single ones (limited to avoid explosion)
        // Only for short queries to prevent too many variants
        if (normalized.length <= 10) {
            const withDoubles = normalized.replace(/([bcdfghjklmnpqrstvwxyz])(?![bcdfghjklmnpqrstvwxyz])/g, '$1$1');
            if (withDoubles !== normalized && withDoubles.length <= normalized.length + 3) {
                variants.add(withDoubles);
            }
        }

        // 2. Common character substitutions in transliteration:
        const substitutions: Record<string, string[]> = {
            'dh': ['d'], 'd': ['dh'],
            'th': ['t'], 't': ['th'],
            'ph': ['p'], 'p': ['ph'],
            'v': ['b', 'w'], 'b': ['v'], 'w': ['v'],
            'kh': ['k'], 'k': ['kh'],
            'gh': ['g'], 'g': ['gh'],
            'ch': ['c'], 'c': ['ch'],
            'sh': ['s'], 's': ['sh']
        };

        for (const [pattern, replacements] of Object.entries(substitutions)) {
            if (normalized.includes(pattern)) {
                for (const repl of replacements) {
                    const variant = normalized.replace(new RegExp(pattern, 'g'), repl);
                    if (variant !== normalized) variants.add(variant);
                }
            }
        }

        // 3. Vowel variations (common in speech-to-text or fast typing):
        // Remove repeated vowels: 'aa' -> 'a', 'ee' -> 'e'
        const noDoubleVowels = normalized.replace(/([aeiou])\1+/g, '$1');
        if (noDoubleVowels !== normalized) variants.add(noDoubleVowels);

        // Common vowel substitutions (u/oo, i/e, a/aa, o/oo)
        const vowelSubstitutions: Array<[RegExp, string]> = [
            [/oo/g, 'u'], [/u/g, 'oo'],
            [/ee/g, 'i'], [/i/g, 'e'], [/e/g, 'i'],
            [/aa/g, 'a'],
            [/o/g, 'oo'], [/oo/g, 'o'],  // Handle o vs oo (Chittoor vs Chittor, Kurnool vs Kurnol)
        ];

        for (const [pattern, repl] of vowelSubstitutions) {
            const variant = normalized.replace(pattern, repl);
            if (variant !== normalized && variant.length >= 3) {
                variants.add(variant);
            }
        }

        // Handle sha/sa confusion (common in Telugu transliteration)
        if (normalized.includes('sha')) {
            variants.add(normalized.replace(/sha/g, 'sa'));
        }
        if (normalized.includes('sa')) {
            variants.add(normalized.replace(/sa/g, 'sha'));
        }

        // Handle 'ul' vs 'ool' pattern (kurnul vs kurnool)
        if (normalized.includes('ul')) {
            variants.add(normalized.replace(/ul/g, 'ool'));
        }
        if (normalized.includes('ool')) {
            variants.add(normalized.replace(/ool/g, 'ul'));
        }

        // Handle visha/visa confusion (extra 'i' in Visakhapatnam)
        // Common mistake: adding 'h' after 'i' -> "vishakapatnam" instead of "visakhapatnam"
        if (normalized.includes('isha')) {
            variants.add(normalized.replace(/isha/g, 'isa'));
        }
        if (normalized.includes('isa')) {
            variants.add(normalized.replace(/isa/g, 'isha'));
        }

        // Handle "akha" vs "haka" transposition (vishakapatnam vs visakhapatnam)
        if (normalized.includes('haka')) {
            variants.add(normalized.replace(/haka/g, 'akha'));
        }
        if (normalized.includes('akha')) {
            variants.add(normalized.replace(/akha/g, 'haka'));
        }

        // 4. Common prefix/suffix variations:
        if (normalized.startsWith('sri ')) variants.add('shri ' + normalized.slice(4));
        if (normalized.startsWith('shri ')) variants.add('sri ' + normalized.slice(5));
        if (normalized.endsWith('abad')) variants.add(normalized.slice(0, -4) + 'bad');
        if (normalized.endsWith('bad') && !normalized.endsWith('abad')) {
            variants.add(normalized.slice(0, -3) + 'abad');
        }
        if (normalized.endsWith('puram')) variants.add(normalized.slice(0, -5) + 'pura');
        if (normalized.endsWith('pura')) variants.add(normalized.slice(0, -4) + 'puram');
        if (normalized.endsWith('palle')) variants.add(normalized.slice(0, -5) + 'palli');
        if (normalized.endsWith('palli')) variants.add(normalized.slice(0, -5) + 'palle');

        // 5. Common abbreviations/nicknames (Andhra Pradesh specific)
        const nicknames: Record<string, string[]> = {
            'vizag': ['visakhapatnam', 'vishakhapatnam'],
            'rjy': ['rajahmundry', 'rajamahendravaram'],
            'vjd': ['vijayawada']
        };

        const lowerNormalized = normalized.toLowerCase();
        if (nicknames[lowerNormalized]) {
            nicknames[lowerNormalized].forEach(full => variants.add(full));
        }
    }

    // Keep variant count reasonable (increased from 15 to 20 for better coverage)
    return Array.from(variants)
        .map((v) => v.trim())
        .filter((v) => v.length >= 2)
        .slice(0, 20);
};

// Create a single location
export const createLocation = (data: CreateLocationDto) => {
    const { timestampUtc, ...rest } = data as any;
    return prisma.userLocation.create({
        data: {
            ...rest,
            timestampUtc: timestampUtc ? new Date(timestampUtc) : undefined,
        }
    });
};

// Get all locations with pagination and filtering
export const findAllLocations = (options: { page?: number, limit?: number, filter?: any }) => {
    const { page = 1, limit = 10, filter = {} } = options;
    const skip = (page - 1) * limit;

    return prisma.userLocation.findMany({
        skip,
        take: limit,
        where: filter
        // No relations in UserLocation model
    });
};

// Get a single location by userId (primary key)
export const findLocationById = (userId: string) => {
    return prisma.userLocation.findUnique({
        where: { userId }
        // No relations in UserLocation model
    });
};

// Update a location
export const updateLocation = (userId: string, data: UpdateLocationDto) => {
    const { timestampUtc, ...rest } = data as any;
    return prisma.userLocation.update({
        where: { userId },
        data: {
            ...rest,
            timestampUtc: timestampUtc ? new Date(timestampUtc) : undefined,
        },
    });
};

// Delete a location
export const deleteLocation = (userId: string) => {
    return prisma.userLocation.delete({
        where: { userId },
    });
};

// Bulk upload from CSV
export const bulkUploadLocations = (filePath: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        const locations: any[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                // Basic validation for required fields
                if (!row.userId || !row.latitude || !row.longitude) {
                    // Skip row or handle error
                    return;
                }
                locations.push({
                    userId: row.userId,
                    latitude: parseFloat(row.latitude),
                    longitude: parseFloat(row.longitude),
                    accuracyMeters: row.accuracyMeters ? parseFloat(row.accuracyMeters) : undefined,
                    provider: row.provider,
                    timestampUtc: row.timestampUtc ? new Date(row.timestampUtc) : undefined,
                    placeId: row.placeId,
                    placeName: row.placeName,
                    address: row.address,
                    source: row.source,
                });
            })
            .on('end', async () => {
                try {
                    if(locations.length === 0) {
                        fs.unlinkSync(filePath);
                        return reject(new Error('CSV file is empty or headers are incorrect.'));
                    }
                    const result = await prisma.userLocation.createMany({
                        data: locations,
                        skipDuplicates: true,
                    });
                    fs.unlinkSync(filePath);
                    resolve(result);
                } catch (error) {
                    fs.unlinkSync(filePath);
                    reject(error);
                }
            })
            .on('error', (error) => {
                fs.unlinkSync(filePath);
                reject(error);
            });
    });
};

// Search geo entities (State/District/Mandal) for reporter/article location selection
export const searchGeoLocations = async (params: { q: string; limit?: number; types?: string[]; includeVillage?: boolean; tenantId?: string }) => {
    const q = String(params.q || '').trim();
    const limit = Math.max(1, Math.min(Number(params.limit || 20), 50));
    const includeVillage = !!params.includeVillage;
    const tenantId = params.tenantId ? String(params.tenantId) : undefined;
    const types = Array.isArray(params.types) ? params.types.map((t) => String(t).toUpperCase()) : [];
    const wantAll = !types.length;
    const wantState = wantAll || types.includes('STATE');
    const wantDistrict = wantAll || types.includes('DISTRICT');
    const wantMandal = wantAll || types.includes('MANDAL');
    const wantVillage = includeVillage || types.includes('VILLAGE');

    if (!q) return [];

    const qVariants = buildLocationSearchVariants(q);
    
    // Create search conditions with priority:
    // 1. Exact match (highest priority)
    // 2. Starts with (high priority)
    // 3. Contains (medium priority)
    const orNameOrTranslationsContains = qVariants.flatMap((v) => [
        // English name matches
        { name: { equals: v, mode: 'insensitive' as const } },        // Exact match
        { name: { startsWith: v, mode: 'insensitive' as const } },    // Starts with
        { name: { contains: v, mode: 'insensitive' as const } },       // Contains
        // Translation matches
        { translations: { some: { name: { equals: v, mode: 'insensitive' as const } } } },
        { translations: { some: { name: { startsWith: v, mode: 'insensitive' as const } } } },
        { translations: { some: { name: { contains: v, mode: 'insensitive' as const } } } },
    ]);

    const [states, districts, mandals, villages] = await Promise.all([
        wantState
            ? prisma.state.findMany({
                where: {
                    isDeleted: false,
                    OR: orNameOrTranslationsContains as any,
                },
                select: { id: true, name: true },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
        wantDistrict
            ? prisma.district.findMany({
                where: {
                    isDeleted: false,
                    OR: orNameOrTranslationsContains as any,
                },
                select: { id: true, name: true, state: { select: { id: true, name: true } } },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
        wantMandal
            ? prisma.mandal.findMany({
                where: {
                    isDeleted: false,
                    OR: orNameOrTranslationsContains as any,
                },
                select: {
                    id: true,
                    name: true,
                    district: { select: { id: true, name: true, state: { select: { id: true, name: true } } } },
                },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
        wantVillage
            ? (prisma as any).village.findMany({
                where: {
                    isDeleted: false,
                    OR: orNameOrTranslationsContains as any,
                    ...(tenantId ? { tenantId } : {}),
                },
                select: {
                    id: true,
                    name: true,
                    tenantId: true,
                    mandal: {
                        select: {
                            id: true,
                            name: true,
                            district: { select: { id: true, name: true, state: { select: { id: true, name: true } } } },
                        },
                    },
                },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
    ]);

    const items: any[] = [];

    for (const s of states) {
        items.push({
            type: 'STATE',
            id: s.id,
            name: s.name,
            stateId: s.id,
            stateName: s.name,
            districtId: null,
            districtName: null,
            mandalId: null,
            mandalName: null,
            displayName: s.name,
            placeId: s.id,
            address: s.name,
        });
    }

    for (const d of districts) {
        const address = [d.name, d.state?.name].filter(Boolean).join(', ');
        items.push({
            type: 'DISTRICT',
            id: d.id,
            name: d.name,
            stateId: d.state?.id || null,
            stateName: d.state?.name || null,
            districtId: d.id,
            districtName: d.name,
            mandalId: null,
            mandalName: null,
            displayName: d.name,
            placeId: d.id,
            address,
        });
    }

    for (const m of mandals) {
        const districtName = m.district?.name || null;
        const stateName = m.district?.state?.name || null;
        const address = [districtName, stateName].filter(Boolean).join(', ');
        items.push({
            type: 'MANDAL',
            id: m.id,
            name: m.name,
            stateId: m.district?.state?.id || null,
            stateName,
            districtId: m.district?.id || null,
            districtName,
            mandalId: m.id,
            mandalName: m.name,
            displayName: m.name,
            placeId: m.id,
            address,
        });
    }

    for (const v of villages) {
        const mandalName = v.mandal?.name || null;
        const districtName = v.mandal?.district?.name || null;
        const stateName = v.mandal?.district?.state?.name || null;
        const address = [mandalName, districtName, stateName].filter(Boolean).join(', ');
        items.push({
            type: 'VILLAGE',
            id: v.id,
            name: v.name,
            tenantId: v.tenantId,
            stateId: v.mandal?.district?.state?.id || null,
            stateName,
            districtId: v.mandal?.district?.id || null,
            districtName,
            mandalId: v.mandal?.id || null,
            mandalName,
            villageId: v.id,
            villageName: v.name,
            displayName: v.name,
            placeId: v.id,
            address,
        });
    }

    // Optional: allow free-text village suggestion even if not in DB
    if (includeVillage) {
        items.unshift({
            type: 'VILLAGE_SUGGESTION',
            id: null,
            name: q,
            tenantId: tenantId || null,
            stateId: null,
            stateName: null,
            districtId: null,
            districtName: null,
            mandalId: null,
            mandalName: null,
            villageId: null,
            villageName: q,
            displayName: q,
            placeId: null,
            address: null,
        });
    }

    // Score and sort results by relevance
    const scoredItems = items.map(item => ({
        ...item,
        _score: calculateMatchScore(q, item.name)
    }));

    // Sort by score (descending), then by name (ascending)
    scoredItems.sort((a, b) => {
        if (b._score !== a._score) {
            return b._score - a._score;
        }
        return (a.name || '').localeCompare(b.name || '');
    });

    // Remove score from output and apply limit
    const rankedItems = scoredItems.map(({ _score, ...item }) => item);

    return rankedItems.slice(0, limit);
};

export const createVillage = async (data: { tenantId: string; mandalId: string; name: string }) => {
    const tenantId = String(data.tenantId);
    const mandalId = String(data.mandalId);
    const name = String(data.name || '').trim();
    if (!tenantId || !mandalId || !name) throw new Error('tenantId, mandalId, name required');
    return (prisma as any).village.create({ data: { tenantId, mandalId, name } });
};

export const listVillages = async (params: { tenantId?: string; mandalId?: string; q?: string; limit?: number; offset?: number }) => {
    const tenantId = params.tenantId ? String(params.tenantId) : undefined;
    const mandalId = params.mandalId ? String(params.mandalId) : undefined;
    const q = params.q ? String(params.q).trim() : undefined;
    const take = Math.max(1, Math.min(Number(params.limit || 20), 100));
    const skip = Math.max(0, Number(params.offset || 0));

    const where: any = { isDeleted: false };
    if (tenantId) where.tenantId = tenantId;
    if (mandalId) where.mandalId = mandalId;
    if (q) where.name = { contains: q, mode: 'insensitive' };

    const [total, items] = await Promise.all([
        (prisma as any).village.count({ where }),
        (prisma as any).village.findMany({
            where,
            take,
            skip,
            orderBy: { name: 'asc' },
            include: {
                mandal: { include: { district: { include: { state: true } } } },
            },
        }),
    ]);

    return { total, items };
};

export const getVillageById = async (id: string) => {
    return (prisma as any).village.findUnique({
        where: { id },
        include: { mandal: { include: { district: { include: { state: true } } } } },
    });
};
