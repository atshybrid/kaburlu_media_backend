
import { Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCommentDto, UpdateCommentDto, validatePolymorphicTarget } from './comments.dto';
import { createComment, getComments, updateComment, deleteComment } from './comments.service';

export const createCommentController = async (req: Request, res: Response) => {
  try {
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
    const { articleId, shortNewsId } = req.query as { articleId?: string; shortNewsId?: string };
    if ((articleId && shortNewsId) || (!articleId && !shortNewsId)) {
      return res.status(400).json({ success: false, message: 'Provide exactly one of articleId or shortNewsId as query param' });
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
