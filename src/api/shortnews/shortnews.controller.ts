import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { transliterate } from 'transliteration';
import { resolveOrCreateCategoryIdByName } from '../../lib/categoryAuto';
import type { Language } from '@prisma/client';
import { buildNewsArticleJsonLd } from '../../lib/seo';
import { getCanonicalDomain, buildCanonicalUrl } from '../../lib/domains';

import { aiEnabledFor } from '../../lib/aiConfig';
import { getPrompt, renderPrompt } from '../../lib/prompts';
import { aiGenerateText } from '../../lib/aiProvider';
import { generateAiShortNewsFromPrompt } from './shortnews.ai';
import { sendToTopic } from '../../lib/fcm';
import prismaClient from '../../lib/prisma';
import { translateAndSaveCategoryInBackground } from '../categories/categories.service';

type HeadingStyle = { text: string; color?: string; bgColor?: string; size?: number; tag?: 'h2' | 'h3' };
type HeadingsPayload = { h2?: HeadingStyle; h3?: HeadingStyle };

function normalizeHeading(tag: 'h2' | 'h3', obj: any): HeadingStyle | undefined {
  if (!obj) return undefined;
  const text = typeof obj.text === 'string' ? obj.text.trim() : (typeof obj.content === 'string' ? obj.content.trim() : '');
  if (!text) return undefined;
  const maxLen = 50;
  const color = typeof obj.color === 'string' && obj.color.trim() ? obj.color.trim() : undefined;
  const bgColorRaw = (obj.bgColor ?? obj.backgroundColor);
  const bgColor = typeof bgColorRaw === 'string' && bgColorRaw.trim() ? bgColorRaw.trim() : undefined;
  const sizeNum = obj.size != null ? Number(obj.size) : undefined;
  const size = Number.isFinite(sizeNum) && sizeNum! > 0 ? sizeNum : undefined;
  const defaults = tag === 'h2' ? { color: '#1f2937', bgColor: 'transparent', size: 20 } : { color: '#374151', bgColor: 'transparent', size: 18 };
  return {
    tag,
    text: text.slice(0, maxLen),
    color: color || defaults.color,
    bgColor: bgColor || defaults.bgColor,
    size: size || defaults.size,
  };
}

function normalizeHeadings(input?: any, h2Alt?: any, h3Alt?: any): HeadingsPayload | null {
  // Accept either a single "headings" object or separate h2/h3 objects
  const src = (input && typeof input === 'object') ? input : {};
  const h2 = normalizeHeading('h2', src.h2 ?? h2Alt);
  const h3 = normalizeHeading('h3', src.h3 ?? h3Alt);
  const payload: HeadingsPayload = {};
  if (h2) payload.h2 = h2;
  if (h3) payload.h3 = h3;
  return Object.keys(payload).length ? payload : null;
}

// AI article generation (SHORTNEWS_AI_ARTICLE) - helper only, no DB write
export const aiGenerateShortNewsArticle = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { rawText } = req.body || {};
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    const wordCount = rawText.trim().split(/\s+/).length;
    if (wordCount > 500) {
      return res.status(400).json({ success: false, error: 'rawText must be 500 words or less' });
    }
    const languageId = (req.user as any).languageId;
    if (!languageId) return res.status(400).json({ success: false, error: 'User language not set' });
    const lang = await prismaClient.language.findUnique({ where: { id: languageId } });
    const languageCode = lang?.code || 'en';
    const tpl = await getPrompt('SHORTNEWS_AI_ARTICLE' as any);
    const prompt = renderPrompt(tpl, { languageCode, content: rawText });
    const draft = await generateAiShortNewsFromPrompt(
      rawText,
      prompt,
      async (p) => {
        const r = await aiGenerateText({ prompt: p, purpose: 'shortnews_ai_article' });
        return String(r?.text || '');
      },
      { minWords: 58, maxWords: 60, maxAttempts: 3 }
    );
    let suggestedCategoryName = draft.suggestedCategoryName;
    if (!suggestedCategoryName) suggestedCategoryName = 'Community';
    let matchedCategory: { id: string; name: string } | null = null;
    let createdCategory = false;
    let categoryTranslationId: string | null = null;
    let localizedCategoryName: string | null = null;
    try {
      const resolved = await resolveOrCreateCategoryIdByName({
        suggestedName: suggestedCategoryName,
        languageCode,
        similarityThreshold: 0.9,
        autoCreate: true,
      });
      if (resolved?.categoryId) {
        const cat = await prismaClient.category.findUnique({ where: { id: resolved.categoryId }, select: { id: true, name: true } }).catch(() => null);
        if (cat?.id) matchedCategory = cat;
        createdCategory = Boolean(resolved?.created);
        localizedCategoryName = suggestedCategoryName;
        // Ensure translation exists for this language code
        const tr = await prismaClient.categoryTranslation.upsert({
          where: { categoryId_language: { categoryId: resolved.categoryId, language: languageCode as any } },
          update: { name: suggestedCategoryName },
          create: { categoryId: resolved.categoryId, language: languageCode as any, name: suggestedCategoryName },
          select: { id: true }
        });
        categoryTranslationId = tr.id;
      }
    } catch {}
    return res.json({
      success: true,
      data: {
        title: draft.title,
        content: draft.content,
        languageCode,
        suggestedCategoryName,
        suggestedCategoryId: matchedCategory?.id || null,
        matchedCategoryName: matchedCategory?.name || null,
        createdCategory,
        categoryTranslationId,
        languageCategoryId: categoryTranslationId,
        localizedCategoryName,
        attempts: draft.attempts,
        fallback: draft.fallbackUsed,
        headings: draft.headings || undefined,
      },
    });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to generate AI article' });
  }
};

// AI rewrite helper (SHORTNEWS_REWRITE)
export const aiRewriteShortNews = async (req: Request, res: Response) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { rawText, title } = req.body || {};
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return res.status(400).json({ success: false, error: 'rawText is required' });
    }
    // Determine language from user principal
    const languageId = (req.user as any).languageId;
    if (!languageId) return res.status(400).json({ success: false, error: 'User language not set' });
    const lang = await prismaClient.language.findUnique({ where: { id: languageId } });
    const languageCode = lang?.code || 'en';
    const tpl = await getPrompt('SHORTNEWS_REWRITE' as any);
    const prompt = renderPrompt(tpl, { languageCode, title: title || '', content: rawText });
  const aiJsonRes = await aiGenerateText({ prompt, purpose: 'rewrite' });
    const aiJson = String(aiJsonRes?.text || '');
    if (!aiJson) return res.status(500).json({ success: false, error: 'AI rewrite failed' });
    let parsed: any;
    try {
      const cleaned = aiJson.trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({ success: false, error: 'AI returned invalid JSON' });
    }
    if (!parsed || typeof parsed.title !== 'string' || typeof parsed.content !== 'string') {
      return res.status(500).json({ success: false, error: 'AI output malformed' });
    }
    // Enforce limits after AI output
    const wordCount = parsed.content.trim().split(/\s+/).length;
    if (parsed.title.length > 35) parsed.title = parsed.title.slice(0, 35).trim();
    if (wordCount > 60) {
      const trimmedWords = parsed.content.trim().split(/\s+/).slice(0, 60);
      parsed.content = trimmedWords.join(' ');
    }
    return res.json({ success: true, data: { title: parsed.title, content: parsed.content, languageCode } });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to rewrite short news' });
  }
};

