
import prisma from '../../lib/prisma';
import { CreateArticleDto } from './articles.dto';

export const createArticle = async (dto: CreateArticleDto, authorId: string) => {
  const { title, content, categoryIds, isPublished, isBreaking, isFeatured } = dto;

  // 1. Create the article and connect it to categories in one transaction
  const article = await prisma.article.create({
    data: {
      title,
      content,
      authorId,
      publishedAt: isPublished ? new Date() : undefined,
      isBreaking: isBreaking ?? false,
      isFeatured: isFeatured ?? false,
      categories: {
        create: categoryIds.map((categoryId) => ({
          category: {
            connect: { id: categoryId },
          },
        })),
      },
    },
    include: {
      categories: {
        include: {
          category: true,
        },
      },
    },
  });

  return article;
};
