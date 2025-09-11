import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dislikeArticle = async (userId: string, articleId: string) => {
  // Prevent duplicate dislikes
  const existing = await prisma.dislike.findUnique({
    where: { userId_articleId: { userId, articleId } },
  });
  if (existing) throw new Error('User has already disliked this article');
  return await prisma.dislike.create({ data: { userId, articleId } });
};

export const removeDislike = async (userId: string, articleId: string) => {
  return await prisma.dislike.delete({
    where: { userId_articleId: { userId, articleId } },
  });
};

export const getDislikesForArticle = async (articleId: string) => {
  return await prisma.dislike.findMany({ where: { articleId } });
};
