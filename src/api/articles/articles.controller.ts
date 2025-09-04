
import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { CreateArticleDto } from './articles.dto';
import { createArticle } from './articles.service';

export const createArticleController = async (req: Request, res: Response) => {
  try {
    const createArticleDto = new CreateArticleDto();
    createArticleDto.title = req.body.title;
    createArticleDto.content = req.body.content;
    createArticleDto.categoryIds = req.body.categoryIds;
    createArticleDto.isPublished = req.body.isPublished;
    createArticleDto.isBreaking = req.body.isBreaking;
    createArticleDto.isFeatured = req.body.isFeatured;

    const errors = await validate(createArticleDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // @ts-ignore - req.user is populated by Passport
    const authorId = req.user.sub;
    if (!authorId) {
      return res.status(401).json({ error: 'Authentication error: User ID not found.' });
    }

    const article = await createArticle(createArticleDto, authorId);

    res.status(201).json(article);
  } catch (error: any) {
    // Handle Prisma-specific errors (e.g., a categoryId doesn't exist)
    if (error.code === 'P2025') {
      return res.status(400).json({ error: 'One or more specified categories do not exist.' });
    }

    console.error("Error creating article:", error);
    res.status(500).json({ error: 'Failed to create article.' });
  }
};
