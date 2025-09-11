
import prisma from '../../lib/prisma';
import { CreateLikeDto } from './likes.dto';

export const likeArticle = async (likeDto: CreateLikeDto) => {
  const { userId, articleId } = likeDto;

  // Check if the like already exists to prevent duplicates
  const existingLike = await prisma.like.findUnique({
    where: {
      userId_articleId: {
        userId,
        articleId,
      },
    },
  });

  if (existingLike) {
    throw new Error('User has already liked this article');
  }

  return await prisma.like.create({
    data: {
      userId,
      articleId,
    },
  });
};

export const unlikeArticle = async (likeDto: CreateLikeDto) => {
  const { userId, articleId } = likeDto;

  return await prisma.like.delete({
    where: {
      userId_articleId: {
        userId,
        articleId,
      },
    },
  });
};

export const getLikesForArticle = async (articleId: string) => {
  return await prisma.like.findMany({
    where: { articleId },
    include: {
      user: {
        select: {
          id: true,
        }
      }
    }
  });
};
