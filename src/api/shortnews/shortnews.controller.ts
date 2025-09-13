import { Request, Response } from 'express';
import { PrismaClient, User } from '@prisma/client';
import { transliterate } from 'transliteration';
import type { Language } from '@prisma/client';
import { buildNewsArticleJsonLd } from '../../lib/seo';

import { aiEnabledFor } from '../../lib/aiConfig';
import { getPrompt, renderPrompt } from '../../lib/prompts';
import { aiGenerateText } from '../../lib/aiProvider';

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
    const text = await aiGenerateText({ prompt, purpose: 'seo' });
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
  const { title, content, mediaUrls, latitude, longitude, address, categoryId, tags } = req.body;
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
        const out = await aiGenerateText({ prompt, purpose: 'moderation' });
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
    const canonicalDomain = process.env.CANONICAL_DOMAIN || 'https://app.hrcitodaynews.in';
    const canonicalUrl = `${canonicalDomain}/${languageCode}/${slug}`;
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

    const shortNews = await prisma.shortNews.create({
      data: {
        title: titleToSave,
        slug,
        content,
        authorId,
        categoryId,
        tags: combinedTags,
        seo: { ...finalSeo, jsonLd },
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
        latitude: Number(latNum),
        longitude: Number(lonNum),
        address: address || null,
        language: languageId,
        status: initialStatus,
        aiRemark,
        aiPlagiarism,
        aiSensitive,
      },
    });
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
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to submit short news' });
  }
};

export const getShortNewsJsonLd = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await prisma.shortNews.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ success: false, error: 'Not found' });
    const lang = await prisma.language.findUnique({ where: { id: item.language as any } });
    const languageCode = lang?.code || 'en';
    const canonicalDomain = process.env.CANONICAL_DOMAIN || 'https://app.hrcitodaynews.in';
    const canonicalUrl = `${canonicalDomain}/${languageCode}/${item.slug}`;
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
    const user = req.user as User & { role?: { name: string } };
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
    // get saved location from profile
    const userLocation = await prisma.userLocation.findUnique({ where: { userId: user.id } });
    const hasLocation = !!(userLocation && typeof userLocation.latitude === 'number' && typeof userLocation.longitude === 'number');

    // prefetch pool: same language; do not restrict to coords/desk to ensure we include all when no location
    const seed = await prisma.shortNews.findMany({
      where: { language: languageId },
      include: { author: { include: { role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: Math.max(limit * 10, 200),
    });

    // in-memory filter: within 20km of saved location OR authored by NEWS_DESK
    const R = 6371; // km
    const toRad = (d: number) => (d * Math.PI) / 180;
    const withinRadiusOrDesk = seed.filter((item) => {
      const isDesk = item.author?.role?.name === 'NEWS_DESK' || item.author?.role?.name === 'NEWS_DESK_ADMIN';
      const isSelf = item.authorId === user.id;
      if (!hasLocation) return true; // no location -> keep all (latest by language)
      if (isDesk || isSelf) return true; // always allow desk or self-authored
      if (item.latitude == null || item.longitude == null) return false;
      const dLat = toRad(item.latitude - (userLocation!.latitude as number));
      const dLon = toRad(item.longitude - (userLocation!.longitude as number));
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(userLocation!.latitude)) * Math.cos(toRad(item.latitude)) * Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      return distance <= 20;
    });

    // choose collection based on location presence
    const collection = hasLocation ? withinRadiusOrDesk : seed;

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
    const last = slice[slice.length - 1];
    const hasMore = afterCursor.length > limit;
    const nextCursor = last ? Buffer.from(JSON.stringify({ id: last.id, date: last.createdAt.toISOString() })).toString('base64') : null;

    const data = slice.map((i) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      return {
        ...i,
        languageId: i.language ?? null,
        languageName: l?.name ?? null,
        languageCode: l?.code ?? null,
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
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, error: 'Failed to update status' });
  }
};

// Public feed: only DESK_APPROVED items, optional language filter by code
export const listApprovedShortNews = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10), 50);
    const cursorRaw = (req.query.cursor as string) || '';
    const languageCode = (req.query.languageCode as string) || undefined;
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
    let languageId: string | undefined;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: languageCode } });
      languageId = lang?.id;
    }
    const where: any = { status: 'DESK_APPROVED' };
    if (languageId) where.language = languageId;
    const items = await prisma.shortNews.findMany({
      where,
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
    // attach language info
    const langIds = Array.from(new Set(slice.map((i) => i.language).filter((x): x is string => !!x)));
    const langs = await prisma.language.findMany({ where: { id: { in: langIds } } });
    const langMap = new Map(langs.map((l) => [l.id, l]));
    const data = slice.map((i) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      return { ...i, languageId: i.language ?? null, languageName: l?.name ?? null, languageCode: l?.code ?? null } as any;
    });
    return res.json({ success: true, pageInfo: { limit, nextCursor, hasMore: filtered.length > limit }, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch approved short news' });
  }
};

// Moderation/status-wise listing: citizens see their own by status; desk/admin see language-wide by status
export const listShortNewsByStatus = async (req: Request, res: Response) => {
  try {
    const user = req.user as User & { role?: { name: string } };
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
    const data = slice.map((i) => {
      const l = i.language ? langMap.get(i.language as any) : undefined;
      return { ...i, languageId: i.language ?? null, languageName: l?.name ?? null, languageCode: l?.code ?? null } as any;
    });
    return res.json({ success: true, pageInfo: { limit, nextCursor, hasMore: filtered.length > limit }, data });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Failed to fetch moderation list' });
  }
};
