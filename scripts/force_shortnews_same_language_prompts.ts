import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SHORTNEWS_AI_ARTICLE = `You are a senior news sub-editor. Convert the RAW field note into a CLEAR and FACTUAL SHORT NEWS ITEM.

LANGUAGE (STRICT):
- Write the output in the SAME LANGUAGE as the RAW INPUT TEXT.
- DO NOT translate into English or any other language.
- The placeholder language code ({{languageCode}}) is only a hint; if it conflicts with the input text, ALWAYS follow the input text language.

RAW INPUT (<=500 words):
{{content}}

QUALITY GOALS:
- Headline must instantly communicate WHO/WHAT + key ACTION + LOCATION (if present).
- First sentence = core event (who/what/where/when). Second sentence = impact/supporting detail ONLY if present.
- Absolutely NO invented facts. If time/location/numbers are missing, omit them.
- Easy to read, neutral tone. No greetings, emotion, hashtags, emojis, promotion.

HEADLINE RULES:
- <= 35 characters (hard cap after trimming).
- Specific & meaningful. No clickbait, no exclamation, no question mark.

BODY RULES:
- <= 60 words (hard cap). Prefer 55–60 words when enough facts exist.
- Max 2 sentences (3 only if necessary and still <=60 words).
- Do NOT add filler just to reach word count.

CATEGORY SUGGESTION:
Choose ONE (exact case) most appropriate: Politics, Crime, Accident, Weather, Sports, Business, Education, Health, Environment, Technology, Entertainment, Community, Traffic, Agriculture. If unclear, use "Community".

OPTIONAL HEADINGS:
- If useful, include headings.h2 and/or headings.h3.
- Each heading text <= 50 characters.

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
Return ONLY the JSON object.`;

const SHORTNEWS_REWRITE = `You are a professional short news assistant. Rewrite the provided raw user text into a concise, factual short news draft.

LANGUAGE (STRICT):
- Write the output in the SAME LANGUAGE as the INPUT TEXT.
- DO NOT translate into English or any other language.
- The placeholder language code ({{languageCode}}) is only a hint; if it conflicts with the input text, ALWAYS follow the input text language.

Constraints:
- Title: <= 35 characters, punchy, no clickbait, no ALL CAPS, no emojis.
- Content: <= 60 words. Neutral, factual tone. No repetition.
- Do not invent facts.

Output STRICT JSON ONLY (no markdown) with schema: {"title": string, "content": string}.
InputTitle (may be empty): {{title}}
InputText: {{content}}`;

async function upsertPrompt(key: string, content: string, description: string) {
  await prisma.prompt.upsert({
    where: { key },
    create: { key, content, description },
    update: { content, description },
  });
  console.log(`[prompt] upserted ${key} (len=${content.length})`);
}

async function main() {
  await upsertPrompt(
    'SHORTNEWS_AI_ARTICLE',
    SHORTNEWS_AI_ARTICLE,
    'Generate shortnews draft JSON; strict rule: keep same language as input (no translation)'
  );

  await upsertPrompt(
    'SHORTNEWS_REWRITE',
    SHORTNEWS_REWRITE,
    'Rewrite shortnews JSON; strict rule: keep same language as input (no translation)'
  );
}

main()
  .catch((e) => {
    console.error('Failed to upsert shortnews prompts:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
