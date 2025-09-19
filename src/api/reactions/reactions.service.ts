import prisma from '../../lib/prisma';

export type ReactionType = 'LIKE' | 'DISLIKE' | 'NONE';

export async function setReaction(userId: string, articleId: string, reaction: ReactionType) {
  return await prisma.$transaction(async (tx) => {
    // Remove both first for idempotency simplicity
    await tx.like.deleteMany({ where: { userId, articleId } });
    await tx.dislike.deleteMany({ where: { userId, articleId } });

    let final: ReactionType = 'NONE';
    if (reaction === 'LIKE') {
      await tx.like.create({ data: { userId, articleId } });
      final = 'LIKE';
    } else if (reaction === 'DISLIKE') {
      await tx.dislike.create({ data: { userId, articleId } });
      final = 'DISLIKE';
    }

    const [likes, dislikes] = await Promise.all([
      tx.like.count({ where: { articleId } }),
      tx.dislike.count({ where: { articleId } }),
    ]);
    return { articleId, reaction: final, counts: { likes, dislikes } };
  });
}

export async function getArticleReaction(userId: string | null, articleId: string) {
  const [likeRow, dislikeRow, likes, dislikes] = await Promise.all([
    userId ? prisma.like.findUnique({ where: { userId_articleId: { userId, articleId } } }) : Promise.resolve(null),
    userId ? prisma.dislike.findUnique({ where: { userId_articleId: { userId, articleId } } }) : Promise.resolve(null),
    prisma.like.count({ where: { articleId } }),
    prisma.dislike.count({ where: { articleId } }),
  ]);
  let reaction: ReactionType = 'NONE';
  if (likeRow) reaction = 'LIKE';
  else if (dislikeRow) reaction = 'DISLIKE';
  return { articleId, reaction, counts: { likes, dislikes } };
}

export async function batchStatus(userId: string, articleIds: string[]) {
  if (articleIds.length === 0) return [];
  const uniqueIds = Array.from(new Set(articleIds));
  const [likeRows, dislikeRows, likeCountsRaw, dislikeCountsRaw] = await Promise.all([
    prisma.like.findMany({ where: { userId, articleId: { in: uniqueIds } }, select: { articleId: true } }),
    prisma.dislike.findMany({ where: { userId, articleId: { in: uniqueIds } }, select: { articleId: true } }),
    prisma.like.groupBy({ by: ['articleId'], where: { articleId: { in: uniqueIds } }, _count: { articleId: true } }),
    prisma.dislike.groupBy({ by: ['articleId'], where: { articleId: { in: uniqueIds } }, _count: { articleId: true } }),
  ]);
  const likeSet = new Set(likeRows.map(r => r.articleId));
  const dislikeSet = new Set(dislikeRows.map(r => r.articleId));
  const likeCountMap = new Map<string, number>(likeCountsRaw.map(r => [r.articleId, r._count.articleId]));
  const dislikeCountMap = new Map<string, number>(dislikeCountsRaw.map(r => [r.articleId, r._count.articleId]));
  return uniqueIds.map(articleId => {
    let reaction: ReactionType = 'NONE';
    if (likeSet.has(articleId)) reaction = 'LIKE';
    else if (dislikeSet.has(articleId)) reaction = 'DISLIKE';
    return {
      articleId,
      reaction,
      counts: {
        likes: likeCountMap.get(articleId) || 0,
        dislikes: dislikeCountMap.get(articleId) || 0,
      }
    };
  });
}
