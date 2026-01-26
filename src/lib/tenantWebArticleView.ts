// Shared view helpers for website/public APIs backed by TenantWebArticle.

import { config } from '../config/env';

/**
 * OG-safe cover image structure for social media sharing.
 * - url: Original image URL (may be WebP, used for website rendering)
 * - ogImageUrl: CDN-transformed JPG/PNG URL (1200x630, for og:image meta tags)
 * - alt: Image alt text (article title)
 * - caption: Image caption (if available)
 */
export type CoverImage = {
  url: string;
  ogImageUrl: string | null;
  alt: string;
  caption: string;
};

export type WebArticleCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
  category: { id: string; slug: string; name: string } | null;
  languageCode: string | null;
  tags: string[];
};

export type WebArticleDetail = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  subtitle: string;
  excerpt: string;
  highlights: string[];
  tags: string[];
  status: string;
  publishedAt: string | null;
  coverImage: CoverImage | null;
  categories: any[];
  blocks: any[];
  contentHtml: string;
  plainText: string;
  readingTimeMin: number;
  languageCode: string;
  authors: any[];
  meta: { seoTitle: string; metaDescription: string };
  jsonLd: any;
  audit: any;
  media: any;
};

/**
 * Build OG-safe image URL using CDN transformation.
 * Converts WebP/original images to JPG/PNG at 1200x630 for social media sharing.
 * 
 * Supported CDN providers:
 * - bunny: ?format=jpg&width=1200&height=630&quality=85
 * - cloudflare: /cdn-cgi/image/format=jpg,width=1200,height=630,quality=85/
 * - imgix: ?fm=jpg&w=1200&h=630&q=85&fit=crop
 * - none: Returns original URL (fallback)
 * 
 * @param originalUrl - Original image URL (may be WebP)
 * @returns CDN-transformed URL for OG image, or null if no image
 */
export function buildOgImageUrl(originalUrl: string | null | undefined): string | null {
  if (!originalUrl || typeof originalUrl !== 'string' || !originalUrl.trim()) {
    return null;
  }

  const url = originalUrl.trim();
  
  // Already a non-WebP format? Some platforms may handle it
  // But we still transform for consistent sizing and format
  const provider = config.cdn?.imageTransformProvider || 'bunny';
  const ogConfig = config.cdn?.ogImage || { width: 1200, height: 630, format: 'jpg', quality: 85 };
  const { width, height, format, quality } = ogConfig;

  // Skip transformation if provider is 'none' or not configured
  if (provider === 'none') {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    
    switch (provider) {
      case 'bunny': {
        // Bunny CDN: append query params
        // https://docs.bunny.net/docs/image-processing
        parsedUrl.searchParams.set('format', format);
        parsedUrl.searchParams.set('width', String(width));
        parsedUrl.searchParams.set('height', String(height));
        parsedUrl.searchParams.set('quality', String(quality));
        parsedUrl.searchParams.set('aspect_ratio', '1.91:1'); // OG ratio
        return parsedUrl.toString();
      }
      
      case 'cloudflare': {
        // Cloudflare Images: /cdn-cgi/image/{options}/{path}
        // https://developers.cloudflare.com/images/transform-images/
        const options = `format=${format},width=${width},height=${height},quality=${quality},fit=cover`;
        const baseUrl = config.cdn?.imageTransformBaseUrl || `${parsedUrl.protocol}//${parsedUrl.host}`;
        const imagePath = parsedUrl.pathname + parsedUrl.search;
        return `${baseUrl}/cdn-cgi/image/${options}${imagePath}`;
      }
      
      case 'imgix': {
        // Imgix: append query params
        // https://docs.imgix.com/apis/rendering
        parsedUrl.searchParams.set('fm', format === 'jpg' ? 'jpg' : 'png');
        parsedUrl.searchParams.set('w', String(width));
        parsedUrl.searchParams.set('h', String(height));
        parsedUrl.searchParams.set('q', String(quality));
        parsedUrl.searchParams.set('fit', 'crop');
        parsedUrl.searchParams.set('crop', 'faces,center');
        return parsedUrl.toString();
      }
      
      default:
        // Fallback: return original URL
        return url;
    }
  } catch {
    // URL parsing failed, return original
    return url;
  }
}

/**
 * Build cover image object with OG-safe URL for social sharing.
 * @param coverImageData - Raw cover image data from contentJson or coverImageUrl
 * @param articleTitle - Article title for alt text
 * @returns CoverImage object with ogImageUrl, or null if no image
 */
