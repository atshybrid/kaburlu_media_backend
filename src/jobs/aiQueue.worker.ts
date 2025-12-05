import prisma from '../lib/prisma';
import { aiGenerateText } from '../lib/aiProvider';
import { sanitizeHtmlAllowlist, slugFromAnyLanguage, trimWords } from '../lib/sanitize';
import { generateAiShortNewsFromPrompt } from '../api/shortnews/shortnews.ai';

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
      `You are an article formatter and SEO assistant. Input: a small editor payload follows. Output: a single JSON object only (no commentary). Sanitize HTML (allow only <p>,<h1>-<h3>,<ul>,<ol>,<li>,<strong>,<em>,<a>,<figure>,<img>,<figcaption>). Use ISO 8601 for dates. If languageCode is "te", produce Telugu article text; metadata can be English or Telugu. Preserve user text; do not invent facts.

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
  const payload = {
    tenantId: article.tenantId,
    languageCode,
    authorId: article.authorId,
    categoryIds: raw.categoryIds || [],
    images: raw.images || article.images || [],
    isPublished: article.status === 'PUBLISHED',
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
        const jsonText = aiRaw.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        let webJson = JSON.parse(jsonText);
        if (typeof webJson?.contentHtml === 'string') webJson.contentHtml = sanitizeHtmlAllowlist(webJson.contentHtml);
        if (!webJson.slug && webJson.title) webJson.slug = slugFromAnyLanguage(String(webJson.title), 120);
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
      } catch {}
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
            status: 'PENDING',
            seo: updatedCJ?.web?.meta ? updatedCJ.web.meta : undefined,
            headings: draft.headings ? (draft.headings as any) : undefined,
            mediaUrls: payload.images || []
          }
        });
        updatedCJ = { ...updatedCJ, shortDone: true, shortNewsId: short.id };
      } catch (e) {
        updatedCJ = { ...updatedCJ, shortError: String(e && (e as any).message || e) };
      }
    }
  }

  // NEWSPAPER: only mark queued; actual generation to be implemented in phase 2
  if (queue.newspaper && !contentJson.newspaperQueued) {
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
    const count = await prisma.article.count({ where: { authorId: article.authorId, tenantId: article.tenantId, type: 'newspaper', createdAt: { gte: start, lte: end } } });
    if (count >= 2) {
      updatedCJ = { ...updatedCJ, newspaperQueued: false, newspaperError: 'DAILY_LIMIT_REACHED' };
    } else {
      // Generate newspaper prompt and create a dedicated record of type=newspaper
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
      else npPrompt = (process.env.NEWSPAPER_PROMPT_CHATGPT || '').trim();
      if (!npPrompt) {
        npPrompt = await getPrompt(provider2 === 'gemini' ? 'ai_newspaper_article_json_gemini' : 'ai_newspaper_article_json') || '';
      }
      if (!npPrompt) {
        npPrompt = `You are an article formatter for print newspaper. Output a single JSON object with fields { headline, subhead, dateline, bodyHtml, plainText, meta }. Keep clean, column-friendly HTML (only <p>,<h2>,<h3>,<ul>,<ol>,<li>,<strong>,<em>). No figures/images. Language follows input. Use ISO 8601 dates (+05:30). Preserve facts; do not invent.`;
      }
      npPrompt = renderTemplate(npPrompt, { RAW_JSON: JSON.stringify(base.raw || {}, null, 2) });
      const npRes = await aiGenerateText({ prompt: npPrompt, purpose: 'newspaper' as any });
      const npText = npRes.text;
      let npJson: any = {};
      try {
        const jsonText = npText.trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
        npJson = JSON.parse(jsonText);
        if (typeof npJson?.bodyHtml === 'string') npJson.bodyHtml = sanitizeHtmlAllowlist(npJson.bodyHtml);
      } catch {}
      const created = await prisma.article.create({
        data: {
          title: npJson?.headline || article.title,
          content: npJson?.plainText || article.content,
          type: 'newspaper',
          status: 'DRAFT',
          authorId: article.authorId,
          tenantId: article.tenantId || undefined,
          languageId: article.languageId || undefined,
          categories: { connect: (raw.categoryIds || []).map((id: string) => ({ id })) },
          contentJson: { newspaper: npJson, baseFromArticleId: article.id }
        }
      });
      const usageList = Array.isArray(updatedCJ.aiUsage) ? updatedCJ.aiUsage : [];
      if (npRes.usage) usageList.push(npRes.usage);
      updatedCJ = { ...updatedCJ, newspaperQueued: true, newspaperDraftId: created.id, aiUsage: usageList };
    }
  }

  updatedCJ = { ...updatedCJ, aiStatus: 'DONE', aiFinishedAt: now, aiQueue: { ...updatedCJ.aiQueue, web: false, short: false } };
  await prisma.article.update({ where: { id: article.id }, data: { contentJson: updatedCJ } });
}

async function main() {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
  const batch = await prisma.article.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    take: 500
  });
  const pending = batch.filter((a: any) => {
    const cj = a.contentJson || {};
    const q = cj.aiQueue || {};
    return (q.web && !cj.web) || (q.short && !cj.shortDone);
  });
  for (const art of pending) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await processOne(art);
    } catch (e) {
      // mark failed
      const cj = (art as any).contentJson || {};
      await prisma.article.update({ where: { id: art.id }, data: { contentJson: { ...cj, aiStatus: 'FAILED', aiError: String((e as any)?.message || e) } } });
    }
  }
  // eslint-disable-next-line no-console
  console.log(`Processed ${pending.length} queued articles.`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
