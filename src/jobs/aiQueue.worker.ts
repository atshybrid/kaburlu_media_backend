import prisma from '../lib/prisma';
import { aiGenerateText } from '../lib/aiProvider';
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../lib/sanitize';
import { buildNewsArticleJsonLd } from '../lib/seo';
import { generateAiShortNewsFromPrompt } from '../api/shortnews/shortnews.ai';
import { CORE_NEWS_CATEGORIES, resolveOrCreateCategoryIdByName } from '../lib/categoryAuto';

async function updateRawArticleFromBaseArticle(article: any, contentJson: any) {
  const rawId = String(contentJson?.rawArticleId || contentJson?.raw?.rawArticleId || '').trim();
  if (!rawId) return;
  try {
    const status = String(contentJson?.aiStatus || '').toUpperCase();
    const next = status === 'DONE' ? 'DONE' : (status === 'FAILED' ? 'FAILED' : 'PROCESSING');
    await (prisma as any).rawArticle.update({
      where: { id: rawId },
      data: {
        status: next,
        errorCode: next === 'FAILED' ? (String(contentJson?.aiError || 'AI_FAILED').slice(0, 120)) : null,
        usage: {
          articleId: article?.id,
          queue: 'postgres',
        },
        webArticleId: contentJson?.webArticleId || null,
        shortNewsId: contentJson?.shortNewsId || null,
        newspaperArticleId: contentJson?.newspaperArticleId || null,
      }
    });
  } catch {
    // best-effort
  }
}

function nowIsoIST(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('Z', '+05:30');
}

async function getPrompt(key: string): Promise<string | null> {
  try {
    const row = await (prisma as any).prompt?.findUnique?.({ where: { key } });
    return row?.content || null;
  } catch { return null; }
}

function normalizeText(s: any): string {
  return String(s || '').replace(/\r\n/g, '\n');
}

function extractBetween(text: string, startLabel: string, endLabels: string[]): string {
  const t = normalizeText(text);
  const startIdx = t.toLowerCase().indexOf(startLabel.toLowerCase());
  if (startIdx < 0) return '';
  const start = startIdx + startLabel.length;
  const after = t.slice(start);
  let end = after.length;
  for (const el of endLabels) {
    const i = after.toLowerCase().indexOf(el.toLowerCase());
    if (i >= 0 && i < end) end = i;
  }
  return after.slice(0, end).trim();
}

function parseLinesList(block: string): string[] {
  const lines = normalizeText(block).split('\n').map(l => l.trim()).filter(Boolean);
  const cleaned: string[] = [];
  for (const l of lines) {
    const x = l.replace(/^[-•*\u2022]+\s*/, '').replace(/^\d+[.)]\s*/, '').trim();
    if (!x) continue;
    cleaned.push(x);
  }
  return cleaned;
}

function words(s: string): number {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

function buildSimpleHtmlFromPlainText(plain: string): string {
  const text = normalizeText(plain).trim();
  if (!text) return '';
  const parts = text.split(/\n\s*\n/g).map(p => p.trim()).filter(Boolean);
  const html = parts.map(p => {
    // Heuristic heading: short line, no sentence-ending punctuation
    if (p.length <= 80 && !/[.!?]$/.test(p) && !/[,;:]$/.test(p) && !/\n/.test(p)) {
      return `<h2>${p}</h2>`;
    }
    return `<p>${p.split(/\n+/).map(x => x.trim()).filter(Boolean).join('<br/>')}</p>`;
  }).join('');
  return sanitizeHtmlAllowlist(html);
}

function buildRawText(article: any): string {
  const cj: any = article?.contentJson || {};
  const raw: any = cj.raw || {};
  const t = String(raw.title || article.title || '').trim();
  const c = String(raw.content || article.content || '').trim();
  return [t, c].filter(Boolean).join('\n\n').trim();
}

function applyPromptTemplate(promptTpl: string, rawText: string): string {
  const tpl = normalizeText(promptTpl);
  // Supports common placeholders from user prompts
  return tpl
    .replace(/\{\{\s*PASTE ARTICLE HERE\s*\}\}/gi, rawText)
    .replace(/\{\{\s*ARTICLE\s*\}\}/gi, rawText)
    .replace(/\{\{\s*RAW_TEXT\s*\}\}/gi, rawText);
}

function applyWebAndShortPromptTemplate(promptTpl: string, vars: Record<string, string>, shortNewsText: string): string {
  let tpl = normalizeText(promptTpl);
  // User-provided prompt commonly uses this placeholder
  tpl = tpl.replace(/<<<\s*PASTE SHORT NEWS HERE\s*>>>/gi, shortNewsText);

  // Some prompts use moustache-style placeholders
  for (const k of Object.keys(vars)) {
    const needle = new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g');
    tpl = tpl.replace(needle, vars[k]);
  }

  // Generic fallbacks
  tpl = tpl
    .replace(/\{\{\s*SHORT_NEWS\s*\}\}/gi, shortNewsText)
    .replace(/\{\{\s*NEWS\s*\}\}/gi, shortNewsText);
  return tpl;
}

async function inferCategoryIdForArticle(article: any): Promise<string | null> {
  try {
    const cj: any = article?.contentJson || {};
    const raw: any = cj.raw || {};
    const title = String(raw.title || article.title || '').trim();
    const content = String(raw.content || article.content || '').trim();
    const text = [title, content].filter(Boolean).join('\n\n').slice(0, 2500);
    if (!text) return null;

    const cats = await prisma.category.findMany({
      where: { isDeleted: false },
      select: { id: true, name: true, slug: true },
      take: 120,
    });
    if (!cats?.length) return null;

    const list = cats.map(c => `${c.id}::${c.name}::${c.slug}`).join('\n');
    const prompt =
      `Pick the best matching news category for this article.\n` +
      `Return ONLY JSON: {"categoryId": string|null}.\n` +
      `If nothing fits, return {"categoryId": null}.\n\n` +
      `CATEGORIES (id::name::slug):\n${list}\n\n` +
      `ARTICLE:\n${text}`;

    const aiRes = await aiGenerateText({ prompt, purpose: 'rewrite' as any });
    const out = String(aiRes?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    if (!out) return null;
    const parsed = JSON.parse(out);
    const id = parsed?.categoryId ? String(parsed.categoryId).trim() : '';
    if (!id) return null;
    if (!cats.some(c => c.id === id)) return null;
    return id;
  } catch {
    return null;
  }
}

async function inferCategoryNameForArticle(article: any): Promise<string | null> {
  try {
    const cj: any = article?.contentJson || {};
    const raw: any = cj.raw || {};
    const title = String(raw.title || article.title || '').trim();
    const content = String(raw.content || article.content || '').trim();
    const text = [title, content].filter(Boolean).join('\n\n').slice(0, 2500);
    if (!text) return null;

    const options = CORE_NEWS_CATEGORIES.map(c => c.name).join(', ');
    const prompt =
      `Choose ONE best news category for this article.\n` +
      `Prefer these standard categories: ${options}.\n` +
      `If none fit, return a short 1-3 word category label.\n` +
      `Return ONLY JSON: {"categoryName": string}.\n\n` +
      `ARTICLE:\n${text}`;

    const aiRes = await aiGenerateText({ prompt, purpose: 'rewrite' as any });
    const out = String(aiRes?.text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    if (!out) return null;
    const parsed = JSON.parse(out);
    const name = parsed?.categoryName ? String(parsed.categoryName).trim() : '';
    return name || null;
  } catch {
    return null;
  }
}

async function fallbackCategoryId(): Promise<string | null> {
  try {
    const preferredSlugs = ['general', 'news', 'top-news', 'breaking', 'latest'];
    const preferredNames = ['General', 'News', 'Top News', 'Breaking', 'Latest'];
    const hit = await prisma.category.findFirst({
      where: {
        isDeleted: false,
        OR: [
          { slug: { in: preferredSlugs } },
          { name: { in: preferredNames } },
        ],
      },
      select: { id: true },
    }).catch(() => null);
    if (hit?.id) return hit.id;
    const any = await prisma.category.findFirst({ where: { isDeleted: false }, select: { id: true } }).catch(() => null);
    return any?.id || null;
  } catch {
    return null;
  }
}

async function resolveDomainForTenant(tenantId: string, domainId?: string | null): Promise<{ domainId: string | null; domainName: string | null }> {
  const dId = domainId ? String(domainId).trim() : '';
  if (dId) {
    const dom = await prisma.domain.findFirst({ where: { id: dId, tenantId }, select: { id: true, domain: true } }).catch(() => null);
    if (dom?.id) return { domainId: dom.id, domainName: dom.domain };
  }
  const primary = await prisma.domain.findFirst({
    where: { tenantId, status: 'ACTIVE' as any },
    orderBy: [{ isPrimary: 'desc' as any }, { createdAt: 'desc' as any }],
    select: { id: true, domain: true },
  }).catch(() => null);
  if (primary?.id) return { domainId: primary.id, domainName: primary.domain };
  const anyDom = await prisma.domain.findFirst({ where: { tenantId }, orderBy: { createdAt: 'desc' }, select: { id: true, domain: true } }).catch(() => null);
  return { domainId: anyDom?.id || null, domainName: anyDom?.domain || null };
}

async function backfillInferredCategory(opts: {
  baseArticleId: string;
  categoryId: string;
  contentJson?: any;
}) {
  const baseArticleId = String(opts.baseArticleId || '').trim();
  const categoryId = String(opts.categoryId || '').trim();
  if (!baseArticleId || !categoryId) return;

  // Best-effort only: never break the job if these fail.
  try {
    const webArticleId = opts?.contentJson?.webArticleId ? String(opts.contentJson.webArticleId).trim() : '';
    if (webArticleId) {
      await prisma.tenantWebArticle.updateMany({
        where: { id: webArticleId, categoryId: null },
        data: { categoryId },
      });
    }
  } catch {}

  try {
    await (prisma as any).newspaperArticle.updateMany({
      where: { baseArticleId, categoryId: null },
      data: { categoryId },
    });
  } catch {}
}

type ParsedTrue = {
  newspaper: { title: string; subtitle: string; keyPoints: string[]; content: string };
  web: { seoTitle: string; metaDescription: string; slug: string; keywords: string[]; content: string };
  short: { title: string; content: string };
};

type ParsedFalse = {
  web: { originalTitle: string; seoTitle: string; metaDescription: string; slug: string; keywords: string[]; schemaFocusKeywords: string[] };
  short: { title: string; content: string };
};

function extractJsonObject(text: string): any | null {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      return JSON.parse(cleaned);
    } catch {
      // continue
    }
  }

  // best-effort: find first JSON object span
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const maybe = cleaned.slice(start, end + 1);
    try {
      return JSON.parse(maybe);
    } catch {
      return null;
    }
  }
  return null;
}