// Optional AI SEO generation using centralized prompts and provider abstraction
async function generateSeoWithAI(
  title: string,
  content: string,
  languageCode: string,
  imageUrls: string[] = []
): Promise<{ metaTitle: string; metaDescription: string; tags: string[]; altTexts?: Record<string, string> } | null> {
  try {
    if (!aiEnabledFor('seo')) return null;
    const tpl = await getPrompt('SEO_GENERATION');
    const prompt = renderPrompt(tpl, {
      languageCode,
      title,
      content: content.slice(0, 1000),
      images: imageUrls,
    });
    const textRes = await aiGenerateText({ prompt, purpose: 'seo' });
    const text = String(textRes?.text || '');
    if (!text) return null;
    const jsonText = text.trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
    const parsed = JSON.parse(jsonText);
    if (parsed && typeof parsed.metaTitle === 'string' && typeof parsed.metaDescription === 'string' && Array.isArray(parsed.tags)) {
      return {
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
        tags: parsed.tags.slice(0, 10).map((t: any) => String(t)),
        altTexts: parsed.altTexts && typeof parsed.altTexts === 'object' ? parsed.altTexts : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const prisma = new PrismaClient();

export const createShortNews = async (req: Request, res: Response) => {
  try {
  const { title, content, mediaUrls, latitude, longitude, address, categoryId, tags,
    accuracyMeters, provider, timestampUtc, placeId, placeName, source, headings, h2, h3, templateId } = req.body;
    if (!req.user || typeof req.user !== 'object' || !('id' in req.user)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    if (!content || !categoryId || !title) {
      return res.status(400).json({ success: false, error: 'title, content and categoryId are required.' });
    }
    // Enforce location: latitude and longitude are mandatory for short news
    const latNum = typeof latitude === 'string' ? Number(latitude) : latitude;
    const lonNum = typeof longitude === 'string' ? Number(longitude) : longitude;
    if (
      latNum === undefined || lonNum === undefined ||
      latNum === null || lonNum === null ||
      Number.isNaN(Number(latNum)) || Number.isNaN(Number(lonNum)) ||
      Number(latNum) < -90 || Number(latNum) > 90 ||
      Number(lonNum) < -180 || Number(lonNum) > 180
    ) {
      return res.status(400).json({ success: false, error: 'latitude and longitude are required and must be valid coordinates.' });
    }
    if (content.trim().split(/\s+/).length > 60) {
      return res.status(400).json({ success: false, error: 'Content must be 60 words or less.' });
    }
    const authorId = (req.user as { id: string }).id;
    const languageId = (req.user as { languageId?: string }).languageId;
    if (!languageId) {
      return res.status(400).json({ success: false, error: 'User language is not set' });
    }
  // Slug: always auto-generate from title (ignore client-provided slug)
  const slugSource = String(title);
  // Create ASCII slug using transliteration (no Unicode in slug)
    const transliteratedSlug = transliterate(slugSource)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
    const slug = `${transliteratedSlug}-${Date.now().toString().slice(-6)}`;
    // AI SEO enrichment (stub, replace with real AI call)
    const initialSeo = {
      metaTitle: title,
      metaDescription: content.slice(0, 150),
      tags: Array.isArray(tags) ? tags : [],
    };
    const titleToSave = title;

    // Lookup language details for response and for SEO
    const lang: Language | null = await prisma.language.findUnique({ where: { id: languageId } });
    const languageCode = lang?.code || 'en';

    // Optional AI SEO enrichment
  const imageCandidates: string[] = Array.isArray(mediaUrls) ? mediaUrls.filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u)) : [];
  const videoCandidates: string[] = Array.isArray(mediaUrls) ? mediaUrls.filter((u: string) => /\.(webm|mp4|mov|ogg)$/i.test(u)) : [];

  const aiSeo = await generateSeoWithAI(titleToSave, content, languageCode, imageCandidates);
    const combinedTags = Array.from(new Set([...(Array.isArray(tags) ? tags : []), ...((aiSeo?.tags ?? []) as string[])]));
    const finalSeo = aiSeo ?? {
      metaTitle: titleToSave,
      metaDescription: content.slice(0, 160),
      tags: combinedTags,
      altTexts: imageCandidates.reduce((acc: Record<string,string>, url) => { acc[url] = titleToSave; return acc; }, {}),
    };

    // AI moderation stub: flag plagiarism/sensitive content and decide status
    let aiRemark: string | undefined;
    let aiPlagiarism: any = null;
    let aiSensitive: any = null;
    let initialStatus: string = 'PENDING';
    try {
      const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
      if (apiKey) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const modPrompt = `Content moderation for news. Analyze the text below for plagiarism likelihood and sensitive content (violence, hate, adult, personal data). Provide STRICT JSON with keys: plagiarismScore (0-1), sensitiveFlags (string[]), decision ('ALLOW'|'REVIEW'|'BLOCK'), remark (short in ${languageCode}). Text: ${content.slice(0, 2000)}`;
        const modRes = await model.generateContent(modPrompt);
        const text = (modRes?.response?.text && modRes.response.text()) || '';
        const jsonText = text.trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
        const parsed = JSON.parse(jsonText);
        aiPlagiarism = { score: parsed?.plagiarismScore ?? null };
        aiSensitive = { flags: Array.isArray(parsed?.sensitiveFlags) ? parsed.sensitiveFlags : [] };
        if (parsed?.decision === 'BLOCK') {
          initialStatus = 'REJECTED';
          aiRemark = parsed?.remark || 'Blocked by AI';
        } else if (parsed?.decision === 'REVIEW') {
          initialStatus = 'DESK_PENDING';
          aiRemark = parsed?.remark || 'Needs desk review';
        } else {
          initialStatus = 'AI_APPROVED';
        }
      } else {
        initialStatus = 'DESK_PENDING';
      }
    } catch {
      initialStatus = 'DESK_PENDING';
    }

    // Moderation via centralized prompt/provider if enabled (overrides previous initialStatus if available)
    try {
      if (aiEnabledFor('moderation')) {
        const tpl = await getPrompt('MODERATION');
        const prompt = renderPrompt(tpl, { languageCode, content: content.slice(0, 2000) });
        const outRes = await aiGenerateText({ prompt, purpose: 'moderation' });
        const out = String(outRes?.text || '');
        if (out) {
          const jsonText = out.trim().replace(/^```(json)?/i, '').replace(/```$/,'').trim();
          const parsed = JSON.parse(jsonText);
          aiPlagiarism = { score: parsed?.plagiarismScore ?? null };
          aiSensitive = { flags: Array.isArray(parsed?.sensitiveFlags) ? parsed.sensitiveFlags : [] };
          const decision = String(parsed?.decision || 'REVIEW').toUpperCase();
          aiRemark = typeof parsed?.remark === 'string' ? parsed.remark : undefined;
          if (decision === 'ALLOW') initialStatus = 'AI_APPROVED';
          else if (decision === 'BLOCK') initialStatus = 'REJECTED';
          else initialStatus = 'DESK_PENDING';
        }
      }
    } catch {
      // ignore moderation failure, keep prior initialStatus
    }

    // Build canonical URL and JSON-LD for SEO
    const canonicalUrl = buildCanonicalUrl(languageCode, slug, 'short');
    const jsonLd = buildNewsArticleJsonLd({
      headline: titleToSave,
      description: finalSeo.metaDescription,
      canonicalUrl,
      imageUrls: imageCandidates.slice(0, 5),
      languageCode,
      datePublished: new Date(),
      dateModified: new Date(),
      authorName: undefined,
      publisherName: process.env.SEO_PUBLISHER_NAME,
      publisherLogoUrl: process.env.SEO_PUBLISHER_LOGO,
      videoUrl: videoCandidates[0],
      videoThumbnailUrl: imageCandidates[0],
    });

    const normalizedHeadings = normalizeHeadings(headings, h2, h3);

    const shortNews = await (prisma as any).shortNews.create({
      data: {
        title: titleToSave,
        slug,
        content,
        authorId,
        categoryId,
        tags: combinedTags,
        seo: { ...finalSeo, jsonLd },
  headings: normalizedHeadings || undefined,
  templateId: typeof templateId === 'string' && templateId.trim() ? templateId.trim() : undefined,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
        latitude: Number(latNum),
        longitude: Number(lonNum),
        address: address || null,
        accuracyMeters: typeof accuracyMeters === 'number' ? accuracyMeters : (accuracyMeters != null ? Number(accuracyMeters) : null),
        provider: provider || null,
        timestampUtc: timestampUtc ? new Date(timestampUtc) : null,
        placeId: placeId || null,
        placeName: placeName || null,
        source: source || null,
        language: languageId,
        status: initialStatus,
        aiRemark,
        aiPlagiarism,
        aiSensitive,
      },
    });
    // If AI directly approved, push notification immediately
    try {
      if (initialStatus === 'AI_APPROVED') {
        const primaryImage = imageCandidates[0];
        const titleText = titleToSave;
        const bodyText = content.slice(0, 120);
        const dataPayload = { type: 'shortnews', shortNewsId: shortNews.id, url: canonicalUrl } as Record<string, string>;
        if (languageCode) {
          await sendToTopic(`news-lang-${languageCode.toLowerCase()}`, { title: titleText, body: bodyText, image: primaryImage, data: dataPayload });
        }
        if (categoryId) {
          await sendToTopic(`news-cat-${String(categoryId).toLowerCase()}`, { title: titleText, body: bodyText, image: primaryImage, data: dataPayload });
        }
      }
    } catch (e) {
      console.warn('FCM send failed on AI approval (non-fatal):', e);
    }
    res.status(201).json({
      success: true,
      data: {
        ...shortNews,
        transliteratedSlug,
        languageId,
        languageName: lang?.name ?? null,
        languageCode: lang?.code ?? null,
        languageInfo: lang ? { id: lang.id, code: lang.code, name: lang.name, nativeName: lang.nativeName } : null,
        canonicalUrl,
        seo: shortNews.seo,
      },
    });
  } catch (error: any) {
    // Differentiate known Prisma validation/foreign key errors vs generic failure
    const message = (error && typeof error === 'object' && (error.message || (error as any).code)) ? String(error.message || (error as any).code) : 'Failed to submit short news';
    // Log full error server-side for observability
    console.error('[createShortNews] Error:', message, '\nStack:', error?.stack);
    // Heuristic mapping for cleaner client messages
    let clientMsg = 'Failed to submit short news';
    if (/foreign key|relation|not found/i.test(message)) clientMsg = 'Invalid categoryId or related reference';
    else if (/Unique constraint/i.test(message)) clientMsg = 'Duplicate value constraint violated';
    else if (/JSON|Unexpected token/i.test(message)) clientMsg = 'AI moderation parsing failed';
    else if (/timeout/i.test(message)) clientMsg = 'Upstream AI/service timeout';
    // In development, expose the raw message to help debugging
    const isDev = process.env.NODE_ENV !== 'production';
    return res.status(400).json({ success: false, error: clientMsg, detail: isDev ? message : undefined });
  }
};

export const getShortNewsJsonLd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.shortNews.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    const lang = await prisma.language.findUnique({ where: { id: item.language as any } });
    const languageCode = lang?.code || 'en';
    const canonicalUrl = buildCanonicalUrl(languageCode, item.slug || item.id, 'short');
    const imgs = (item.mediaUrls || []).filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u));
    const vids = (item.mediaUrls || []).filter((u: string) => /\.(webm|mp4|mov|ogg)$/i.test(u));
    const jsonLd = buildNewsArticleJsonLd({
      headline: item.title,
      description: (item.seo as any)?.metaDescription || item.content?.slice(0, 160),
      canonicalUrl,
      imageUrls: imgs.slice(0, 5),
      languageCode,
      datePublished: item.createdAt,
      dateModified: item.updatedAt,
      videoUrl: vids[0],
      videoThumbnailUrl: imgs[0],
    });
    return res.json(jsonLd);
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to build JSON-LD' });
  }
};

