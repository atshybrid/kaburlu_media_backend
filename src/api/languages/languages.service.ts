
import prisma from '../../lib/prisma';
import { CreateLanguageDto } from './languages.dto';

export const getLanguages = async () => {
  return await prisma.language.findMany();
};

export const createLanguage = async (language: CreateLanguageDto) => {
  return await prisma.language.create({
    data: {
      ...language,
    },
  });
};
