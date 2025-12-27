import prisma from '../lib/prisma';
import { aiGenerateText } from '../lib/aiProvider';
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../lib/sanitize';
import { buildNewsArticleJsonLd } from '../lib/seo';
import { generateAiShortNewsFromPrompt } from '../api/shortnews/shortnews.ai';
import axios from 'axios';

async function notifyCallback(article: any, status: 'DONE' | 'FAILED' | 'SKIPPED', contentJson: any) {
  const url = String(contentJson?.callbackUrl || '').trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) return;
  try {
    const secret = String(process.env.AI_CALLBACK_SECRET || '').trim();
    const headers: Record<string, string> = {};
    if (secret) headers['X-AI-Callback-Secret'] = secret;
    await axios.post(
      url,
      {
        type: 'AI_REWRITE_STATUS',
        status,
        articleId: article?.id,
        tenantId: article?.tenantId,
        aiMode: contentJson?.aiMode,
        webArticleId: contentJson?.webArticleId || null,
        shortNewsId: contentJson?.shortNewsId || null,
        newspaperArticleId: contentJson?.newspaperArticleId || null,
        externalArticleId: contentJson?.externalArticleId || null,
        error: contentJson?.aiError || null,
        finishedAt: contentJson?.aiFinishedAt || null,
      },
      { timeout: Number(process.env.AI_CALLBACK_TIMEOUT_MS || 4000), headers }
    );
  } catch {
    // best-effort; never fail job due to callback
  }
}

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

type ParsedTrue = {
  newspaper: { title: string; subtitle: string; keyPoints: string[]; content: string };
  web: { seoTitle: string; metaDescription: string; slug: string; keywords: string[]; content: string };
  short: { title: string; content: string };
};

