import { Request, Response } from 'express';
import { setReaction, getArticleReaction, batchStatus } from './reactions.service';

export const upsertReaction = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { articleId, reaction } = req.body || {};
    if (!articleId || !reaction || !['LIKE','DISLIKE','NONE'].includes(reaction)) {
      return res.status(400).json({ success: false, error: 'articleId and reaction (LIKE|DISLIKE|NONE) required' });
    }
    const result = await setReaction(user.id, articleId, reaction);
    return res.status(200).json({ success: true, data: result });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: 'Failed to set reaction' });
  }
};

export const getReactionForArticle = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { articleId } = req.params;
    if (!articleId) return res.status(400).json({ success: false, error: 'articleId required' });
    const result = await getArticleReaction(user?.id || null, articleId);
    return res.status(200).json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch reaction' });
  }
};

export const batchReactionStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { articleIds } = req.body || {};
    if (!Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ success: false, error: 'articleIds array required' });
    }
    const data = await batchStatus(user.id, articleIds);
    return res.status(200).json({ success: true, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch batch status' });
  }
};
