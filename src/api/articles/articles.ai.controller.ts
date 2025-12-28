import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { aiGenerateText } from '../../lib/aiProvider';
import { getPrompt as getDbPrompt } from '../../lib/prompts';
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../../lib/sanitize';
import { generateAiShortNewsFromPrompt } from '../shortnews/shortnews.ai';

type GenerateMode = 'web' | 'web+short' | 'web+newspaper';

function nowIsoIST(): string {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const ist = new Date(utc + (5.5 * 60 * 60 * 1000));
  return ist.toISOString().replace('Z', '+05:30');
}

function parseJsonLenient(input: string): any {
  let t = String(input || '').trim();
  if (!t) throw new Error('empty');
  // Strip fenced code blocks
  t = t.replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
  try {
    return JSON.parse(t);
  } catch {}
  // Extract first '{' to last '}' window and try parse
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    const sub = t.slice(first, last + 1);
    try { return JSON.parse(sub); } catch {}
  }
  // Remove BOM and non-printables, retry
  const cleaned = t.replace(/^[\uFEFF\u200B]+/, '').replace(/[\u0000-\u001F]+/g,' ');
  try { return JSON.parse(cleaned); } catch {}
  throw new Error('invalid_json');
}

function countParagraphWords(blocks: any[]): number {
  if (!Array.isArray(blocks)) return 0;
  const text = blocks
    .filter(b => b && typeof b === 'object' && b.type === 'p' && typeof b.text === 'string')
    .map(b => String(b.text))
    .join(' ');
  return String(text).trim().split(/\s+/).filter(Boolean).length;
}

// Extract the largest plausible JSON object from arbitrary text.
function extractLargestJson(text: string): any {
  const str = String(text || '');
  let bestObj: string | null = null;
  let bestArr: string | null = null;
  let depth = 0;
  let start = -1;
  let inString = false;
  let escape = false;
  // Scan for objects { ... }
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        const candidate = str.slice(start, i + 1);
        bestObj = candidate; // keep last largest top-level object
        start = -1;
      }
    }
  }
  // Scan for arrays [ ... ]
  depth = 0; start = -1; inString = false; escape = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) { escape = false; }
      else if (ch === '\\') { escape = true; }
      else if (ch === '"') { inString = false; }
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '[') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ']') {
      if (depth > 0) depth--;
      if (depth === 0 && start >= 0) {
        const candidate = str.slice(start, i + 1);
        bestArr = candidate; // last largest top-level array
        start = -1;
      }
    }
  }

  const pick = bestObj || bestArr;
  if (pick) {
    try {
      return JSON.parse(pick);
    } catch {
      const trimmed = pick.trim();
      return JSON.parse(trimmed);
    }
  }
  throw new Error('No JSON found');
}