function extractAiValidationMeta(out: string): {
  aiApprovalStatus: string | null;
  aiViolationCount: number;
  aiValidationIssues: any | null;
  isBreaking: boolean | null;
} {
  const obj = extractJsonObject(out);
  if (!obj || typeof obj !== 'object') {
    return { aiApprovalStatus: null, aiViolationCount: 0, aiValidationIssues: null, isBreaking: null };
  }

  const statusRaw = (obj as any).status ?? (obj as any).ai_status ?? (obj as any).approval_status ?? (obj as any).approvalStatus;
  const status = statusRaw != null ? String(statusRaw).trim() : null;

  const vcRaw = (obj as any).violation_count ?? (obj as any).violationCount ?? (obj as any).violations ?? 0;
  const aiViolationCount = Number.isFinite(Number(vcRaw)) ? Number(vcRaw) : 0;

  const aiValidationIssues =
    (obj as any).validation_issues ??
    (obj as any).validationIssues ??
    (obj as any).issues ??
    (obj as any).validation ??
    null;

  let isBreaking: boolean | null = null;
  const newsType = (obj as any).news_type ?? (obj as any).newsType;
  if (typeof (obj as any).breaking === 'boolean') isBreaking = (obj as any).breaking;
  else if (typeof (obj as any).isBreaking === 'boolean') isBreaking = (obj as any).isBreaking;
  else if (typeof newsType === 'string') isBreaking = newsType.toLowerCase().includes('break');
  else if (newsType && typeof newsType === 'object') {
    const n: any = newsType;
    if (typeof n.breaking === 'boolean') isBreaking = n.breaking;
    else if (typeof n.isBreaking === 'boolean') isBreaking = n.isBreaking;
  }

  return {
    aiApprovalStatus: status,
    aiViolationCount,
    aiValidationIssues,
    isBreaking,
  };
}

function parseWebAndShortNewsAiOutput(out: string): {
  aiApprovalStatus: string;
  aiViolationCount: number;
  aiValidationIssues: any;
  isBreaking: boolean;
  web: {
    title: string;
    subTitle: string;
    summary: string;
    content: string;
    metaTitle: string;
    metaDescription: string;
    keywords: string[];
    locationKeywords: string[];
    jsonLd: any | null;
    wordCount: number | null;
  };
  short: {
    title: string;
    subTitle: string;
    content: string;
    wordCount: number | null;
  };
} | null {
  const obj = extractJsonObject(out);
  if (!obj || typeof obj !== 'object') return null;

  const status = String((obj as any).status || '').trim() || 'PENDING';
  const vcRaw = (obj as any).violation_count ?? (obj as any).violationCount ?? 0;
  const violationCount = Number.isFinite(Number(vcRaw)) ? Number(vcRaw) : 0;
  const issues = (obj as any).validation_issues ?? (obj as any).validationIssues ?? [];

  const newsType = (obj as any).news_type ?? (obj as any).newsType;
  const isBreaking = (typeof newsType === 'string') ? newsType.toLowerCase() === 'breaking' : false;

  const wn: any = (obj as any).web_news ?? (obj as any).webNews ?? {};
  const sn: any = (obj as any).short_news ?? (obj as any).shortNews ?? {};

  const webTitle = String(wn.title || '').trim();
  if (!webTitle) return null;

  const keywords = Array.isArray(wn.keywords) ? wn.keywords.map((x: any) => String(x || '').trim()).filter(Boolean) : [];
  const locationKeywords = Array.isArray(wn.location_keywords)
    ? wn.location_keywords.map((x: any) => String(x || '').trim()).filter(Boolean)
    : (Array.isArray(wn.locationKeywords) ? wn.locationKeywords.map((x: any) => String(x || '').trim()).filter(Boolean) : []);

  return {
    aiApprovalStatus: status,
    aiViolationCount: violationCount,
    aiValidationIssues: issues,
    isBreaking,
    web: {
      title: webTitle,
      subTitle: String(wn.sub_title ?? wn.subTitle ?? '').trim(),
      summary: String(wn.summary || '').trim(),
      content: String(wn.content || '').trim(),
      metaTitle: String(wn.meta_title ?? wn.metaTitle ?? wn.meta?.meta_title ?? wn.meta?.metaTitle ?? '').trim(),
      metaDescription: String(wn.meta_description ?? wn.metaDescription ?? wn.meta?.meta_description ?? wn.meta?.metaDescription ?? '').trim(),
      keywords,
      locationKeywords,
      jsonLd: (wn.json_ld ?? wn.jsonLd) ?? null,
      wordCount: (wn.word_count != null && Number.isFinite(Number(wn.word_count))) ? Number(wn.word_count) : null,
    },
    short: {
      title: String(sn.short_title ?? sn.title ?? '').trim(),
      subTitle: String(sn.short_sub_title ?? sn.sub_title ?? sn.subTitle ?? '').trim(),
      content: String(sn.content || '').trim(),
      wordCount: (sn.word_count != null && Number.isFinite(Number(sn.word_count))) ? Number(sn.word_count) : null,
    }
  };
}

function parseTrueOutput(text: string): ParsedTrue | null {
  const t = normalizeText(text);
  const title = extractBetween(t, 'Title:', ['Subtitle:', 'Key Points:', 'Main Article:']);
  const subtitle = extractBetween(t, 'Subtitle:', ['Key Points:', 'Main Article:']);
  const keyPointsRaw = extractBetween(t, 'Key Points:', ['Main Article:', 'SEO Title:', 'Meta Description:', 'Slug:', 'Keywords:', 'Article Content:', 'Short Title:', 'Short Article:']);
  const mainArticle = extractBetween(t, 'Main Article:', ['SEO Title:', 'Meta Description:', 'Slug:', 'Keywords:', 'Article Content:', 'Short Title:', 'Short Article:']);

  const seoTitle = extractBetween(t, 'SEO Title:', ['Meta Description:', 'Slug:', 'Keywords:', 'Article Content:', 'Short Title:', 'Short Article:']);
  const metaDescription = extractBetween(t, 'Meta Description:', ['Slug:', 'Keywords:', 'Article Content:', 'Short Title:', 'Short Article:']);
  const slug = extractBetween(t, 'Slug:', ['Keywords:', 'Article Content:', 'Short Title:', 'Short Article:']);
  const keywordsRaw = extractBetween(t, 'Keywords:', ['Article Content:', 'Short Title:', 'Short Article:']);
  const articleContent = extractBetween(t, 'Article Content:', ['Short Title:', 'Short Article:']);

  const shortTitle = extractBetween(t, 'Short Title:', ['Short Article:']);
  const shortArticle = extractBetween(t, 'Short Article:', []);

  const keyPoints = parseLinesList(keyPointsRaw).slice(0, 5);
  const keywords = parseLinesList(keywordsRaw)
    .flatMap(x => x.split(/[,|]/g).map(z => z.trim()).filter(Boolean))
    .slice(0, 10);

  if (!title && !seoTitle && !shortTitle) return null;

  return {
    newspaper: {
      title: String(title || '').trim(),
      subtitle: String(subtitle || '').trim(),
      keyPoints,
      content: String(mainArticle || '').trim(),
    },
    web: {
      seoTitle: String(seoTitle || '').trim(),
      metaDescription: String(metaDescription || '').trim(),
      slug: String(slug || '').trim(),
      keywords,
      content: String(articleContent || '').trim(),
    },
    short: {
      title: String(shortTitle || '').trim(),
      content: String(shortArticle || '').trim(),
    }
  };
}

