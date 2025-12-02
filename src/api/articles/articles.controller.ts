import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { buildCanonicalUrl } from '../../lib/domains';

// Paginated article fetch for swipe UI
export const getPaginatedArticleController = async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 1;
    const cursor = req.query.cursor as string | undefined;
    const articles = await prisma.article.findMany({
      take: limit,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: { createdAt: 'asc' },
      include: { language: true },
    });
    const nextId = articles.length === limit ? articles[articles.length - 1].id : null;
    const articlesOut = articles.map((a) => {
      const langCode = (a as any).language?.code || 'en';
      const cj: any = (a as any).contentJson || {};
      const slugOrId = cj?.slug || a.id;
      const canonicalUrl = buildCanonicalUrl(langCode, slugOrId, 'article');
      return { ...a, canonicalUrl };
    });
    res.json({ articles: articlesOut, nextId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles.' });
  }
};

// Single article fetch
export const getSingleArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await prisma.article.findUnique({ where: { id }, include: { language: true } });
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    const langCode = (article as any).language?.code || 'en';
    const cj: any = (article as any).contentJson || {};
    const slugOrId = cj?.slug || article.id;
    const canonicalUrl = buildCanonicalUrl(langCode, slugOrId, 'article');
    res.json({ ...article, canonicalUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch article.' });
  }
};

import { validate } from 'class-validator';
import { CreateArticleDto } from './articles.dto';
import { createArticle } from './articles.service';
import { aiGenerateSEO } from './articles.service';
import { sendToTopic, sendToUser } from '../../lib/fcm';


