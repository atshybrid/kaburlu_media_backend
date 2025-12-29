export type NewsArticleJsonLd = Record<string, any>;

function toAbsolute(url: string | undefined | null, base: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  return base.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
}

function toOrigin(canonicalUrl: string): string {
  try {
    return new URL(canonicalUrl).origin;
  } catch {
    return '';
  }
}

export function buildNewsArticleJsonLd(params: {
  headline: string;
  description?: string;
  canonicalUrl: string;
  imageUrls?: string[];
  imageWidth?: number;
  imageHeight?: number;
  languageCode?: string;
  datePublished?: string | Date;
  dateModified?: string | Date;
  authorName?: string;
  publisherName?: string;
  publisherLogoUrl?: string;
  publisherLogoWidth?: number;
  publisherLogoHeight?: number;
  videoUrl?: string;
  videoThumbnailUrl?: string;
  keywords?: string[];
  articleSection?: string;
  isAccessibleForFree?: boolean;
  wordCount?: number;
  contentLocationName?: string;
  aboutName?: string;
}): NewsArticleJsonLd {
  const {
    headline,
    description,
    canonicalUrl,
    imageUrls = [],
    imageWidth,
    imageHeight,
    languageCode = 'en',
    datePublished,
    dateModified,
    authorName,
    publisherName = process.env.SEO_PUBLISHER_NAME || 'HRCI Today News',
    publisherLogoUrl = process.env.SEO_PUBLISHER_LOGO || '',
    publisherLogoWidth,
    publisherLogoHeight,
    videoUrl,
    videoThumbnailUrl,
    keywords,
    articleSection,
    isAccessibleForFree = true,
    wordCount,
    contentLocationName,
    aboutName,
  } = params;

  const origin = toOrigin(canonicalUrl);
  const normalizedImageUrls = (imageUrls || [])
    .map((u) => (origin ? toAbsolute(u, origin) : u))
    .filter(Boolean) as string[];
  const normalizedLogoUrl = origin ? toAbsolute(publisherLogoUrl, origin) : (publisherLogoUrl || undefined);

  const article: any = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: String(headline).slice(0, 110),
    url: canonicalUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl,
    },
    inLanguage: languageCode,
    isAccessibleForFree,
  };

  if (description) article.description = String(description).slice(0, 160);
  if (normalizedImageUrls.length === 1) {
    const imageObj: any = { '@type': 'ImageObject', url: normalizedImageUrls[0] };
    const iw = Number.isFinite(imageWidth as any) ? Number(imageWidth) : undefined;
    const ih = Number.isFinite(imageHeight as any) ? Number(imageHeight) : undefined;
    if (iw && ih) {
      imageObj.width = iw;
      imageObj.height = ih;
    }
    article.image = imageObj;
  } else if (normalizedImageUrls.length) {
    article.image = normalizedImageUrls;
  }
  if (datePublished) article.datePublished = new Date(datePublished).toISOString();
  if (dateModified) article.dateModified = new Date(dateModified).toISOString();
  // Author is important for E-E-A-T; keep a sensible fallback.
  article.author = { '@type': 'Person', name: (authorName && String(authorName).trim()) ? String(authorName).trim() : 'Reporter' };
  if (publisherName) {
    const logoW = Number.isFinite(publisherLogoWidth as any)
      ? Number(publisherLogoWidth)
      : (Number.isFinite(Number(process.env.SEO_PUBLISHER_LOGO_WIDTH)) ? Number(process.env.SEO_PUBLISHER_LOGO_WIDTH) : undefined);
    const logoH = Number.isFinite(publisherLogoHeight as any)
      ? Number(publisherLogoHeight)
      : (Number.isFinite(Number(process.env.SEO_PUBLISHER_LOGO_HEIGHT)) ? Number(process.env.SEO_PUBLISHER_LOGO_HEIGHT) : undefined);

    article.publisher = {
      '@type': 'Organization',
      name: publisherName,
      logo: normalizedLogoUrl
        ? {
            '@type': 'ImageObject',
            url: normalizedLogoUrl,
            ...(logoW && logoH ? { width: logoW, height: logoH } : {})
          }
        : undefined,
    };
  }
  if (Array.isArray(keywords) && keywords.length) article.keywords = keywords;
  if (articleSection) article.articleSection = articleSection;
  if (Number.isFinite(wordCount as any)) article.wordCount = wordCount;

  if (contentLocationName) {
    article.contentLocation = { '@type': 'Place', name: String(contentLocationName) };
  }
  if (aboutName) {
    article.about = { '@type': 'Thing', name: String(aboutName) };
  }

  if (videoUrl) {
    article.video = {
      '@type': 'VideoObject',
      name: headline,
      description: description || headline,
      uploadDate: (datePublished ? new Date(datePublished) : new Date()).toISOString(),
      contentUrl: videoUrl,
      thumbnailUrl: videoThumbnailUrl || (normalizedImageUrls && normalizedImageUrls[0]) || undefined,
    };
  }

  return article;
}
