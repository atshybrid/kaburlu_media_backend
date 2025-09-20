import { Request, Response } from 'express';
import { setReaction, getArticleReaction, batchStatus } from './reactions.service';
import ContentReactionsService from './contentReactions.service';
import { ContentType } from '@prisma/client';
import prisma from '../../lib/prisma';

const contentReactions = new ContentReactionsService();

export const upsertReaction = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { articleId, shortNewsId, contentId, reaction } = req.body || {};
    if (!reaction || !['LIKE','DISLIKE','NONE'].includes(reaction)) {
      return res.status(400).json({ success: false, error: 'reaction must be LIKE|DISLIKE|NONE' });
    }
    // Allow a generic contentId: try to auto-detect its type if provided
    let aId = articleId as string | undefined;
    let sId = shortNewsId as string | undefined;
    if (!aId && !sId && contentId) {
      aId = contentId;
    }
    const providedIds = [aId, sId].filter(Boolean);
    if (providedIds.length !== 1) {
      return res.status(400).json({ success: false, error: 'Provide exactly one of articleId or shortNewsId' });
    }
    let id = aId || sId;
    let contentType: ContentType;
    if (aId) {
      const art = await prisma.article.findUnique({ where: { id: aId } });
      if (art) {
        contentType = ContentType.ARTICLE;
      } else {
        // Fallback: maybe the client sent a ShortNews ID in articleId
        const sn = await prisma.shortNews.findUnique({ where: { id: aId } });
        if (sn) {
          contentType = ContentType.SHORTNEWS;
          id = aId; // treat as shortnews
        } else {
          return res.status(404).json({ success: false, error: 'Content not found' });
        }
      }
    } else if (sId) {
      const sn = await prisma.shortNews.findUnique({ where: { id: sId } });
      if (!sn) return res.status(404).json({ success: false, error: 'ShortNews not found' });
      contentType = ContentType.SHORTNEWS;
    } else {
      return res.status(400).json({ success: false, error: 'No content id provided' });
    }
    try {
  const result = await contentReactions.setReaction({ userId: user.id, contentType, contentId: id!, reaction });
      return res.status(200).json({ success: true, data: result });
    } catch (e) {
      console.error('contentReaction set error', e);
      return res.status(500).json({ success: false, error: 'Failed to set reaction' });
    }
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to set reaction' });
  }
};

export const getReactionForArticle = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { articleId } = req.params;
    if (!articleId) return res.status(400).json({ success: false, error: 'articleId required' });
    const exists = await prisma.article.findUnique({ where: { id: articleId } });
    if (!exists) return res.status(404).json({ success: false, error: 'Article not found' });
  const result = await contentReactions.getReaction(user?.id || null, ContentType.ARTICLE, articleId);
    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reaction' });
  }
};

export const batchReactionStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { articleIds, shortNewsIds } = req.body || {};
    if (articleIds && shortNewsIds) {
      return res.status(400).json({ success: false, error: 'Send only articleIds OR shortNewsIds, not both' });
    }
    const ids = articleIds || shortNewsIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'articleIds or shortNewsIds array required' });
    }
  const contentType: ContentType = articleIds ? ContentType.ARTICLE : ContentType.SHORTNEWS;
    // Optionally validate a subset (lightweight): we skip for performance; counts just ignore missing.
    const data = await contentReactions.batch(user.id, contentType, ids);
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch batch status' });
  }
};