async function resolveTenantScope(req: Request, bodyTenantId?: string, bodyDomainId?: string): Promise<{ tenantId: string } | { error: string; status: number }> {
  const user: any = (req as any).user;
  if (!user || !user.role) return { error: 'Unauthorized', status: 401 };
  const roleName = user.role.name;
  if (roleName === 'SUPER_ADMIN') {
    if (bodyTenantId) return { tenantId: bodyTenantId };
    if (bodyDomainId) {
      const dom = await prisma.domain.findUnique({ where: { id: bodyDomainId } });
      if (!dom) return { error: 'Domain not found', status: 400 };
      return { tenantId: dom.tenantId };
    }
    const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
    if (rep?.tenantId) return { tenantId: rep.tenantId };
    return { error: 'tenantId or domainId required for SUPER_ADMIN', status: 400 };
  }
  if (['TENANT_ADMIN', 'REPORTER', 'ADMIN_EDITOR', 'NEWS_MODERATOR'].includes(roleName)) {
    const rep = await (prisma as any).reporter.findFirst({ where: { userId: user.id }, select: { tenantId: true } }).catch(() => null);
    if (!rep?.tenantId) return { error: 'Reporter profile not linked to tenant', status: 403 };
    if (bodyTenantId && bodyTenantId !== rep.tenantId) return { error: 'Tenant scope mismatch', status: 403 };
    return { tenantId: rep.tenantId };
  }
  return { error: 'Forbidden', status: 403 };
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return Object.keys(vars).reduce((acc, k) => {
    const a = acc.split(`{{${k}}}`).join(vars[k]);
    return a.split(`{${k}}`).join(vars[k]);
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
    // Prefer DB prompt first
    const dbTpl = await getDbPrompt('ai_web_article_json' as any).catch(() => '') as any;
    if (dbTpl && typeof dbTpl === 'string' && dbTpl.trim()) return renderTemplate(dbTpl.trim(), vars);
    // No env prompt fallback; use built-in default only
    return (
      `You are an article formatter and SEO assistant. Input: a small editor payload follows. Output: a single JSON object only (no commentary). Sanitize HTML (allow only <p>,<h1>-<h3>,<ul>,<ol>,<li>,<strong>,<em>,<a>,<figure>,<img>,<figcaption>). Use ISO 8601 for dates. If languageCode is "te", produce Telugu article text; metadata can be English or Telugu. Preserve user text; do not invent facts.

Payload:
${JSON.stringify({
  tenantId: payload.tenantId,
  languageCode: payload.languageCode,
  authorId: payload.authorId,
  categoryIds: payload.categoryIds,
  images: payload.images,
  isPublished: Boolean(payload.isPublished),
  raw: '{RAW_JSON}'
}, null, 2).replace('"{RAW_JSON}"', RAW_JSON)}

Return JSON with fields: tenantId, languageCode, slug, title, subtitle, excerpt, authors, status, publishedAt, readingTimeMin, categories, tags, coverImage, blocks, contentHtml, plainText, meta, jsonLd, audit.

Rules:
1. Create slug from title, kebab-case, <=120 chars.
2. Authors: [{id: authorId, name:"", role:"reporter"}].
3. Status = "published" if isPublished true else "draft".
4. publishedAt / audit createdAt/updatedAt use current timestamp in +05:30 ISO format.
5. readingTimeMin = max(1, round(words/200)).
6. blocks: canonicalize raw. If raw has multiple h1, keep first as h1, convert others to h2.
7. contentHtml: render blocks to clean HTML, use <figure> for images.
8. plainText: headings on new lines, lists as "- item".
9. excerpt: 18-30 words.
10. tags: 3-7 short tags.
11. meta.seoTitle <=60 chars; metaDescription 110-155 chars.
12. jsonLd: NewsArticle with headline, image[], datePublished, dateModified, author, publisher (include logo as empty string if unknown).
13. Do not make up numbers or claims not in raw.
14. Output only valid JSON.`
    );
  }
  // Prefer DB prompt first
  const dbTpl2 = await getDbPrompt('ai_web_article_json' as any).catch(() => '') as any;
  if (dbTpl2 && typeof dbTpl2 === 'string' && dbTpl2.trim()) return renderTemplate(dbTpl2.trim(), vars);
  // No env prompt fallback; use built-in default only
  return (
    `You are a production-ready article formatter and SEO assistant. Always follow instructions exactly. Output must be valid JSON only (no surrounding markdown, explanation, or commentary). Validate and sanitize HTML, allow only <p>, <h1>-<h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <figure>, <img>, and <figcaption>. If any required field cannot be generated, fill with an empty string or empty array. Use ISO 8601 for dates. Use server timezone +05:30 if a date is needed. Do not invent facts — preserve user text. Keep metadata concise and SEO-friendly. If input language is Telugu (languageCode = "te"), produce article text in Telugu; metadata (seoTitle, metaDescription) may be in English or Telugu but keep it short. Return only one JSON object.

${JSON.stringify({ raw: payload.raw || {} }, null, 2)}
`
  );
}

function buildShortNewsPrompt(rawText: string): string {
  return `Return ONLY JSON: {"title": string (<=35 chars), "content": string (60 words), "suggestedCategoryName": string}. Use the following text as source, do not invent details. Text: ${JSON.stringify(rawText)}`;
}

async function buildMarkdownPrompt(payload: any): Promise<string | null> {
  const rawText = typeof payload?.raw === 'object' ? `${payload?.raw?.title || ''}\n\n${payload?.raw?.content || ''}` : '';
  const tpl = await getDbPrompt('ai_web_article_markdown' as any).catch(() => '') as any;
  if (tpl && typeof tpl === 'string' && tpl.trim()) {
    return tpl.replace(/\{\{RAW_TEXT\}\}/g, rawText);
  }
  return null;
}

function computeISTDayBounds(date: Date) {
  const utcMs = date.getTime() + (date.getTimezoneOffset() * 60000);
  const istMs = utcMs + 5.5 * 3600000;
  const d = new Date(istMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const day = d.getUTCDate();
  const startIst = Date.UTC(y, m, day, 0, 0, 0) - 5.5 * 3600000;
  const endIst = Date.UTC(y, m, day, 23, 59, 59, 999) - 5.5 * 3600000;
  return { start: new Date(startIst), end: new Date(endIst) };
}

export const composeAIArticleController = async (req: Request, res: Response) => {
  try {
    // Header to control generation strategy
    const modeHeader = String(req.headers['x-generate'] || 'web').toLowerCase();
    const mode: GenerateMode = (['web', 'web+short', 'web+newspaper'] as string[]).includes(modeHeader)
      ? (modeHeader as GenerateMode)
      : 'web';

    const { tenantId: tenantIdBody, domainId, title, content, languageCode, images = [], categoryIds = [], isPublished = false, raw = {} } = req.body || {};
    if (!title || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'title, content, categoryIds are required' });
    }

    // Resolve tenant scope / author
    const scope = await resolveTenantScope(req, tenantIdBody, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    const user: any = (req as any).user;
    const authorId: string = user.id;

    // Resolve languageId if provided
    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
      if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });
      languageId = lang.id;
    } else {
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      languageId = author?.languageId || null;
    }

    // Create base Article with raw content
    const baseArticle = await prisma.article.create({
      data: {
        title,
        content,
        type: 'reporter',
        status: isPublished ? 'PUBLISHED' : 'DRAFT',
        authorId,
        tenantId,
        languageId: languageId || undefined,
        images,
        categories: { connect: categoryIds.map((id: string) => ({ id })) },
        contentJson: {
          raw: { ...raw, title, content, images, categoryIds, languageCode },
          aiQueue: { web: true, short: false, newspaper: false },
          aiStatus: 'PENDING',
          aiCreatedAt: new Date().toISOString(),
        }
      }
    });

    return res.status(202).json({
      message: 'Web article generation queued successfully',
      articleId: baseArticle.id,
      queued: { web: true, short: false, newspaper: false },
      statusUrl: `/api/v1/articles/${baseArticle.id}`,
    });

    // Build provider-specific prompt and call AI
    const provider = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY ? 'gemini' : 'chatgpt';
    const payload = { tenantId, languageCode: languageCode || '', authorId, categoryIds, images, isPublished, raw: { ...raw, title, content } };
      const webPrompt = await buildWebPrompt(provider as any, payload);
    const aiRes = await aiGenerateText({ prompt: webPrompt, purpose: 'rewrite' as any });
    let aiRaw = aiRes.text;
    if (!aiRaw) {
      return res.status(500).json({ error: 'AI generation failed (empty response)' });
    }
    let webJson: any;
    try {
      webJson = parseJsonLenient(aiRaw);
    } catch {
      // Attempt extraction from original aiRaw
      try {
        webJson = extractLargestJson(aiRaw);
      } catch {
        // Retry once with stricter instruction to return ONLY JSON
        const strictPrompt = `${webPrompt}\n\nIMPORTANT: Return ONLY a single valid JSON object with the exact keys specified. Do not include markdown, code fences, explanations, or any text before/after the JSON.`;
        const retryRes = await aiGenerateText({ prompt: strictPrompt, purpose: 'rewrite' as any });
        const retryText = retryRes.text || '';
        try {
          webJson = parseJsonLenient(retryText);
          aiRaw = retryText;
        } catch {
          try {
            webJson = extractLargestJson(retryText);
            aiRaw = retryText;
          } catch {
            // Persist aiRaw to DB for diagnostics
            await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw: retryText || aiRaw, aiError: 'INVALID_JSON' } } }).catch(() => null);
            return res.status(202).json({ articleId: baseArticle.id, aiError: 'INVALID_JSON', message: 'AI returned non-JSON. Inspect article.contentJson.aiRaw and adjust prompt.' });
          }
        }
      }
    }

    // Enforce body length between 600 and 1200 words via single retry if needed
    try {
      const words = countParagraphWords(webJson?.blocks || []);
      if (!Number.isFinite(words) || words < 600 || words > 1200) {
        const balancePrompt = `${webPrompt}\n\nIMPORTANT: Ensure the combined article body (join all 'p' block texts) is between 600 and 1200 words. Do not invent facts; expand or condense neutrally. Return ONLY JSON.`;
        const balanceRes = await aiGenerateText({ prompt: balancePrompt, purpose: 'rewrite' as any });
        const balanceText = balanceRes.text || '';
        try {
          const balanced = parseJsonLenient(balanceText);
          const w2 = countParagraphWords(balanced?.blocks || []);
          if (Number.isFinite(w2) && w2 >= 600 && w2 <= 1200) {
            webJson = balanced;
            aiRaw = balanceText;
          }
        } catch {
          try {
            const balanced = extractLargestJson(balanceText);
            const w2 = countParagraphWords(balanced?.blocks || []);
            if (Number.isFinite(w2) && w2 >= 600 && w2 <= 1200) {
              webJson = balanced;
              aiRaw = balanceText;
            }
          } catch {}
        }
      }
    } catch {}

    // Sanitize HTML and blocks
    if (typeof webJson?.contentHtml === 'string') {
      webJson.contentHtml = sanitizeHtmlAllowlist(webJson.contentHtml);
    }
    if (Array.isArray(webJson?.blocks)) {
      webJson.blocks = webJson.blocks.map((b: any) => {
        if (!b || typeof b !== 'object') return b;
        const t = b.type;
        if (t === 'p' || t === 'h1' || t === 'h2' || t === 'h3' || t === 'list') {
          if (typeof b.text === 'string') b.text = String(b.text).slice(0, 4000);
          if (Array.isArray(b.items)) b.items = b.items.map((s: any) => String(s).slice(0, 400));
        }
        if (t === 'image') {
          if (typeof b.caption === 'string') b.caption = String(b.caption).slice(0, 300);
          if (typeof b.alt === 'string') b.alt = String(b.alt).slice(0, 200);
        }
        return b;
      });
    }

    // Ensure slug and timestamps
    if (!webJson.slug && webJson.title) webJson.slug = slugFromAnyLanguage(String(webJson.title), 120);
    const now = nowIsoIST();
    webJson.publishedAt = webJson.publishedAt || now;
    if (!webJson.audit) webJson.audit = {};
    webJson.audit.createdAt = webJson.audit.createdAt || now;
    webJson.audit.updatedAt = now;
    webJson.audit.createdBy = webJson.audit.createdBy || authorId;
    webJson.audit.updatedBy = authorId;

    // Optionally generate Markdown article using DB prompt (if present)
    let webMarkdown: string | undefined;
    const mdPrompt = await buildMarkdownPrompt(payload).catch(() => null);
    const trimmedPrompt = String(mdPrompt ?? '').trim();
    if (trimmedPrompt.length > 0) {
      const mdRes = await aiGenerateText({ prompt: trimmedPrompt, purpose: 'rewrite_markdown' as any });
      if (mdRes?.text) {
        webMarkdown = String(mdRes.text).trim();
      }
    }

    // Save webJson (+ markdown if available) into Article.contentJson
    await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, web: webJson, webMarkdown, aiRaw, aiUsage: [ ...(baseArticle as any).contentJson?.aiUsage || [], aiRes.usage ].filter(Boolean) } } });

    // Persist a normalized TenantWebArticle record (upsert by tenant+domain+language+slug)
    const coverImageUrl = (webJson?.coverImage?.url) || (Array.isArray(images) && images[0]) || null;
    const normStatus = String(webJson?.status || (isPublished ? 'PUBLISHED' : 'DRAFT')).toUpperCase();
    const primaryCategoryId = Array.isArray(categoryIds) && categoryIds[0] ? String(categoryIds[0]) : undefined;
    let twa: any;
    try {
      const existing = await prisma.tenantWebArticle.findFirst({
        where: {
          tenantId,
          slug: String(webJson.slug),
          domainId: domainId ? { equals: domainId } : { equals: null },
          languageId: languageId ? { equals: languageId } : { equals: null }
        }
      });
      if (existing) {
        twa = await prisma.tenantWebArticle.update({
          where: { id: existing!.id },
          data: {
            title: String(webJson.title || title),
            status: normStatus,
            coverImageUrl: coverImageUrl || undefined,
            categoryId: primaryCategoryId,
            contentJson: webJson,
            seoTitle: (webJson?.meta?.seoTitle) ? String(webJson.meta.seoTitle) : undefined,
            metaDescription: (webJson?.meta?.metaDescription) ? String(webJson.meta.metaDescription) : undefined,
            jsonLd: webJson?.jsonLd ? webJson.jsonLd : undefined,
            tags: Array.isArray(webJson?.tags) ? webJson.tags : [],
            publishedAt: webJson?.publishedAt ? new Date(webJson.publishedAt) as any : undefined,
            authorId: authorId || undefined
          }
        });
      } else {
        twa = await prisma.tenantWebArticle.create({
          data: {
            tenantId,
            domainId: domainId || undefined,
            languageId: languageId || undefined,
            authorId: authorId || null,
            title: String(webJson.title || title),
            slug: String(webJson.slug),
            status: normStatus,
            coverImageUrl: coverImageUrl || undefined,
            categoryId: primaryCategoryId,
            contentJson: webJson,
            seoTitle: (webJson?.meta?.seoTitle) ? String(webJson.meta.seoTitle) : undefined,
            metaDescription: (webJson?.meta?.metaDescription) ? String(webJson.meta.metaDescription) : undefined,
            jsonLd: webJson?.jsonLd ? webJson.jsonLd : undefined,
            tags: Array.isArray(webJson?.tags) ? webJson.tags : [],
            publishedAt: webJson?.publishedAt ? new Date(webJson.publishedAt) as any : undefined
          }
        });
      }
    } catch (e) {
      // Non-fatal; proceed without blocking compose flow
      console.warn('TenantWebArticle upsert failed:', e);
    }

    const out: any = { articleId: baseArticle.id, web: webJson, webArticleId: twa?.id };

    if (mode === 'web+short') {
      // Build concise short news from the same content
      const rawText = `${title}\n${content}`;
      const prompt = buildShortNewsPrompt(rawText);
      const draft = await generateAiShortNewsFromPrompt(rawText, prompt, async (p) => {
        const r = await aiGenerateText({ prompt: p, purpose: 'shortnews_ai_article' as any });
        return r.text;
      });
      const shortTitle = draft.title.slice(0, 35);
      const shortBody = trimWords(draft.content, 60);
      const firstCategoryId = categoryIds[0];
      const short = await prisma.shortNews.create({
        data: {
          title: shortTitle,
          slug: slugFromAnyLanguage(shortTitle, 80),
          content: shortBody,
          language: languageCode || 'te',
          authorId,
          categoryId: firstCategoryId,
          tags: Array.isArray(webJson?.tags) ? webJson.tags.slice(0, 7) : [],
          featuredImage: (webJson?.coverImage?.url) || (images[0] || null),
          status: 'PENDING',
          seo: webJson?.meta ? webJson.meta : undefined,
          headings: draft.headings ? (draft.headings as any) : undefined,
          mediaUrls: images
        }
      });
      out.shortNewsId = short.id;
    }

    if (mode === 'web+newspaper') {
      // Enforce per-reporter daily limit of 2 in IST
      const { start, end } = computeISTDayBounds(new Date());
      const count = await prisma.article.count({
        where: {
          authorId,
          tenantId,
          type: 'newspaper',
          createdAt: { gte: start, lte: end }
        }
      });
      if (count >= 2) {
        out.newspaper = { error: 'DAILY_LIMIT_REACHED', message: 'You have reached today\'s 2-article newspaper limit' };
      } else {
        // Placeholder: we only queue stub by creating a record with type=newspaper for now
        const np = await prisma.article.create({
          data: {
            title,
            content,
            type: 'newspaper',
            status: 'DRAFT',
            authorId,
            tenantId,
            languageId: languageId || undefined,
            categories: { connect: categoryIds.map((id: string) => ({ id })) },
            contentJson: { note: 'newspaper generation pending', baseFromArticleId: baseArticle.id }
          }
        });
        out.newspaperDraftId = np.id;
      }
    }

    return res.status(201).json(out);
  } catch (e) {
    console.error('composeAIArticleController error', e);
    return res.status(500).json({ error: 'Failed to compose article' });
  }
};

