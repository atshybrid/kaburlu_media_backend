import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}
