import prisma from './prisma';

type PromptKey = 'SEO_GENERATION' | 'MODERATION' | 'CATEGORY_TRANSLATION';

const cache = new Map<string, { content: string; ts: number }>();
const CACHE_MS = 60_000; // 1 minute

const defaults: Record<PromptKey, string> = {
  SEO_GENERATION: `You are an SEO assistant. Given a news title and content, produce strict JSON with keys: metaTitle, metaDescription, tags, altTexts.
- metaTitle: short, compelling, <= 70 chars.
- metaDescription: <= 160 chars.
- tags: 5-10 concise tags.
- altTexts: object mapping provided image URL -> descriptive alt text.
Respond entirely in language code: {{languageCode}}.
Title: {{title}}
Content: {{content}}
Images: {{images}}
Output JSON schema: {"metaTitle": string, "metaDescription": string, "tags": string[], "altTexts": { [url: string]: string }}`,

  MODERATION: `Content moderation for news. Analyze the text for plagiarism likelihood and sensitive content (violence, hate, adult, personal data).
Return STRICT JSON: {"plagiarismScore": number (0-1), "sensitiveFlags": string[], "decision": "ALLOW"|"REVIEW"|"BLOCK", "remark": string (short, in {{languageCode}})}.
Text: {{content}}`,

  CATEGORY_TRANSLATION: `You are a translator. Translate the news category name exactly into {{targetLanguage}}.
Rules:
- Respond with ONLY the translated category name.
- No quotes, no extra words, no punctuation.
- Use the native script of {{targetLanguage}}{{latinGuard}}.
Category: {{text}}`,
};

export async function getPrompt(key: PromptKey): Promise<string> {
  const now = Date.now();
  const c = cache.get(key);
  if (c && now - c.ts < CACHE_MS) return c.content;
  try {
    // Use dynamic access to avoid TS typing issues until Prisma client is regenerated
    const row = await (prisma as any).prompt?.findUnique?.({ where: { key } });
    const content = row?.content || defaults[key];
    cache.set(key, { content, ts: now });
    return content;
  } catch {
    return defaults[key];
  }
}

export function renderPrompt(tpl: string, ctx: Record<string, any>) {
  return tpl.replace(/{{\s*([\w.]+)\s*}}/g, (_, k) => {
    const v = ctx[k];
    if (v === undefined || v === null) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  });
}
