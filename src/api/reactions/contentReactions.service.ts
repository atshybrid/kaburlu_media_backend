import prisma from '../../lib/prisma';
import { ContentType } from '@prisma/client';

// Local fallback since generated enum ReactionValue not present in current client output.
export type ReactionValue = 'LIKE' | 'DISLIKE';

export interface SetContentReactionInput {
  userId: string;
  contentType: ContentType;
  contentId: string;
  reaction: ReactionValue | 'NONE';
}

export interface ContentReactionResult {
  contentType: ContentType;
  contentId: string;
  reaction: ReactionValue | 'NONE';
  counts: { likes: number; dislikes: number };
}

export class ContentReactionsService {
  async setReaction({ userId, contentType, contentId, reaction }: SetContentReactionInput): Promise<ContentReactionResult> {
    const client: any = prisma as any;
    if (client.contentReaction) {
      // Normal Prisma path
      if (reaction === 'NONE') {
        await client.contentReaction.deleteMany({ where: { userId, contentType, contentId } });
      } else {
        await client.contentReaction.upsert({
          where: { userId_contentType_contentId: { userId, contentType, contentId } },
          update: { reaction },
            create: { userId, contentType, contentId, reaction },
        });
      }
    } else {
      // Raw SQL fallback (model not in generated client yet)
      if (reaction === 'NONE') {
        await prisma.$executeRaw`DELETE FROM "ContentReaction" WHERE "userId"=${userId} AND "contentType"=${contentType} AND "contentId"=${contentId}`;
      } else {
        await prisma.$executeRaw`INSERT INTO "ContentReaction" ("userId","contentType","contentId","reaction","createdAt","updatedAt") VALUES (${userId},${contentType},${contentId},${reaction}, now(), now())
          ON CONFLICT ("userId","contentType","contentId") DO UPDATE SET "reaction"=EXCLUDED."reaction", "updatedAt"=now()`;
      }
    }
    const counts = await this.counts(contentType, contentId);
    const current: ReactionValue | 'NONE' = reaction === 'NONE' ? 'NONE' : reaction;
    return { contentType, contentId, reaction: current, counts };
  }

  async getReaction(userId: string | null, contentType: ContentType, contentId: string): Promise<ContentReactionResult> {
    let row: any = null;
    const client: any = prisma as any;
    if (userId) {
      if (client.contentReaction) {
        row = await client.contentReaction.findUnique({ where: { userId_contentType_contentId: { userId, contentType, contentId } } });
      } else {
        const results: any[] = await prisma.$queryRaw`SELECT "reaction" FROM "ContentReaction" WHERE "userId"=${userId} AND "contentType"=${contentType} AND "contentId"=${contentId} LIMIT 1`;
        row = results[0] || null;
      }
    }
    const counts = await this.counts(contentType, contentId);
    return { contentType, contentId, reaction: row ? row.reaction : 'NONE', counts };
  }

  async batch(userId: string, contentType: ContentType, contentIds: string[]): Promise<ContentReactionResult[]> {
    if (!contentIds.length) return [];
    const ids = Array.from(new Set(contentIds));
    const client: any = prisma as any;
    let rows: any[] = [];
    let likeCounts: any[] = [];
    let dislikeCounts: any[] = [];
    if (client.contentReaction) {
      rows = await client.contentReaction.findMany({ where: { userId, contentType, contentId: { in: ids } } });
      likeCounts = await client.contentReaction.groupBy({ by: ['contentId'], where: { contentType, contentId: { in: ids }, reaction: 'LIKE' }, _count: { contentId: true } });
      dislikeCounts = await client.contentReaction.groupBy({ by: ['contentId'], where: { contentType, contentId: { in: ids }, reaction: 'DISLIKE' }, _count: { contentId: true } });
    } else {
      rows = await prisma.$queryRaw<any[]>`SELECT "contentId", "reaction" FROM "ContentReaction" WHERE "userId"=${userId} AND "contentType"=${contentType} AND "contentId" IN (${prisma.$queryRaw`${ids}`})`;
      likeCounts = await prisma.$queryRaw<any[]>`SELECT "contentId", COUNT(*)::int as cnt FROM "ContentReaction" WHERE "contentType"=${contentType} AND "reaction"='LIKE' AND "contentId" IN (${prisma.$queryRaw`${ids}`}) GROUP BY "contentId"`;
      dislikeCounts = await prisma.$queryRaw<any[]>`SELECT "contentId", COUNT(*)::int as cnt FROM "ContentReaction" WHERE "contentType"=${contentType} AND "reaction"='DISLIKE' AND "contentId" IN (${prisma.$queryRaw`${ids}`}) GROUP BY "contentId"`;
      likeCounts = likeCounts.map(r => ({ contentId: r.contentId, _count: { contentId: r.cnt } }));
      dislikeCounts = dislikeCounts.map(r => ({ contentId: r.contentId, _count: { contentId: r.cnt } }));
    }
    const likeMap = new Map<string, number>(likeCounts.map((c: any) => [c.contentId, c._count.contentId]));
    const dislikeMap = new Map<string, number>(dislikeCounts.map((c: any) => [c.contentId, c._count.contentId]));
    return ids.map(id => {
      const r = rows.find((x: any) => x.contentId === id);
      return {
        contentType,
        contentId: id,
        reaction: r ? (r.reaction as ReactionValue) : 'NONE',
        counts: { likes: likeMap.get(id) || 0, dislikes: dislikeMap.get(id) || 0 },
      };
    });
  }

  private async counts(contentType: ContentType, contentId: string) {
    const client: any = prisma as any;
    if (client.contentReaction) {
      const [likes, dislikes] = await Promise.all([
        client.contentReaction.count({ where: { contentType, contentId, reaction: 'LIKE' } }),
        client.contentReaction.count({ where: { contentType, contentId, reaction: 'DISLIKE' } }),
      ]);
      return { likes, dislikes };
    }
    const likeRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "ContentReaction" WHERE "contentType"=${contentType} AND "contentId"=${contentId} AND "reaction"='LIKE'`;
    const dislikeRow: any[] = await prisma.$queryRaw`SELECT COUNT(*)::int as cnt FROM "ContentReaction" WHERE "contentType"=${contentType} AND "contentId"=${contentId} AND "reaction"='DISLIKE'`;
    return { likes: likeRow[0]?.cnt || 0, dislikes: dislikeRow[0]?.cnt || 0 };
  }
}

export default ContentReactionsService;
