
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

// Get a single location by ID
export const findLocationById = (id: string) => {
    return prisma.userLocation.findUnique({
        where: { id }
        // No relations in UserLocation model
    });
};

// Update a location
export const updateLocation = (id: string, data: UpdateLocationDto) => {
    const { timestampUtc, ...rest } = data as any;
    return prisma.userLocation.update({
        where: { id },
        data: {
            ...rest,
            timestampUtc: timestampUtc ? new Date(timestampUtc) : undefined,
        },
    });
};

// Delete a location
export const deleteLocation = (id: string) => {
    return prisma.userLocation.delete({
        where: { id },
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
