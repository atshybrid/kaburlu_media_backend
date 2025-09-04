
import { Request, Response } from 'express';
import { plainToClass } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateLikeDto } from './likes.dto';
import {
  likeArticle,
  unlikeArticle,
  getLikesForArticle,
} from './likes.service';

export const likeArticleController = async (req: Request, res: Response) => {
  try {
    const likeDto = plainToClass(CreateLikeDto, req.body);
    const errors = await validate(likeDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const like = await likeArticle(likeDto);
    res.status(201).json({ success: true, message: 'Article liked successfully', data: like });
  } catch (error) {
    if (error instanceof Error) {
        return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const unlikeArticleController = async (req: Request, res: Response) => {
  try {
    // We can reuse the same DTO for validation
    const likeDto = plainToClass(CreateLikeDto, req.body);
    const errors = await validate(likeDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    await unlikeArticle(likeDto);
    res.status(200).json({ success: true, message: 'Article unliked successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getLikesForArticleController = async (req: Request, res: Response) => {
    try {
      const { articleId } = req.params;
      const likes = await getLikesForArticle(articleId);
      res.status(200).json({ success: true, data: likes });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  };
