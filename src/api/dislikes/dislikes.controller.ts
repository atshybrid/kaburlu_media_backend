import { Request, Response } from 'express';
import { dislikeArticle, removeDislike, getDislikesForArticle } from './dislikes.service';

export const dislikeArticleController = async (req: Request, res: Response) => {
  try {
    const { userId, articleId } = req.body;
    if (!userId || !articleId) return res.status(400).json({ error: 'userId and articleId required' });
    const dislike = await dislikeArticle(userId, articleId);
    res.status(201).json(dislike);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
};

export const removeDislikeController = async (req: Request, res: Response) => {
  try {
    const { userId, articleId } = req.body;
    if (!userId || !articleId) return res.status(400).json({ error: 'userId and articleId required' });
    await removeDislike(userId, articleId);
    res.status(200).json({ message: 'Dislike removed' });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
};

export const getDislikesForArticleController = async (req: Request, res: Response) => {
  try {
    const { articleId } = req.params;
    if (!articleId) return res.status(400).json({ error: 'articleId required' });
    const dislikes = await getDislikesForArticle(articleId);
    res.status(200).json(dislikes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(400).json({ error: message });
  }
};
