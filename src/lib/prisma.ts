
import { PrismaClient } from '@prisma/client';

// Prefer fallback DB if explicitly requested. This allows running locally without
// touching the remote database when the network blocks port 5432 or the cloud
// database is temporarily unavailable.
const preferFallback = String(process.env.PRISMA_PREFER_FALLBACK).toLowerCase() === 'true';
const primaryUrl = process.env.DATABASE_URL;
const fallbackUrl = process.env.DATABASE_URL_FALLBACK;

const chosenUrl = preferFallback && fallbackUrl ? fallbackUrl : primaryUrl;

// Create PrismaClient with explicit datasource URL if chosen
const prisma = chosenUrl
	? new PrismaClient({ datasources: { db: { url: chosenUrl } } })
	: new PrismaClient();

if (chosenUrl) {
	try {
		const masked = chosenUrl.replace(/:\/\/.*?:.*?@/, '://***:***@');
		console.log(`[Prisma] Using datasource: ${masked}`);
	} catch {
		// ignore masking errors
	}
}

export default prisma;
