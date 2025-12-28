import axios from 'axios';
import { config } from '../config/env';

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/+$/g, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

export function isBunnyStreamConfigured(): boolean {
  const { libraryId, apiKey, embedBaseUrl } = config.media.bunny.stream;
  return Boolean(libraryId && apiKey && embedBaseUrl);
}

export async function bunnyStreamUploadVideo(params: {
  title: string;
  body: Buffer;
  contentType: string;
}): Promise<{ key: string; publicUrl: string; videoGuid: string }>
{
  const { libraryId, apiKey, embedBaseUrl } = config.media.bunny.stream;
  if (!libraryId || !apiKey) {
    const missing = [
      !libraryId ? 'BUNNY_STREAM_LIBRARY_ID' : null,
      !apiKey ? 'BUNNY_STREAM_API_KEY' : null,
    ].filter(Boolean);
    throw new Error(`Bunny Stream not configured. Missing: ${missing.join(', ')}`);
  }

  // 1) Create video
  const createUrl = `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos`;
  const created = await axios.post(createUrl, { title: params.title || 'upload' }, {
    headers: {
      AccessKey: apiKey,
      'Content-Type': 'application/json',
    },
  });

  const data = created.data || {};
  const videoGuid = data.guid || data.videoGuid || data.id;
  if (!videoGuid || typeof videoGuid !== 'string') {
    throw new Error('Bunny Stream: failed to create video (missing guid)');
  }

  // 2) Upload binary
  const uploadUrl = `https://video.bunnycdn.com/library/${encodeURIComponent(libraryId)}/videos/${encodeURIComponent(videoGuid)}`;
  await axios.put(uploadUrl, params.body, {
    headers: {
      AccessKey: apiKey,
      'Content-Type': params.contentType || 'application/octet-stream',
      'Content-Length': params.body.length,
    },
    maxBodyLength: Infinity,
  });

  const publicUrl = joinUrl(embedBaseUrl || 'https://iframe.mediadelivery.net/embed', `${libraryId}/${videoGuid}`);
  const key = `bunny-stream/${videoGuid}`;

  return { key, publicUrl, videoGuid };
}
