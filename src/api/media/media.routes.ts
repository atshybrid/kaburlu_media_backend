import { Router } from 'express';
import passport from 'passport';
import { r2Client, R2_BUCKET, getPublicUrl, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT } from '../../lib/r2';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import prisma from '../../lib/prisma';
import sharp from 'sharp';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';

const router = Router();
// Simple configuration guard for R2. Returns a human-readable error if misconfigured.
function ensureR2Configured(res: any): boolean {
  const missing: string[] = [];
  if (!R2_BUCKET) missing.push('R2_BUCKET');
  if (!R2_ACCOUNT_ID && !R2_ENDPOINT) missing.push('R2_ACCOUNT_ID or R2_ENDPOINT');
  if (!R2_ACCESS_KEY_ID) missing.push('R2_ACCESS_KEY_ID');
  if (!R2_SECRET_ACCESS_KEY) missing.push('R2_SECRET_ACCESS_KEY');
  if (missing.length > 0) {
    res.status(500).json({ error: 'Storage not configured', missing });
    return false;
  }
  return true;
}

// Configure ffmpeg/ffprobe binaries (works on Windows/Linux/Mac)
try {
  if (ffmpegStatic) {
    // @ts-ignore - types may declare string | null
    ffmpeg.setFfmpegPath(ffmpegStatic as string);
  }
  if ((ffprobeStatic as any)?.path) {
    ffmpeg.setFfprobePath((ffprobeStatic as any).path as string);
  }
} catch {}

// Allowed MIME types for images and videos
const IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/heic',
  'image/heif',
]);
const VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
]);

// Basic filter: only accept image/* or video/* files
const upload = multer({
  // Allow up to 100 MB to accommodate videos; we'll enforce image limit separately
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image/video files are allowed'));
    }
  },
});

function mimeToExt(mime: string, fallback: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/ogg': 'ogv', 'video/quicktime': 'mov',
  };
  return map[mime] || fallback;
}

