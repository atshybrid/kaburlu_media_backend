import axios from 'axios';
import { config } from '../config/env';

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/g, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

function ensureHttpsBaseUrl(base: string): string {
  const trimmed = String(base || '').trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  // Allow callers to pass host/path without scheme.
  return `https://${trimmed.replace(/^\/\/+/, '')}`;
}

function encodeKey(key: string): string {
  // Bunny accepts path-style keys; encode each segment safely.
  return key.split('/').map(encodeURIComponent).join('/');
}

export function isBunnyStorageConfigured(): boolean {
  const { zoneName, apiKey, publicBaseUrl } = config.media.bunny.storage;
  return Boolean(zoneName && apiKey && publicBaseUrl);
}

export async function bunnyStoragePutObject(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string; publicUrl: string }>
{
  const { zoneName, apiKey, publicBaseUrl } = config.media.bunny.storage;
  if (!zoneName || !apiKey || !publicBaseUrl) {
    const missing = [
      !zoneName ? 'BUNNY_STORAGE_ZONE_NAME' : null,
      !apiKey ? 'BUNNY_STORAGE_API_KEY' : null,
      !publicBaseUrl ? 'BUNNY_STORAGE_PUBLIC_BASE_URL' : null,
    ].filter(Boolean);
    throw new Error(`Bunny Storage not configured. Missing: ${missing.join(', ')}`);
  }

  const encodedKey = encodeKey(params.key);
  const putUrl = joinUrl(`https://storage.bunnycdn.com/${encodeURIComponent(zoneName)}`, encodedKey);

  await axios.put(putUrl, params.body, {
    headers: {
      AccessKey: apiKey,
      'Content-Type': params.contentType || 'application/octet-stream',
      'Content-Length': params.body.length,
    },
    maxBodyLength: Infinity,
  });

  const publicUrl = joinUrl(ensureHttpsBaseUrl(publicBaseUrl), encodedKey);
  return { key: params.key, publicUrl };
}