function parseFalseOutput(text: string): ParsedFalse | null {
  const t = normalizeText(text);
  const originalTitle = extractBetween(t, 'Original Title:', ['SEO Title:', 'Meta Description:', 'Slug:', 'Keywords:', 'Schema Focus Keywords:', 'Short Title:', 'Short Article:']);
  const seoTitle = extractBetween(t, 'SEO Title:', ['Meta Description:', 'Slug:', 'Keywords:', 'Schema Focus Keywords:', 'Short Title:', 'Short Article:']);
  const metaDescription = extractBetween(t, 'Meta Description:', ['Slug:', 'Keywords:', 'Schema Focus Keywords:', 'Short Title:', 'Short Article:']);
  const slug = extractBetween(t, 'Slug:', ['Keywords:', 'Schema Focus Keywords:', 'Short Title:', 'Short Article:']);
  const keywordsRaw = extractBetween(t, 'Keywords:', ['Schema Focus Keywords:', 'Short Title:', 'Short Article:']);
  const schemaRaw = extractBetween(t, 'Schema Focus Keywords:', ['Short Title:', 'Short Article:']);
  const shortTitle = extractBetween(t, 'Short Title:', ['Short Article:']);
  const shortArticle = extractBetween(t, 'Short Article:', []);

  const keywords = parseLinesList(keywordsRaw)
    .flatMap(x => x.split(/[,|]/g).map(z => z.trim()).filter(Boolean))
    .slice(0, 10);
  const schemaFocusKeywords = parseLinesList(schemaRaw)
    .flatMap(x => x.split(/[,|]/g).map(z => z.trim()).filter(Boolean))
    .slice(0, 5);

  if (!seoTitle && !shortTitle) return null;

  return {
    web: {
      originalTitle: String(originalTitle || '').trim(),
      seoTitle: String(seoTitle || '').trim(),
      metaDescription: String(metaDescription || '').trim(),
      slug: String(slug || '').trim(),
      keywords,
      schemaFocusKeywords,
    },
    short: {
      title: String(shortTitle || '').trim(),
      content: String(shortArticle || '').trim(),
    }
  };
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return Object.keys(vars).reduce((acc, k) => {
    const needle = `{{${k}}}`;
    return acc.split(needle).join(vars[k]);
  }, tpl);
}

async function buildWebPrompt(provider: 'gemini' | 'chatgpt', payload: any): Promise<string> {
  const RAW_JSON = JSON.stringify(payload.raw || {}, null, 2);
  const vars = {
    TENANT_ID: String(payload.tenantId || ''),
    LANGUAGE_CODE: String(payload.languageCode || ''),
    AUTHOR_ID: String(payload.authorId || ''),
    CATEGORY_IDS: JSON.stringify(payload.categoryIds || []),
    IMAGE_URLS: JSON.stringify(payload.images || []),
    IS_PUBLISHED: String(!!payload.isPublished),
    RAW_CONTENT: RAW_JSON,
    RAW_JSON: RAW_JSON
  } as Record<string, string>;
  if (provider === 'gemini') {
    const envTpl = (process.env.WEB_PROMPT_GEMINI || '').trim();
    if (envTpl) return renderTemplate(envTpl, vars);
    const tpl = await getPrompt('ai_web_article_json_gemini');
    if (tpl) return renderTemplate(tpl, vars);
    return (
      `You are an article formatter and SEO assistant. Input: a small editor payload follows. Output: a single JSON object only (no commentary). Sanitize HTML (allow only <p>,<h1>-<h3>,<ul>,<ol>,<li>,<strong>,<em>,<a>,<figure>,<img>,<figcaption>). Use ISO 8601 for dates. If languageCode is "te", produce Telugu article text; metadata can be English or Telugu. Preserve user text; do not invent facts. The title must be meaningful, not empty or just dashes, and written in the same language.

Payload:\n${JSON.stringify({
        tenantId: payload.tenantId,
        languageCode: payload.languageCode,
        authorId: payload.authorId,
        categoryIds: payload.categoryIds,
        images: payload.images,
        isPublished: Boolean(payload.isPublished),
        raw: '{RAW_JSON}'
      }, null, 2).replace('"{RAW_JSON}"', RAW_JSON)}

Return JSON with fields: tenantId, languageCode, slug, title, subtitle, excerpt, authors, status, publishedAt, readingTimeMin, categories, tags, coverImage, blocks, contentHtml, plainText, meta, jsonLd, audit.

Rules:\n1. Create slug from title, kebab-case, <=120 chars.\n2. Authors: [{id: authorId, name:"", role:"reporter"}].\n3. Status = "published" if isPublished true else "draft".\n4. publishedAt / audit createdAt/updatedAt use current timestamp in +05:30 ISO format.\n5. readingTimeMin = max(1, round(words/200)).\n6. blocks: canonicalize raw. If raw has multiple h1, keep first as h1, convert others to h2.\n7. contentHtml: render blocks to clean HTML, use <figure> for images.\n8. plainText: headings on new lines, lists as "- item".\n9. excerpt: 18-30 words.\n10. tags: 3-7 short tags.\n11. meta.seoTitle <=60 chars; metaDescription 110-155 chars.\n12. jsonLd: NewsArticle with headline, image[], datePublished, dateModified, author, publisher (include logo as empty string if unknown).\n13. Do not make up numbers or claims not in raw.\n14. Output only valid JSON.`
    );
  }
  const envTpl2 = (process.env.WEB_PROMPT_CHATGPT || '').trim();
  if (envTpl2) return renderTemplate(envTpl2, vars);
  const tpl = await getPrompt('ai_web_article_json');
  if (tpl) return renderTemplate(tpl, vars);
  return (
    `You are a production-ready article formatter and SEO assistant. Always follow instructions exactly. Output must be valid JSON only (no surrounding markdown, explanation, or commentary). Validate and sanitize HTML, allow only <p>, <h1>-<h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <figure>, <img>, and <figcaption>. If any required field cannot be generated, fill with an empty string or empty array. Use ISO 8601 for dates. Use server timezone +05:30 if a date is needed. Do not invent facts — preserve user text. Keep metadata concise and SEO-friendly. If input language is Telugu (languageCode = "te"), produce article text in Telugu; metadata (seoTitle, metaDescription) may be in English or Telugu but keep it short. Return only one JSON object.\n\n${JSON.stringify({ raw: payload.raw || {} }, null, 2)}`
  );
}