async function transcodeToWebm(inputBuffer: Buffer): Promise<Buffer> {
  // Write to temp file and transcode via ffmpeg to WebM (VP9 + Opus)
  const tmpDir = os.tmpdir();
  const base = `upload-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const inPath = path.join(tmpDir, `${base}.input`);
  const outPath = path.join(tmpDir, `${base}.webm`);
  await fs.writeFile(inPath, inputBuffer);
  return await new Promise<Buffer>((resolve, reject) => {
    ffmpeg(inPath)
      .videoCodec('libvpx-vp9')
      .audioCodec('libopus')
      .outputOptions([
        '-b:v 0',            // constant quality mode
        '-crf 32',           // quality (lower is better, 24-36 reasonable)
        '-deadline good',    // better quality
        '-cpu-used 4',       // speed/quality tradeoff
      ])
      .format('webm')
      .on('end', async () => {
        try {
          const buf = await fs.readFile(outPath);
          // cleanup
          await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath)]);
          resolve(buf);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', async (err: any) => {
        await Promise.allSettled([fs.unlink(inPath), fs.unlink(outPath).catch(() => {})]);
        reject(err);
      })
      .save(outPath);
  });
}

/**
 * @swagger
 * /media/presign-upload:
 *   post:
 *     summary: Get a presigned URL to upload a file to R2
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 example: "shortnews/2025/09/13/uuid.jpg"
 *               contentType:
 *                 type: string
 *                 example: "image/jpeg"
 *     responses:
 *       200:
 *         description: Presigned URL and public URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                 publicUrl:
 *                   type: string
 */
router.post('/presign-upload', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    if (!ensureR2Configured(res)) return;
    const { key, contentType } = req.body as { key: string; contentType?: string };
    if (!key) return res.status(400).json({ error: 'key is required' });
    const command = new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType });
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 * 5 }); // 5 min
    const publicUrl = getPublicUrl(key);
    res.json({ uploadUrl, publicUrl });
  } catch (e) {
    console.error('presign-upload error', e);
    res.status(500).json({ error: 'Failed to create presigned URL' });
  }
});

/**
 * @swagger
 * /media/presign-get:
 *   post:
 *     summary: Get a presigned GET URL to download a private object
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *                 example: "shortnews/2025/09/13/uuid.jpg"
 *     responses:
 *       200:
 *         description: Presigned GET URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 url:
 *                   type: string
 */
router.post('/presign-get', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    if (!ensureR2Configured(res)) return;
    const { key } = req.body as { key: string };
    if (!key) return res.status(400).json({ error: 'key is required' });
    const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
    const url = await getSignedUrl(r2Client, command, { expiresIn: 60 * 5 }); // 5 min
    res.json({ url });
  } catch (e) {
    console.error('presign-get error', e);
    res.status(500).json({ error: 'Failed to create presigned GET URL' });
  }
});

export default router;

/**
 * @swagger
 * /media/upload:
 *   post:
 *     summary: Upload a file directly (multipart/form-data)
 *     description: Useful for Swagger testing or admin uploads. For client apps, prefer presigned upload.
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               key:
 *                 type: string
 *                 description: Optional destination key. If omitted, server generates shortnews/YYYY/MM/DD/<timestamp-rand>.<ext>
 *               filename:
 *                 type: string
 *                 description: Optional base filename (without extension). Server will append an extension based on MIME type.
 *               folder:
 *                 type: string
 *                 description: Optional root folder (e.g., images, videos, shortnews/uploads). Defaults to images/videos/files based on MIME.
 *               kind:
 *                 type: string
 *                 enum: [image, video]
 *                 description: Optional file kind. If provided, server validates MIME accordingly.
 *     responses:
 *       200:
 *         description: File uploaded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 publicUrl:
 *                   type: string
 */
router.post('/upload', passport.authenticate('jwt', { session: false }), upload.single('file'), async (req, res) => {
  try {
    if (!ensureR2Configured(res)) return;
    const file = req.file;
    const { key, filename, kind, folder } = req.body as { key?: string; filename?: string; kind?: 'image' | 'video'; folder?: string };
    if (!file) return res.status(400).json({ error: 'file is required (multipart/form-data)' });

    // Validate kind if provided
    if (kind) {
      const isImage = IMAGE_MIMES.has(file.mimetype);
      const isVideo = VIDEO_MIMES.has(file.mimetype);
      if (kind === 'image' && !isImage) return res.status(400).json({ error: 'Expected an image file' });
      if (kind === 'video' && !isVideo) return res.status(400).json({ error: 'Expected a video file' });
    }

    const original = file.originalname || 'upload.bin';
    const originalExt = (original.includes('.') ? original.substring(original.lastIndexOf('.') + 1) : 'bin').toLowerCase();
    const detectedExt = mimeToExt(file.mimetype || '', originalExt);
    const d = new Date();
    const datePath = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    const random = Math.random().toString(36).slice(2, 8);
    // Choose root folder (sanitized), default to kind-based root
    const sanitizedFolder = (folder ? String(folder).trim() : '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const rootByKind = file.mimetype.startsWith('image/') ? 'images' : (file.mimetype.startsWith('video/') ? 'videos' : 'files');
    const root = sanitizedFolder || rootByKind;

    // Decide target content type and extension based on conversion policy
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    let targetExt = detectedExt;
    let targetContentType = file.mimetype || 'application/octet-stream';
    if (isImage) {
      // Convert all images to WebP except PNG stays PNG
      if (file.mimetype === 'image/png') {
        targetExt = 'png';
        targetContentType = 'image/png';
      } else {
        targetExt = 'webp';
        targetContentType = 'image/webp';
      }
    } else if (isVideo) {
      // Convert all videos to WebM
      targetExt = 'webm';
      targetContentType = 'video/webm';
    }

    // If filename is provided, use it (without extension), otherwise generate a timestamp-based name
    const safeBase = (filename ? String(filename).trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '') : `${Date.now()}-${random}`).replace(/\.[^.]+$/, '');
    const generatedKey = `${root}/${datePath}/${safeBase}.${targetExt}`;
    // If a key is supplied, replace its extension to match target
    let finalKey = (key && String(key).trim().length > 0) ? String(key).trim() : generatedKey;
    if (finalKey && (isImage || isVideo)) {
      finalKey = finalKey.replace(/\.[^.\/]+$/, '') + `.${targetExt}`;
    }

    // Enforce size limits and perform light compression for images
    const MAX_IMAGE_BYTES = Number(process.env.MEDIA_MAX_IMAGE_MB || 10) * 1024 * 1024; // default 10MB
    const MAX_VIDEO_BYTES = Number(process.env.MEDIA_MAX_VIDEO_MB || 100) * 1024 * 1024; // default 100MB

    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      return res.status(400).json({ error: `Video too large. Max ${Math.round(MAX_VIDEO_BYTES / (1024*1024))}MB` });
    }

    let uploadBuffer = file.buffer;
    let uploadContentType = targetContentType;

    if (isImage) {
      try {
        // Convert to WebP by default (except PNG stays PNG); rotate to respect EXIF
        const img = sharp(file.buffer).rotate();
        if (targetContentType === 'image/png') {
          uploadBuffer = await img.png({ compressionLevel: 9 }).toBuffer();
        } else {
          // target is webp
          uploadBuffer = await img.webp({ quality: 85 }).toBuffer();
        }
        // Enforce final size limit for images
        if (uploadBuffer.length > MAX_IMAGE_BYTES) {
          return res.status(400).json({ error: `Image too large after optimization. Max ${Math.round(MAX_IMAGE_BYTES / (1024*1024))}MB` });
        }
      } catch (optErr) {
        console.warn('image optimize failed, using original buffer', optErr);
        if (file.size > MAX_IMAGE_BYTES) {
          return res.status(400).json({ error: `Image too large. Max ${Math.round(MAX_IMAGE_BYTES / (1024*1024))}MB` });
        }
      }
    }

    if (isVideo) {
      try {
        uploadBuffer = await transcodeToWebm(file.buffer);
        uploadContentType = 'video/webm';
      } catch (vidErr) {
        console.error('video transcode failed', vidErr);
        return res.status(500).json({ error: 'Video transcoding failed' });
      }
    }

    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: finalKey,
      Body: uploadBuffer,
      ContentType: uploadContentType,
      CacheControl: 'public, max-age=31536000, immutable',
    }));

  const publicUrl = getPublicUrl(finalKey);

    // Insert DB record (best-effort; if it fails, still return upload success)
    try {
      const ownerId = (req.user as any)?.id || undefined;
      const folderValue = root;
      const prismaAny = prisma as any;
      await prismaAny.media.create({
        data: {
          key: finalKey,
          url: publicUrl,
          name: original,
          contentType: uploadContentType,
          size: Number(uploadBuffer.length || 0),
          kind: (file.mimetype?.startsWith('image/') ? 'image' : (file.mimetype?.startsWith('video/') ? 'video' : 'other')),
          folder: folderValue,
          ownerId,
        },
      } as any);
    } catch (dbErr) {
      console.warn('media db create failed (non-fatal):', dbErr);
    }

    res.json({
      key: finalKey,
      publicUrl,
      name: original,
      contentType: uploadContentType,
      size: uploadBuffer.length,
      kind: (file.mimetype?.startsWith('image/') ? 'image' : (file.mimetype?.startsWith('video/') ? 'video' : 'other')),
    });
  } catch (e) {
    console.error('direct upload error', e);
    res.status(500).json({ error: 'Upload failed' });
  }
});

/**
 * @swagger
 * /media/object:
 *   get:
 *     summary: Get object metadata (HEAD)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Object key
 *     responses:
 *       200:
 *         description: Object metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 key:
 *                   type: string
 *                 contentType:
 *                   type: string
 *                 contentLength:
 *                   type: number
 *                 lastModified:
 *                   type: string
 *                   format: date-time
 */
router.get('/object', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const key = String(req.query.key || '');
    if (!key) return res.status(400).json({ error: 'key is required' });
    const head = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    // Using GetObject because aws-sdk v3 doesn't expose a separate HeadObject in our imports here; adjusts behavior
    const contentType = (head as any).ContentType || 'application/octet-stream';
    const contentLength = (head as any).ContentLength || 0;
    const lastModified = (head as any).LastModified || null;
    res.json({ key, contentType, contentLength, lastModified });
  } catch (e) {
    console.error('object meta error', e);
    res.status(404).json({ error: 'Object not found' });
  }
});

/**
 * @swagger
 * /media/list:
 *   get:
 *     summary: List objects by prefix
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: prefix
 *         schema:
 *           type: string
 *         description: Key prefix to filter (e.g., shortnews/2025/09/13)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: cursor
 *         schema:
 *           type: string
 *         description: Continuation token
 *     responses:
 *       200:
 *         description: Object list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 items:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       key:
 *                         type: string
 *                       size:
 *                         type: number
 *                       lastModified:
 *                         type: string
 *                         format: date-time
 *                 nextCursor:
 *                   type: string
 */
router.get('/list', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
    const prefix = String(req.query.prefix || '');
    const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 50));
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const resp = await r2Client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix || undefined,
      MaxKeys: limit,
      ContinuationToken: cursor,
    }));
    const items = (resp.Contents || []).map(obj => ({
      key: obj.Key || '',
      size: Number(obj.Size || 0),
      lastModified: obj.LastModified || null,
    }));
    res.json({ items, nextCursor: resp.NextContinuationToken || null });
  } catch (e) {
    console.error('list error', e);
    res.status(500).json({ error: 'List failed' });
  }
});

/**
 * @swagger
 * /media/object:
 *   delete:
 *     summary: Delete an object
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               key:
 *                 type: string
 *     responses:
 *       200:
 *         description: Deleted
 */
router.delete('/object', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const { key } = req.body as { key?: string };
    if (!key) return res.status(400).json({ error: 'key is required' });
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    try {
      const prismaAny = prisma as any;
      await prismaAny.media.delete({ where: { key } });
    } catch (e) {
      // ignore if not found
    }
    res.json({ deleted: true, key });
  } catch (e) {
    console.error('delete error', e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

/**
 * @swagger
 * /media/rename:
 *   put:
 *     summary: Rename/move an object (copy + delete)
 *     tags: [Media]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromKey:
 *                 type: string
 *               toKey:
 *                 type: string
 *     responses:
 *       200:
 *         description: Renamed
 */
router.put('/rename', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    const { CopyObjectCommand, DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const { fromKey, toKey } = req.body as { fromKey?: string; toKey?: string };
    if (!fromKey || !toKey) return res.status(400).json({ error: 'fromKey and toKey are required' });
    await r2Client.send(new CopyObjectCommand({
      Bucket: R2_BUCKET,
      CopySource: `/${R2_BUCKET}/${fromKey}`,
      Key: toKey,
      MetadataDirective: 'COPY',
    } as any));
    await r2Client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: fromKey }));
    try {
      // upsert new key, delete old if exists
      const url = getPublicUrl(toKey);
      const prismaAny = prisma as any;
      await prisma.$transaction([
        prismaAny.media.deleteMany({ where: { key: fromKey } }),
        prismaAny.media.upsert({
          where: { key: toKey },
          update: { url },
          create: {
            key: toKey,
            url,
            name: toKey.split('/').pop() || toKey,
            contentType: 'application/octet-stream',
            size: 0,
            kind: 'other',
            folder: toKey.split('/')[0] || null,
          },
        })
      ]);
    } catch (e) {
      console.warn('media db rename sync failed (non-fatal):', e);
    }
    res.json({ renamed: true, fromKey, toKey, publicUrl: getPublicUrl(toKey) });
  } catch (e) {
    console.error('rename error', e);
    res.status(500).json({ error: 'Rename failed' });
  }
});