export const listShortNews = async (req: Request, res: Response) => {
  try {
    const user = req.user as Express.User;
    if (!user?.id) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // inputs: limit and cursor (base64 JSON { id, date })
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const cursorRaw = (req.query.cursor as string) || '';
    let cursor: { id: string; date: string } | null = null;
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.date === 'string') {
          cursor = { id: parsed.id, date: parsed.date };
        }
      } catch (_) {
        // ignore bad cursor
      }
    }

    const languageId = user.languageId;
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const where: any = all ? {} : { language: languageId };
    // Prefetch pool: optionally global when all=true; include author for ownership + future role-based filtering
    const seed = await prisma.shortNews.findMany({
      where,
      include: {
        author: {
          select: {
            id: true,
            email: true,
            mobileNumber: true,
            role: { select: { name: true } },
            profile: { select: { fullName: true, profilePhotoUrl: true } },
          },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(limit * 10, 200),
    });
    const collection = seed;

    // apply cursor (items strictly after cursor in our desc ordering => older than cursor)
    const afterCursor = cursor
      ? collection.filter((item) => {
          const itemDate = item.createdAt instanceof Date ? item.createdAt : new Date(item.createdAt as any);
          const cursorDate = new Date(cursor!.date);
          return itemDate < cursorDate || (itemDate.getTime() === cursorDate.getTime() && item.id < cursor!.id);
        })
      : collection;

  // take next N and compute next cursor
  const slice = afterCursor.slice(0, limit);
  // enrich with language name and code
  const langIds = Array.from(new Set(slice.map((i) => i.language).filter((x): x is string => !!x)));
  const langs = await prisma.language.findMany({ where: { id: { in: langIds } } });
  const langMap = new Map(langs.map((l) => [l.id, l]));
  // fetch category translations and base names for categoryName
  const categoryIds = Array.from(new Set(slice.map((i: any) => i.categoryId).filter((x: any) => !!x)));
  const [catTranslations, cats] = await Promise.all([
    prisma.categoryTranslation.findMany({ where: { categoryId: { in: categoryIds }, language: languageId as any } }),
    prisma.category.findMany({ where: { id: { in: categoryIds } } }),
  ]);
  const catNameById = new Map<string, string>();
  for (const ct of catTranslations) catNameById.set(ct.categoryId, ct.name);
  for (const c of cats) if (!catNameById.has(c.id)) catNameById.set(c.id, c.name);
  // fetch authors' latest user location for placeName/address if available
  const authorIds = Array.from(new Set(slice.map((i: any) => i.authorId).filter((x: any) => !!x)));
  const authorLocs = await prisma.userLocation.findMany({ where: { userId: { in: authorIds } } });
  const authorLocByUser = new Map(authorLocs.map((l) => [l.userId, l]));
    // Pre-fetch read markers for current user (ShortNewsRead)
    let readSet: Set<string> = new Set();
    if (slice.length) {
      const readRows = await prisma.shortNewsRead.findMany({
        where: { userId: user.id, shortNewsId: { in: slice.map((i: any) => i.id) } },
        select: { shortNewsId: true },
      });
      readSet = new Set(readRows.map(r => r.shortNewsId));
    }

    const last = slice[slice.length - 1];
    const hasMore = afterCursor.length > limit;
    const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64') : null;

    const data = slice.map((i: any) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      const categoryName = i.categoryId ? catNameById.get(i.categoryId) ?? null : null;
      const author = i.author as any;
  const authorName = author?.profile?.fullName || author?.email || author?.mobileNumber || null; // prefer fullName
      const loc = authorLocByUser.get(i.authorId) as any;
      const placeName = i.placeName ?? (loc as any)?.placeName ?? null;
      const address = i.address ?? (loc as any)?.address ?? null;
      const isOwner = i.authorId === user.id;
      const isRead = readSet.has(i.id);
      return {
        ...i,
        // Ensure mediaUrls always present as array
        mediaUrls: Array.isArray(i.mediaUrls) ? i.mediaUrls : [],
        languageId: i.language ?? null,
        languageName: l?.name ?? null,
        languageCode: l?.code ?? null,
        categoryName,
        // Backward compatibility: keep authorName at top level
        authorName,
        author: {
          id: author?.id || null,
            fullName: author?.profile?.fullName || null,
            profilePhotoUrl: author?.profile?.profilePhotoUrl || null,
            email: author?.email || null,
            mobileNumber: author?.mobileNumber || null,
            roleName: author?.role?.name || null,
            reporterType: author?.role?.name || null,
        },
        isOwner,
        isRead,
        placeName,
        address,
        latitude: i.latitude ?? null,
        longitude: i.longitude ?? null,
        accuracyMeters: i.accuracyMeters ?? null,
        provider: i.provider ?? null,
        timestampUtc: i.timestampUtc ?? null,
        placeId: i.placeId ?? null,
        source: i.source ?? null,
      } as any;
    });

    return res.status(200).json({
      success: true,
      pageInfo: { limit, nextCursor, hasMore },
      data,
    });
  } catch (error) {
    console.error('Failed to fetch short news:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch short news' });
  }
};