export const composeWebOnlyController = async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdBody, domainId, title, content, languageCode, images = [], categoryIds = [], isPublished = false, raw = {} } = req.body || {};
    if (!title || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'title, content, categoryIds are required' });
    }

    const scope = await resolveTenantScope(req, tenantIdBody, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    const user: any = (req as any).user;
    const authorId: string = user.id;

    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
      if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });
      languageId = lang.id;
    } else {
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      languageId = author?.languageId || null;
    }

    const baseArticle = await prisma.article.create({
      data: {
        title,
        content,
        type: 'reporter',
        status: isPublished ? 'PUBLISHED' : 'DRAFT',
        authorId,
        tenantId,
        languageId: languageId || undefined,
        images,
        categories: { connect: categoryIds.map((id: string) => ({ id })) },
        contentJson: { raw }
      }
    });

    const provider = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY ? 'gemini' : 'chatgpt';
    const payload = { tenantId, languageCode: languageCode || '', authorId, categoryIds, images, isPublished, raw: { ...raw, title, content } };
    const webPrompt = await buildWebPrompt(provider as any, payload);
    const aiRes = await aiGenerateText({ prompt: webPrompt, purpose: 'rewrite' as any });
    let aiRaw = aiRes.text;
    if (!aiRaw) {
      await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw: '', aiError: 'EMPTY_RESPONSE' } } }).catch(() => null);
      return res.status(202).json({ articleId: baseArticle.id, aiError: 'EMPTY_RESPONSE', message: 'AI returned empty response. Check article.contentJson.aiRaw later or retry.' });
    }
    let webJson: any;
    try {
      webJson = parseJsonLenient(aiRaw);
    } catch {
      try {
        webJson = extractLargestJson(aiRaw as any);
      } catch {
        const strictPrompt = `${webPrompt}\n\nIMPORTANT: Return ONLY a single valid JSON object with the exact keys specified. Do not include markdown, code fences, explanations, or any text before/after the JSON.`;
        const retryRes = await aiGenerateText({ prompt: strictPrompt, purpose: 'rewrite' as any });
        const retryText = retryRes.text || '';
        try {
          webJson = parseJsonLenient(retryText);
          aiRaw = retryText;
        } catch {
          try {
            webJson = extractLargestJson(retryText);
            aiRaw = retryText;
          } catch {
            await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw: retryText || aiRaw, aiError: 'INVALID_JSON' } } }).catch(() => null);
            return res.status(202).json({ articleId: baseArticle.id, aiError: 'INVALID_JSON', message: 'AI returned non-JSON. Inspect article.contentJson.aiRaw and adjust prompt.' });
          }
        }
      }
    }

    // Enforce body length between 600 and 1200 words via single retry if needed
    try {
      const words = countParagraphWords(webJson?.blocks || []);
      if (!Number.isFinite(words) || words < 600 || words > 1200) {
        const balancePrompt = `${webPrompt}\n\nIMPORTANT: Ensure the combined article body (join all 'p' block texts) is between 600 and 1200 words. Do not invent facts; expand or condense neutrally. Return ONLY JSON.`;
        const balanceRes = await aiGenerateText({ prompt: balancePrompt, purpose: 'rewrite' as any });
        const balanceText = balanceRes.text || '';
        try {
          const balanced = parseJsonLenient(balanceText);
          const w2 = countParagraphWords(balanced?.blocks || []);
          if (Number.isFinite(w2) && w2 >= 600 && w2 <= 1200) {
            webJson = balanced;
            aiRaw = balanceText;
          }
        } catch {
          try {
            const balanced = extractLargestJson(balanceText);
            const w2 = countParagraphWords(balanced?.blocks || []);
            if (Number.isFinite(w2) && w2 >= 600 && w2 <= 1200) {
              webJson = balanced;
              aiRaw = balanceText;
            }
          } catch {}
        }
      }
    } catch {}

    if (typeof webJson?.contentHtml === 'string') {
      webJson.contentHtml = sanitizeHtmlAllowlist(webJson.contentHtml);
    }
    if (Array.isArray(webJson?.blocks)) {
      webJson.blocks = webJson.blocks.map((b: any) => {
        if (!b || typeof b !== 'object') return b;
        const t = b.type;
        if (t === 'p' || t === 'h1' || t === 'h2' || t === 'h3' || t === 'list') {
          if (typeof b.text === 'string') b.text = String(b.text).slice(0, 4000);
          if (Array.isArray(b.items)) b.items = b.items.map((s: any) => String(s).slice(0, 400));
        }
        if (t === 'image') {
          if (typeof b.caption === 'string') b.caption = String(b.caption).slice(0, 300);
          if (typeof b.alt === 'string') b.alt = String(b.alt).slice(0, 200);
        }
        return b;
      });
    }

    if (!webJson.slug && webJson.title) webJson.slug = slugFromAnyLanguage(String(webJson.title), 120);
    const now = nowIsoIST();
    webJson.publishedAt = webJson.publishedAt || now;
    if (!webJson.audit) webJson.audit = {};
    webJson.audit.createdAt = webJson.audit.createdAt || now;
    webJson.audit.updatedAt = now;
    webJson.audit.createdBy = webJson.audit.createdBy || authorId;
    webJson.audit.updatedBy = authorId;

    await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, web: webJson, aiRaw, aiUsage: [ ...(baseArticle as any).contentJson?.aiUsage || [], aiRes.usage ].filter(Boolean) } } });

    // Persist a normalized TenantWebArticle record (upsert by tenant+domain+language+slug)
    const coverImageUrl2 = (webJson?.coverImage?.url) || (Array.isArray(images) && images[0]) || null;
    const normStatus2 = String(webJson?.status || (isPublished ? 'PUBLISHED' : 'DRAFT')).toUpperCase();
    let twa2: any;
    try {
      const existing2 = await prisma.tenantWebArticle.findFirst({
        where: {
          tenantId,
          slug: String(webJson.slug),
          domainId: domainId ? { equals: domainId } : { equals: null },
          languageId: languageId ? { equals: languageId } : { equals: null }
        }
      });
      if (existing2) {
        twa2 = await prisma.tenantWebArticle.update({
          where: { id: existing2.id },
          data: {
            title: String(webJson.title || title),
            status: normStatus2,
            coverImageUrl: coverImageUrl2 || undefined,
            contentJson: webJson,
            seoTitle: (webJson?.meta?.seoTitle) ? String(webJson.meta.seoTitle) : undefined,
            metaDescription: (webJson?.meta?.metaDescription) ? String(webJson.meta.metaDescription) : undefined,
            jsonLd: webJson?.jsonLd ? webJson.jsonLd : undefined,
            tags: Array.isArray(webJson?.tags) ? webJson.tags : [],
            publishedAt: webJson?.publishedAt ? new Date(webJson.publishedAt) as any : undefined,
            authorId: authorId || undefined
          }
        });
      } else {
        twa2 = await prisma.tenantWebArticle.create({
          data: {
            tenantId,
            domainId: domainId || undefined,
            languageId: languageId || undefined,
            authorId: authorId || null,
            title: String(webJson.title || title),
            slug: String(webJson.slug),
            status: normStatus2,
            coverImageUrl: coverImageUrl2 || undefined,
            contentJson: webJson,
            seoTitle: (webJson?.meta?.seoTitle) ? String(webJson.meta.seoTitle) : undefined,
            metaDescription: (webJson?.meta?.metaDescription) ? String(webJson.meta.metaDescription) : undefined,
            jsonLd: webJson?.jsonLd ? webJson.jsonLd : undefined,
            tags: Array.isArray(webJson?.tags) ? webJson.tags : [],
            publishedAt: webJson?.publishedAt ? new Date(webJson.publishedAt) as any : undefined
          }
        });
      }
    } catch (e) {
      console.warn('TenantWebArticle upsert failed (web-only):', e);
    }

    return res.status(201).json({ articleId: baseArticle.id, web: webJson, webArticleId: twa2?.id });
  } catch (e) {
    console.error('composeWebOnlyController error', e);
    return res.status(500).json({ error: 'Failed to compose web article' });
  }
};

