import prisma from '../../lib/prisma';
import ContentReadService, { ContentTypeEnum } from '../contentRead/contentRead.service';

class NotFoundError extends Error {
  constructor(message: string) { super(message); }
}

interface ProgressInput {
  shortNewsId: string;
  deltaTimeMs?: number;
  maxScrollPercent?: number;
  ended?: boolean;
}

export class ShortNewsReadService {
  private contentRead = new ContentReadService();
  private async getLocationSnapshot(userId: string) {
    try {
      const prof: any = await prisma.userProfile.findUnique({ where: { userId }, select: { stateId: true, districtId: true, mandalId: true } });
      if (!prof) return {};
      return { stateId: prof.stateId || undefined, districtId: prof.districtId || undefined, mandalId: prof.mandalId || undefined };
    } catch { return {}; }
  }
  /**
   * Record read progress for a short news item.
   * - Accumulates totalTimeMs (bounded per event)
   * - Tracks maxScrollPercent (max of all events)
   * - Marks completed when BOTH time & scroll thresholds reached
   * - Increments sessionsCount when an event is flagged with ended=true
   */
  async markProgress(userId: string, input: ProgressInput) {
    const { shortNewsId } = input;
    const exists = await prisma.shortNews.findUnique({ where: { id: shortNewsId }, select: { id: true } });
    if (!exists) throw new NotFoundError(`ShortNews not found: ${shortNewsId}`);

    const MIN_DELTA = 0;
    const MAX_DELTA = 5 * 60 * 1000; // 5 minutes safety cap to ignore spikes
    const COMPLETE_MIN_TIME = Number(process.env.READ_COMPLETE_MIN_TIME_MS || 8000);
    const COMPLETE_SCROLL = Number(process.env.READ_COMPLETE_SCROLL_PERCENT || 85);

    let delta = Number(input.deltaTimeMs || 0);
    if (isNaN(delta) || delta < MIN_DELTA) delta = 0;
    if (delta > MAX_DELTA) delta = MAX_DELTA;
    let scroll = Number(input.maxScrollPercent || 0);
    if (isNaN(scroll) || scroll < 0) scroll = 0;
    if (scroll > 100) scroll = 100;
    const ended = !!input.ended;

    const now = new Date();
    const existing: any = await (prisma as any).shortNewsRead.findUnique({
      where: { userId_shortNewsId: { userId, shortNewsId } }
    });

    if (!existing) {
      const completed = (delta >= COMPLETE_MIN_TIME && scroll >= COMPLETE_SCROLL);
      const created: any = await (prisma as any).shortNewsRead.create({
        data: {
          userId,
            shortNewsId,
            readAt: now,
            totalTimeMs: delta,
            maxScrollPercent: scroll,
            completed,
            lastEventAt: now,
            completedAt: completed ? now : null,
            sessionsCount: 1, // first session
        }
      });
      // dual write content read (best effort)
      try {
        const snapshot = await this.getLocationSnapshot(userId);
        await this.contentRead.recordProgress({
          userId,
          contentId: shortNewsId,
          contentType: 'SHORTNEWS' as ContentTypeEnum,
          deltaTimeMs: delta,
          maxScrollPercent: scroll,
          ended,
          snapshot,
        });
      } catch (e) { if (process.env.DEBUG_READ_PROGRESS) console.warn('[ContentRead dual-write create failed]', (e as Error).message); }
      return this._present(created);
    }

    const totalTimeMs = (existing.totalTimeMs || 0) + delta;
    const maxScrollPercent = Math.max(existing.maxScrollPercent || 0, scroll);
    let completed = !!existing.completed;
    let completedAt = existing.completedAt || null;
    if (!completed && totalTimeMs >= COMPLETE_MIN_TIME && maxScrollPercent >= COMPLETE_SCROLL) {
      completed = true;
      completedAt = now;
    }
    const sessionsCount = (existing.sessionsCount || 0) + (ended ? 1 : 0);

    const updated: any = await (prisma as any).shortNewsRead.update({
      where: { id: existing.id },
      data: {
        totalTimeMs,
        maxScrollPercent,
        completed,
        completedAt,
        lastEventAt: now,
        sessionsCount,
      }
    });

    if (delta > 0 || scroll > 0 || ended) {
      try {
        await this.contentRead.recordProgress({
          userId,
          contentId: shortNewsId,
          contentType: 'SHORTNEWS' as ContentTypeEnum,
          deltaTimeMs: delta,
          maxScrollPercent: scroll,
          ended,
        });
      } catch (e) { if (process.env.DEBUG_READ_PROGRESS) console.warn('[ContentRead dual-write update failed]', (e as Error).message); }
    }
    return this._present(updated);
  }

  private _present(row: any) {
    return {
      shortNewsId: row.shortNewsId,
      read: true,
      readAt: row.readAt,
      totalTimeMs: row.totalTimeMs || 0,
      maxScrollPercent: row.maxScrollPercent || 0,
      completed: !!row.completed,
      completedAt: row.completedAt || null,
      lastEventAt: row.lastEventAt || null,
      sessionsCount: row.sessionsCount || 0,
    };
  }
}

export default ShortNewsReadService;