export function buildCoverImage(
  coverImageData: { url?: string; alt?: string; caption?: string } | string | null | undefined,
  articleTitle: string
): CoverImage | null {
  let url: string | null = null;
  let alt = '';
  let caption = '';

  if (typeof coverImageData === 'string') {
    url = coverImageData.trim() || null;
  } else if (coverImageData && typeof coverImageData === 'object') {
    url = coverImageData.url?.trim() || null;
    alt = coverImageData.alt || '';
    caption = coverImageData.caption || '';
  }

  if (!url) {
    return null;
  }

  return {
    url,
    ogImageUrl: buildOgImageUrl(url),
    alt: alt || articleTitle || '',
    caption,
  };
}

export function toWebArticleDetailDto(a: any): WebArticleDetail {
  const cj: any = a?.contentJson || {};
  const publishedAt = (a?.publishedAt || cj?.publishedAt || null) as any;
  const title = a.title || cj?.title || '';
  
  // Build cover image with OG-safe URL for social sharing
  // Priority: contentJson.coverImage > coverImageUrl > media.images[0]
  const rawCoverImage = cj?.coverImage 
    || (a?.coverImageUrl ? { url: a.coverImageUrl, alt: '', caption: '' } : null)
    || (cj?.media?.images?.[0]?.url ? { url: cj.media.images[0].url, alt: '', caption: '' } : null);
  const coverImage = buildCoverImage(rawCoverImage, title);

  return {
    id: a.id,
    tenantId: a.tenantId,
    slug: a.slug,
    title,
    subtitle: cj?.subtitle || '',
    excerpt: cj?.excerpt || '',
    highlights: cj?.highlights || [],
    tags: (a.tags || cj?.tags || []) as string[],
    status: String(a.status || cj?.status || 'draft').toLowerCase(),
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    coverImage,
    categories: cj?.categories || [],
    blocks: cj?.blocks || [],
    contentHtml: cj?.contentHtml || '',
    plainText: cj?.plainText || '',
    readingTimeMin: cj?.readingTimeMin || 0,
    languageCode: cj?.languageCode || '',
    authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
    meta: {
      seoTitle: a.seoTitle || cj?.meta?.seoTitle || '',
      metaDescription: a.metaDescription || cj?.meta?.metaDescription || ''
    },
    jsonLd: a.jsonLd || cj?.jsonLd || {},
    audit: cj?.audit || {
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      createdBy: a.authorId || '',
      updatedBy: a.authorId || ''
    },
    media: cj?.media || { images: [], videos: [] }
  };
}

export function toWebArticleCardDto(a: any, opts?: { category?: any; languageCode?: string | null }): WebArticleCard {
  const cj: any = a?.contentJson || {};
  const title = (a?.title || cj?.title || '') as string;
  const excerpt = (cj?.excerpt || cj?.meta?.metaDescription || a?.metaDescription || null) as string | null;
  const coverImageUrl = (a?.coverImageUrl || cj?.coverImage?.url || null) as string | null;
  const publishedAt = (a?.publishedAt || cj?.publishedAt || null) as any;
  const languageCode = (opts?.languageCode ?? cj?.languageCode ?? null) as string | null;

  return {
    id: a.id,
    slug: a.slug,
    title,
    excerpt,
    coverImageUrl,
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    category: opts?.category
      ? { id: opts.category.id, slug: opts.category.slug, name: opts.category.name }
      : (a?.category ? { id: a.category.id, slug: a.category.slug, name: a.category.name } : null),
    languageCode,
    tags: (a?.tags || cj?.tags || []) as string[]
  };
}

export function buildNewsArticleJsonLd(params: {
  domain: string;
  tenantName: string;
  slug: string;
  title: string;
  description: string | null;
  imageUrls: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  authorName: string | null;
  section: string | null;
  inLanguage: string | null;
}) {
  const base = `https://${params.domain}`;
  const url = `${base}/articles/${encodeURIComponent(params.slug)}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: params.title,
    image: params.imageUrls.slice(0, 3),
    datePublished: params.publishedAt,
    dateModified: params.modifiedAt,
    author: { '@type': 'Person', name: params.authorName || 'Reporter' },
    publisher: { '@type': 'Organization', name: params.tenantName },
    articleSection: params.section,
    description: params.description,
    inLanguage: params.inLanguage
  };
}