export const enqueueRawArticleController = async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdBody, domainId, title, content, languageCode, images = [], categoryIds = [], raw = {}, queue = { web: true, short: true, newspaper: false } } = req.body || {};
    if (!title || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'title, content, categoryIds are required' });
    }
    const scope = await resolveTenantScope(req, tenantIdBody, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    const user: any = (req as any).user;
    const authorId: string = user.id;
    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
      if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });
      languageId = lang.id;
    } else {
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      languageId = author?.languageId || null;
    }
    const article = await prisma.article.create({
      data: {
        title,
        content,
        type: 'reporter',
        status: 'DRAFT',
        authorId,
        tenantId,
        languageId: languageId || undefined,
        images,
        categories: { connect: categoryIds.map((id: string) => ({ id })) },
        contentJson: {
          raw: { ...raw, title, content, images, categoryIds },
          aiQueue: { web: !!queue?.web, short: !!queue?.short, newspaper: !!queue?.newspaper },
          aiStatus: 'PENDING'
        }
      }
    });
    return res.status(202).json({ articleId: article.id, queued: true, aiQueue: { web: !!queue?.web, short: !!queue?.short, newspaper: !!queue?.newspaper } });
  } catch (e) {
    console.error('enqueueRawArticleController error', e);
    return res.status(500).json({ error: 'Failed to enqueue article' });
  }
};

