import { S3Client } from '@aws-sdk/client-s3';

export const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || '';
export const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
export const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
export const R2_BUCKET = process.env.R2_BUCKET || '';
export const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || '';
export const R2_ENDPOINT = process.env.R2_ENDPOINT || '';

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