type ParsedFalse = {
  web: { originalTitle: string; seoTitle: string; metaDescription: string; slug: string; keywords: string[]; schemaFocusKeywords: string[] };
  short: { title: string; content: string };
};

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

  const domainResolved = await resolveDomainForTenant(article.tenantId, raw.domainId || contentJson.domainId || null);
  const domainId = domainResolved.domainId;
  const domainName = domainResolved.domainName;

  // If shortnews is requested but categoryIds missing, infer a category and persist it.
  if (queue.short && (!Array.isArray(raw.categoryIds) || raw.categoryIds.length === 0)) {
    const inferred = await inferCategoryIdForArticle(article);
    if (inferred) {
      try {
        const updatedCJ = {
          ...contentJson,
          raw: { ...(contentJson.raw || {}), categoryIds: [inferred] },
          aiCategoryInferred: { categoryId: inferred, at: nowIsoIST() },
        } as any;
        await prisma.article.update({
          where: { id: article.id },
          data: {
            contentJson: updatedCJ,
            categories: { connect: [{ id: inferred }] } as any,
          },
        });
        // update local copy for this run
        (contentJson.raw = updatedCJ.raw);
        (raw.categoryIds = [inferred]);
      } catch {
        // If connect fails due to already-connected, still keep contentJson categoryIds.
        try {
          const updatedCJ = {
            ...contentJson,
            raw: { ...(contentJson.raw || {}), categoryIds: [inferred] },
            aiCategoryInferred: { categoryId: inferred, at: nowIsoIST() },
          } as any;
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          (contentJson.raw = updatedCJ.raw);
          (raw.categoryIds = [inferred]);
        } catch {
          // ignore
        }
      }
    }
  }

  // Combined TRUE/FALSE prompt mode (OpenAI-only best practice per user request)
  const wantWork = !!(queue.web || queue.short || queue.newspaper);
  if (wantWork) {
    try {
      const flags = await (prisma as any).tenantFeatureFlags?.findUnique?.({ where: { tenantId: article.tenantId } }).catch(() => null);
      const tenantAiRewriteEnabled = flags?.aiArticleRewriteEnabled !== false;
      const aiMode = tenantAiRewriteEnabled ? 'FULL' : 'LIMITED';

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
            await notifyCallback(article, 'SKIPPED', updatedCJ);
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
          await notifyCallback(article, 'FAILED', updatedCJ);
          return;
        }

        // Parse and persist
        if (aiMode === 'FULL') {
          const parsed = parseTrueOutput(out);
          if (!parsed) {
            updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'PARSE_TRUE_FAILED', aiFinishedAt: nowIsoIST(), aiRawOutput: out };
            await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
            await notifyCallback(article, 'FAILED', updatedCJ);
            return;
          }

          // Update/Upsert NewspaperArticle linked to this base article
          try {
            const existing = await prisma.newspaperArticle.findFirst({ where: { baseArticleId: article.id } }).catch(() => null) as any;
            const npTitle = parsed.newspaper.title || article.title;
            const npContent = parsed.newspaper.content || article.content;
            const points = (parsed.newspaper.keyPoints || []).slice(0, 5).map(p => {
              const s = String(p || '').trim();
              // enforce 4-5 word constraint best-effort
              const w = words(s);
              if (w > 5) return s.split(/\s+/).slice(0, 5).join(' ');
              return s;
            });
            if (existing?.id) {
              await prisma.newspaperArticle.update({
                where: { id: existing.id },
                data: {
                  title: npTitle,
                  subTitle: parsed.newspaper.subtitle || null,
                  heading: parsed.newspaper.subtitle || npTitle,
                  points,
                  content: npContent,
                }
              });
              updatedCJ.newspaperArticleId = existing.id;
            } else {
              const created = await prisma.newspaperArticle.create({
                data: {
                  tenantId: article.tenantId,
                  authorId: article.authorId,
                  languageId: null as any,
                  baseArticleId: article.id,
                  title: npTitle,
                  subTitle: parsed.newspaper.subtitle || null,
                  heading: parsed.newspaper.subtitle || npTitle,
                  points,
                  dateline: String(raw?.dateline || ''),
                  content: npContent,
                  placeName: String(raw?.locationRef?.displayName || null),
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
              blocks: [],
              audit: { createdAt: nowIsoIST(), updatedAt: nowIsoIST() },
            };
            const existingWeb = await prisma.tenantWebArticle.findFirst({ where: { tenantId: article.tenantId, authorId: article.authorId, slug: webSlug } }).catch(() => null) as any;
            if (existingWeb?.id) {
              await prisma.tenantWebArticle.update({
                where: { id: existingWeb.id },
                data: {
                  title: webTitle,
                  slug: webSlug,
                  domainId: domainId || undefined,
                  contentJson: webJson,
                  seoTitle: webJson.meta.seoTitle,
                  metaDescription: webJson.meta.metaDescription,
                  jsonLd: webJson.jsonLd || undefined,
                  tags,
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
                  contentJson: webJson,
                  seoTitle: webJson.meta.seoTitle,
                  metaDescription: webJson.meta.metaDescription,
                  jsonLd: webJson.jsonLd || undefined,
                  tags,
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
                  status: shouldPublish ? 'AI_APPROVED' : 'DESK_PENDING',
                  seo: {
                    metaTitle: parsed.web.seoTitle || shortTitle,
                    metaDescription: parsed.web.metaDescription || '',
                    tags: (parsed.web.keywords || []).slice(0, 10),
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
          await notifyCallback(article, 'DONE', updatedCJ);
          return;
        }

        // LIMITED mode
        const parsed2 = parseFalseOutput(out);
        if (!parsed2) {
          updatedCJ = { ...updatedCJ, aiStatus: 'FAILED', aiError: 'PARSE_FALSE_FAILED', aiFinishedAt: nowIsoIST(), aiRawOutput: out };
          await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
          await notifyCallback(article, 'FAILED', updatedCJ);
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
          if (existingId) {
            await prisma.tenantWebArticle.update({
              where: { id: existingId },
              data: {
                title: webTitle,
                slug: webSlug,
                domainId: domainId || undefined,
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
        await notifyCallback(article, 'DONE', updatedCJ);
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
  await notifyCallback(article, 'DONE', updatedCJ);
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
      await notifyCallback(art, 'FAILED', failedCJ);
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