export const createArticleController = async (req: Request, res: Response) => {
  try {
    // Only accept required fields for short news
      const { categoryId, title, content } = req.body;
      if (!categoryId || !title || !content) {
        return res.status(400).json({ error: 'categoryId, title, and content are required.' });
    }
    if (content.split(' ').length > 60) {
      return res.status(400).json({ error: 'Content must be 60 words or less.' });
    }
    // @ts-ignore - req.user is populated by Passport (see jwt.strategy.ts returns full user)
    const authorId: string | undefined = (req as any).user?.id;
    if (!authorId) {
      return res.status(401).json({ error: 'Authentication error: User ID not found.' });
    }
  // Determine author's languageId from token (preferred) or DB
  const tokenLanguageId: string | undefined = (req as any).user?.languageId;
  const author = await prisma.user.findUnique({ where: { id: authorId }, include: { language: true } });
  const languageId = tokenLanguageId || author?.languageId || null;
    // Create the article
    const article = await prisma.article.create({
      data: {
        title,
        content,
        authorId,
        categories: { connect: [{ id: categoryId }] },
        type: 'citizen',
        contentJson: {}, // Will be updated after AI enrichment
      },
    });
    // AI enrichment for SEO metadata and tags
    let seoMeta: { seoTitle: string; seoDescription: string; seoKeywords: string[] };
    try {
      seoMeta = await aiGenerateSEO({ title });
    } catch (err) {
      // Fallback if AI fails
      seoMeta = {
        seoTitle: title,
        seoDescription: content,
        seoKeywords: [],
      };
    }
    // Update article with SEO metadata
    await prisma.article.update({
      where: { id: article.id },
      data: {
        contentJson: {
          seoTitle: seoMeta.seoTitle || title,
          seoDescription: seoMeta.seoDescription || content,
          seoKeywords: seoMeta.seoKeywords || [],
        },
      },
    });

    // Build canonical URL and topics
  const user = author; // already fetched with language
  const languageCode = author?.language?.code || 'en';
  const canonicalUrl = buildCanonicalUrl(languageCode, article.id, 'article');

    // Send notification to language topic and category topic (best-effort)
    const titleText = seoMeta.seoTitle || title;
    const bodyText = (seoMeta.seoDescription || content).slice(0, 120);
    const dataPayload = { type: 'article', articleId: article.id, url: canonicalUrl } as Record<string, string>;
    try {
      if (languageCode) {
        await sendToTopic(`news-lang-${languageCode.toLowerCase()}`,
          { title: titleText, body: bodyText, data: dataPayload }
        );
      }
      if (categoryId) {
        await sendToTopic(`news-cat-${String(categoryId).toLowerCase()}`,
          { title: titleText, body: bodyText, data: dataPayload }
        );
      }
    } catch (e) {
      console.warn('FCM send failed (non-fatal):', e);
    }
  // Reload article for response
  const articleOut = await prisma.article.findUnique({ where: { id: article.id } });
  res.status(201).json({
    ...articleOut,
    language: author?.language ? { id: author.language.id, code: author.language.code, name: author.language.name } : null,
    contentJson: {
          seoTitle: seoMeta.seoTitle || title,
          seoDescription: seoMeta.seoDescription || content,
          seoKeywords: seoMeta.seoKeywords || [],
        },
    canonicalUrl,
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Category does not exist.' });
    }
    console.error('Error creating short news:', error);
    res.status(500).json({ error: 'Failed to create short news article.' });
  }
};

// Helper to resolve tenant scope based on role/token and optional tenantId/domainId in body
async function resolveTenantScope(req: Request, bodyTenantId?: string, bodyDomainId?: string): Promise<{ tenantId: string } | { error: string; status: number }> {
  const user: any = (req as any).user;
  if (!user || !user.role) return { error: 'Unauthorized', status: 401 };
  const roleName = user.role.name;
  // SUPER_ADMIN: allow explicit tenantId or derive from domainId
  if (roleName === 'SUPER_ADMIN') {
    if (bodyTenantId) return { tenantId: bodyTenantId };
    if (bodyDomainId) {
      const dom = await prisma.domain.findUnique({ where: { id: bodyDomainId } });
      if (!dom) return { error: 'Domain not found', status: 400 };
      return { tenantId: dom.tenantId };
    }
    // fallback: reporter linkage
    const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
    if (rep?.tenantId) return { tenantId: rep.tenantId };
    return { error: 'tenantId or domainId required for SUPER_ADMIN', status: 400 };
  }
  // TENANT_ADMIN or REPORTER: use reporter linkage
  if (roleName === 'TENANT_ADMIN' || roleName === 'REPORTER') {
    const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
    if (!rep?.tenantId) return { error: 'Reporter profile not linked to tenant', status: 403 };
    if (bodyTenantId && bodyTenantId !== rep.tenantId) return { error: 'Tenant scope mismatch', status: 403 };
    if (bodyDomainId) {
      const dom = await prisma.domain.findUnique({ where: { id: bodyDomainId } });
      if (!dom || dom.tenantId !== rep.tenantId) return { error: 'Domain tenant mismatch', status: 403 };
    }
    return { tenantId: rep.tenantId };
  }
  return { error: 'Forbidden', status: 403 };
}

// Create tenant-scoped article (reporter/admin)
export const createTenantArticleController = async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdBody, domainId, title, content, categoryIds = [], type = 'reporter', isPublished = false, images = [] } = req.body || {};
    if (!title || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'title, content, categoryIds required' });
    }
    // Resolve tenant
    const scope = await resolveTenantScope(req, tenantIdBody, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    // Author and language
    const user: any = (req as any).user;
    const authorId: string = user.id;
    const author = await prisma.user.findUnique({ where: { id: authorId }, include: { language: true } });
    const languageId = (user.languageId as string) || author?.languageId || null;
    const status = isPublished ? 'PUBLISHED' : 'DRAFT';
    // Create
    const article = await prisma.article.create({
      data: {
        title,
        content,
        type,
        status,
        authorId,
        tenantId,
        languageId,
        images,
        categories: { connect: categoryIds.map((id: string) => ({ id })) },
        contentJson: {},
      }
    });
    res.status(201).json(article);
  } catch (e) {
    console.error('createTenantArticle error', e);
    res.status(500).json({ error: 'Failed to create article' });
  }
};

// Create web story (type=web_story)
export const createWebStoryController = async (req: Request, res: Response) => {
  (req as any).body = { ...(req.body || {}), type: 'web_story' };
  return createTenantArticleController(req, res);
};

// Update article
export const updateArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, content, categoryIds, status } = req.body || {};
    const art = await prisma.article.findUnique({ where: { id } });
    if (!art) return res.status(404).json({ error: 'Article not found' });
    // Authorization: reporters/admins can only update within their tenant
    const scope = await resolveTenantScope(req, art.tenantId, undefined);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const data: any = {};
    if (title) data.title = title;
    if (content) data.content = content;
    if (status) data.status = status;
    if (Array.isArray(categoryIds)) {
      data.categories = { set: [], connect: categoryIds.map((id: string) => ({ id })) };
    }
    const updated = await prisma.article.update({ where: { id }, data });
    res.json(updated);
  } catch (e) {
    console.error('updateArticle error', e);
    res.status(500).json({ error: 'Failed to update article' });
  }
};

// Delete article
export const deleteArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const art = await prisma.article.findUnique({ where: { id } });
    if (!art) return res.status(404).json({ error: 'Article not found' });
    const scope = await resolveTenantScope(req, art.tenantId, undefined);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    await prisma.article.delete({ where: { id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('deleteArticle error', e);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};