export const updateShortNewsStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, aiRemark } = req.body;
    const updated = await prisma.shortNews.update({
      where: { id },
      data: { status, aiRemark },
    });
    // Push notification on approval transitions
    try {
      const approvedStatuses = new Set(['AI_APPROVED', 'DESK_APPROVED']);
      if (approvedStatuses.has(String(status))) {
        // Build notification payload
        const mediaUrls = Array.isArray((updated as any).mediaUrls) ? (updated as any).mediaUrls : [];
        const imageUrls = mediaUrls.filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u));
        const primaryImage = imageUrls[0];
        // Resolve language code for topics and canonical URL
        let languageCode = 'en';
        if (updated.language) {
          const lang = await prisma.language.findUnique({ where: { id: updated.language as any } });
          if (lang?.code) languageCode = lang.code;
        }
        const canonicalUrl = buildCanonicalUrl(languageCode, updated.slug || updated.id, 'short');
        const titleText = updated.title;
        const bodyText = (updated.content || '').slice(0, 120);
        const dataPayload = { type: 'shortnews', shortNewsId: updated.id, url: canonicalUrl } as Record<string, string>;
        // Send to language topic and category topic (best-effort)
        try {
          if (languageCode) {
            await sendToTopic(`news-lang-${languageCode.toLowerCase()}`, { title: titleText, body: bodyText, image: primaryImage, data: dataPayload });
          }
          if ((updated as any).categoryId) {
            await sendToTopic(`news-cat-${String((updated as any).categoryId).toLowerCase()}`, { title: titleText, body: bodyText, image: primaryImage, data: dataPayload });
          }
        } catch (e) {
          console.warn('FCM send failed (non-fatal):', e);
        }
      }
    } catch (e) {
      console.warn('Notification error (non-fatal):', e);
    }
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update status' });
  }
};

// Update short news (author or desk/admin)
export const updateShortNews = async (req: Request, res: Response) => {
  try {
    if (!req.user || typeof req.user !== 'object' || !('id' in req.user)) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    const user = req.user as Express.User;
    const { id } = req.params;

    const existing = await prisma.shortNews.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, error: 'Not found' });

    // Authorization: author can edit unless DESK_APPROVED; desk/admin can always edit
    const roleName = user?.role?.name || '';
    const isDesk = ['NEWS_DESK', 'NEWS_DESK_ADMIN', 'LANGUAGE_ADMIN', 'SUPERADMIN'].includes(roleName);
    const isAuthor = existing.authorId === user.id;
    if (!isDesk && !isAuthor) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (!isDesk && existing.status === 'DESK_APPROVED') {
      return res.status(400).json({ success: false, error: 'Approved items can only be edited by desk/admin' });
    }

    const {
      title,
      content,
      categoryId,
      tags,
      mediaUrls,
      latitude,
      longitude,
      address,
      accuracyMeters,
      provider,
      timestampUtc,
      placeId,
      placeName,
      source,
      headings,
      h2,
      h3,
      templateId,
    } = req.body || {};

    // Validate optional lat/lon if provided
    const hasLat = latitude !== undefined && latitude !== null && latitude !== '';
    const hasLon = longitude !== undefined && longitude !== null && longitude !== '';
    if (hasLat || hasLon) {
      const latNum = typeof latitude === 'string' ? Number(latitude) : latitude;
      const lonNum = typeof longitude === 'string' ? Number(longitude) : longitude;
      if (
        latNum === undefined || lonNum === undefined ||
        latNum === null || lonNum === null ||
        Number.isNaN(Number(latNum)) || Number.isNaN(Number(lonNum)) ||
        Number(latNum) < -90 || Number(latNum) > 90 ||
        Number(lonNum) < -180 || Number(lonNum) > 180
      ) {
        return res.status(400).json({ success: false, error: 'latitude and longitude must be valid coordinates.' });
      }
    }

    // Optional: keep slug unchanged on updates
    const data: any = {};
    if (typeof title === 'string' && title.trim()) data.title = title.trim();
    if (typeof content === 'string' && content.trim()) {
      if (content.trim().split(/\s+/).length > 60) {
        return res.status(400).json({ success: false, error: 'Content must be 60 words or less.' });
      }
      data.content = content.trim();
    }
    if (typeof categoryId === 'string' && categoryId.trim()) data.categoryId = categoryId.trim();
    if (Array.isArray(tags)) data.tags = tags.map((t: any) => String(t));
    if (Array.isArray(mediaUrls)) data.mediaUrls = mediaUrls.map((u: any) => String(u));
    if (hasLat) data.latitude = Number(latitude);
    if (hasLon) data.longitude = Number(longitude);
    if (address !== undefined) data.address = address || null;
    if (accuracyMeters !== undefined) data.accuracyMeters = accuracyMeters != null ? Number(accuracyMeters) : null;
    if (provider !== undefined) data.provider = provider || null;
    if (timestampUtc !== undefined) data.timestampUtc = timestampUtc ? new Date(timestampUtc) : null;
    if (placeId !== undefined) data.placeId = placeId || null;
    if (placeName !== undefined) data.placeName = placeName || null;
    if (source !== undefined) data.source = source || null;
  if (templateId === null) data.templateId = null;
  else if (templateId !== undefined) data.templateId = String(templateId).trim() || null;

    if (headings === null) {
      data.headings = null;
    } else if (headings !== undefined || h2 !== undefined || h3 !== undefined) {
      const norm = normalizeHeadings(headings, h2, h3);
      if (norm) data.headings = norm; else data.headings = null;
    }

  const updated = await (prisma as any).shortNews.update({ where: { id }, data });
    return res.status(200).json({ success: true, data: updated });
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Failed to update short news' });
  }
};

