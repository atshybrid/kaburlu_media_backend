import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config/env';
import { bunnyStoragePutObject, isBunnyStorageConfigured } from './bunnyStorage';
import { getPublicUrl, r2Client, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_BUCKET, R2_SECRET_ACCESS_KEY } from './r2';
import axios from 'axios';

export type PublicObjectPutResult = { key: string; publicUrl: string };

export function getMediaProvider(): 'r2' | 'bunny' {
  const p = String(config.media?.provider || 'r2').toLowerCase();
  return p === 'bunny' ? 'bunny' : 'r2';
}

function assertR2Configured(): void {
  const missing: string[] = [];
  if (!R2_BUCKET) missing.push('R2_BUCKET');
  if (!R2_ACCOUNT_ID) missing.push('R2_ACCOUNT_ID');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (missing.length) {
    throw new Error(`R2 not configured. Missing: ${missing.join(', ')}`);
  }
}

export async function putPublicObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<PublicObjectPutResult> {
  const provider = getMediaProvider();

  if (provider === 'bunny') {
    if (!isBunnyStorageConfigured()) {
      throw new Error('Bunny Storage not configured. Set BUNNY_STORAGE_ZONE_NAME/BUNNY_STORAGE_API_KEY/BUNNY_STORAGE_PUBLIC_BASE_URL.');
    }
    return await bunnyStoragePutObject({
      key: params.key,
      body: params.body,
      contentType: params.contentType,
    });
  }

  assertR2Configured();

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType || 'application/octet-stream',
    }),
  );

  return { key: params.key, publicUrl: getPublicUrl(params.key) };
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function ensureHttpsBaseUrl(base: string): string {
  const trimmed = String(base || '').trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/\/+/, '')}`;
}

function joinUrl(base: string, pathPart: string): string {
  const b = base.replace(/\/+$/g, '');
  const p = pathPart.replace(/^\/+/, '');
  return `${b}/${p}`;
}

export async function deletePublicObject(params: { key: string }): Promise<void> {
  const provider = getMediaProvider();

  if (provider === 'bunny') {
    const { zoneName, apiKey } = config.media.bunny.storage;
    if (!zoneName || !apiKey) {
      throw new Error('Bunny Storage not configured for delete operation.');
    }
    const encodedKey = encodeKey(params.key);
    const delUrl = joinUrl(`https://storage.bunnycdn.com/${encodeURIComponent(zoneName)}`, encodedKey);
    await axios.delete(delUrl, {
      headers: { AccessKey: apiKey },
      maxBodyLength: Infinity,
      validateStatus: (s) => (s >= 200 && s < 300) || s === 404,
    });
    return;
  }

  assertR2Configured();
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: R2_BUCKET,
      Key: params.key,
    }),
  );
}
