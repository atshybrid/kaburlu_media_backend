import { Request, Response } from 'express';
import { PrismaClient, User } from '@prisma/client';
import { transliterate } from 'transliteration';

const prisma = new PrismaClient();

export const createShortNews = async (req: Request, res: Response) => {
  try {
    const { title, content, mediaUrls, latitude, longitude, address, categoryId, tags } = req.body;
    if (!req.user || typeof req.user !== 'object' || !('id' in req.user)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!title || !content || !categoryId) {
      return res.status(400).json({ success: false, error: 'Title, content, and categoryId are required.' });
    }
    if (content.trim().split(/\s+/).length > 60) {
      return res.status(400).json({ success: false, error: 'Content must be 60 words or less.' });
    }
    const authorId = (req.user as { id: string }).id;
    const languageId = (req.user as { languageId?: string }).languageId || 'te';
    // Auto-generate slug
    const slug = title
      .toLowerCase()
      .replace(/[^\w\u0C00-\u0C7F]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) + '-' + Date.now().toString().slice(-6);
    // AI SEO enrichment (stub, replace with real AI call)
    const seo = {
      metaTitle: title,
      metaDescription: content.slice(0, 150),
      tags: Array.isArray(tags) ? tags : [],
    };
    const shortNews = await prisma.shortNews.create({
      data: {
        title,
        slug,
        content,
        mediaUrls,
        latitude,
        longitude,
        address,
        authorId,
        categoryId,
        language: languageId,
        status: 'PENDING',
        tags: Array.isArray(tags) ? tags : [],
        seo,
      },
    });
    res.status(201).json({ success: true, data: shortNews });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to submit short news' });
  }
};

export const listShortNews = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    const [news, total] = await Promise.all([
      prisma.shortNews.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.shortNews.count()
    ]);
    res.status(200).json({ success: true, meta: { page, limit, total }, data: news });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch short news' });
  }
};

export const updateShortNewsStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, aiRemark } = req.body;
    const updated = await prisma.shortNews.update({
      where: { id },
      data: { status, aiRemark },
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update status' });
  }
};
