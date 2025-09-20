import prisma from '../../lib/prisma';
import ContentReadService, { ContentTypeEnum } from '../contentRead/contentRead.service';

class NotFoundError extends Error {
  resource: string;
  constructor(resource: string, message: string) {
    super(message);
    this.resource = resource;
  }
}

export class ArticleReadService {
  private contentRead = new ContentReadService();

  private async getLocationSnapshot(userId: string) {
    try {
      const prof: any = await prisma.userProfile.findUnique({
        where: { userId },
        select: { stateId: true, districtId: true, mandalId: true }
      });
      if (!prof) return {};
      return { stateId: prof.stateId || undefined, districtId: prof.districtId || undefined, mandalId: prof.mandalId || undefined };
    } catch { return {}; }
  }
  async markAsRead(userId: string, articleId: string) {
    return prisma.articleRead.upsert({
      where: { userId_articleId: { userId, articleId } },
      update: { readAt: new Date() },
      create: { userId, articleId, readAt: new Date() },
    });
  }

  async getReadStatus(userId: string, articleId: string) {
    return prisma.articleRead.findUnique({
      where: { userId_articleId: { userId, articleId } },
    });
  }

  // Batch progress recording
  async recordProgress(userId: string, updates: { articleId: string; deltaTimeMs?: number; maxScrollPercent?: number; ended?: boolean }[]) {
    // Preload and validate article IDs to prevent FK constraint failures
    const uniqueIds = Array.from(new Set(updates.map(u => u.articleId).filter(Boolean)));
    if (uniqueIds.length === 0) return { updated: [] };
    const existingArticles = await prisma.article.findMany({ where: { id: { in: uniqueIds } }, select: { id: true } });
    const existingSet = new Set(existingArticles.map(a => a.id));
    const missing = uniqueIds.filter(id => !existingSet.has(id));
    if (process.env.DEBUG_READ_PROGRESS) {
      // Lightweight structured diagnostic log (avoid dumping large objects)
      console.log('[ArticleReadService.recordProgress] incomingIds=%s existing=%s missing=%s', JSON.stringify(uniqueIds), existingArticles.length, JSON.stringify(missing));
    }
    // Fallback: if a single ID is reported missing, re-query directly (guards against rare stale cache / replica lag scenarios)
    if (missing.length === 1 && uniqueIds.length === 1) {
      const recheck = await prisma.article.findUnique({ where: { id: uniqueIds[0] }, select: { id: true } });
      if (recheck) {
        if (process.env.DEBUG_READ_PROGRESS) {
          console.log('[ArticleReadService.recordProgress] recheck succeeded for previously missing id=%s', uniqueIds[0]);
        }
        missing.length = 0; // clear missing
        existingSet.add(recheck.id);
      }
    }
    const now = new Date();
    const shortNewsReads: any[] = [];
    if (missing.length) {
      // Check whether the "missing" IDs are actually ShortNews IDs; if so, mark read via ShortNewsRead fallback
      const shortNewsRows = await prisma.shortNews.findMany({ where: { id: { in: missing } }, select: { id: true } });
      const shortNewsSet = new Set(shortNewsRows.map(r => r.id));
      const unresolved = missing.filter(id => !shortNewsSet.has(id));
      if (shortNewsSet.size) {
        for (const sid of shortNewsSet) {
          try {
            const snRead: any = await (prisma as any).shortNewsRead.upsert({
              where: { userId_shortNewsId: { userId, shortNewsId: sid } },
              update: { readAt: now },
              create: { userId, shortNewsId: sid, readAt: now },
            });
            shortNewsReads.push({ shortNewsId: sid, read: true, readAt: snRead.readAt });
          } catch (e) {
            console.warn('ShortNewsRead upsert failed (non-fatal):', e);
          }
        }
      }
      if (unresolved.length) {
        // Some IDs are neither Article nor ShortNews: treat as missing (batch) or 404 (single)
        if (uniqueIds.length > 1) {
          return { updated: [], shortNewsReads, missing: unresolved };
        }
        throw new NotFoundError('Article', `Article not found: ${unresolved[0]}`);
      }
      // If all missing converted to shortNewsReads AND there are no article IDs present at all, we can early return
      if (existingSet.size === 0) {
        return { updated: [], shortNewsReads };
      }
    }

    const MIN_DELTA = 0;
    const MAX_DELTA = 5 * 60 * 1000; // 5 minutes safety cap
    const COMPLETE_MIN_TIME = Number(process.env.READ_COMPLETE_MIN_TIME_MS || 8000);
    const COMPLETE_SCROLL = Number(process.env.READ_COMPLETE_SCROLL_PERCENT || 85);
    // now already defined

    const results: any[] = [];
    for (const upd of updates) {
      const { articleId } = upd;
      if (!existingSet.has(articleId)) {
        // This update belongs to a ShortNews fallback (already marked) or unresolved; skip
        continue;
      }
      let delta = Number(upd.deltaTimeMs || 0);
      if (isNaN(delta) || delta < MIN_DELTA) delta = 0;
      if (delta > MAX_DELTA) delta = MAX_DELTA;
      let scroll = Number(upd.maxScrollPercent || 0);
      if (isNaN(scroll) || scroll < 0) scroll = 0;
      if (scroll > 100) scroll = 100;

      const existingRaw = await prisma.articleRead.findUnique({ where: { userId_articleId: { userId, articleId } } });
      const existing: any = existingRaw as any;
      if (!existing) {
        const completed = (delta >= COMPLETE_MIN_TIME && scroll >= COMPLETE_SCROLL);
        const created: any = await prisma.articleRead.create({
          data: {
            userId,
            articleId,
            readAt: now,
            // extended metrics (casting to any until prisma types regenerate)
            totalTimeMs: delta,
            maxScrollPercent: scroll,
            completed,
            lastEventAt: now,
            completedAt: completed ? now : null,
            sessionsCount: 1,
          } as any
        });
        results.push({ articleId, totalTimeMs: created.totalTimeMs, maxScrollPercent: created.maxScrollPercent, completed: created.completed });
        // Dual write to ContentRead (best effort)
        try {
          const snapshot = await this.getLocationSnapshot(userId);
          await this.contentRead.recordProgress({
            userId,
            contentId: articleId,
            contentType: 'ARTICLE' as ContentTypeEnum,
            deltaTimeMs: delta,
            maxScrollPercent: scroll,
            ended: !!upd.ended,
            snapshot,
          });
        } catch (e) {
          if (process.env.DEBUG_READ_PROGRESS) console.warn('[ContentRead dual-write create failed]', (e as Error).message);
        }
        continue;
      }

      const totalTimeMs = (existing.totalTimeMs || 0) + delta;
      const maxScrollPercent = Math.max(existing.maxScrollPercent || 0, scroll);
      let completed = !!existing.completed;
      let completedAt = existing.completedAt || null;
      if (!completed && totalTimeMs >= COMPLETE_MIN_TIME && maxScrollPercent >= COMPLETE_SCROLL) {
        completed = true;
        completedAt = now;
      }
      const sessionsCount = (existing.sessionsCount || 0) + (upd.ended ? 1 : 0);
      const updated: any = await prisma.articleRead.update({
        where: { id: existing.id },
        data: {
          totalTimeMs,
          maxScrollPercent,
          completed,
          completedAt,
          lastEventAt: now,
          sessionsCount,
        } as any
      });
      results.push({ articleId, totalTimeMs: updated.totalTimeMs, maxScrollPercent: updated.maxScrollPercent, completed: updated.completed });
      // Dual write update (only if delta or scroll progressed or ended)
      if (delta > 0 || scroll > 0 || upd.ended) {
        try {
          await this.contentRead.recordProgress({
            userId,
            contentId: articleId,
            contentType: 'ARTICLE' as ContentTypeEnum,
            deltaTimeMs: delta,
            maxScrollPercent: scroll,
            ended: !!upd.ended,
          });
        } catch (e) {
          if (process.env.DEBUG_READ_PROGRESS) console.warn('[ContentRead dual-write update failed]', (e as Error).message);
        }
      }
    }
    return { updated: results, shortNewsReads };
  }

