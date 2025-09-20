import prisma from '../../lib/prisma';

// Temporary local enum type while Prisma client regeneration is pending / failing on Windows.
// Once `npx prisma generate` succeeds, you can replace this with: `import { ContentType } from '@prisma/client';`
export type ContentTypeEnum = 'ARTICLE' | 'SHORTNEWS';

interface ProgressInput {
  contentId: string;
  contentType: ContentTypeEnum; // ARTICLE or SHORTNEWS
  userId: string;
  deltaTimeMs?: number;
  maxScrollPercent?: number;
  ended?: boolean;
  // optional snapshot location on first create
  snapshot?: {
    latitude?: number; longitude?: number; accuracyMeters?: number;
    placeId?: string; placeName?: string; address?: string;
    stateId?: string; districtId?: string; mandalId?: string;
  };
}

export class ContentReadService {
  private COMPLETE_MIN_TIME = Number(process.env.READ_COMPLETE_MIN_TIME_MS || 8000);
  private COMPLETE_SCROLL = Number(process.env.READ_COMPLETE_SCROLL_PERCENT || 85);
  private MAX_DELTA = 5 * 60 * 1000;

  async recordProgress(input: ProgressInput) {
    let { deltaTimeMs = 0, maxScrollPercent = 0, ended = false } = input;
    if (deltaTimeMs < 0) deltaTimeMs = 0;
    if (deltaTimeMs > this.MAX_DELTA) deltaTimeMs = this.MAX_DELTA;
    if (maxScrollPercent < 0) maxScrollPercent = 0;
    if (maxScrollPercent > 100) maxScrollPercent = 100;

    const now = new Date();
    const existing = await (prisma as any).contentRead.findUnique({
      where: { userId_contentType_contentId: { userId: input.userId, contentType: input.contentType, contentId: input.contentId } }
    });

    if (!existing) {
      const completed = (deltaTimeMs >= this.COMPLETE_MIN_TIME && maxScrollPercent >= this.COMPLETE_SCROLL);
  const created = await (prisma as any).contentRead.create({
        data: {
          userId: input.userId,
          contentType: input.contentType,
          contentId: input.contentId,
          readAt: now,
          totalTimeMs: deltaTimeMs,
          maxScrollPercent,
          completed,
          lastEventAt: now,
          completedAt: completed ? now : null,
          sessionsCount: 1,
          latitude: input.snapshot?.latitude,
          longitude: input.snapshot?.longitude,
          accuracyMeters: input.snapshot?.accuracyMeters,
          placeId: input.snapshot?.placeId,
          placeName: input.snapshot?.placeName,
          address: input.snapshot?.address,
          stateId: input.snapshot?.stateId,
          districtId: input.snapshot?.districtId,
          mandalId: input.snapshot?.mandalId,
        }
      });
      return this.present(created);
    }

    const totalTimeMs = (existing.totalTimeMs || 0) + deltaTimeMs;
    const scroll = Math.max(existing.maxScrollPercent || 0, maxScrollPercent);
    let completed = existing.completed;
    let completedAt = existing.completedAt;
    if (!completed && totalTimeMs >= this.COMPLETE_MIN_TIME && scroll >= this.COMPLETE_SCROLL) {
      completed = true;
      completedAt = now;
    }
    const sessionsCount = existing.sessionsCount + (ended ? 1 : 0);

  const updated = await (prisma as any).contentRead.update({
      where: { id: existing.id },
      data: {
        totalTimeMs,
        maxScrollPercent: scroll,
        completed,
        completedAt,
        lastEventAt: now,
        sessionsCount,
      }
    });
    return this.present(updated);
  }

  present(row: any) {
    return {
      id: row.id,
      userId: row.userId,
      contentId: row.contentId,
      contentType: row.contentType,
      readAt: row.readAt,
      totalTimeMs: row.totalTimeMs,
      maxScrollPercent: row.maxScrollPercent,
      completed: row.completed,
      completedAt: row.completedAt,
      lastEventAt: row.lastEventAt,
      sessionsCount: row.sessionsCount,
      latitude: row.latitude,
      longitude: row.longitude,
      stateId: row.stateId,
      districtId: row.districtId,
      mandalId: row.mandalId,
    };
  }
}

export default ContentReadService;
