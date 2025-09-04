
import prisma from '../../lib/prisma';
import { CreateCommentDto, UpdateCommentDto } from './comments.dto';

export const createComment = async (commentDto: CreateCommentDto) => {
  const { content, userId, articleId, parentId } = commentDto;

  return await prisma.comment.create({
    data: {
      content,
      userId,
      articleId,
      parentId,
    },
  });
};

export const getCommentsByArticle = async (articleId: string) => {
  // Fetch all comments for a given article
  const comments = await prisma.comment.findMany({
    where: { articleId },
    include: {
      user: { select: { id: true, name: true } },
      replies: {
        include: {
          user: { select: { id: true, name: true } },
          // Include nested replies if you want deeper threading
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  // We only return top-level comments, replies are nested within them
  return comments.filter(comment => !comment.parentId);
};

export const updateComment = async (id: string, commentDto: UpdateCommentDto) => {
  return await prisma.comment.update({
    where: { id },
    data: {
      content: commentDto.content,
    },
  });
};

export const deleteComment = async (id: string) => {
    // Deleting a comment should also delete its replies in a transaction
    return prisma.$transaction(async (tx) => {
        // First, delete all replies to this comment
        await tx.comment.deleteMany({ where: { parentId: id } });
        // Then, delete the comment itself
        return await tx.comment.delete({ where: { id } });
    });
};