export const composeBlocksController = async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdBody, domainId, title, content, languageCode, images = [], categoryIds = [], isPublished = false } = req.body || {};
    if (!title || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'title, content, categoryIds are required' });
    }

    const scope = await resolveTenantScope(req, tenantIdBody, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    const user: any = (req as any).user;
    const authorId: string = user.id;

    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
      if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });
      languageId = lang.id;
    } else {
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      languageId = author?.languageId || null;
    }

    const baseArticle = await prisma.article.create({
      data: {
        title,
        content,
        type: 'reporter',
        status: isPublished ? 'PUBLISHED' : 'DRAFT',
        authorId,
        tenantId,
        languageId: languageId || undefined,
        images,
        categories: { connect: categoryIds.map((id: string) => ({ id })) },
        contentJson: { raw: { title, content } }
      }
    });

    const provider: 'gemini' | 'chatgpt' = (process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY) ? 'gemini' : 'chatgpt';
    const nowTs = nowIsoIST();
    // Allow a caller-supplied two-block prompt template via body.promptText
    // When provided, we pass it verbatim with the source material injected exactly as requested.
    const overridePrompt: string | undefined = typeof (req.body || {}).promptText === 'string' ? String((req.body || {}).promptText) : undefined;
    const sourceMaterial = `"title": ${JSON.stringify(title)},\n"content": ${JSON.stringify(content)}`;
    const prompt = overridePrompt && overridePrompt.trim().length > 0
      ? `${overridePrompt.trim()}\n\nOriginal Source Material:\n[${sourceMaterial}]\n`
      : `Act as a Senior Tech Analyst and production SEO editor. Return ONLY a single JSON object. JSON schema: {seo: {slug: string, title: string, subtitle: string, excerpt: string, tags: string[], meta: {seoTitle: string, metaDescription: string}, jsonLd: object}, bodyText: string}.\n\nRequirements:\n- Language: if languageCode='te', bodyText must be Telugu; otherwise follow input language.\n- Body length: 600-1200 words; plain paragraphs separated by blank lines; no markdown, no HTML.\n- slug: kebab-case from title, <=120 chars.\n- excerpt: 18-30 words summary from bodyText.\n- tags: 3-7 short tags.\n- meta.seoTitle <=60 chars; metaDescription 110-155 chars.\n- jsonLd: NewsArticle with headline, image[], datePublished '${nowTs}', dateModified '${nowTs}', author name empty string, publisher with empty logo string.\n- Do not invent facts; rely on input.\n\nInput:\n${JSON.stringify({ tenantId, languageCode: languageCode || '', title, content, images }, null, 2)}\n`;

    const aiRes = await aiGenerateText({ prompt, purpose: 'blocks_web' as any });
    const aiRaw = aiRes.text || '';
    if (!aiRaw) {
      await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw: '', aiError: 'EMPTY_RESPONSE' } } }).catch(() => null);
      return res.status(202).json({ articleId: baseArticle.id, aiError: 'EMPTY_RESPONSE' });
    }

    let parsed: any;
    try {
      parsed = parseJsonLenient(aiRaw);
    } catch {
      try { parsed = extractLargestJson(aiRaw); } catch {
        const retryPrompt = `${prompt}\nIMPORTANT: Output ONLY the JSON object (no code fences, no comments).`;
        const retryRes = await aiGenerateText({ prompt: retryPrompt, purpose: 'blocks_web_retry' as any });
        const retryText = retryRes.text || '';
        try { parsed = parseJsonLenient(retryText); } catch {
          try { parsed = extractLargestJson(retryText); } catch {
            await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw, aiError: 'INVALID_JSON' } } }).catch(() => null);
            return res.status(202).json({ articleId: baseArticle.id, aiError: 'INVALID_JSON' });
          }
        }
      }
    }

    const bodyText: string = String(parsed?.bodyText || '').trim();
    const seo = parsed?.seo || {};
    if (!bodyText) {
      await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, aiRaw, aiError: 'MISSING_BODY' } } }).catch(() => null);
      return res.status(202).json({ articleId: baseArticle.id, aiError: 'MISSING_BODY' });
    }

    // Convert plain text to blocks and HTML
    const paragraphs = bodyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const blocks = [ { type: 'h1', text: String(seo?.title || title).trim().slice(0, 200) }, ...paragraphs.map(p => ({ type: 'p', text: p.slice(0, 4000) })) ];
    const contentHtml = sanitizeHtmlAllowlist(blocks.map(b => {
      if (b.type === 'h1') return `<h1>${b.text}</h1>`;
      return `<p>${b.text}</p>`;
    }).join('\n'));

    const webJson = {
      tenantId,
      languageCode: languageCode || '',
      slug: String(seo?.slug || slugFromAnyLanguage(seo?.title || title || 'article', 120)),
      title: String(seo?.title || title),
      subtitle: String(seo?.subtitle || ''),
      excerpt: String(seo?.excerpt || ''),
      authors: [{ id: authorId, name: '', role: 'reporter' }],
      status: isPublished ? 'published' : 'draft',
      publishedAt: nowTs,
      readingTimeMin: Math.max(1, Math.round((bodyText.split(/\s+/).filter(Boolean).length) / 200)),
      categories: categoryIds,
      tags: Array.isArray(seo?.tags) ? seo.tags : [],
      coverImage: { url: (images && images[0]) || '' },
      blocks,
      contentHtml,
      plainText: bodyText,
      meta: seo?.meta || {},
      jsonLd: seo?.jsonLd || {},
      audit: { createdAt: nowTs, updatedAt: nowTs, createdBy: authorId, updatedBy: authorId }
    };

    await prisma.article.update({ where: { id: baseArticle.id }, data: { contentJson: { ...(baseArticle as any).contentJson, web: webJson, aiRaw } } });

    // Persist TenantWebArticle
    let twa: any;
    try {
      const existing = await prisma.tenantWebArticle.findFirst({
        where: {
          tenantId,
          slug: String(webJson.slug),
          domainId: domainId ? { equals: domainId } : { equals: null },
          languageId: languageId ? { equals: languageId } : { equals: null }
        }
      });
      if (existing) {
        twa = await prisma.tenantWebArticle.update({
          where: { id: existing!.id },
          data: {
            title: webJson.title,
            status: String(webJson.status).toUpperCase(),
            coverImageUrl: webJson.coverImage?.url || undefined,
            contentJson: webJson,
            seoTitle: webJson?.meta?.seoTitle || undefined,
            metaDescription: webJson?.meta?.metaDescription || undefined,
            jsonLd: webJson?.jsonLd || undefined,
            tags: webJson.tags || [],
            publishedAt: new Date(webJson.publishedAt) as any,
            authorId: authorId || undefined
          }
        });
      } else {
        twa = await prisma.tenantWebArticle.create({
          data: {
            tenantId,
            domainId: domainId || undefined,
            languageId: languageId || undefined,
            authorId: authorId || null,
            title: webJson.title,
            slug: webJson.slug,
            status: String(webJson.status).toUpperCase(),
            coverImageUrl: webJson.coverImage?.url || undefined,
            contentJson: webJson,
            seoTitle: webJson?.meta?.seoTitle || undefined,
            metaDescription: webJson?.meta?.metaDescription || undefined,
            jsonLd: webJson?.jsonLd || undefined,
            tags: webJson.tags || [],
            publishedAt: new Date(webJson.publishedAt) as any
          }
        });
      }
    } catch (e) {
      console.warn('TenantWebArticle upsert failed (blocks):', e);
    }

    // Optional debug: echo the prompt back when header X-Debug-Prompt: true
    const debugPrompt = String(req.headers['x-debug-prompt'] || '').toLowerCase() === 'true' ? prompt : undefined;
    return res.status(201).json({ articleId: baseArticle.id, web: webJson, webArticleId: twa?.id, seo, prompt: debugPrompt });
  } catch (e) {
    console.error('composeBlocksController error', e);
    return res.status(500).json({ error: 'Failed to compose blocks article' });
  }
};