// Public feed: DESK_APPROVED and AI_APPROVED items, requires languageId query param
export const listApprovedShortNews = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const cursorRaw = (req.query.cursor as string) || '';
    const qLanguageId = (req.query.languageId as string) || '';
    const qLanguageCode = (req.query.languageCode as string) || '';
    const languageKey = (qLanguageId || qLanguageCode).trim();
    // Optional language filter: if provided, validate exists; else show all languages
    let cursor: { id: string; date: string } | null = null;
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.date === 'string') {
          cursor = { id: parsed.id, date: parsed.date };
        }
      } catch {}
    }
    // Validate language filter if provided (accept either language id or language code)
    let filterLang: any = null;
    if (languageKey) {
      filterLang = await prisma.language.findFirst({ where: { OR: [{ id: languageKey }, { code: languageKey }] } });
      if (!filterLang) {
        return res.status(400).json({ success: false, error: 'Invalid languageId/languageCode' });
      }
    }
    const where: any = { status: { in: ['DESK_APPROVED', 'AI_APPROVED', 'PUBLISHED'] } };
    // ShortNews.language is a string (historically may store either Language.id or Language.code)
    if (filterLang) where.language = { in: [filterLang.id, filterLang.code] };

    // Optional geo filter: if both lat and lon provided, filter within ~30km radius
    const latStr = (req.query.latitude as string) || '';
    const lonStr = (req.query.longitude as string) || '';
    let centerLat: number | null = null;
    let centerLon: number | null = null;
    if (latStr && lonStr) {
      const latNum = Number(latStr);
      const lonNum = Number(lonStr);
      if (
        Number.isFinite(latNum) && Number.isFinite(lonNum) &&
        latNum >= -90 && latNum <= 90 && lonNum >= -180 && lonNum <= 180
      ) {
        centerLat = latNum;
        centerLon = lonNum;
      } else {
        return res.status(400).json({ success: false, error: 'Invalid latitude/longitude' });
      }
    }
    const items = await prisma.shortNews.findMany({
      where,
      include: {
        author: { 
          select: { 
            id: true, 
            email: true, 
            mobileNumber: true, 
            role: { select: { name: true } }, 
            profile: { select: { fullName: true, profilePhotoUrl: true } },
            reporterProfile: {
              select: {
                id: true,
                tenantId: true,
                tenant: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    theme: { select: { logoUrl: true, faviconUrl: true } },
                    entity: { select: { nativeName: true, languageId: true } },
                    domains: { where: { isPrimary: true }, take: 1, select: { domain: true } }
                  }
                }
              }
            }
          } 
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(limit * 10, 200),
    });
    // apply optional geo-radius filtering (first bounding box for speed, then precise haversine <= 30km)
    const R_KM = 6371; // Earth radius
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = toRad(lat2 - lat1);
      const dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R_KM * c;
    };
    let geoFiltered = items;
    if (centerLat != null && centerLon != null) {
      const deltaLat = 30 / 111; // ~1 deg lat ~111km
      const latRad = toRad(centerLat);
      const cosLat = Math.max(0.000001, Math.cos(latRad));
      const deltaLon = 30 / (111 * cosLat);
      const minLat = centerLat - deltaLat;
      const maxLat = centerLat + deltaLat;
      const minLon = centerLon - deltaLon;
      const maxLon = centerLon + deltaLon;
      geoFiltered = items.filter((i: any) => {
        const lat = i.latitude;
        const lon = i.longitude;
        if (lat == null || lon == null) return false;
        if (lat < minLat || lat > maxLat || lon < minLon || lon > maxLon) return false;
        return haversineKm(centerLat!, centerLon!, lat, lon) <= 30;
      });
    }
    const filtered = cursor
      ? geoFiltered.filter((i) => {
          const d = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt as any);
          const cd = new Date(cursor!.date);
          return d < cd || (d.getTime() === cd.getTime() && i.id < cursor!.id);
        })
      : geoFiltered;
    const slice = filtered.slice(0, limit);
    const last = slice[slice.length - 1];
    const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64') : null;
    // attach language info (support both stored id and stored code)
    const langKeys = Array.from(new Set(slice.map((i) => i.language).filter((x): x is string => !!x)));
    const langs = await prisma.language.findMany({
      where: {
        OR: [{ id: { in: langKeys } }, { code: { in: langKeys } }],
      },
    });
    const langMap = new Map<string, any>();
    for (const l of langs) {
      langMap.set(l.id, l);
      langMap.set(l.code, l);
    }
    const sliceLangCodes = Array.from(
      new Set(
        slice
          .map((i: any) => {
            const l = i.language ? langMap.get(i.language as any) : undefined;
            return (l?.code || i.language || '').trim() || null;
          })
          .filter((x: any): x is string => !!x)
      )
    );
    // category names (language-aware: use each item's language)
    const categoryIds = Array.from(new Set(slice.map((i: any) => i.categoryId).filter((x: any) => !!x)));
    const [catTranslations, cats] = await Promise.all([
      prisma.categoryTranslation.findMany({ where: { categoryId: { in: categoryIds }, language: { in: sliceLangCodes as any } } }),
      prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    ]);
    const catNameById = new Map<string, string>();
    const catNameByCatLang = new Map<string, string>();
    for (const ct of catTranslations) {
      catNameById.set(ct.categoryId, ct.name);
      catNameByCatLang.set(`${ct.categoryId}:${ct.language}`, ct.name);
    }
    for (const c of cats) if (!catNameById.has(c.id)) catNameById.set(c.id, c.name);
    // author locations
    const authorIds = Array.from(new Set(slice.map((i: any) => i.authorId).filter((x: any) => !!x)));
    const authorLocs = await prisma.userLocation.findMany({ where: { userId: { in: authorIds } } });
    const authorLocByUser = new Map(authorLocs.map((l) => [l.userId, l]));
    // read markers if user context (optional auth bearer). We accept optional user on public feed.
  const user = (req as any).user as Express.User | undefined;
    let readSet: Set<string> = new Set();
    if (user && slice.length) {
      const readRows = await prisma.shortNewsRead.findMany({
        where: { userId: user.id, shortNewsId: { in: slice.map((s: any) => s.id) } },
        select: { shortNewsId: true },
      });
      readSet = new Set(readRows.map(r => r.shortNewsId));
    }
    const data = slice.map((i: any) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      const resolvedLangCode = (l?.code || i.language || '').trim() || null;
  const categoryName = i.categoryId ? (catNameByCatLang.get(`${i.categoryId}:${resolvedLangCode}`) ?? catNameById.get(i.categoryId) ?? null) : null;
  const author = i.author as any;
  const authorName = author?.profile?.fullName || author?.email || author?.mobileNumber || null;
      const loc = authorLocByUser.get(i.authorId) as any;
      const placeName = i.placeName ?? (loc as any)?.placeName ?? null;
      const address = i.address ?? (loc as any)?.address ?? null;
      // derive canonical url and primary media
      const canonicalLangCode = resolvedLangCode || 'en';
      const canonicalUrl = buildCanonicalUrl(canonicalLangCode, i.slug || i.id, 'short');
      const mediaUrls = Array.isArray(i.mediaUrls) ? i.mediaUrls : [];
      const imageUrls = mediaUrls.filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u));
      const videoUrls = mediaUrls.filter((u: string) => /\.(webm|mp4|mov|ogg)$/i.test(u));
      const primaryImageUrl = imageUrls[0] || null;
      const primaryVideoUrl = videoUrls[0] || null;
      // ensure jsonLd exists (fallback build if missing)
      let jsonLd: any = (i.seo as any)?.jsonLd;
      if (!jsonLd) {
        jsonLd = buildNewsArticleJsonLd({
          headline: i.title,
          description: ((i.seo as any)?.metaDescription || i.content?.slice(0, 160)),
          canonicalUrl,
          imageUrls: imageUrls.slice(0, 5),
          languageCode: canonicalLangCode,
          datePublished: i.createdAt,
          dateModified: i.updatedAt,
          videoUrl: primaryVideoUrl || undefined,
          videoThumbnailUrl: primaryImageUrl || undefined,
        });
      }
      const isOwner = user ? i.authorId === user.id : false;
      const isRead = user ? readSet.has(i.id) : false;

      // Extract tenant info from reporter profile
      const reporterProfile = author?.reporterProfile as any;
      const tenantData = reporterProfile?.tenant;
      const tenantInfo = tenantData ? {
        id: tenantData.id,
        name: tenantData.name,
        slug: tenantData.slug,
        domain: tenantData.domains?.[0]?.domain || null,
        language: resolvedLangCode,
        logoUrl: tenantData.theme?.logoUrl || null,
        faviconUrl: tenantData.theme?.faviconUrl || null,
        nativeName: tenantData.entity?.nativeName || null,
      } : null;

      // Build SEO object
      const seoData = i.seo as any;
      const seo = {
        title: seoData?.metaTitle || `${i.title} | ${tenantInfo?.name || 'News'}`,
        description: seoData?.metaDescription || i.content?.slice(0, 160) || '',
        keywords: seoData?.keywords || i.tags || [],
        ogTitle: seoData?.ogTitle || i.title,
        ogDescription: seoData?.ogDescription || i.content?.slice(0, 160) || '',
        ogImage: primaryImageUrl || seoData?.ogImage || null,
      };

      // Image alt text
      const imageAlt = seoData?.imageAlt || (i.title ? `${i.title} - ${categoryName || 'News'}` : null);

      return {
        ...i,
        // Ensure slug is always present
        slug: i.slug || null,
        // Ensure mediaUrls always present as array
        mediaUrls,
        primaryImageUrl,
        primaryVideoUrl,
        featuredImage: i.featuredImage || primaryImageUrl || null,
        imageAlt,
        canonicalUrl,
        jsonLd,
        // SEO object
        seo,
        // Timestamp
        timestampUtc: i.timestampUtc || i.createdAt?.toISOString() || null,
        languageId: l?.id ?? null,
        languageName: l?.name ?? null,
        languageCode: resolvedLangCode,
        categoryName,
        authorName,
        author: {
          id: author?.id || null,
          fullName: author?.profile?.fullName || null,
          profilePhotoUrl: author?.profile?.profilePhotoUrl || null,
          email: author?.email || null,
          mobileNumber: author?.mobileNumber || null,
          roleName: author?.role?.name || null,
          reporterType: author?.role?.name || null,
        },
        // Tenant info with brand logo
        tenant: tenantInfo,
        // Source/Provider
        source: i.source || (tenantInfo?.name ? `${tenantInfo.name} Reporter` : null),
        provider: i.provider || tenantInfo?.name || null,
        isOwner,
        isRead,
        placeName,
        address,
        latitude: i.latitude ?? null,
        longitude: i.longitude ?? null,
        accuracyMeters: i.accuracyMeters ?? null,
        placeId: i.placeId ?? null,
      } as any;
    });
    return res.json({ success: true, pageInfo: { limit, nextCursor, hasMore: filtered.length > limit }, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch approved short news' });
  }
};

