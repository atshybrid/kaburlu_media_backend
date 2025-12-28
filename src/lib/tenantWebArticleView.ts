// Shared view helpers for website/public APIs backed by TenantWebArticle.

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
  tags: string[];
  status: string;
  publishedAt: string | null;
  coverImage: { alt: string; url: string; caption: string };
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

export function toWebArticleDetailDto(a: any): WebArticleDetail {
  const cj: any = a?.contentJson || {};
  const coverUrl = (cj?.coverImage?.url || a?.coverImageUrl || '') as string;
  const publishedAt = (a?.publishedAt || cj?.publishedAt || null) as any;

  return {
    id: a.id,
    tenantId: a.tenantId,
    slug: a.slug,
    title: a.title || cj?.title || '',
    subtitle: cj?.subtitle || '',
    excerpt: cj?.excerpt || '',
    tags: (a.tags || cj?.tags || []) as string[],
    status: String(a.status || cj?.status || 'draft').toLowerCase(),
    publishedAt: publishedAt ? new Date(publishedAt).toISOString() : null,
    coverImage: cj?.coverImage || { alt: '', url: coverUrl, caption: '' },
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