async function processOne(article: any) {
  const contentJson: any = article.contentJson || {};
  const raw = contentJson.raw || {};
  const queue = contentJson.aiQueue || {};
  const languageCode = raw.languageCode || '';
  const shouldPublish = String(article.status || '').toUpperCase() === 'PUBLISHED';
  // Newspaper flow stores publish intent here; publish happens after AI_APPROVED.
  const publishRequested = (typeof raw?.isPublished === 'boolean') ? Boolean(raw.isPublished) : shouldPublish;

  const domainResolved = await resolveDomainForTenant(article.tenantId, raw.domainId || contentJson.domainId || null);
  const domainId = domainResolved.domainId;
  const domainName = domainResolved.domainName;

  // If ShortNews/Web is requested but categoryIds missing, infer/resolve one and persist it.
  if ((queue.short || queue.web) && (!Array.isArray(raw.categoryIds) || raw.categoryIds.length === 0)) {
    let categoryId: string | null = null;

    // 1) Try legacy inference (choose from existing categories by id)
    categoryId = await inferCategoryIdForArticle(article);

    // 2) Infer category name then resolve/create by >=90% match
    if (!categoryId) {
      const inferredName = await inferCategoryNameForArticle(article);
      if (inferredName) {
        const resolved = await resolveOrCreateCategoryIdByName({
          suggestedName: inferredName,
          languageCode: String(languageCode || '').trim() || undefined,
          similarityThreshold: 0.9,
          autoCreate: true,
        }).catch(() => null);
        if (resolved?.categoryId) categoryId = resolved.categoryId;
      }
    }

    // 3) Final fallback
    if (!categoryId) categoryId = await fallbackCategoryId();

    if (categoryId) {
      try {
        const updatedCJ = {
          ...contentJson,
          raw: { ...(contentJson.raw || {}), categoryIds: [categoryId] },
          aiCategoryInferred: { categoryId, at: nowIsoIST() },
        } as any;
        await prisma.article.update({
          where: { id: article.id },
          data: {
            contentJson: updatedCJ,
            categories: { connect: [{ id: categoryId }] } as any,
          },
        });
        (contentJson.raw = updatedCJ.raw);
        (raw.categoryIds = [categoryId]);
      } catch {
        try {
          const updatedCJ = {
            ...contentJson,
            raw: { ...(contentJson.raw || {}), categoryIds: [categoryId] },
            aiCategoryInferred: { categoryId, at: nowIsoIST() },
          } as any;
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          (contentJson.raw = updatedCJ.raw);
          (raw.categoryIds = [categoryId]);
        } catch {}
      }

      // Also backfill into already-created linked records (LIMITED newspaper flow creates web/newspaper early).
      await backfillInferredCategory({ baseArticleId: article.id, categoryId, contentJson });
    }
  }

  // Extra guard: if inference failed for any reason, still pick a stable fallback category
  // so ShortNews and TenantWebArticle stay consistent.
  if ((queue.short || queue.web) && (!Array.isArray(raw.categoryIds) || raw.categoryIds.length === 0)) {
    const fb = await fallbackCategoryId();
    if (fb) {
      try {
        const updatedCJ = {
          ...contentJson,
          raw: { ...(contentJson.raw || {}), categoryIds: [fb] },
          aiCategoryInferred: { categoryId: fb, at: nowIsoIST(), reason: 'fallback' },
        } as any;
        await prisma.article.update({
          where: { id: article.id },
          data: {
            contentJson: updatedCJ,
            categories: { connect: [{ id: fb }] } as any,
          },
        });
        (contentJson.raw = updatedCJ.raw);
        (raw.categoryIds = [fb]);
      } catch {
        try {
          const updatedCJ = {
            ...contentJson,
            raw: { ...(contentJson.raw || {}), categoryIds: [fb] },
            aiCategoryInferred: { categoryId: fb, at: nowIsoIST(), reason: 'fallback' },
          } as any;
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          (contentJson.raw = updatedCJ.raw);
          (raw.categoryIds = [fb]);
        } catch {}
      }

      await backfillInferredCategory({ baseArticleId: article.id, categoryId: fb, contentJson });
    }
  }

  // Combined TRUE/FALSE prompt mode (OpenAI-only best practice per user request)
  const wantWork = !!(queue.web || queue.short || queue.newspaper);
  if (wantWork) {
    try {
      const isNewspaperPost = String(contentJson?.source || '') === 'newspaper.post' || !!contentJson?.rawNewspaper;

      const decision = (contentJson as any)?.aiDecision || {};
      const decidedEnabled = typeof decision?.tenantAiRewriteEnabled === 'boolean' ? decision.tenantAiRewriteEnabled : null;

      const flags = await (prisma as any).tenantFeatureFlags?.findUnique?.({ where: { tenantId: article.tenantId } }).catch(() => null);
      const storedEnabled = flags?.aiArticleRewriteEnabled !== false;

      // Prefer submit-time decision (includes SUPER_ADMIN override via forceAiRewriteEnabled)
      const tenantAiRewriteEnabled = decidedEnabled !== null ? decidedEnabled : storedEnabled;
      const aiMode = tenantAiRewriteEnabled ? 'FULL' : 'LIMITED';

      // Newspaper submission flow: ALWAYS use single prompt `web_and_shortnews_ai_article`
      // and generate full web + short news JSON (no separate TRUE/FALSE prompts).
      if (isNewspaperPost && (queue.web || queue.short)) {
        const PROMPT_KEY = 'web_and_shortnews_ai_article';
        const promptTpl = (await getPrompt(PROMPT_KEY).catch(() => null)) || '';
        if (!promptTpl.trim()) {
          const failedCJ = { ...contentJson, aiStatus: 'FAILED', aiError: `MISSING_PROMPT:${PROMPT_KEY}`, aiFinishedAt: nowIsoIST(), aiMode } as any;
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: failedCJ } });
          await updateRawArticleFromBaseArticle(article, failedCJ);
          return;
        }

        const rawText = buildRawText(article);

        // Resolve category name (best-effort)
        let categoryName = '';
        const firstCategoryId = Array.isArray(raw.categoryIds) && raw.categoryIds[0] ? String(raw.categoryIds[0]) : '';
        if (firstCategoryId) {
          const c = await prisma.category.findUnique({ where: { id: firstCategoryId }, select: { name: true } }).catch(() => null);
          if (c?.name) categoryName = String(c.name);
        }

        // Resolve publisher name (tenant entity preferred)
        const tenantRow = await prisma.tenant.findUnique({
          where: { id: article.tenantId },
          select: { name: true, entity: { select: { publisherName: true, ownerName: true, editorName: true } } },
        }).catch(() => null);
        const publisherName = String(tenantRow?.entity?.publisherName || tenantRow?.name || '').trim();

        const websiteUrl = domainName ? `https://${domainName}` : '';

        const locationVars = {
          state: String(raw?.locationRef?.stateName || raw?.locationRef?.state || ''),
          district: String(raw?.locationRef?.districtName || raw?.locationRef?.district || ''),
          mandal: String(raw?.locationRef?.mandalName || raw?.locationRef?.mandal || ''),
          village: String(raw?.locationRef?.villageName || raw?.locationRef?.village || ''),
          displayName: String(raw?.locationRef?.displayName || ''),
        };

        const vars: Record<string, string> = {
          category_name: categoryName,
          language: String(languageCode || ''),
          publisher_name: publisherName,
          website_url: websiteUrl,
          location: JSON.stringify(locationVars),
        };

        const prompt = applyWebAndShortPromptTemplate(promptTpl, vars, rawText);

        const now = nowIsoIST();
        let updatedCJ = { ...contentJson, aiStatus: 'RUNNING', aiStartedAt: now, aiMode } as any;
        await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });

        const aiRes = await aiGenerateText({ prompt, purpose: 'rewrite' as any });
        const out = normalizeText(aiRes.text || '').trim();
        if (!out) {
          updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'EMPTY_AI_OUTPUT', aiFinishedAt: nowIsoIST() };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          await updateRawArticleFromBaseArticle(article, updatedCJ);
          return;
        }

        const parsed = parseWebAndShortNewsAiOutput(out);
        if (!parsed) {
          updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'PARSE_WEB_SHORT_JSON_FAILED', aiFinishedAt: nowIsoIST(), aiRawOutput: out };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          await updateRawArticleFromBaseArticle(article, updatedCJ);
          return;
        }

        const isBreakingFromRaw = typeof raw?.isBreaking === 'boolean' ? raw.isBreaking : false;
        const isBreaking = parsed.isBreaking || isBreakingFromRaw;
        const aiApprovalStatus = parsed.aiApprovalStatus;
        const aiViolationCount = parsed.aiViolationCount;
        const aiValidationIssues = parsed.aiValidationIssues;

        const shouldPublishNow = publishRequested && aiApprovalStatus === 'AI_APPROVED';

        // Build TenantWebArticle JSON
        const webTitle = parsed.web.title;
        const webSlug = slugFromAnyLanguage(webTitle, 120);
        const plainText = parsed.web.content || rawText;
        const contentHtml = buildSimpleHtmlFromPlainText(plainText);
        const tags = (parsed.web.keywords || []).slice(0, 10);

        const canonicalUrl = domainName ? `https://${domainName}/articles/${webSlug}` : `/articles/${webSlug}`;
        const jsonLd = parsed.web.jsonLd || buildNewsArticleJsonLd({
          headline: webTitle,
          description: parsed.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
          canonicalUrl,
          imageUrls: Array.isArray(raw.images) ? raw.images.slice(0, 3) : [],
          languageCode: languageCode || undefined,
          datePublished: shouldPublishNow ? (raw.publishedAt || nowIsoIST()) : undefined,
          dateModified: nowIsoIST(),
          keywords: tags,
          articleSection: Array.isArray(raw.categoryIds) && raw.categoryIds[0] ? String(raw.categoryIds[0]) : undefined,
          wordCount: words(plainText),
        });

        const webJson: any = {
          title: webTitle,
          subtitle: parsed.web.subTitle || '',
          slug: webSlug,
          summary: parsed.web.summary || '',
          contentHtml,
          plainText,
          tags,
          categories: Array.isArray(raw.categoryIds) ? raw.categoryIds : [],
          meta: {
            seoTitle: parsed.web.metaTitle || webTitle,
            metaDescription: parsed.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
            locationKeywords: parsed.web.locationKeywords || [],
          },
          jsonLd,
          publisher: { name: publisherName, websiteUrl },
          locationRef: raw?.locationRef || undefined,
          media: { images: raw?.images || [], videos: raw?.videos || [], coverImageUrl: raw?.coverImageUrl || null },
          aiValidation: {
            approvalStatus: aiApprovalStatus,
            violationCount: aiViolationCount,
            issues: aiValidationIssues,
            isBreaking,
          },
          audit: { createdAt: nowIsoIST(), updatedAt: nowIsoIST() },
        };

        // Upsert TenantWebArticle (prefer existing id from base article)
        try {
          let languageId: string | undefined;
          if (languageCode) {
            const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } }).catch(() => null);
            if (lang?.id) languageId = lang.id;
          }

          const primaryCategoryId = Array.isArray(raw.categoryIds) && raw.categoryIds[0]
            ? String(raw.categoryIds[0])
            : (await fallbackCategoryId() || undefined);

          const existingId = contentJson.webArticleId ? String(contentJson.webArticleId) : '';
          if (existingId) {
            await prisma.tenantWebArticle.update({
              where: { id: existingId },
              data: {
                title: webTitle,
                slug: webSlug,
                domainId: domainId || undefined,
                categoryId: primaryCategoryId,
                contentJson: webJson,
                seoTitle: webJson.meta.seoTitle,
                metaDescription: webJson.meta.metaDescription,
                jsonLd: webJson.jsonLd || undefined,
                tags,
                status: shouldPublishNow ? 'PUBLISHED' : 'DRAFT',
                publishedAt: shouldPublishNow ? new Date() : null,
                coverImageUrl: raw?.coverImageUrl || (raw?.images?.[0] || null),
                isBreaking,
                aiApprovalStatus,
                aiViolationCount,
                aiValidationIssues,
              } as any
            });
            updatedCJ.webArticleId = existingId;
          } else {
            const createdWeb = await prisma.tenantWebArticle.create({
              data: {
                tenantId: article.tenantId,
                domainId: domainId || undefined,
                authorId: article.authorId,
                languageId,
                title: webTitle,
                slug: webSlug,
                status: shouldPublishNow ? 'PUBLISHED' : 'DRAFT',
                publishedAt: shouldPublishNow ? new Date() : null,
                coverImageUrl: raw?.coverImageUrl || (raw?.images?.[0] || null),
                categoryId: primaryCategoryId,
                contentJson: webJson,
                seoTitle: webJson.meta.seoTitle,
                metaDescription: webJson.meta.metaDescription,
                jsonLd: webJson.jsonLd || undefined,
                tags,
                isBreaking,
                aiApprovalStatus,
                aiViolationCount,
                aiValidationIssues,
              } as any
            });
            updatedCJ.webArticleId = createdWeb.id;
          }
          updatedCJ.web = webJson;
        } catch (e) {
          updatedCJ.webError = String((e as any)?.message || e);
        }

        // Upsert ShortNews
        try {
          let firstCategoryId2 = (raw.categoryIds && raw.categoryIds[0]) || null;
          if (!firstCategoryId2) firstCategoryId2 = await fallbackCategoryId();
          if (!firstCategoryId2) throw new Error('MISSING_CATEGORY_ID');

          const mediaUrls = Array.from(new Set([
            ...(Array.isArray(raw.images) ? raw.images : []),
            ...(Array.isArray(raw.videos) ? raw.videos : []),
          ].map(x => String(x || '').trim()).filter(Boolean)));

          const shortTitle = String(parsed.short.title || parsed.web.title || article.title || '').trim().slice(0, 50);
          const shortSummary = String(parsed.short.subTitle || '').trim() || null;
          const shortBody = trimWords(String(parsed.short.content || parsed.web.summary || '').trim(), 60);

          const shortStatus = shouldPublishNow ? 'AI_APPROVED' : 'DESK_PENDING';

          const existingShortId = contentJson.shortNewsId ? String(contentJson.shortNewsId) : '';
          if (existingShortId) {
            await prisma.shortNews.update({
              where: { id: existingShortId },
              data: {
                title: shortTitle,
                summary: shortSummary,
                content: shortBody,
                slug: slugFromAnyLanguage(shortTitle, 80),
                categoryId: String(firstCategoryId2),
                tags: (parsed.web.keywords || []).slice(0, 7),
                featuredImage: (raw.coverImageUrl || (raw.images && raw.images[0]) || null),
                status: shortStatus,
                isBreaking,
                aiApprovalStatus,
                aiViolationCount,
                aiValidationIssues,
                mediaUrls,
                placeId: raw?.locationRef?.placeId || null,
                placeName: raw?.locationRef?.displayName || null,
                address: raw?.locationRef?.address || null,
                seo: {
                  metaTitle: parsed.web.metaTitle || shortTitle,
                  metaDescription: parsed.web.metaDescription || '',
                  tags: (parsed.web.keywords || []).slice(0, 10),
                  altTexts: {},
                } as any,
              } as any
            });
            updatedCJ.shortNewsId = existingShortId;
          } else {
            const sn = await prisma.shortNews.create({
              data: {
                title: shortTitle,
                slug: slugFromAnyLanguage(shortTitle, 80),
                summary: shortSummary,
                content: shortBody,
                language: languageCode || 'te',
                authorId: article.authorId,
                categoryId: String(firstCategoryId2),
                tags: (parsed.web.keywords || []).slice(0, 7),
                featuredImage: (raw.coverImageUrl || (raw.images && raw.images[0]) || null),
                status: shortStatus,
                isBreaking,
                aiApprovalStatus,
                aiViolationCount,
                aiValidationIssues,
                seo: {
                  metaTitle: parsed.web.metaTitle || shortTitle,
                  metaDescription: parsed.web.metaDescription || '',
                  tags: (parsed.web.keywords || []).slice(0, 10),
                  altTexts: {},
                } as any,
                mediaUrls,
                placeId: raw?.locationRef?.placeId || null,
                placeName: raw?.locationRef?.displayName || null,
                address: raw?.locationRef?.address || null,
              } as any
            });
            updatedCJ.shortDone = true;
            updatedCJ.shortNewsId = sn.id;
          }
        } catch (e) {
          updatedCJ.shortError = String((e as any)?.message || e);
        }

        updatedCJ = {
          ...updatedCJ,
          aiStatus: 'DONE',
          aiFinishedAt: nowIsoIST(),
          aiRawOutput: out,
          aiDecisionUsed: { tenantAiRewriteEnabled, aiMode, decidedEnabled, storedEnabled, promptKey: 'web_and_shortnews_ai_article' },
          aiQueue: { web: false, short: false, newspaper: false },
        };

        await prisma.article.update({
          where: { id: article.id },
          data: {
            contentJson: updatedCJ,
            ...(shouldPublishNow ? { status: 'PUBLISHED' } : {}),
          } as any
        });
        if (shouldPublishNow) {
          await (prisma as any).newspaperArticle.updateMany({ where: { baseArticleId: article.id }, data: { status: 'PUBLISHED' } }).catch(() => null);
        }
        await updateRawArticleFromBaseArticle(article, updatedCJ);
        return;
      }

      // Optional billing enforcement: skip AI if tenant exceeded monthly token limit.
      // Best-effort guard (tokens are known only after calls). This prevents runaway usage.
      try {
        const billingEnabled = flags?.aiBillingEnabled === true;
        const limit = typeof flags?.aiMonthlyTokenLimit === 'number' ? flags.aiMonthlyTokenLimit : null;
        if (billingEnabled && limit && limit > 0) {
          const nowUtc = new Date();
          const monthStart = new Date(Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth(), 1, 0, 0, 0, 0));
          const usedAgg = await (prisma as any).aiUsageEvent?.aggregate?.({
            where: { tenantId: article.tenantId, createdAt: { gte: monthStart } },
            _sum: { totalTokens: true },
          }).catch(() => null);
          const used = Number(usedAgg?._sum?.totalTokens || 0);
          if (Number.isFinite(used) && used >= limit) {
            const now = nowIsoIST();
            const updatedCJ = { ...contentJson, aiStatus: 'SKIPPED', aiSkipReason: 'TOKEN_LIMIT_EXCEEDED', aiFinishedAt: now, aiMode } as any;
            await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
            return;
          }
        }
      } catch (_) {
        // ignore billing enforcement errors
      }

      // Prompt source precedence:
      // 1) ENV (emergency override)
      // 2) DB Prompt table (recommended)
      const envRaw = tenantAiRewriteEnabled
        ? (process.env.AI_REWRITE_PROMPT_TRUE || '')
        : (process.env.AI_REWRITE_PROMPT_FALSE || '');
      const envPromptTpl = String(envRaw).trim();

      const defaultDbKey = tenantAiRewriteEnabled ? 'ai_rewrite_prompt_true' : 'ai_rewrite_prompt_false';

      // Allow ENV to either:
      // - contain the full prompt text, OR
      // - reference a DB prompt key via `db:<key>` or by setting the env value equal to the key
      const envDbRef = envPromptTpl.toLowerCase().startsWith('db:')
        ? envPromptTpl.slice(3).trim()
        : (envPromptTpl === 'ai_rewrite_prompt_true' || envPromptTpl === 'ai_rewrite_prompt_false')
          ? envPromptTpl
          : '';

      const dbKey = envDbRef || defaultDbKey;
      const dbPromptTpl = (await getPrompt(dbKey).catch(() => null)) || '';
      const promptTpl = (envDbRef ? '' : envPromptTpl) || String(dbPromptTpl || '').trim();

      // If user provided the two prompts (ENV or DB), run a SINGLE AI call and split outputs.
      if (promptTpl) {
        const rawText = buildRawText(article);
        const prompt = applyPromptTemplate(promptTpl, rawText);

        const now = nowIsoIST();
        let updatedCJ = { ...contentJson, aiStatus: 'RUNNING', aiStartedAt: now, aiMode } as any;
        await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });

        const aiRes = await aiGenerateText({ prompt, purpose: 'rewrite' as any });
        const out = normalizeText(aiRes.text || '').trim();

        const meta = extractAiValidationMeta(out);
        const rawIsBreaking = typeof raw?.isBreaking === 'boolean' ? raw.isBreaking : null;
        const isBreaking = (meta.isBreaking !== null ? meta.isBreaking : rawIsBreaking) ?? false;
        const aiViolationCount = Number.isFinite(Number(meta.aiViolationCount)) ? Number(meta.aiViolationCount) : 0;
        const aiApprovalStatus = meta.aiApprovalStatus
          ? String(meta.aiApprovalStatus).trim()
          : (aiViolationCount > 0 ? 'DESK_PENDING' : 'AI_APPROVED');
        const aiValidationIssues = meta.aiValidationIssues ?? null;

        // Persist token usage for billing/auditing (best-effort; never fail the job due to metering).
        try {
          const u: any = aiRes.usage || {};
          await (prisma as any).aiUsageEvent?.create?.({
            data: {
              tenantId: article.tenantId,
              articleId: article.id,
              provider: String(u.provider || (process.env.AI_PROVIDER || '') || 'unknown'),
              model: u.model ? String(u.model) : null,
              purpose: 'rewrite',
              promptTokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : null,
              completionTokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : null,
              totalTokens: typeof u.total_tokens === 'number' ? u.total_tokens : null,
              promptChars: typeof u.promptChars === 'number' ? u.promptChars : (typeof prompt === 'string' ? prompt.length : null),
              responseChars: typeof u.responseChars === 'number' ? u.responseChars : (typeof out === 'string' ? out.length : null),
              rawUsage: u && Object.keys(u).length ? u : null,
            }
          });
        } catch (_) {
          // ignore
        }

        if (!out) {
          updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'EMPTY_AI_OUTPUT', aiFinishedAt: nowIsoIST() };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          return;
        }

        // Parse and persist
        if (aiMode === 'FULL') {
          const parsed = parseTrueOutput(out);
          if (!parsed) {
            updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'PARSE_TRUE_FAILED', aiFinishedAt: nowIsoIST(), aiRawOutput: out };
            await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
            return;
          }

          // Update/Upsert NewspaperArticle linked to this base article
          try {
            const existing = await prisma.newspaperArticle.findFirst({ where: { baseArticleId: article.id } }).catch(() => null) as any;
            let languageId: string | null = null;
            if (languageCode) {
              const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } }).catch(() => null);
              if (lang?.id) languageId = lang.id;
            }
            const npTitle = parsed.newspaper.title || article.title;
            const npContent = parsed.newspaper.content || article.content;
            const points = (parsed.newspaper.keyPoints || []).slice(0, 5).map(p => {
              const s = String(p || '').trim();
              // enforce 4-5 word constraint best-effort
              const w = words(s);
              if (w > 5) return s.split(/\s+/).slice(0, 5).join(' ');
              return s;
            });
            const dateline = String(raw?.dateline || '');
            const placeName = (raw?.locationRef?.displayName != null) ? String(raw.locationRef.displayName) : null;
            const loc = raw?.locationRef || {};
            const primaryCategoryId = Array.isArray(raw.categoryIds) && raw.categoryIds[0] ? String(raw.categoryIds[0]) : null;
            if (existing?.id) {
              await (prisma as any).newspaperArticle.update({
                where: { id: existing.id },
                data: {
                  title: npTitle,
                  subTitle: parsed.newspaper.subtitle || null,
                  heading: parsed.newspaper.subtitle || npTitle,
                  points,
                  dateline,
                  content: npContent,
                  placeName,
                  languageId: languageId || undefined,
                  categoryId: primaryCategoryId,
                  stateId: loc?.stateId || null,
                  districtId: loc?.districtId || null,
                  mandalId: loc?.mandalId || null,
                  villageId: loc?.villageId || null,
                }
              });
              updatedCJ.newspaperArticleId = existing.id;
            } else {
              const created = await (prisma as any).newspaperArticle.create({
                data: {
                  tenantId: article.tenantId,
                  authorId: article.authorId,
                  languageId: languageId || undefined,
                  baseArticleId: article.id,
                  categoryId: primaryCategoryId,
                  title: npTitle,
                  subTitle: parsed.newspaper.subtitle || null,
                  heading: parsed.newspaper.subtitle || npTitle,
                  points,
                  dateline,
                  content: npContent,
                  placeName,
                  stateId: loc?.stateId || null,
                  districtId: loc?.districtId || null,
                  mandalId: loc?.mandalId || null,
                  villageId: loc?.villageId || null,
                  status: 'DRAFT',
                } as any
              });
              updatedCJ.newspaperArticleId = created.id;
            }
          } catch (e) {
            updatedCJ.newspaperError = String((e as any)?.message || e);
          }

          // Upsert TenantWebArticle
          try {
            let languageId: string | undefined;
            if (languageCode) {
              const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } }).catch(() => null);
              if (lang?.id) languageId = lang.id;
            }
            const webTitle = (parsed.web.seoTitle || article.title || 'Article').trim();
            const webSlug = slugFromAnyLanguage(parsed.web.slug || webTitle, 120);
            const contentHtml = buildSimpleHtmlFromPlainText(parsed.web.content);
            const plainText = parsed.web.content || article.content || '';
            const tags = (parsed.web.keywords || []).slice(0, 10);
            const canonicalUrl = domainName ? `https://${domainName}/articles/${webSlug}` : `/articles/${webSlug}`;
            const jsonLd = buildNewsArticleJsonLd({
              headline: webTitle,
              description: parsed.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
              canonicalUrl,
              imageUrls: Array.isArray(raw.images) ? raw.images.slice(0, 3) : [],
              languageCode: languageCode || undefined,
              datePublished: shouldPublish ? (raw.publishedAt || nowIsoIST()) : undefined,
              dateModified: nowIsoIST(),
              keywords: tags,
              articleSection: Array.isArray(raw.categoryIds) && raw.categoryIds[0] ? String(raw.categoryIds[0]) : undefined,
              wordCount: words(plainText),
            });
            const webJson: any = {
              title: webTitle,
              subtitle: '',
              slug: webSlug,
              contentHtml,
              plainText,
              tags,
              categories: Array.isArray(raw.categoryIds) ? raw.categoryIds : [],
              meta: {
                seoTitle: parsed.web.seoTitle || webTitle,
                metaDescription: parsed.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
              },
              jsonLd,
              publisher: (raw && (raw as any).publisher) ? (raw as any).publisher : undefined,
              locationRef: raw?.locationRef || undefined,
              media: { images: raw?.images || [], videos: raw?.videos || [], coverImageUrl: raw?.coverImageUrl || null },
              aiValidation: {
                approvalStatus: aiApprovalStatus,
                violationCount: aiViolationCount,
                issues: aiValidationIssues,
                isBreaking,
              },
              blocks: [],
              audit: { createdAt: nowIsoIST(), updatedAt: nowIsoIST() },
            };
            const existingWeb = await prisma.tenantWebArticle.findFirst({ where: { tenantId: article.tenantId, authorId: article.authorId, slug: webSlug } }).catch(() => null) as any;
            const primaryCategoryId = Array.isArray(raw.categoryIds) && raw.categoryIds[0]
              ? String(raw.categoryIds[0])
              : (await fallbackCategoryId() || undefined);
            if (existingWeb?.id) {
              await prisma.tenantWebArticle.update({
                where: { id: existingWeb.id },
                data: {
                  title: webTitle,
                  slug: webSlug,
                  domainId: domainId || undefined,
                  categoryId: primaryCategoryId,
                  contentJson: webJson,
                  seoTitle: webJson.meta.seoTitle,
                  metaDescription: webJson.meta.metaDescription,
                  jsonLd: webJson.jsonLd || undefined,
                  tags,
                  isBreaking,
                  aiApprovalStatus,
                  aiViolationCount,
                  aiValidationIssues,
                } as any
              });
              updatedCJ.webArticleId = existingWeb.id;
            } else {
              const createdWeb = await prisma.tenantWebArticle.create({
                data: {
                  tenantId: article.tenantId,
                  domainId: domainId || undefined,
                  authorId: article.authorId,
                  languageId,
                  title: webTitle,
                  slug: webSlug,
                  status: 'DRAFT',
                  categoryId: primaryCategoryId,
                  contentJson: webJson,
                  seoTitle: webJson.meta.seoTitle,
                  metaDescription: webJson.meta.metaDescription,
                  jsonLd: webJson.jsonLd || undefined,
                  tags,
                  isBreaking,
                  aiApprovalStatus,
                  aiViolationCount,
                  aiValidationIssues,
                } as any
              });
              updatedCJ.webArticleId = createdWeb.id;
            }
            // Also keep inside article contentJson for debugging
            updatedCJ.web = webJson;
          } catch (e) {
            updatedCJ.webError = String((e as any)?.message || e);
          }

          // Create ShortNews (requires categoryId)
          try {
            let firstCategoryId = (raw.categoryIds && raw.categoryIds[0]) || null;
            if (!firstCategoryId) firstCategoryId = await fallbackCategoryId();
            if (firstCategoryId) {
              const locRef = (raw && (raw as any).locationRef) ? (raw as any).locationRef : null;
              const shortTitle = String(parsed.short.title || article.title || '').trim().slice(0, 50);
              const shortBody = trimWords(String(parsed.short.content || '').trim(), 60);

              const mediaUrls = Array.from(new Set([
                ...(Array.isArray(raw.images) ? raw.images : []),
                ...(Array.isArray(raw.videos) ? raw.videos : []),
              ].map(x => String(x || '').trim()).filter(Boolean)));

              const shortStatus = aiViolationCount > 0
                ? 'DESK_PENDING'
                : (shouldPublish ? 'AI_APPROVED' : 'DESK_PENDING');

              const sn = await prisma.shortNews.create({
                data: {
                  title: shortTitle,
                  slug: slugFromAnyLanguage(shortTitle, 80),
                  content: shortBody,
                  language: languageCode || 'te',
                  authorId: article.authorId,
                  categoryId: firstCategoryId,
                  tags: (parsed.web.keywords || []).slice(0, 7),
                  featuredImage: (raw.images && raw.images[0]) ? raw.images[0] : null,
                  status: shortStatus,
                  isBreaking,
                  aiApprovalStatus,
                  aiViolationCount,
                  aiValidationIssues,
                  seo: {
                    metaTitle: parsed.web.seoTitle || shortTitle,
                    metaDescription: parsed.web.metaDescription || '',
                    tags: (parsed.web.keywords || []).slice(0, 10),
                    altTexts: {},
                  } as any,
                  mediaUrls,
                  placeId: locRef?.placeId || null,
                  placeName: locRef?.displayName || null,
                  address: locRef?.address || null,
                } as any
              });
              updatedCJ.shortDone = true;
              updatedCJ.shortNewsId = sn.id;
            } else {
              updatedCJ.shortError = 'MISSING_CATEGORY_ID';
            }
          } catch (e) {
            updatedCJ.shortError = String((e as any)?.message || e);
          }

          updatedCJ = {
            ...updatedCJ,
            aiStatus: 'DONE',
            aiFinishedAt: nowIsoIST(),
            aiRawOutput: out,
            aiDecisionUsed: { tenantAiRewriteEnabled, aiMode, decidedEnabled, storedEnabled },
            aiQueue: { web: false, short: false, newspaper: false },
          };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          return;
        }

        // LIMITED mode
        const parsed2 = parseFalseOutput(out);
        if (!parsed2) {
          updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'PARSE_FALSE_FAILED', aiFinishedAt: nowIsoIST(), aiRawOutput: out };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          return;
        }

        // Web: DO NOT rewrite content; use original title/content but update SEO only
        try {
          let languageId: string | undefined;
          if (languageCode) {
            const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } }).catch(() => null);
            if (lang?.id) languageId = lang.id;
          }
          const originalTitle = String(raw.title || article.title || '').trim();
          const webTitle = originalTitle;
          const webSlug = slugFromAnyLanguage(parsed2.web.slug || originalTitle, 120);
          const plainText = String(raw.content || article.content || '').trim();
          const contentHtml = buildSimpleHtmlFromPlainText(plainText);
          const tags = (parsed2.web.keywords || []).slice(0, 10);

          const canonicalUrl = domainName ? `https://${domainName}/articles/${webSlug}` : `/articles/${webSlug}`;
          const jsonLd = buildNewsArticleJsonLd({
            headline: webTitle,
            description: parsed2.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
            canonicalUrl,
            imageUrls: Array.isArray(raw.images) ? raw.images.slice(0, 3) : [],
            languageCode: languageCode || undefined,
            datePublished: shouldPublish ? (raw.publishedAt || nowIsoIST()) : undefined,
            dateModified: nowIsoIST(),
            keywords: tags,
            articleSection: Array.isArray(raw.categoryIds) && raw.categoryIds[0] ? String(raw.categoryIds[0]) : undefined,
            wordCount: words(plainText),
          });

          const webJson: any = {
            title: webTitle,
            slug: webSlug,
            contentHtml,
            plainText,
            tags,
            categories: Array.isArray(raw.categoryIds) ? raw.categoryIds : [],
            meta: {
              seoTitle: parsed2.web.seoTitle || webTitle,
              metaDescription: parsed2.web.metaDescription || trimWords(plainText, 24).slice(0, 160),
              schemaFocusKeywords: parsed2.web.schemaFocusKeywords || [],
            },
            jsonLd,
            audit: { createdAt: nowIsoIST(), updatedAt: nowIsoIST() },
          };

          // Try to find existing web article previously created for this base article
          const existingId = contentJson.webArticleId ? String(contentJson.webArticleId) : null;
          const primaryCategoryId = Array.isArray(raw.categoryIds) && raw.categoryIds[0]
            ? String(raw.categoryIds[0])
            : (await fallbackCategoryId() || undefined);
          if (existingId) {
            await prisma.tenantWebArticle.update({
              where: { id: existingId },
              data: {
                title: webTitle,
                slug: webSlug,
                domainId: domainId || undefined,
                categoryId: primaryCategoryId,
                contentJson: webJson,
                seoTitle: webJson.meta.seoTitle,
                metaDescription: webJson.meta.metaDescription,
                jsonLd: webJson.jsonLd || undefined,
                tags,
                status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
                publishedAt: shouldPublish ? new Date() : null,
              } as any
            });
            updatedCJ.webArticleId = existingId;
          } else {
            const createdWeb = await prisma.tenantWebArticle.create({
              data: {
                tenantId: article.tenantId,
                domainId: domainId || undefined,
                authorId: article.authorId,
                languageId,
                title: webTitle,
                slug: webSlug,
                status: shouldPublish ? 'PUBLISHED' : 'DRAFT',
                categoryId: primaryCategoryId,
                contentJson: webJson,
                seoTitle: webJson.meta.seoTitle,
                metaDescription: webJson.meta.metaDescription,
                jsonLd: webJson.jsonLd || undefined,
                tags,
                publishedAt: shouldPublish ? new Date() : null,
              } as any
            });
            updatedCJ.webArticleId = createdWeb.id;
          }

          updatedCJ.web = webJson;
        } catch (e) {
          updatedCJ.webError = String((e as any)?.message || e);
        }

        // ShortNews rewrite
        try {
          let firstCategoryId = (raw.categoryIds && raw.categoryIds[0]) || null;
          if (!firstCategoryId) firstCategoryId = await fallbackCategoryId();
          if (firstCategoryId) {
            const locRef = (raw && (raw as any).locationRef) ? (raw as any).locationRef : null;
            const shortTitle = String(parsed2.short.title || article.title || '').trim().slice(0, 50);
            const shortBody = trimWords(String(parsed2.short.content || '').trim(), 60);
            const sn = await prisma.shortNews.create({
              data: {
                title: shortTitle,
                slug: slugFromAnyLanguage(shortTitle, 80),
                content: shortBody,
                language: languageCode || 'te',
                authorId: article.authorId,
                categoryId: firstCategoryId,
                tags: (parsed2.web.keywords || []).slice(0, 7),
                featuredImage: (raw.images && raw.images[0]) ? raw.images[0] : null,
                status: shouldPublish ? 'AI_APPROVED' : 'DESK_PENDING',
                seo: {
                  metaTitle: parsed2.web.seoTitle || shortTitle,
                  metaDescription: parsed2.web.metaDescription || '',
                  tags: (parsed2.web.keywords || []).slice(0, 10),
                  altTexts: {},
                } as any,
                mediaUrls: raw.images || [],
                placeId: locRef?.placeId || null,
                placeName: locRef?.displayName || null,
                address: locRef?.address || null,
              } as any
            });
            updatedCJ.shortDone = true;
            updatedCJ.shortNewsId = sn.id;
          } else {
            updatedCJ.shortError = 'MISSING_CATEGORY_ID';
          }
        } catch (e) {
          updatedCJ.shortError = String((e as any)?.message || e);
        }

        updatedCJ = {
          ...updatedCJ,
          aiStatus: 'DONE',
          aiFinishedAt: nowIsoIST(),
          aiRawOutput: out,
          aiQueue: { web: false, short: false, newspaper: false },
        };
        await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
        return;
      }
    } catch (e) {
      // If combined mode fails, fall back to old per-prompt pipeline.
    }
  }
  const payload = {
    tenantId: article.tenantId,
    languageCode,
    authorId: article.authorId,
    categoryIds: raw.categoryIds || [],
    images: raw.images || article.images || [],
    isPublished: shouldPublish,
    raw
  };
  const provider = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY ? 'gemini' : 'chatgpt';

  const now = nowIsoIST();
  let updatedCJ = { ...contentJson, aiStatus: 'RUNNING', aiStartedAt: now } as any;
  await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });

  // WEB
  if (queue.web && !contentJson.web) {
    const prompt = await buildWebPrompt(provider as any, payload);
    const aiRes = await aiGenerateText({ prompt, purpose: 'rewrite' as any });
    const aiRaw = aiRes.text;
    if (aiRaw) {
      try {
        const jsonText = aiRaw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        let webJson = JSON.parse(jsonText);
        if (typeof webJson?.contentHtml === 'string') webJson.contentHtml = sanitizeHtmlAllowlist(webJson.contentHtml);
        // Harden title and slug
        const badTitle = (t: any) => { const s = String(t || '').trim(); return !s || /^-+$/.test(s); };
        if (badTitle(webJson.title)) {
          const h1 = Array.isArray(webJson.blocks) ? (webJson.blocks.find((b: any) => b?.type === 'h1')?.text || '') : '';
          webJson.title = String(h1 || raw?.title || article.title || 'Untitled Article').trim();
        }
        if (!webJson.slug && webJson.title) webJson.slug = slugFromAnyLanguage(String(webJson.title), 120);
        // Ensure jsonLd exists
        try {
          if (!webJson.jsonLd || typeof webJson.jsonLd !== 'object') {
            const coverUrl = webJson?.coverImage?.url || (payload.images?.[0] || undefined);
            webJson.jsonLd = buildNewsArticleJsonLd({
              headline: String(webJson.title || article.title || 'Article').slice(0, 110),
              description: String(webJson?.meta?.metaDescription || trimWords(String(webJson.plainText || article.content || ''), 24)).slice(0, 160),
              canonicalUrl: '',
              imageUrls: coverUrl ? [coverUrl] : [],
              languageCode: String(webJson.languageCode || languageCode || 'en'),
              datePublished: webJson.publishedAt,
              dateModified: webJson.audit?.updatedAt || webJson.publishedAt,
              authorName: '',
            });
          }
        } catch {}
        const coverUrl = webJson?.coverImage?.url || (payload.images?.[0] || null);
        if (!webJson.coverImage) webJson.coverImage = { url: coverUrl, alt: webJson?.title || '', caption: '' };
        webJson.publishedAt = webJson.publishedAt || now;
        webJson.audit = webJson.audit || {};
        webJson.audit.createdAt = webJson.audit.createdAt || now;
        webJson.audit.updatedAt = now;
        webJson.audit.createdBy = webJson.audit.createdBy || payload.authorId;
        webJson.audit.updatedBy = payload.authorId;
        const usageList = Array.isArray(updatedCJ.aiUsage) ? updatedCJ.aiUsage : [];
        if (aiRes.usage) usageList.push(aiRes.usage);
        updatedCJ = { ...updatedCJ, web: webJson, aiUsage: usageList };
      } catch { }
    }
  }

  // SHORT
  if (queue.short && !contentJson.shortDone) {
    const rawText = `${article.title}\n${article.content}`;
    let prompt = `Return ONLY JSON: {"title": string (<=35 chars), "content": string (60 words), "suggestedCategoryName": string}. Use the following text as source, do not invent details. Text: ${JSON.stringify(rawText)}`;
    const envShort = (process.env.SHORTNEWS_PROMPT || '').trim();
    if (envShort) prompt = renderTemplate(envShort, { RAW_TEXT: rawText });
    else {
      const tpl = await getPrompt('shortnews_ai_article');
      if (tpl) prompt = renderTemplate(tpl, { RAW_TEXT: rawText });
    }
    const draft = await generateAiShortNewsFromPrompt(rawText, prompt, async (p) => {
      const r = await aiGenerateText({ prompt: p, purpose: 'shortnews_ai_article' as any });
      if (r.usage) {
        const usageList = Array.isArray(updatedCJ.aiUsage) ? updatedCJ.aiUsage : [];
        usageList.push(r.usage);
        updatedCJ.aiUsage = usageList;
      }
      return r.text;
    });
    const shortTitle = draft.title.slice(0, 35);
    const shortBody = trimWords(draft.content, 60);
    const firstCategoryId = (raw.categoryIds && raw.categoryIds[0]) || null;
    if (firstCategoryId) {
      try {
        const locRef = (raw && (raw as any).locationRef) ? (raw as any).locationRef : null;
        const short = await prisma.shortNews.create({
          data: {
            title: shortTitle,
            slug: slugFromAnyLanguage(shortTitle, 80),
            content: shortBody,
            language: languageCode || 'te',
            authorId: article.authorId,
            categoryId: firstCategoryId,
            tags: Array.isArray(updatedCJ?.web?.tags) ? updatedCJ.web.tags.slice(0, 7) : [],
            featuredImage: (updatedCJ?.web?.coverImage?.url) || (payload.images?.[0] || null),
            status: shouldPublish ? 'AI_APPROVED' : 'DESK_PENDING',
            seo: updatedCJ?.web?.meta ? updatedCJ.web.meta : undefined,
            headings: draft.headings ? (draft.headings as any) : undefined,
            mediaUrls: payload.images || [],
            placeId: locRef?.placeId || null,
            placeName: locRef?.displayName || null,
            address: locRef?.address || null,
          }
        });
        updatedCJ = { ...updatedCJ, shortDone: true, shortNewsId: short.id };
      } catch (e) {
        updatedCJ = { ...updatedCJ, shortError: String(e && (e as any).message || e) };
      }
    }
  }

  // NEWSPAPER
  if (queue.newspaper && !contentJson.newspaperArticleId) {
    // Enforce per-reporter per-tenant daily limit (2)
    const { start, end } = (function computeISTDayBounds(date: Date) {
      const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
      const istMs = utcMs + 5.5 * 3600000;
      const d = new Date(istMs);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const day = d.getUTCDate();
      const startIst = Date.UTC(y, m, day, 0, 0, 0) - 5.5 * 3600000;
      const endIst = Date.UTC(y, m, day, 23, 59, 59, 999) - 5.5 * 3600000;
      return { start: new Date(startIst), end: new Date(endIst) };
    })(new Date());

    let count = 0;
    try {
      count = await prisma.newspaperArticle.count({
        where: { authorId: article.authorId, tenantId: article.tenantId, createdAt: { gte: start, lte: end } }
      });
    } catch { /* ignore if table missing, but migration should exist now */ }

    if (count >= 2) {
      updatedCJ = { ...updatedCJ, newspaperError: 'DAILY_LIMIT_REACHED' };
    } else {
      const provider2 = provider as any;
      const base = {
        tenantId: article.tenantId,
        languageCode,
        authorId: article.authorId,
        categoryIds: raw.categoryIds || [],
        images: raw.images || article.images || [],
        isPublished: false,
        raw
      };

      let npPrompt = '';
      if (provider2 === 'gemini') npPrompt = (process.env.NEWSPAPER_PROMPT_GEMINI || '').trim();

      if (!npPrompt) {
        // Fallback default prompt
        npPrompt = `You are a professional newspaper editor.
Input: A raw report JSON.
Task: Write a print-ready newspaper article in language "${languageCode}".
Output: A single valid JSON object (no markdown).

JSON Schema:
{
  "title": "String (Short, punchy headline, max 6 words)",
  "subTitle": "String (Optional kicker/deck)",
  "heading": "String (Formal news heading, max 10 words)",
  "dateline": "String (City, Date format e.g., 'Adilabad, Dec 6')",
  "points": ["String", "String", "String"], // 3-4 key highlights
  "content": "String (Main body text, 150-200 words, factual tone)",
  "placeName": "String (Extracted city/location)"
}

Raw Input:
${JSON.stringify({ title: article.title, content: article.content, raw: base.raw })}`;
      }

      const npRes = await aiGenerateText({ prompt: npPrompt, purpose: 'newspaper' as any });
      const npText = npRes.text;
      let npJson: any = {};
      try {
        const jsonText = npText.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
        npJson = JSON.parse(jsonText);
      } catch (e) {
        console.error("Newspaper JSON parse error", e);
      }

      if (npJson && npJson.title) {
        try {
          // Create NewspaperArticle
          const createdStats = await prisma.newspaperArticle.create({
            data: {
              tenantId: article.tenantId,
              authorId: article.authorId,
              languageId: article.languageId,
              baseArticleId: article.id,
              title: npJson.title || article.title,
              subTitle: npJson.subTitle || null,
              heading: npJson.heading || article.title,
              points: npJson.points || [],
              dateline: npJson.dateline || '',
              content: npJson.content || article.content,
              placeName: npJson.placeName || null,
              status: 'DRAFT'
            }
          });
          const usageList = Array.isArray(updatedCJ.aiUsage) ? updatedCJ.aiUsage : [];
          if (npRes.usage) usageList.push(npRes.usage);
          updatedCJ = { ...updatedCJ, newspaperArticleId: createdStats.id, aiUsage: usageList };
        } catch (e) {
          updatedCJ = { ...updatedCJ, newspaperError: String((e as any)?.message) };
        }
      } else {
        updatedCJ = { ...updatedCJ, newspaperError: "AI_EMPTY_RESPONSE" };
      }
    }
  }

  updatedCJ = { ...updatedCJ, aiStatus: 'DONE', aiFinishedAt: now, aiQueue: { ...updatedCJ.aiQueue, web: false, short: false, newspaper: false } };
  await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
  await updateRawArticleFromBaseArticle(article, updatedCJ);
}

async function main(): Promise<number> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const batch = await prisma.article.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 500
  });
  const pending = batch.filter((a: any) => {
    const cj = a.contentJson || {};
    const q = cj.aiQueue || {};
    return (q.web && !cj.web) || (q.short && !cj.shortDone) || (q.newspaper && !cj.newspaperArticleId);
  });
  for (const art of pending) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processOne(art);
    } catch (e) {
      // mark failed
      const cj = (art as any).contentJson || {};
      const failedCJ = { ...cj, aiStatus: 'FAILED', aiError: String((e as any)?.message || e) };
      await prisma.article.update({ where: { id: art.id }, data: { contentJson: failedCJ } });
      await updateRawArticleFromBaseArticle(art, failedCJ);
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Processed ${pending.length} queued articles.`);
  return pending.length;
}

export async function runOnce(): Promise<number> {
  return await main();
}

if (require.main === module) {
  runOnce().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