export const getApprovedShortNewsById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ShortNews ID is required' });
    }

    // Find the short news item - must be approved to be publicly accessible
    const item = await prisma.shortNews.findUnique({
      where: { id },
      include: {
        author: { 
          select: { 
            id: true, 
            email: true, 
            mobileNumber: true, 
            role: { select: { name: true } }, 
            profile: { select: { fullName: true, profilePhotoUrl: true } },
            reporterProfile: {
              select: {
                id: true,
                tenantId: true,
                tenant: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    theme: { select: { logoUrl: true, faviconUrl: true } },
                    entity: { select: { nativeName: true, languageId: true } },
                    domains: { where: { isPrimary: true }, take: 1, select: { domain: true } }
                  }
                }
              }
            }
          } 
        },
      },
    });

    if (!item) {
      return res.status(404).json({ success: false, error: 'ShortNews not found' });
    }

    // Only approved items are publicly accessible
    if (!['DESK_APPROVED', 'AI_APPROVED'].includes(item.status as string)) {
      return res.status(404).json({ success: false, error: 'ShortNews not found' });
    }

    // Get language info (support stored id or stored code)
    const lang = item.language ? await prisma.language.findFirst({ where: { OR: [{ id: item.language as any }, { code: item.language as any }] } }) : null;

    // Get category name (in the item's language if available)
    let categoryName: string | null = null;
    if (item.categoryId) {
      const catTranslation = await prisma.categoryTranslation.findUnique({
        where: { categoryId_language: { categoryId: item.categoryId, language: item.language as any } }
      });
      if (catTranslation) {
        categoryName = catTranslation.name;
      } else {
        // Fallback to category default name
        const cat = await prisma.category.findUnique({ where: { id: item.categoryId } });
        categoryName = cat?.name || null;
      }
    }

    // Get author location for place/address fallback
    let authorLoc: any = null;
    if (item.authorId) {
      authorLoc = await prisma.userLocation.findUnique({ where: { userId: item.authorId } });
    }

    // Check if requesting user has read this (optional auth)
    const user = (req as any).user as Express.User | undefined;
    let isRead = false;
    let isOwner = false;
    if (user) {
      isOwner = item.authorId === user.id;
      const readRecord = await prisma.shortNewsRead.findUnique({
        where: { userId_shortNewsId: { userId: user.id, shortNewsId: item.id } }
      });
      isRead = !!readRecord;
    }

    // Build enriched response (same format as public list)
    const author = item.author as any;
    const authorName = author?.profile?.fullName || author?.email || author?.mobileNumber || null;
    const placeName = item.placeName ?? authorLoc?.placeName ?? null;
    const address = item.address ?? authorLoc?.address ?? null;

    // Build canonical URL and media URLs
    const languageCode = lang?.code || (typeof item.language === 'string' && item.language ? item.language : 'en');
    const canonicalUrl = buildCanonicalUrl(languageCode, item.slug || item.id, 'short');
    const mediaUrls = Array.isArray(item.mediaUrls) ? item.mediaUrls : [];
    const imageUrls = mediaUrls.filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u));
    const videoUrls = mediaUrls.filter((u: string) => /\.(webm|mp4|mov|ogg)$/i.test(u));
    const primaryImageUrl = imageUrls[0] || null;
    const primaryVideoUrl = videoUrls[0] || null;

    // Build JSON-LD (fallback if missing)
    let jsonLd: any = (item.seo as any)?.jsonLd;
    if (!jsonLd) {
      jsonLd = buildNewsArticleJsonLd({
        headline: item.title,
        description: ((item.seo as any)?.metaDescription || item.content?.slice(0, 160)),
        canonicalUrl,
        imageUrls: imageUrls.slice(0, 5),
        languageCode,
        datePublished: item.createdAt,
        dateModified: item.updatedAt,
        videoUrl: primaryVideoUrl || undefined,
        videoThumbnailUrl: primaryImageUrl || undefined,
      });
    }

    // Extract tenant info from reporter profile
    const reporterProfile = author?.reporterProfile as any;
    const tenantData = reporterProfile?.tenant;
    const tenantInfo = tenantData ? {
      id: tenantData.id,
      name: tenantData.name,
      slug: tenantData.slug,
      domain: tenantData.domains?.[0]?.domain || null,
      language: languageCode,
      logoUrl: tenantData.theme?.logoUrl || null,
      faviconUrl: tenantData.theme?.faviconUrl || null,
      nativeName: tenantData.entity?.nativeName || null,
    } : null;

    // Build SEO object
    const seoData = item.seo as any;
    const seo = {
      title: seoData?.metaTitle || `${item.title} | ${tenantInfo?.name || 'News'}`,
      description: seoData?.metaDescription || item.content?.slice(0, 160) || '',
      keywords: seoData?.keywords || item.tags || [],
      ogTitle: seoData?.ogTitle || item.title,
      ogDescription: seoData?.ogDescription || item.content?.slice(0, 160) || '',
      ogImage: primaryImageUrl || seoData?.ogImage || null,
    };

    // Image alt text
    const imageAlt = seoData?.imageAlt || (item.title ? `${item.title} - ${categoryName || 'News'}` : null);

    const data = {
      ...item,
      // Ensure slug is always present
      slug: item.slug || null,
      mediaUrls,
      primaryImageUrl,
      primaryVideoUrl,
      featuredImage: item.featuredImage || primaryImageUrl || null,
      imageAlt,
      canonicalUrl,
      jsonLd,
      // SEO object
      seo,
      // Timestamp
      timestampUtc: item.timestampUtc || item.createdAt?.toISOString() || null,
      languageId: lang?.id ?? null,
      languageName: lang?.name ?? null,
      languageCode: lang?.code ?? (typeof item.language === 'string' ? item.language : null),
      categoryName,
      authorName,
      author: {
        id: author?.id || null,
        fullName: author?.profile?.fullName || null,
        profilePhotoUrl: author?.profile?.profilePhotoUrl || null,
        email: author?.email || null,
        mobileNumber: author?.mobileNumber || null,
        roleName: author?.role?.name || null,
        reporterType: author?.role?.name || null,
      },
      // Tenant info with brand logo
      tenant: tenantInfo,
      // Source/Provider
      source: item.source || (tenantInfo?.name ? `${tenantInfo.name} Reporter` : null),
      provider: item.provider || tenantInfo?.name || null,
      isOwner,
      isRead,
      placeName,
      address,
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      accuracyMeters: item.accuracyMeters ?? null,
      placeId: item.placeId ?? null,
    };

    return res.json({ success: true, data });
  } catch (e) {
    console.error('Failed to fetch short news by ID:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch short news' });
  }
};