export const composeSimpleArticleController = async (req: Request, res: Response) => {
  try {
    const { domainId, categoryIds = [], content, languageCode, coverImageUrl, media } = req.body || {};
    if (!domainId || !content || !Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ error: 'domainId, content, categoryIds are required' });
    }

    // Resolve tenant via domainId; SUPER_ADMIN can use any domain; tenant roles must match
    const scope = await resolveTenantScope(req, undefined, domainId);
    if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
    const tenantId = scope.tenantId;
    const user: any = (req as any).user;
    const authorId: string = user.id;

    const domain = await prisma.domain.findUnique({ where: { id: domainId } });
    if (!domain || domain.tenantId !== tenantId) return res.status(400).json({ error: 'Invalid domainId' });

    let languageId: string | null = null;
    if (languageCode) {
      const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
      if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });
      languageId = lang.id;
    } else {
      const author = await prisma.user.findUnique({ where: { id: authorId } });
      languageId = author?.languageId || null;
    }

    const persona = String(req.body?.persona || 'Senior Tech Analyst');
    const primaryKeyword = String(req.body?.primaryKeyword || '').trim();
    const targetAudience = String(req.body?.targetAudience || '').trim();
    const tone = String(req.body?.tone || 'Objective and Detailed');

    const now = nowIsoIST();
    const source = `"title": "",\n"content": ${JSON.stringify(String(content))}`;
    const twoBlockPrompt = `Act as a highly experienced ${persona} and professional SEO Content Strategist. Your task is to transform the provided source material into a comprehensive, authoritative, and engaging long-form analysis piece (minimum 1000 words). Maintain a strict, purely human writing style that matches the chosen persona.

  Language Requirement:
  - If languageCode='te' (Telugu), write BOTH blocks entirely in Telugu script.
  - If another language is intended, keep BOTH blocks strictly in that language.

The final output MUST be delivered in TWO separate, complete blocks for seamless website integration:

BLOCK 1: SEO Optimization and Metadata (JSON Format)
Generate a valid JSON object containing the complete metadata package:
1. "seo_title" (H1, max 60 characters, highly compelling and keyword-focused)
2. "meta_description" (max 160 characters, summarizing the article's core value)
3. "primary_keyword"
4. "secondary_keywords" (minimum 6 relevant supporting terms)
5. "tags" (minimum 5 relevant hashtags for social/internal indexing)
6. "url_slug" (SEO-friendly, concise URL path)

BLOCK 2: Complete Article Body (Plain Text Format)
Generate the full article content.
- Start with the H1 Title (copied from the SEO Data).
- The article must feature a strong introduction and a concluding summary.
- The content must be logically structured using an advanced content hierarchy:
    * A minimum of five H2 Headings (main sections).
    * At least three H3 Subheadings nested under one or more H2 sections.
- Ensure the Target Primary Keyword is naturally woven throughout the text for maximum optimization.

Target Primary Keyword: ${primaryKeyword || '[INSERT YOUR MAIN KEYWORD HERE]'}
Target Audience: ${targetAudience || '[INSERT YOUR TARGET AUDIENCE HERE]'}
Tone: ${tone}

Original Source Material:
[${source}]
`;

    const aiRes = await aiGenerateText({ prompt: twoBlockPrompt, purpose: 'simple_blocks' as any });
    let aiRaw = aiRes.text || '';
    if (!aiRaw) return res.status(202).json({ aiError: 'EMPTY_RESPONSE' });

    // Try to split into two blocks: parse first JSON object, then remaining as plain text
    let seo: any; let bodyText = '';
    try {
      // Extract first object
      const obj = extractLargestJson(aiRaw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) seo = obj;
      // Remove the JSON part from aiRaw heuristically
      const firstBrace = aiRaw.indexOf('{');
      const lastBrace = aiRaw.lastIndexOf('}');
      const after = lastBrace > firstBrace ? aiRaw.slice(lastBrace + 1) : '';
      bodyText = String(after || '').trim();
    } catch {
      // Fallback to lenient parse of whole text as JSON-only
      try { seo = parseJsonLenient(aiRaw); } catch {}
    }

    if (!seo || typeof seo !== 'object' || !bodyText) {
      const strictLang = (languageCode || '').toLowerCase();
      const retryPrompt = `${twoBlockPrompt}\n\nIMPORTANT: Write ONLY in ${strictLang === 'te' ? 'Telugu' : (strictLang || 'the requested language')}. No English words. Keep BOTH blocks exactly as specified.`;
      const retryRes = await aiGenerateText({ prompt: retryPrompt, purpose: 'simple_blocks_retry' as any });
      const retryText = retryRes.text || '';
      try {
        const obj2 = extractLargestJson(retryText);
        if (obj2 && typeof obj2 === 'object' && !Array.isArray(obj2)) seo = obj2;
        const fb = retryText.indexOf('{');
        const lb = retryText.lastIndexOf('}');
        const after2 = lb > fb ? retryText.slice(lb + 1) : '';
        bodyText = String(after2 || '').trim() || bodyText;
        aiRaw = retryText;
      } catch {}
      if (!seo || typeof seo !== 'object' || !bodyText) {
        return res.status(202).json({ aiError: !seo ? 'MISSING_SEO_BLOCK' : 'MISSING_BODY', prompt: (String(req.headers['x-debug-prompt'] || '').toLowerCase() === 'true') ? retryPrompt : undefined });
      }
    }

    // Normalize to webJson
    const paragraphs = bodyText.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
    const titleText = String(seo?.seo_title || '').trim();
    const slug = String(seo?.url_slug || slugFromAnyLanguage(titleText || 'article', 120));
    const blocks = [ { type: 'h1', text: titleText.slice(0, 200) }, ...paragraphs.map(p => ({ type: 'p', text: p.slice(0, 4000) })) ];
    const contentHtml = sanitizeHtmlAllowlist(blocks.map(b => b.type === 'h1' ? `<h1>${b.text}</h1>` : `<p>${b.text}</p>`).join('\n'));

    const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
    let aiStatus: 'APPROVED' | 'REVIEW_REQUIRED' = wordCount >= 950 ? 'APPROVED' : 'REVIEW_REQUIRED';
    const langHeaderStrict = String(req.headers['x-strict-language'] || '').toLowerCase() === 'true';
    if ((languageCode || '').toLowerCase() === 'te') {
      const teluguChars = (bodyText.match(/[\u0C00-\u0C7F]/g) || []).length;
      const latinChars = (bodyText.match(/[A-Za-z]/g) || []).length;
      const totalChars = bodyText.length || 1;
      const teluguRatio = teluguChars / totalChars;
      if (teluguRatio < 0.6 || latinChars > teluguChars) {
        if (langHeaderStrict) {
          const debugPromptStrict = String(req.headers['x-debug-prompt'] || '').toLowerCase() === 'true' ? twoBlockPrompt : undefined;
          return res.status(202).json({ aiError: 'LANGUAGE_MISMATCH', prompt: debugPromptStrict });
        }
        aiStatus = 'REVIEW_REQUIRED';
      }
    }

    const webJson = {
      tenantId,
      languageCode: languageCode || '',
      slug,
      title: titleText || paragraphs[0]?.slice(0, 120) || 'Untitled',
      subtitle: '',
      excerpt: '',
      authors: [{ id: authorId, name: '', role: 'reporter' }],
      status: 'draft',
      publishedAt: now,
      readingTimeMin: Math.max(1, Math.round(wordCount / 200)),
      categories: categoryIds,
      tags: Array.isArray(seo?.tags) ? seo.tags : [],
      coverImage: { url: coverImageUrl || '', alt: '', caption: '' },
      media: { images: Array.isArray(media?.images) ? media.images : [], videos: Array.isArray(media?.videos) ? media.videos : [] },
      blocks,
      contentHtml,
      plainText: bodyText,
      meta: { seoTitle: seo?.seo_title || '', metaDescription: seo?.meta_description || '' },
      jsonLd: {
        '@context': 'https://schema.org', '@type': 'NewsArticle', headline: titleText,
        datePublished: now, dateModified: now, image: [coverImageUrl || ''], author: { '@type': 'Person', name: '' }, publisher: { '@type': 'Organization', name: '', logo: { '@type': 'ImageObject', url: '' } }
      },
      audit: { createdAt: now, updatedAt: now, createdBy: authorId, updatedBy: authorId },
      aiStatus
    } as any;

    // Persist to TenantWebArticle
    let saved;
    try {
      saved = await prisma.tenantWebArticle.create({
        data: {
          tenantId,
          domainId,
          languageId: languageId || undefined,
          authorId,
          title: webJson.title,
          slug: webJson.slug,
          status: aiStatus === 'APPROVED' ? 'DRAFT' : 'PENDING',
          coverImageUrl: webJson.coverImage?.url || undefined,
          contentJson: webJson,
          seoTitle: webJson?.meta?.seoTitle || undefined,
          metaDescription: webJson?.meta?.metaDescription || undefined,
          jsonLd: webJson?.jsonLd || undefined,
          tags: webJson.tags || [],
          publishedAt: undefined
        }
      });
    } catch (e) {
      console.error('TenantWebArticle create failed (simple):', e);
      return res.status(500).json({ error: 'Persist failed' });
    }

    const debugPrompt = String(req.headers['x-debug-prompt'] || '').toLowerCase() === 'true' ? twoBlockPrompt : undefined;
    return res.status(201).json({ webArticleId: saved.id, aiStatus, seo, web: webJson, usage: aiRes.usage, prompt: debugPrompt });
  } catch (e) {
    console.error('composeSimpleArticleController error', e);
    return res.status(500).json({ error: 'Failed to compose simple article' });
  }
};

