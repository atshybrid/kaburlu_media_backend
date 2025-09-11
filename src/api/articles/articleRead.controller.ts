import { Request, Response } from 'express';
import { ArticleReadService } from './articleRead.service';

export class ArticleReadController {
  private service: ArticleReadService;

  constructor() {
    this.service = new ArticleReadService();
  }

  async markAsRead(req: Request, res: Response) {
    try {
      // Accept articleId from body or params for flexibility
      const articleId = req.body.articleId || req.params.articleId;
      // Accept userId from req.user, fallback to req.body for testing
      let userId: string | undefined = undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        userId = (req.user as any).id;
      } else if (req.body.userId) {
        userId = req.body.userId;
      }
      if (!userId || !articleId) {
        return res.status(400).json({ error: 'Missing userId or articleId' });
      }
      const result = await this.service.markAsRead(userId, articleId);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  }

  async getReadStatus(req: Request, res: Response) {
    try {
      const articleId = req.params.articleId || req.body.articleId;
      let userId: string | undefined = undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        userId = (req.user as any).id;
      } else if (req.body.userId) {
        userId = req.body.userId;
      }
      if (!userId || !articleId) {
        return res.status(400).json({ error: 'Missing userId or articleId' });
      }
      const result = await this.service.getReadStatus(userId, articleId);
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: message });
    }
  }
}