// Moderation/status-wise listing: citizens see their own by status; desk/admin see language-wide by status
export const listShortNewsByStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user as Express.User;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const status = (req.query.status as string) || undefined;
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const cursorRaw = (req.query.cursor as string) || '';
    let cursor: { id: string; date: string } | null = null;
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.date === 'string') {
          cursor = { id: parsed.id, date: parsed.date };
        }
      } catch {}
    }
    const roleName = user?.role?.name || '';
    const where: any = {};
    if (status) where.status = status;
    if (roleName === 'NEWS_DESK' || roleName === 'NEWS_DESK_ADMIN' || roleName === 'LANGUAGE_ADMIN' || roleName === 'SUPERADMIN') {
      where.language = user.languageId; // show items in their language
    } else {
      where.authorId = user.id; // citizens only their own
    }
    const items = await prisma.shortNews.findMany({
      where,
      include: { author: { select: { id: true, email: true, mobileNumber: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(limit * 2, 100),
    });
    const filtered = cursor
      ? items.filter((i) => {
          const d = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt as any);
          const cd = new Date(cursor!.date);
          return d < cd || (d.getTime() === cd.getTime() && i.id < cursor!.id);
        })
      : items;
    const slice = filtered.slice(0, limit);
    const last = slice[slice.length - 1];
    const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64') : null;
    const langIds = Array.from(new Set(slice.map((i) => i.language).filter((x): x is string => !!x)));
    const langs = await prisma.language.findMany({ where: { id: { in: langIds } } });
    const langMap = new Map(langs.map((l) => [l.id, l]));
    // categories and authors enrich
    const categoryIds = Array.from(new Set(slice.map((i: any) => i.categoryId).filter((x: any) => !!x)));
    const [catTranslations, cats] = await Promise.all([
      prisma.categoryTranslation.findMany({ where: { categoryId: { in: categoryIds }, language: user.languageId as any } }),
      prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    ]);
    const catNameById = new Map<string, string>();
    for (const ct of catTranslations) catNameById.set(ct.categoryId, ct.name);
    for (const c of cats) if (!catNameById.has(c.id)) catNameById.set(c.id, c.name);
    const authorIds = Array.from(new Set(slice.map((i: any) => i.authorId).filter((x: any) => !!x)));
    const authorLocs = await prisma.userLocation.findMany({ where: { userId: { in: authorIds } } });
    const authorLocByUser = new Map(authorLocs.map((l) => [l.userId, l]));
    const data = slice.map((i: any) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      const categoryName = i.categoryId ? catNameById.get(i.categoryId) ?? null : null;
      const author = i.author as any;
      const authorName = author?.email || author?.mobileNumber || null;
      const loc = authorLocByUser.get(i.authorId) as any;
      const placeName = i.placeName ?? (loc as any)?.placeName ?? null;
      const address = i.address ?? (loc as any)?.address ?? null;
      return {
        ...i,
        // Ensure mediaUrls always present as array
        mediaUrls: Array.isArray(i.mediaUrls) ? i.mediaUrls : [],
        languageId: i.language ?? null,
        languageName: l?.name ?? null,
        languageCode: l?.code ?? null,
        categoryName,
        authorName,
        placeName,
        address,
        latitude: i.latitude ?? null,
        longitude: i.longitude ?? null,
        accuracyMeters: i.accuracyMeters ?? null,
        provider: i.provider ?? null,
        timestampUtc: i.timestampUtc ?? null,
        placeId: i.placeId ?? null,
        source: i.source ?? null,
      } as any;
    });
    return res.json({ success: true, pageInfo: { limit, nextCursor, hasMore: filtered.length > limit }, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch moderation list' });
  }
};

// Admin/Desk wide listing with optional filters and pagination
export const listAllShortNews = async (req: Request, res: Response) => {
  try {
    const user = req.user as Express.User;
    if (!user?.id) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const roleName = (user?.role?.name || '').toUpperCase();
    const isSuper = roleName === 'SUPERADMIN' || roleName === 'SUPER_ADMIN';

    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const cursorRaw = (req.query.cursor as string) || '';
    let cursor: { id: string; date: string } | null = null;
    if (cursorRaw) {
      try {
        const decoded = Buffer.from(cursorRaw, 'base64').toString('utf-8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed.id === 'string' && typeof parsed.date === 'string') {
          cursor = { id: parsed.id, date: parsed.date };
        }
      } catch {}
    }

    const where: any = {};
    const qLanguageId = (req.query.languageId as string) || undefined;
    const qStatus = (req.query.status as string) || undefined;
    const qCategoryId = (req.query.categoryId as string) || undefined;
    if (qStatus) where.status = qStatus;
    if (qCategoryId) where.categoryId = qCategoryId;
    if (isSuper) {
      if (qLanguageId) where.language = qLanguageId;
    } else {
      // Non-super roles are scoped to their own language
      where.language = user.languageId as any;
    }

    const items = await prisma.shortNews.findMany({
      where,
      include: {
        author: {
          select: { id: true, email: true, mobileNumber: true, role: { select: { name: true } } },
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(limit * 2, 100),
    });

    const filtered = cursor
      ? items.filter((i) => {
          const d = i.createdAt instanceof Date ? i.createdAt : new Date(i.createdAt as any);
          const cd = new Date(cursor!.date);
          return d < cd || (d.getTime() === cd.getTime() && i.id < cursor!.id);
        })
      : items;

    const slice = filtered.slice(0, limit);
    const last = slice[slice.length - 1];
    const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64') : null;

    // Enrich language info
    const langIds = Array.from(new Set(slice.map((i) => i.language).filter((x): x is string => !!x)));
    const langs = await prisma.language.findMany({ where: { id: { in: langIds } } });
    const langMap = new Map(langs.map((l) => [l.id, l]));

    // Category names (language-aware best effort): prefer translation in each item's language, fallback to base name
    const categoryIds = Array.from(new Set(slice.map((i: any) => i.categoryId).filter((x: any) => !!x)));
    const sliceLangIds = Array.from(new Set(slice.map((i: any) => i.language).filter((x: any) => !!x)));
    const [catTranslations, cats] = await Promise.all([
      prisma.categoryTranslation.findMany({ where: { categoryId: { in: categoryIds }, language: { in: sliceLangIds as any } } }),
      prisma.category.findMany({ where: { id: { in: categoryIds } } }),
    ]);
    const catNameById = new Map<string, string>();
    const catNameByCatLang = new Map<string, string>();
    for (const ct of catTranslations) {
      catNameById.set(ct.categoryId, ct.name);
      catNameByCatLang.set(`${ct.categoryId}:${ct.language}`, ct.name);
    }
    for (const c of cats) if (!catNameById.has(c.id)) catNameById.set(c.id, c.name);

    // Author last known location for placeName/address
    const authorIds = Array.from(new Set(slice.map((i: any) => i.authorId).filter((x: any) => !!x)));
    const authorLocs = await prisma.userLocation.findMany({ where: { userId: { in: authorIds } } });
    const authorLocByUser = new Map(authorLocs.map((l) => [l.userId, l]));

    const data = slice.map((i: any) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      const categoryName = i.categoryId ? (catNameByCatLang.get(`${i.categoryId}:${i.language}`) ?? catNameById.get(i.categoryId) ?? null) : null;
      const author = i.author as any;
      const authorName = author?.email || author?.mobileNumber || null;
      const loc = authorLocByUser.get(i.authorId) as any;
      const placeName = i.placeName ?? (loc as any)?.placeName ?? null;
      const address = i.address ?? (loc as any)?.address ?? null;
      // derive canonical url and primary media for convenience
      const languageCode = l?.code || 'en';
      const canonicalUrl = buildCanonicalUrl(languageCode, i.slug || i.id, 'short');
      const mediaUrls = Array.isArray(i.mediaUrls) ? i.mediaUrls : [];
      const imageUrls = mediaUrls.filter((u: string) => /\.(webp|png|jpe?g|gif|avif)$/i.test(u));
      const videoUrls = mediaUrls.filter((u: string) => /\.(webm|mp4|mov|ogg)$/i.test(u));
      const primaryImageUrl = imageUrls[0] || null;
      const primaryVideoUrl = videoUrls[0] || null;
      return {
        ...i,
        mediaUrls,
        primaryImageUrl,
        primaryVideoUrl,
        canonicalUrl,
        languageId: i.language ?? null,
        languageName: l?.name ?? null,
        languageCode: l?.code ?? null,
        categoryName,
        authorName,
        placeName,
        address,
        latitude: i.latitude ?? null,
        longitude: i.longitude ?? null,
        accuracyMeters: i.accuracyMeters ?? null,
        provider: i.provider ?? null,
        timestampUtc: i.timestampUtc ?? null,
        placeId: i.placeId ?? null,
        source: i.source ?? null,
      } as any;
    });

    return res.json({ success: true, pageInfo: { limit, nextCursor, hasMore: filtered.length > limit }, data });
  } catch (e) {
    console.error('Failed to fetch all short news:', e);
    return res.status(500).json({ success: false, error: 'Failed to fetch all short news' });
  }
};
