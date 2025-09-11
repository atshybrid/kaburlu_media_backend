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


export const createArticleController = async (req: Request, res: Response) => {
  try {
    // Only accept required fields for short news
    const { categoryId, title, slug, content } = req.body;
    if (!categoryId || !title || !slug || !content) {
      return res.status(400).json({ error: 'categoryId, title, slug, and content are required.' });
    }
    if (content.split(' ').length > 60) {
      return res.status(400).json({ error: 'Content must be 60 words or less.' });
    }
    // @ts-ignore - req.user is populated by Passport
    const authorId = req.user?.sub;
    if (!authorId) {
      return res.status(401).json({ error: 'Authentication error: User ID not found.' });
    }
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
    res.status(201).json({
      ...article,
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
