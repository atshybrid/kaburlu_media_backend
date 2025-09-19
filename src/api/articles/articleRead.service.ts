import prisma from '../../lib/prisma';

export class ArticleReadService {
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
    const MIN_DELTA = 0;
    const MAX_DELTA = 5 * 60 * 1000; // 5 minutes safety cap
    const COMPLETE_MIN_TIME = Number(process.env.READ_COMPLETE_MIN_TIME_MS || 8000);
    const COMPLETE_SCROLL = Number(process.env.READ_COMPLETE_SCROLL_PERCENT || 85);
    const now = new Date();

    const results: any[] = [];
    for (const upd of updates) {
      const { articleId } = upd;
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
    }
    return { updated: results };
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
