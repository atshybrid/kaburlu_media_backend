import { S3Client } from '@aws-sdk/client-s3';
import { config } from '../config/env';

export const R2_ACCOUNT_ID = config.r2.accountId || '';
export const R2_ACCESS_KEY_ID = config.r2.accessKeyId || '';
export const R2_SECRET_ACCESS_KEY = config.r2.secretAccessKey || '';
export const R2_BUCKET = config.r2.bucket || '';
export const R2_PUBLIC_BASE_URL = config.r2.publicBaseUrl || '';
export const R2_ENDPOINT = config.r2.endpoint || '';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export function getPublicUrl(key: string): string {
  // Prefer custom CDN domain if provided, else fallback to R2 public endpoint style
  if (R2_PUBLIC_BASE_URL) {
    const base = R2_PUBLIC_BASE_URL.replace(/\/$/, '');
    // If using Cloudflare's account-level endpoint, we must include the bucket in the path
    // Example: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
    if (/\.r2\.cloudflarestorage\.com$/i.test(base)) {
      return `${base}/${R2_BUCKET}/${key}`;
    }
    // For r2.dev or custom CDN domains that already map to the bucket, do not add the bucket segment
    return `${base}/${key}`;
  }
  if (R2_ENDPOINT) {
    const base = R2_ENDPOINT.replace(/\/$/, '');
    return `${base}/${R2_BUCKET}/${key}`;
  }
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BUCKET}/${key}`;
}
