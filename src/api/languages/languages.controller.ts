
import { Request, Response } from 'express';
import { getLanguages, createLanguage } from './languages.service';
import { CreateLanguageDto } from './languages.dto';
import { validate } from 'class-validator';

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
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