  async multiStatus(userId: string, articleIds: string[]) {
    const readsRaw = await prisma.articleRead.findMany({
      where: { userId, articleId: { in: articleIds } },
    });
    const reads = (readsRaw as any[]).map(r => ({
      articleId: (r as any).articleId,
      totalTimeMs: (r as any).totalTimeMs || 0,
      maxScrollPercent: (r as any).maxScrollPercent || 0,
      completed: !!(r as any).completed,
      readAt: (r as any).readAt,
      lastEventAt: (r as any).lastEventAt || null,
    }));
    const map: Record<string, any> = {};
    for (const r of reads) map[r.articleId] = r;
    const result = articleIds.map(id => map[id] || { articleId: id, completed: false });
    return { reads: result };
  }

  async aggregateByArticle(articleId: string) {
    // Fallback manual aggregation (cast due to type mismatch until regenerated types recognized)
    const rows: any[] = await prisma.articleRead.findMany({ where: { articleId } }) as any[];
    let views = 0, totalReadTimeMs = 0, totalScroll = 0, completedReads = 0;
    for (const r of rows) {
      views++;
      totalReadTimeMs += r.totalTimeMs || 0;
      totalScroll += r.maxScrollPercent || 0;
      if (r.completed) completedReads++;
    }
    const avgReadTimeMs = views ? totalReadTimeMs / views : 0;
    const avgScrollPercent = views ? totalScroll / views : 0;
    return { articleId, views, totalReadTimeMs, avgReadTimeMs, avgScrollPercent, completedReads };
  }

  async aggregateByAuthor(authorId: string) {
    // Find articles by author
    const articles = await prisma.article.findMany({ where: { authorId }, select: { id: true } });
    const ids = articles.map(a => a.id);
    if (ids.length === 0) {
      return { authorId, articleCount: 0, views: 0, totalReadTimeMs: 0, avgReadTimeMs: 0, completedReads: 0 };
    }
    const rows: any[] = await prisma.articleRead.findMany({ where: { articleId: { in: ids } } }) as any[];
    let views = 0, totalReadTimeMs = 0, completedReads = 0;
    for (const r of rows) {
      views++;
      totalReadTimeMs += r.totalTimeMs || 0;
      if (r.completed) completedReads++;
    }
    const avgReadTimeMs = views ? totalReadTimeMs / views : 0;
    return { authorId, articleCount: ids.length, views, totalReadTimeMs, avgReadTimeMs, completedReads };
  }
}
