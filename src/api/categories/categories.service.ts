
import prisma from '../../lib/prisma';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini AI model for translations
if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY environment variable is not set. Translation services will not work.');
}
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }) : null;

/**
 * Translates a given text to a target language using the Gemini API.
 * @param text The text to translate.
 * @param targetLanguage The language to translate to (e.g., "Spanish").
 * @returns The translated text, or the original text if translation fails.
 */
const translateText = async (text: string, targetLanguage: string): Promise<string> => {
  if (!model) {
    console.error('Gemini model not initialized. Skipping translation.');
    return text;
  }
  try {
    // Construct a clear and direct prompt for the model
    const prompt = `Translate the news category "${text}" into ${targetLanguage}. Provide only the translated text, with no extra explanation or formatting.`;
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text().trim();
  } catch (error) {
    console.error(`Error translating '${text}' to ${targetLanguage}:`, error);
    // Fallback to the original text in case of an API error
    return text;
  }
};

export const createCategory = async (categoryDto: CreateCategoryDto) => {
  const slug = categoryDto.name.toLowerCase().replace(/ /g, '-');

  const existingCategory = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: categoryDto.name }] },
  });

  if (existingCategory) {
    throw new Error('A category with this name or slug already exists.');
  }

  return await prisma.category.create({
    data: {
      name: categoryDto.name,
      slug,
      isActive: typeof categoryDto.isActive === 'boolean' ? categoryDto.isActive : true,
      parentId: categoryDto.parentId === 'null' || !categoryDto.parentId ? null : categoryDto.parentId,
      iconUrl: categoryDto.iconUrl === 'null' || !categoryDto.iconUrl ? null : categoryDto.iconUrl,
      order: 0,
    },
  });
};

export const translateAndSaveCategoryInBackground = async (categoryId: string, categoryName: string) => {
  console.log(`[Background Job] Starting translations for category: ${categoryName}`);
  let successfulTranslations = 0;
  try {
    const languages = await prisma.language.findMany();
    const englishLanguage = languages.find(lang => lang.code.toLowerCase() === 'en');

    if (englishLanguage) {
      await prisma.categoryTranslation.create({
        data: { categoryId, languageId: englishLanguage.id, name: categoryName },
      });
      successfulTranslations++;
    }

    const otherLanguages = languages.filter(lang => lang.code.toLowerCase() !== 'en');
    for (const lang of otherLanguages) {
      try {
        const translatedName = await translateText(categoryName, lang.name);
        await prisma.categoryTranslation.create({
          data: { categoryId, languageId: lang.id, name: translatedName },
        });
        successfulTranslations++;
        console.log(`> Successfully translated '${categoryName}' to ${lang.name}: ${translatedName}`);
      } catch (innerError) {
        console.error(`> Failed to translate '${categoryName}' to ${lang.name}:`, innerError);
      }
    }

    console.log(`[Background Job] Finished translations for '${categoryName}'. Total successful: ${successfulTranslations}/${languages.length}`);
  } catch (error) {
    console.error(`[Background Job] A critical error occurred during translation for category '${categoryName}' (ID: ${categoryId}):`, error);
  }
};

export const getCategories = async (languageContext: string | null | 'all') => {
  let includeClause: any = {};

  if (languageContext === 'all') {
    includeClause = { translations: true };
  } else if (languageContext) {
    includeClause = { translations: { where: { languageId: languageContext } } };
  }

  const allCategories = await prisma.category.findMany({
    include: includeClause,
    orderBy: { order: 'asc' },
  });

  const categoryMap = new Map();
  const processedCategories = allCategories.map(cat => {
    let processedName = cat.name;
    let translationsArray;

    if (languageContext === 'all') {
      translationsArray = (cat as any).translations;
    } else if (languageContext && (cat as any).translations?.length > 0) {
      processedName = (cat as any).translations[0].name;
    }

    const processed: any = {
      ...cat,
      name: processedName,
      children: [],
    };

    if (languageContext === 'all') {
      processed.translations = translationsArray;
    } else if ((processed as any).translations) {
      delete (processed as any).translations;
    }

    categoryMap.set(processed.id, processed);
    return processed;
  });

  const categoryTree: any[] = [];
  processedCategories.forEach(cat => {
    if (cat.parentId && categoryMap.has(cat.parentId)) {
      categoryMap.get(cat.parentId).children.push(cat);
    } else {
      categoryTree.push(cat);
    }
  });

  return categoryTree;
};

export const updateCategory = async (id: string, categoryDto: UpdateCategoryDto) => {
  const data: any = { ...categoryDto };
  if (categoryDto.name) {
    data.slug = categoryDto.name.toLowerCase().replace(/ /g, '-');
  }
  if (categoryDto.parentId === 'null' || categoryDto.parentId === '' || categoryDto.parentId === null) {
    data.parentId = null;
  }
  return await prisma.category.update({ where: { id }, data });
};

export const deleteCategory = async (id: string) => {
  const childCategories = await prisma.category.findMany({
    where: { parentId: id },
  });

  if (childCategories.length > 0) {
    const childNames = childCategories.map(c => c.name).join(', ');
    throw new Error(`Cannot delete category because it has child relationships. Please delete or reassign the following children first: ${childNames}`);
  }

  return await prisma.category.delete({ where: { id } });
};
