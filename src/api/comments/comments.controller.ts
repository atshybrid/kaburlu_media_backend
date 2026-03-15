
import { Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto, UpdateCommentDto, validatePolymorphicTarget } from './comments.dto';
import { createComment, getComments, updateComment, deleteComment } from './comments.service';
import prisma from '../../lib/prisma';

export const createCommentController = async (req: Request, res: Response) => {
  try {
    // Inject userId from JWT — never trust body for this (security)
    const principal = req.user as any;
    if (!principal?.id) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    req.body.userId = principal.id;

    const createCommentDto = plainToClass(CreateCommentDto, req.body);
    const errors = await validate(createCommentDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }
    const polymorphicError = validatePolymorphicTarget(createCommentDto);
    if (polymorphicError) {
      return res.status(400).json({ success: false, message: polymorphicError });
    }

    const comment = await createComment(createCommentDto);
    res.status(201).json({ success: true, message: 'Comment created successfully', data: comment });
  } catch (error) {
    if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getCommentsController = async (req: Request, res: Response) => {
  try {
    let { articleId, shortNewsId, articleSlug } = req.query as { articleId?: string; shortNewsId?: string; articleSlug?: string };

    // Resolve articleSlug → articleId (TenantWebArticle)
    if (articleSlug && !articleId) {
      const article = await prisma.tenantWebArticle.findFirst({
        where: { slug: articleSlug },
        select: { id: true },
      });
      if (!article) return res.status(404).json({ success: false, message: 'Article not found' });
      articleId = article.id;
    }

    // Also resolve inline slug passed as articleId (slug contains hyphens)
    if (articleId && articleId.includes('-')) {
      const bySlug = await prisma.tenantWebArticle.findFirst({
        where: { slug: articleId },
        select: { id: true },
      });
      if (bySlug) articleId = bySlug.id;
    }

    if ((articleId && shortNewsId) || (!articleId && !shortNewsId)) {
      return res.status(400).json({ success: false, message: 'Provide exactly one of articleId, articleSlug, or shortNewsId as query param' });
    }
    const comments = await getComments({ articleId, shortNewsId });
    res.status(200).json({ success: true, data: comments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateCommentController = async (req: Request, res: Response) => {
  try {
    const updateCommentDto = plainToClass(UpdateCommentDto, req.body);
    const errors = await validate(updateCommentDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const comment = await updateComment(req.params.id, updateCommentDto);
    res.status(200).json({ success: true, message: 'Comment updated successfully', data: comment });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteCommentController = async (req: Request, res: Response) => {
  try {
    await deleteComment(req.params.id);
    res.status(200).json({ success: true, message: 'Comment deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
