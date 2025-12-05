import prisma from './prisma';

type PromptKey =
  | 'SEO_GENERATION'
  | 'MODERATION'
  | 'CATEGORY_TRANSLATION'
  | 'SHORTNEWS_REWRITE'
  | 'SHORTNEWS_AI_ARTICLE'
  | 'ai_web_article_json';

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

  SHORTNEWS_REWRITE: `You are a professional short news assistant. Rewrite the provided raw user text into a concise, factual short news draft in the SAME language as the input (language code: {{languageCode}}).
Constraints:
- Title: <= 35 characters, punchy, no clickbait, no ALL CAPS, no emojis.
- Content: <= 60 words. Neutral, factual tone. No repetition. No speculation beyond given facts.
- Remove greetings, personal opinions, promotional lines, and unrelated chatter.
- Preserve key facts: who, what, where, when. If missing, do NOT invent.
Output STRICT JSON ONLY (no markdown) with schema: {"title": string, "content": string}.
InputTitle (may be empty): {{title}}
InputText: {{content}}`,

  SHORTNEWS_AI_ARTICLE: `You are a senior news sub‑editor. Convert the raw field note into a CLEAR and FACTUAL SHORT NEWS ITEM in the SAME language (language code: {{languageCode}}).
RAW INPUT (<=500 words): {{content}}

QUALITY GOALS:
• Headline must instantly communicate WHO/WHAT + key ACTION + LOCATION (if present) – no ambiguity.
• First sentence = core event (who/what/where/when). Second sentence = impact / supporting detail ONLY if present.
• Absolutely NO invented facts. If time / location / numbers missing, just omit (never write "unknown" / guess).
• Easy to read: short plain words, no jargon unless standard (e.g., FIR, MLA). No greetings, emotion, hashtags, emojis, promotion.
• Active voice. Avoid passive unless subject unknown.
• Remove repetition, filler, self‑reference, thanks lines, lists of honorifics unless essential.

HEADLINE RULES:
• <= 35 characters (hard cap after trimming). Specific & meaningful.
• Must contain concrete subject (e.g., "School", "Rain", "Police", a place name) + action/result.
• No vague adjectives ("big", "shocking"), no clickbait, no exclamation, no question mark, no ALL CAPS (except established acronyms ≤5 letters).
• If event is ongoing, present tense; if completed, past tense.

BODY RULES:
• TARGET LENGTH: EXACT 60 words when enough real facts exist. If genuine facts run short, allow 58–60. NEVER exceed 60. NEVER drop below 55. Use only facts present.
• Max 2 sentences (3 ONLY if required to include distinct factual elements and still <=60 words).
• Sentence 1: Core fact(s). Sentence 2 (or 2 & 3): Impact / action / next step (ONLY if those facts exist in input).
• Do NOT add invented filler just to reach word count. If authentic facts run out, end early (minimum 40 words allowed) — but attempt to pack all real facts to reach close to 60.
• No repeating headline wording unless unavoidable.
• Combine similar minor details; condense lists (e.g., multiple officials) into one concise phrase.

READABILITY ENFORCERS (internal steps – DO them but DO NOT output explanation):
1. Draft headline & body.
2. Re-check headline: does it stand alone with clear meaning? If not, rewrite once.
3. Trim extra words (especially filler like "today morning" -> "this morning", or duplicated location words).
4. Ensure no hallucinated data was added.

CATEGORY SUGGESTION:
Choose ONE (exact case) most appropriate: Politics, Crime, Accident, Weather, Sports, Business, Education, Health, Environment, Technology, Entertainment, Community, Traffic, Agriculture. If unclear, use "Community".

OPTIONAL HEADINGS (ONLY IF USEFUL):
• If the content would benefit from a short sub-head (h2) or a tag-line (h3), include them.
• If NOT needed, omit entirely. Never invent headings just to fill.
• Each heading text ≤ 50 characters. Provide styling fields when included: color (text color) and bgColor (background color). If unsure, set bgColor to "transparent".

OUTPUT STRICT RAW JSON ONLY (no markdown) with EXACT schema:
{
  "title": string,
  "content": string,
  "suggestedCategoryName": string,
  "headings"?: {
    "h2"?: { "text": string, "color"?: string, "bgColor"?: string },
    "h3"?: { "text": string, "color"?: string, "bgColor"?: string }
  }
}
Return ONLY the JSON object.`,

  // For web article, default to user's two-block prompt
  ai_web_article_json: `Act as a highly experienced [INSERT DESIRED PERSONA: e.g., Senior Tech Analyst, Investigative Reporter, Expert Financial Advisor] and professional SEO Content Strategist. Your task is to transform the provided source material into a comprehensive, authoritative, and engaging long-form analysis piece (minimum 1000 words). Maintain a strict, purely human writing style that matches the chosen persona.

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
    * A minimum of **five H2 Headings** (main sections).
    * At least **three H3 Subheadings** nested under one or more H2 sections.
- Ensure the **Target Primary Keyword** is naturally woven throughout the text for maximum optimization.

Target Primary Keyword: **[INSERT YOUR MAIN KEYWORD HERE]**
Target Audience: **[INSERT YOUR TARGET AUDIENCE HERE]**
Tone: **[INSERT DESIRED TONE HERE (e.g., Deeply Analytical, Highly Persuasive, Objective and Detailed)]**

Original Source Material:
[@@SOURCE@@]`
};

// Export a helper to retrieve the raw default (bypasses DB row) for maintenance scripts
export function getDefaultPrompt(key: PromptKey): string {
  return defaults[key];
}

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
