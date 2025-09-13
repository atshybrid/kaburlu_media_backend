import prisma from '../../lib/prisma';

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
    });
    const nextId = articles.length === limit ? articles[articles.length - 1].id : null;
    res.json({ articles, nextId });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch articles.' });
  }
};

// Single article fetch
export const getSingleArticleController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const article = await prisma.article.findUnique({ where: { id } });
    if (!article) {
      return res.status(404).json({ error: 'Article not found.' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch article.' });
  }
};

import { Request, Response } from 'express';
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
    const canonicalDomain = process.env.CANONICAL_DOMAIN || 'https://app.hrcitodaynews.in';
  const canonicalUrl = `${canonicalDomain}/${languageCode}/${article.id}`;

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
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'Category does not exist.' });
    }
    console.error('Error creating short news:', error);
    res.status(500).json({ error: 'Failed to create short news article.' });
  }
};
