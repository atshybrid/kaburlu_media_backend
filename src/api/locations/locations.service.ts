
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import csv from 'csv-parser';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto';

const prisma = new PrismaClient();

// Create a single location
export const createLocation = (data: CreateLocationDto) => {
    return prisma.location.create({ data });
};

// Get all locations with pagination and filtering
export const findAllLocations = (options: { page?: number, limit?: number, filter?: any }) => {
    const { page = 1, limit = 10, filter = {} } = options;
    const skip = (page - 1) * limit;

    return prisma.location.findMany({
        skip,
        take: limit,
        where: filter,
        include: { // Include relations if needed, for example:
            state: true,
            parent: true,
            children: true,
        }
    });
};

// Get a single location by ID
export const findLocationById = (id: string) => {
    return prisma.location.findUnique({
        where: { id },
        include: {
            state: true,
            parent: true,
            children: true,
        }
    });
};

// Update a location
export const updateLocation = (id: string, data: UpdateLocationDto) => {
    return prisma.location.update({
        where: { id },
        data,
    });
};

// Delete a location
export const deleteLocation = (id: string) => {
    return prisma.location.delete({
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
                if (!row.name || !row.code || !row.type || !row.level || !row.stateId) {
                    // Skip row or handle error
                    return;
                }
                locations.push({
                    ...row,
                    level: parseInt(row.level, 10),
                    parentId: row.parentId || null,
                });
            })
            .on('end', async () => {
                try {
                    if(locations.length === 0) {
                        fs.unlinkSync(filePath);
                        return reject(new Error('CSV file is empty or headers are incorrect.'));
                    }
                    const result = await prisma.location.createMany({
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
