
import { Request, Response } from 'express';
import { getLanguages, createLanguage } from './languages.service';
import { CreateLanguageDto } from './languages.dto';
import { validate } from 'class-validator';
import { backfillCategoryTranslationsForNewLanguageInBackground } from '../categories/categories.service';
import prisma from '../../lib/prisma';

export const getLanguagesController = async (req: Request, res: Response) => {
  try {
    const languages = await getLanguages();
    res.status(200).json({ success: true, data: languages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createLanguageController = async (req: Request, res: Response) => {
  try {
    const createLanguageDto = new CreateLanguageDto(req.body.name, req.body.code);

    const errors = await validate(createLanguageDto);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const language = await createLanguage(createLanguageDto);
    res.status(201).json({ success: true, message: 'Language created successfully', data: language });

    // Fire-and-forget: ensure all existing categories get a translation row for this new language.
    // This may take time; we do not block the HTTP response.
    void backfillCategoryTranslationsForNewLanguageInBackground(language.code);
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const backfillCategoryTranslationsController = async (req: Request, res: Response) => {
  const code = String((req.params as any).code || '').trim().toLowerCase();
  if (!code) return res.status(400).json({ error: 'code is required' });
  const exists = await prisma.language.findFirst({ where: { code, isDeleted: false }, select: { id: true } }).catch(() => null);
  if (!exists) return res.status(404).json({ error: 'Language not found' });

  void backfillCategoryTranslationsForNewLanguageInBackground(code);
  return res.status(202).json({ ok: true, message: 'Backfill started', code });
};