async function resolveReporterUserId(reporterId: string): Promise<string | null> {
  try {
    const rep = await (prisma as any).reporter.findUnique({ where: { id: String(reporterId) }, select: { userId: true } });
    return rep?.userId ? String(rep.userId) : null;
  } catch {
    return null;
  }
}

function collectMediaUrls(coverImageUrl: any, media: any): string[] {
  const urls: string[] = [];
  const push = (u: any) => {
    const s = String(u || '').trim();
    if (!s) return;
    if (!/^https?:\/\//i.test(s)) return;
    if (!urls.includes(s)) urls.push(s);
  };
  push(coverImageUrl);
  if (Array.isArray(media)) {
    for (const m of media) push(m?.url);
  } else if (media && typeof media === 'object') {
    if (Array.isArray(media.images)) for (const i of media.images) push(i?.url || i);
    if (Array.isArray(media.videos)) for (const v of media.videos) push(v?.url || v);
  }
  return urls;
}

export const composeChatGptRewriteController = async (req: Request, res: Response) => {
  try {
    const { tenantId, domainName, categoryIds = [], languageCode, coverImageUrl, media, reporterId, rawContent, title } = req.body || {};
    if (!domainName || !reporterId || !languageCode || !rawContent) return res.status(400).json({ error: 'domainName, reporterId, languageCode, rawContent are required' });

    const dom = await prisma.domain.findUnique({ where: { domain: String(domainName) } });
    if (!dom) return res.status(400).json({ error: 'Invalid domainName' });

    const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
    if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });

    const authorId = await resolveReporterUserId(String(reporterId));
    if (!authorId) return res.status(400).json({ error: 'Invalid reporterId' });

    const catIds = (Array.isArray(categoryIds) ? categoryIds : []).map((x: any) => String(x || '').trim()).filter(Boolean);
    const images = collectMediaUrls(coverImageUrl, media);
    const finalTitle = String(title || '').trim() || 'Raw Article';
    const content = String(rawContent || '').trim();

    const article = await prisma.article.create({
      data: {
        title: finalTitle,
        content,
        type: 'reporter',
        status: 'DRAFT',
        authorId,
        tenantId: String(tenantId || dom.tenantId),
        languageId: lang.id,
        images,
        categories: catIds.length ? { connect: catIds.map((id: string) => ({ id })) } : undefined as any,
        contentJson: {
          raw: { title: finalTitle, content, images, categoryIds: catIds, languageCode, aiQueue: { web: true, short: true, newspaper: false } },
          aiQueue: { web: true, short: true, newspaper: false },
          aiStatus: 'PENDING'
        }
      }
    });

    return res.status(202).json({ articleId: article.id, queued: true, aiQueue: { web: true, short: true, newspaper: false } });
  } catch (e) {
    console.error('composeChatGptRewriteController error', e);
    return res.status(500).json({ error: 'Failed to queue rewrite' });
  }
};

