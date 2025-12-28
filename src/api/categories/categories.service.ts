
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
    const outRes = await aiGenerateText({ prompt, purpose: 'translation' });
    const out = String(outRes?.text || '').trim();
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

      // If we don't have the local Gemini model available, try a stricter second-pass prompt
      // through the configured AI provider.
      const strictPrompt = `You are a translator.
Task: Translate the news category name into ${targetLanguageHint}.
Rules:
- Output ONLY the translated category name.
- MUST be in the native script of ${targetLanguageHint}.
- Do NOT output English/Latin letters.
- No quotes, no punctuation, no explanations.

Category: ${text}`;
      const strictRes = await aiGenerateText({ prompt: strictPrompt, purpose: 'translation' });
      const strictOut = String(strictRes?.text || '').trim();
      const strictLooksLatin = /^[A-Za-z0-9\s\-_.]+$/.test(strictOut);
      if (strictOut && !strictLooksLatin) return strictOut;
    }
    return out;
  } catch (error) {
    console.error(`Error translating '${text}' to ${targetLanguageHint}:`, error);
    return text;
  }
};

async function ensureCategoryTranslationPlaceholders(categoryId: string, categoryName: string) {
  // Ensure we have at least placeholder rows for every active language.
  // These can be refined by AI translation later.
  try {
    const languages = await prisma.language.findMany({ where: { isDeleted: false }, select: { code: true } });
    const codes = languages.map(l => String(l.code || '').trim()).filter(Boolean);
    if (!codes.length) return;
    await prisma.categoryTranslation.createMany({
      data: codes.map(code => ({ categoryId, language: code as any, name: categoryName })),
      skipDuplicates: true,
    });
  } catch {
    // best-effort only
  }
}

async function translateCategoryNameForLanguage(categoryName: string, lang: { code: string; name?: string | null; nativeName?: string | null }) {
  const isEnglish = (lang.code || '').toLowerCase() === 'en';
  const hint = `${lang.name || lang.code} (${lang.nativeName || lang.name || lang.code})`;
  const baseLooksLatin = /^[A-Za-z0-9\s\-_.]+$/.test(String(categoryName || '').trim());
  if (isEnglish) return baseLooksLatin ? categoryName : await translateText(categoryName, hint, true);
  return await translateText(categoryName, hint, false);
}

export const createCategory = async (categoryDto: CreateCategoryDto) => {
  const slug = categoryDto.name.toLowerCase().replace(/ /g, '-');

  const existingCategory = await prisma.category.findFirst({
    where: { OR: [{ slug }, { name: categoryDto.name }] },
  });

  if (existingCategory) {
    throw new Error('A category with this name or slug already exists.');
  }

  const created = await prisma.category.create({
    data: {
      name: categoryDto.name,
      slug,
      iconUrl: categoryDto.iconUrl,
      isDeleted: typeof categoryDto.isDeleted === 'boolean' ? categoryDto.isDeleted : false,
      parentId: categoryDto.parentId === 'null' || !categoryDto.parentId ? null : categoryDto.parentId,
    },
  });

  await ensureCategoryTranslationPlaceholders(created.id, created.name);

  // Fire-and-forget: translate into all languages (including English).
  translateAndSaveCategoryInBackground(created.id, created.name).catch(() => {});

  return created;
};

export const translateAndSaveCategoryInBackground = async (categoryId: string, categoryName: string) => {
  console.log(`[Background Job] Starting translations for category: ${categoryName}`);
  let successfulTranslations = 0;
  try {
    // Only active languages
    const languages = await prisma.language.findMany({ where: { isDeleted: false } });

    for (const lang of languages) {
      try {
        const translatedName = await translateCategoryNameForLanguage(categoryName, lang as any);
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

export const backfillCategoryTranslationsForNewLanguageInBackground = async (languageCodeRaw: string) => {
  const languageCode = String(languageCodeRaw || '').trim().toLowerCase();
  if (!languageCode) return;
  try {
    const lang = await prisma.language.findFirst({ where: { code: languageCode, isDeleted: false } });
    if (!lang) return;

    const categories = await prisma.category.findMany({ where: { isDeleted: false }, select: { id: true, name: true } });

    // 1) Ensure placeholder rows exist.
    try {
      await prisma.categoryTranslation.createMany({
        data: categories.map(c => ({ categoryId: c.id, language: languageCode as any, name: c.name })),
        skipDuplicates: true,
      });
    } catch {
      // ignore
    }

    // 2) Translate each category into the new language and upsert.
    for (const c of categories) {
      try {
        const translatedName = await translateCategoryNameForLanguage(c.name, lang as any);
        await prisma.categoryTranslation.upsert({
          where: { categoryId_language: { categoryId: c.id, language: languageCode } },
          update: { name: translatedName },
          create: { categoryId: c.id, language: languageCode, name: translatedName },
        });
      } catch {
        // best-effort
      }
    }
  } catch (e) {
    console.error('[Background Job] Failed to backfill category translations for new language:', languageCodeRaw, e);
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
  const existing = await prisma.category.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!existing) throw new Error('Category not found');

  const data: any = { ...categoryDto };
  if (categoryDto.name) {
    data.slug = categoryDto.name.toLowerCase().replace(/ /g, '-');
  }
  if (categoryDto.parentId === 'null' || categoryDto.parentId === '' || categoryDto.parentId === null) {
    data.parentId = null;
  }
  if (categoryDto.iconUrl !== undefined) {
    data.iconUrl = categoryDto.iconUrl;
  }

  const updated = await prisma.category.update({ where: { id }, data });

  // If name changed, ensure translations exist for all languages and retranslate.
  if (typeof categoryDto.name === 'string' && categoryDto.name.trim() && categoryDto.name !== existing.name) {
    await ensureCategoryTranslationPlaceholders(updated.id, updated.name);
    translateAndSaveCategoryInBackground(updated.id, updated.name).catch(() => {});
  }

  return updated;
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
