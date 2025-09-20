import { Request, Response } from 'express';
import { ArticleReadService } from './articleRead.service';

// Narrow error typing helper
function isNotFound(e: any) {
  return e && typeof e === 'object' && e.message && /Article not found:/.test(e.message);
}

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
  const result = await this.service.markAsRead(userId, articleId) as any;
  // If this was newly created, Prisma upsert doesn't directly tell us; we can check readAt is close to now
  // Simplicity: always return 201 to align with Swagger expectation for creation semantics.
  res.status(201).json(result);
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

  // New: record single progress (wraps batch route logic)
  async recordSingleProgress(req: Request, res: Response) {
    try {
      let userId: string | undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        const principal: any = req.user;
        // If device principal with linked userId, prefer real userId for FK consistency
        if (principal.kind === 'device' && principal.userId) userId = principal.userId;
        else userId = principal.id;
      }
      if (!userId) return res.status(400).json({ error: 'Missing user context' });
      const { articleId, deltaTimeMs, maxScrollPercent, ended } = req.body || {};
      if (!articleId) return res.status(400).json({ error: 'articleId required' });
      const updates = [{ articleId, deltaTimeMs, maxScrollPercent, ended }];
      const result = await this.service.recordProgress(userId, updates);
      const r: any = result as any;
      if (r.missing && (!r.updated || r.updated.length === 0) && (!r.shortNewsReads || r.shortNewsReads.length === 0)) {
        return res.status(404).json({ error: 'Article(s) not found', missing: r.missing });
      }
      res.json(r);
    } catch (e) {
      if (isNotFound(e)) return res.status(404).json({ error: (e as Error).message });
      res.status(500).json({ error: (e as Error).message });
    }
  }

  // New: batch progress
  async recordBatchProgress(req: Request, res: Response) {
    try {
      let userId: string | undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        const principal: any = req.user;
        if (principal.kind === 'device' && principal.userId) userId = principal.userId; else userId = principal.id;
      }
      if (!userId) return res.status(400).json({ error: 'Missing user context' });
      const { reads } = req.body || {};
      if (!Array.isArray(reads) || reads.length === 0) {
        return res.status(400).json({ error: 'reads array required' });
      }
      const sanitized = reads.map((r: any) => ({
        articleId: r.articleId,
        deltaTimeMs: r.deltaTimeMs,
        maxScrollPercent: r.maxScrollPercent,
        ended: r.ended,
      })).filter(r => r.articleId);
      if (sanitized.length === 0) return res.status(400).json({ error: 'No valid articleIds' });
      const result = await this.service.recordProgress(userId, sanitized);
      const r: any = result as any;
      if (r.missing && (!r.updated || r.updated.length === 0) && (!r.shortNewsReads || r.shortNewsReads.length === 0)) {
        return res.status(404).json({ error: 'Article(s) not found', missing: r.missing });
      }
      res.json(r);
    } catch (e) {
      if (isNotFound(e)) return res.status(404).json({ error: (e as Error).message });
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async getMultiStatus(req: Request, res: Response) {
    try {
      let userId: string | undefined;
      if (req.user && typeof req.user === 'object' && 'id' in req.user) {
        userId = (req.user as any).id;
      }
      if (!userId) return res.status(400).json({ error: 'Missing user context' });
      const idsParam = req.query.ids || '';
      const ids = String(idsParam).split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return res.status(400).json({ error: 'ids query param required' });
      const result = await this.service.multiStatus(userId, ids);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async aggregateArticle(req: Request, res: Response) {
    try {
      const { articleId } = req.params;
      if (!articleId) return res.status(400).json({ error: 'articleId required' });
      const result = await this.service.aggregateByArticle(articleId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }

  async aggregateAuthor(req: Request, res: Response) {
    try {
      const { authorId } = req.params;
      if (!authorId) return res.status(400).json({ error: 'authorId required' });
      const result = await this.service.aggregateByAuthor(authorId);
      res.json(result);
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  }
}
