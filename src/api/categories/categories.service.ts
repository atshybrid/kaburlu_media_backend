
import prisma from '../../lib/prisma';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { aiEnabledFor } from '../../lib/aiConfig';
import { getPrompt, renderPrompt } from '../../lib/prompts';
import { aiGenerateText } from '../../lib/aiProvider';

// Initialize the Gemini AI model for translations
const GENAI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
if (!GENAI_API_KEY) {
  console.warn('GEMINI_API_KEY/GOOGLE_GENAI_API_KEY not set. Category translations will fall back to original text.');
}
const genAI = GENAI_API_KEY ? new GoogleGenerativeAI(GENAI_API_KEY) : null;
const model = genAI ? genAI.getGenerativeModel({ model: 'gemini-1.5-pro' }) : null;

/**
 * Translates a given text to a target language using the Gemini API.
 * @param text The text to translate.
 * @param targetLanguage The language to translate to (e.g., "Spanish").
 * @returns The translated text, or the original text if translation fails.
 */
const translateText = async (text: string, targetLanguageHint: string, isEnglishTarget = false): Promise<string> => {
  if (!aiEnabledFor('translation')) return text;
  try {
    const tpl = await getPrompt('CATEGORY_TRANSLATION');
    const prompt = renderPrompt(tpl, { text, targetLanguage: targetLanguageHint, latinGuard: isEnglishTarget ? '' : ' (do NOT use Latin/English letters)' });
    const out = (await aiGenerateText({ prompt, purpose: 'translation' })).trim();
    if (!out) return text;
    const looksLatin = /^[A-Za-z0-9\s\-_.]+$/.test(out);
    if (!isEnglishTarget && (out.localeCompare(text, undefined, { sensitivity: 'base' }) === 0 || looksLatin)) {
      // Attempt a second pass using the local Gemini model if available
      if (model) {
        const fbPrompt = `Translate the category "${text}" into ${targetLanguageHint} in native script only. Output only the word.`;
        const fbRes = await model.generateContent(fbPrompt);
        const fbOut = (await fbRes.response.text()).trim();
        if (fbOut) return fbOut;
      }
    }
    return out;
  } catch (error) {
    console.error(`Error translating '${text}' to ${targetLanguageHint}:`, error);
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
  isDeleted: typeof categoryDto.isDeleted === 'boolean' ? categoryDto.isDeleted : false,
      parentId: categoryDto.parentId === 'null' || !categoryDto.parentId ? null : categoryDto.parentId,
  // iconUrl removed, not present in DTO or model
  // order removed, not present in model
    },
  });
};

export const translateAndSaveCategoryInBackground = async (categoryId: string, categoryName: string) => {
  console.log(`[Background Job] Starting translations for category: ${categoryName}`);
  let successfulTranslations = 0;
  try {
    // Only active languages
    const languages = await prisma.language.findMany({ where: { isDeleted: false } });

    for (const lang of languages) {
      try {
        const isEnglish = (lang.code || '').toLowerCase() === 'en';
        const hint = `${lang.name} (${lang.nativeName})`;
        const translatedName = isEnglish ? categoryName : await translateText(categoryName, hint, false);
        // Upsert by composite unique (categoryId, language)
        await prisma.categoryTranslation.upsert({
          where: { categoryId_language: { categoryId, language: lang.code } },
          update: { name: translatedName },
          create: { categoryId, language: lang.code, name: translatedName },
        });
        successfulTranslations++;
        console.log(`> Saved translation '${translatedName}' for ${lang.name} (${lang.code})`);
      } catch (innerError) {
        console.error(`> Failed to upsert translation for '${categoryName}' in ${lang.name} (${lang.code}):`, innerError);
      }
    }

    console.log(`[Background Job] Finished translations for '${categoryName}'. Total attempted: ${languages.length}, successful: ${successfulTranslations}`);
  } catch (error) {
    console.error(`[Background Job] A critical error occurred during translation for category '${categoryName}' (ID: ${categoryId}):`, error);
  }
};

export const getCategories = async (languageContext: string) => {
  // Map languageId -> language code for CategoryTranslation.language filter
  const lang = await prisma.language.findUnique({ where: { id: languageContext } });
  const code = lang?.code;
  if (!code) {
    return [];
  }
  const includeClause: any = { translations: { where: { language: code } } };

  const allCategories = await prisma.category.findMany({
    include: includeClause,
  });

  const categoryMap = new Map();
  const processedCategories = allCategories.map(cat => {
    let processedName = cat.name;
    let translationsArray;

    if ((cat as any).translations?.length > 0) {
      processedName = (cat as any).translations[0].name;
    }

    const processed: any = {
      ...cat,
      name: processedName,
      children: [],
    };

    if ((processed as any).translations) {
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

export const retranslateCategory = async (id: string) => {
  const cat = await prisma.category.findUnique({ where: { id } });
  if (!cat) throw new Error('Category not found');
  await translateAndSaveCategoryInBackground(id, cat.name);
  return { ok: true };
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
