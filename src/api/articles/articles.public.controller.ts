import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { notifyArticleStatusChange } from '../../lib/articleNotifications';

export const getWebArticleByIdPublic = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const a = await prisma.tenantWebArticle.findUnique({
      where: { id },
      select: {
        id: true, tenantId: true, domainId: true, languageId: true,
        title: true, slug: true, status: true, coverImageUrl: true,
        contentJson: true, seoTitle: true, metaDescription: true, jsonLd: true,
        tags: true, publishedAt: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
    if (!a) return res.status(404).json({ error: 'Not found' });
    const cj: any = a.contentJson || {};
    const resp = {
      meta: {
        seoTitle: a.seoTitle || cj?.meta?.seoTitle || '',
        metaDescription: a.metaDescription || cj?.meta?.metaDescription || ''
      },
      slug: a.slug,
      tags: a.tags || cj?.tags || [],
      audit: cj?.audit || { createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.authorId || '', updatedBy: a.authorId || '' },
      media: cj?.media || { images: [], videos: [] },
      title: a.title || cj?.title || '',
      blocks: cj?.blocks || [],
      jsonLd: a.jsonLd || cj?.jsonLd || {},
      status: a.status.toLowerCase() === 'published' ? 'published' : (cj?.status || a.status.toLowerCase()),
      authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
      excerpt: cj?.excerpt || '',
      aiStatus: cj?.aiStatus || undefined,
      subtitle: cj?.subtitle || '',
      tenantId: a.tenantId,
      plainText: cj?.plainText || '',
      categories: cj?.categories || [],
      coverImage: cj?.coverImage || { alt: '', url: a.coverImageUrl || '', caption: '' },
      contentHtml: cj?.contentHtml || '',
      publishedAt: a.publishedAt || cj?.publishedAt || null,
      languageCode: cj?.languageCode || '',
      readingTimeMin: cj?.readingTimeMin || 0
    };
    return res.json(resp);
  } catch (e) {
    console.error('getWebArticleByIdPublic error', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
};

export const getWebArticlesByDomainPublic = async (req: Request, res: Response) => {
  try {
    const { domainId } = req.params as any;
    const { limit = '20', offset = '0', status = 'PUBLISHED' } = req.query as any;
    const take = Math.max(1, Math.min(100, parseInt(String(limit)) || 20));
    const skip = Math.max(0, parseInt(String(offset)) || 0);
    const items = await prisma.tenantWebArticle.findMany({
      where: { domainId, status: String(status).toUpperCase() as any },
      orderBy: { publishedAt: 'desc' },
      take, skip,
      select: {
          id: true, title: true, slug: true, coverImageUrl: true,
          metaDescription: true, seoTitle: true, tags: true, publishedAt: true,
          jsonLd: true, contentJson: true, tenantId: true, languageId: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
      const transformed = items.map((a: any) => {
        const cj = a.contentJson || {};
        return {
          meta: {
            seoTitle: a.seoTitle || cj?.meta?.seoTitle || '',
            metaDescription: a.metaDescription || cj?.meta?.metaDescription || ''
          },
          slug: a.slug,
          tags: a.tags || cj?.tags || [],
          audit: cj?.audit || { createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.authorId || '', updatedBy: a.authorId || '' },
          media: cj?.media || { images: [], videos: [] },
          title: a.title || cj?.title || '',
          blocks: cj?.blocks || [],
          jsonLd: a.jsonLd || cj?.jsonLd || {},
          status: a.status.toLowerCase() === 'published' ? 'published' : (cj?.status || a.status.toLowerCase()),
          authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
          excerpt: cj?.excerpt || '',
          aiStatus: cj?.aiStatus || undefined,
          subtitle: cj?.subtitle || '',
          tenantId: a.tenantId,
          plainText: cj?.plainText || '',
          categories: cj?.categories || [],
          coverImage: cj?.coverImage || { alt: '', url: a.coverImageUrl || '', caption: '' },
          contentHtml: cj?.contentHtml || '',
          publishedAt: a.publishedAt || cj?.publishedAt || null,
          languageCode: cj?.languageCode || '',
          readingTimeMin: cj?.readingTimeMin || 0
        };
      });
      return res.json({ items: transformed, count: transformed.length });
  } catch (e) {
    console.error('getWebArticlesByDomainPublic error', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
};

export const listTitlesAndHeroesPublic = async (req: Request, res: Response) => {
  try {
    const { domainId } = req.query as any;
    const { limit = '50', offset = '0', status = 'PUBLISHED' } = req.query as any;
    const take = Math.max(1, Math.min(200, parseInt(String(limit)) || 50));
    const skip = Math.max(0, parseInt(String(offset)) || 0);
    const where: any = { status: String(status).toUpperCase() };
    if (domainId) where.domainId = String(domainId);
    const items = await prisma.tenantWebArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take, skip,
      select: {
          id: true, title: true, slug: true, coverImageUrl: true, publishedAt: true,
          tags: true, contentJson: true, tenantId: true, languageId: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
      const transformed = items.map((a: any) => {
        const cj = a.contentJson || {};
        return {
          meta: {
            seoTitle: cj?.meta?.seoTitle || '',
            metaDescription: cj?.meta?.metaDescription || ''
          },
          slug: a.slug,
          tags: a.tags || cj?.tags || [],
          audit: cj?.audit || { createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.authorId || '', updatedBy: a.authorId || '' },
          media: cj?.media || { images: [], videos: [] },
          title: a.title || cj?.title || '',
          blocks: cj?.blocks || [],
          jsonLd: cj?.jsonLd || {},
          status: 'published',
          authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
          excerpt: cj?.excerpt || '',
          aiStatus: cj?.aiStatus || undefined,
          subtitle: cj?.subtitle || '',
          tenantId: a.tenantId,
          plainText: cj?.plainText || '',
          categories: cj?.categories || [],
          coverImage: cj?.coverImage || { alt: '', url: a.coverImageUrl || '', caption: '' },
          contentHtml: cj?.contentHtml || '',
          publishedAt: a.publishedAt || cj?.publishedAt || null,
          languageCode: cj?.languageCode || '',
          readingTimeMin: cj?.readingTimeMin || 0
        };
      });
      return res.json({ items: transformed });
  } catch (e) {
    console.error('listTitlesAndHeroesPublic error', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
};

export const listPublicArticles = async (req: Request, res: Response) => {
  try {
    const { domainName: qDomainName } = req.query as any;
    const hDomain = (req.headers['x-tenant-domain'] || req.headers['x-tenant'] || req.headers['x-domain']) as string | undefined;
    const domainName = (qDomainName as string) || hDomain;
    const { limit = '20', offset = '0', status = 'PUBLISHED' } = req.query as any;
    const take = Math.max(1, Math.min(100, parseInt(String(limit)) || 20));
    const skip = Math.max(0, parseInt(String(offset)) || 0);
    const where: any = { status: String(status).toUpperCase() };
    if (domainName) {
      const domain = await prisma.domain.findFirst({ where: { domain: String(domainName) }, select: { id: true } });
      if (!domain) return res.status(404).json({ error: 'Domain not found' });
      where.domainId = domain.id;
    }
    const items = await prisma.tenantWebArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      take, skip,
      select: {
        id: true,
        tenantId: true,
        domainId: true,
        languageId: true,
        title: true,
        slug: true,
        status: true,
        coverImageUrl: true,
        seoTitle: true,
        metaDescription: true,
        jsonLd: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        contentJson: true,
        authorId: true
      }
    });
    const transformed = items.map((a: any) => {
      const cj = a.contentJson || {};
      return {
        meta: {
          seoTitle: a.seoTitle || cj?.meta?.seoTitle || '',
          metaDescription: a.metaDescription || cj?.meta?.metaDescription || ''
        },
        slug: a.slug,
        tags: a.tags || cj?.tags || [],
        audit: cj?.audit || { createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.authorId || '', updatedBy: a.authorId || '' },
        media: cj?.media || { images: [], videos: [] },
        title: a.title || cj?.title || '',
        blocks: cj?.blocks || [],
        jsonLd: a.jsonLd || cj?.jsonLd || {},
        status: a.status.toLowerCase() === 'published' ? 'published' : (cj?.status || a.status.toLowerCase()),
        authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
        excerpt: cj?.excerpt || '',
        aiStatus: cj?.aiStatus || undefined,
        subtitle: cj?.subtitle || '',
        tenantId: a.tenantId,
        plainText: cj?.plainText || '',
        categories: cj?.categories || [],
        coverImage: cj?.coverImage || { alt: '', url: a.coverImageUrl || '', caption: '' },
        contentHtml: cj?.contentHtml || '',
        publishedAt: a.publishedAt || cj?.publishedAt || null,
        languageCode: cj?.languageCode || '',
        readingTimeMin: cj?.readingTimeMin || 0
      };
    });
    return res.json({ items: transformed, count: transformed.length });
  } catch (e) {
    console.error('listPublicArticles error', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
};

export const updateWebArticleStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    const { status, rejectionReason } = req.body as any;
    if (!status) return res.status(400).json({ error: 'status is required' });
    const allowed = ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'PENDING', 'REJECTED', 'CHANGES_REQUESTED'];
    const next = String(status).toUpperCase();
    if (!allowed.includes(next)) return res.status(400).json({ error: 'Invalid status' });

    // Get current article for notification
    const current = await prisma.tenantWebArticle.findUnique({
      where: { id },
      select: { status: true, title: true, authorId: true, tenantId: true, domainId: true }
    });
    if (!current) return res.status(404).json({ error: 'Article not found' });

    const previousStatus = current.status;
    const now = new Date();
    const data: any = { status: next };
    if (next === 'PUBLISHED') {
      data.publishedAt = now;
    } else if (next === 'DRAFT' || next === 'PENDING') {
      data.publishedAt = null;
    }

    const updated = await prisma.tenantWebArticle.update({
      where: { id },
      data,
      select: { id: true, status: true, publishedAt: true, updatedAt: true }
    });

    // Send push notification for status change (fire and forget)
    notifyArticleStatusChange({
      id,
      title: current.title,
      authorId: current.authorId,
      tenantId: current.tenantId,
      domainId: current.domainId,
      status: next,
      previousStatus,
      rejectionReason
    }).catch(err => console.error('[ArticleNotify] Background notification failed:', err));

    return res.json(updated);
  } catch (e) {
    console.error('updateWebArticleStatus error', e);
    return res.status(500).json({ error: 'Failed to update status' });
  }
};

export const getWebArticleBySlugPublic = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params as any;
    const hDomain = (req.headers['x-tenant-domain'] || req.headers['x-tenant'] || req.headers['x-domain']) as string | undefined;
    const qDomain = (req.query?.domainName as string) || undefined;
    const domainName = hDomain || qDomain;
    if (!domainName) return res.status(400).json({ error: 'Domain required. Provide X-Tenant-Domain header or domainName query' });
    const domain = await prisma.domain.findFirst({ where: { domain: String(domainName) }, select: { id: true } });
    if (!domain) return res.status(404).json({ error: 'Domain not found' });

    // Only published by default
    const a = await prisma.tenantWebArticle.findFirst({
      where: { domainId: domain.id, slug, status: 'PUBLISHED' },
      select: {
        id: true, tenantId: true, domainId: true, languageId: true,
        title: true, slug: true, status: true, coverImageUrl: true,
        contentJson: true, seoTitle: true, metaDescription: true, jsonLd: true,
        tags: true, publishedAt: true, authorId: true, createdAt: true, updatedAt: true
      }
    });
    if (!a) return res.status(404).json({ error: 'Not found' });
    const cj: any = a.contentJson || {};
    const resp = {
      meta: {
        seoTitle: a.seoTitle || cj?.meta?.seoTitle || '',
        metaDescription: a.metaDescription || cj?.meta?.metaDescription || ''
      },
      slug: a.slug,
      tags: a.tags || cj?.tags || [],
      audit: cj?.audit || { createdAt: a.createdAt, updatedAt: a.updatedAt, createdBy: a.authorId || '', updatedBy: a.authorId || '' },
      media: cj?.media || { images: [], videos: [] },
      title: a.title || cj?.title || '',
      blocks: cj?.blocks || [],
      jsonLd: a.jsonLd || cj?.jsonLd || {},
      status: 'published',
      authors: cj?.authors || (a.authorId ? [{ id: a.authorId, name: '', role: 'reporter' }] : []),
      excerpt: cj?.excerpt || '',
      aiStatus: cj?.aiStatus || undefined,
      subtitle: cj?.subtitle || '',
      tenantId: a.tenantId,
      plainText: cj?.plainText || '',
      categories: cj?.categories || [],
      coverImage: cj?.coverImage || { alt: '', url: a.coverImageUrl || '', caption: '' },
      contentHtml: cj?.contentHtml || '',
      publishedAt: a.publishedAt || cj?.publishedAt || null,
      languageCode: cj?.languageCode || '',
      readingTimeMin: cj?.readingTimeMin || 0
    };
    return res.json(resp);
  } catch (e) {
    console.error('getWebArticleBySlugPublic error', e);
    return res.status(500).json({ error: 'Failed to fetch' });
  }
};
