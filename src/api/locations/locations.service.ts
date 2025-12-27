
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto';

const prisma = new PrismaClient();

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

    const [states, districts, mandals, villages] = await Promise.all([
        wantState
            ? prisma.state.findMany({
                where: { isDeleted: false, name: { contains: q, mode: 'insensitive' } },
                select: { id: true, name: true },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
        wantDistrict
            ? prisma.district.findMany({
                where: { isDeleted: false, name: { contains: q, mode: 'insensitive' } },
                select: { id: true, name: true, state: { select: { id: true, name: true } } },
                take: limit,
                orderBy: { name: 'asc' },
            })
            : Promise.resolve([] as any[]),
        wantMandal
            ? prisma.mandal.findMany({
                where: { isDeleted: false, name: { contains: q, mode: 'insensitive' } },
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
                    name: { contains: q, mode: 'insensitive' },
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

    return items.slice(0, limit);
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