export const composeGeminiRewriteController = async (req: Request, res: Response) => {
  // Provider selection is key-based in aiProvider; this endpoint queues the same job shape.
  return composeChatGptRewriteController(req, res);
};

export const createRawArticleController = async (req: Request, res: Response) => {
  try {
    const { tenantId, domainId, reporterId, languageCode, title = '', content, categoryIds = [], coverImageUrl, media } = req.body || {};
    if (!domainId || !reporterId || !languageCode || !content) return res.status(400).json({ error: 'domainId, reporterId, languageCode, content are required' });

    const dom = await prisma.domain.findUnique({ where: { id: String(domainId) } });
    if (!dom) return res.status(400).json({ error: 'Invalid domainId' });

    const lang = await prisma.language.findUnique({ where: { code: String(languageCode) } });
    if (!lang) return res.status(400).json({ error: 'Invalid languageCode' });

    const authorId = await resolveReporterUserId(String(reporterId));
    if (!authorId) return res.status(400).json({ error: 'Invalid reporterId' });

    const catIds = (Array.isArray(categoryIds) ? categoryIds : []).map((x: any) => String(x || '').trim()).filter(Boolean);
    const images = collectMediaUrls(coverImageUrl, media);

    const raw = await (prisma as any).rawArticle.create({
      data: {
        tenantId: String(tenantId || dom.tenantId),
        domainId: String(domainId),
        reporterId: String(reporterId),
        languageId: lang.id,
        title: String(title || ''),
        content: String(content),
        categoryIds: catIds,
        coverImageUrl: coverImageUrl || null,
        media: media || null,
        status: 'NEW',
        aiProvider: 'openai'
      }
    });

    const baseArticle = await prisma.article.create({
      data: {
        title: String(title || '').trim() || 'Raw Article',
        content: String(content || '').trim(),
        type: 'reporter',
        status: 'DRAFT',
        authorId,
        tenantId: String(tenantId || dom.tenantId),
        languageId: lang.id,
        images,
        categories: catIds.length ? { connect: catIds.map((id: string) => ({ id })) } : undefined as any,
        contentJson: {
          rawArticleId: raw.id,
          raw: { title, content, images, categoryIds: catIds, languageCode, rawArticleId: raw.id, aiQueue: { web: true, short: true, newspaper: true } },
          aiQueue: { web: true, short: true, newspaper: true },
          aiStatus: 'PENDING'
        }
      }
    });

    await (prisma as any).rawArticle.update({
      where: { id: raw.id },
      data: { status: 'QUEUED', usage: { articleId: baseArticle.id, queue: 'postgres', queuedAt: new Date().toISOString() } }
    }).catch(() => null);

    return res.status(201).json({ id: raw.id, status: 'QUEUED', queuedArticleId: baseArticle.id });
  } catch (e) {
    console.error('createRawArticleController error', e);
    return res.status(500).json({ error: 'Failed to store raw article' });
  }
};

export const getRawArticleStatusController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const raw = await (prisma as any).rawArticle.findUnique({ where: { id: String(id) } });
    if (!raw) return res.status(404).json({ error: 'Not Found' });
    const usage = (raw as any).usage || {};
    return res.json({ id: raw.id, status: raw.status, errorCode: raw.errorCode || null, usage, webArticleId: raw.webArticleId || null, shortNewsId: raw.shortNewsId || null });
  } catch (e) {
    console.error('getRawArticleStatusController error', e);
    return res.status(500).json({ error: 'Failed to fetch raw article status' });
  }
};

export const getArticleAiStatusController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    if (!id) return res.status(400).json({ error: 'id required' });

    const user: any = (req as any).user;
    const roleName = String(user?.role?.name || '');

    let article: any = null;
    if (roleName === 'SUPER_ADMIN') {
      article = await prisma.article.findUnique({
        where: { id },
        select: { id: true, tenantId: true, status: true, createdAt: true, updatedAt: true, contentJson: true },
      });
    } else {
      const scope = await resolveTenantScope(req);
      if ('error' in scope) return res.status(scope.status).json({ error: scope.error });
      article = await prisma.article.findFirst({
        where: { id, tenantId: scope.tenantId },
        select: { id: true, tenantId: true, status: true, createdAt: true, updatedAt: true, contentJson: true },
      });
    }

    if (!article) return res.status(404).json({ error: 'Not found' });

    const cj: any = article.contentJson || {};
    const q: any = cj.aiQueue || {};
    return res.json({
      articleId: article.id,
      tenantId: article.tenantId,
      status: article.status,
      ai: {
        aiStatus: cj.aiStatus || null,
        aiMode: cj.aiMode || null,
        aiStartedAt: cj.aiStartedAt || null,
        aiFinishedAt: cj.aiFinishedAt || null,
        aiError: cj.aiError || null,
        aiSkipReason: cj.aiSkipReason || null,
        queue: {
          web: Boolean(q.web),
          short: Boolean(q.short),
          newspaper: Boolean(q.newspaper),
        },
        outputs: {
          webArticleId: cj.webArticleId || null,
          shortNewsId: cj.shortNewsId || null,
          newspaperArticleId: cj.newspaperArticleId || null,
        },
      },
      externalArticleId: cj.externalArticleId || null,
      rawArticleId: cj.rawArticleId || cj?.raw?.rawArticleId || null,
      callbackUrl: cj.callbackUrl || null,
      updatedAt: article.updatedAt,
      createdAt: article.createdAt,
    });
  } catch (e) {
    console.error('getArticleAiStatusController error', e);
    return res.status(500).json({ error: 'Failed to fetch AI status' });
  }
};

export const processRawArticleNowController = async (req: Request, res: Response) => {
  try {
    const { id } = req.params as any;
    if (!id) return res.status(400).json({ error: 'id is required' });
    const raw = await (prisma as any).rawArticle.findUnique({ where: { id: String(id) } });
    if (!raw) return res.status(404).json({ error: 'Not Found' });

    const usage = (raw as any).usage || {};
    const articleId = usage?.articleId ? String(usage.articleId) : null;
    if (articleId) {
      const art = await prisma.article.findUnique({ where: { id: articleId } });
      if (art) {
        const cj: any = (art as any).contentJson || {};
        const nextCJ = {
          ...cj,
          rawArticleId: cj.rawArticleId || raw.id,
          raw: { ...(cj.raw || {}), rawArticleId: cj.rawArticleId || raw.id },
          aiQueue: { ...(cj.aiQueue || {}), web: true, short: true, newspaper: true },
          aiStatus: 'PENDING'
        };
        await prisma.article.update({ where: { id: articleId }, data: { contentJson: nextCJ } });
        await (prisma as any).rawArticle.update({ where: { id: raw.id }, data: { status: 'QUEUED' } }).catch(() => null);
        return res.status(202).json({ id: raw.id, status: 'QUEUED', queuedArticleId: articleId });
      }
    }

    return res.status(409).json({ error: 'Raw article is not linked to a base Article yet. Recreate via /articles/raw.' });
  } catch (e) {
    console.error('processRawArticleNowController error', e);
    return res.status(500).json({ error: 'Failed to queue raw article processing' });
  }
};
