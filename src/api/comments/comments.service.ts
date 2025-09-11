
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
  // Helper to recursively include replies
  type RepliesInclude = {
    include: {
      user: { select: { id: true } },
      replies?: RepliesInclude | boolean;
    };
    orderBy: { createdAt: 'asc' };
  } | boolean;

  const recursiveReplies = (depth = 3): RepliesInclude => {
    if (depth === 0) return false;
    return {
      include: {
        user: { select: { id: true } },
        replies: recursiveReplies(depth - 1)
      },
      orderBy: { createdAt: 'asc' }
    };
  };

  const comments = await prisma.comment.findMany({
    where: { articleId },
    include: {
      user: { select: { id: true } },
      replies: recursiveReplies(5) // 5 levels deep
    },
    orderBy: { createdAt: 'desc' },
  });

  // Only return top-level comments, replies are nested
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
