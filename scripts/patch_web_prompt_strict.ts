import prisma from '../src/lib/prisma';

const KEY = 'ai_web_article_json';

const STRICT_TEMPLATE = `Return ONLY one valid JSON object, no code fences, no commentary, no extra text.

Input context:
- tenantId: {{TENANT_ID}}
- languageCode: {{LANGUAGE_CODE}}
- authorId: {{AUTHOR_ID}}
- categoryIds: {{CATEGORY_IDS}}
- images: {{IMAGE_URLS}}
- isPublished: {{IS_PUBLISHED}}
- raw: {{RAW_JSON}}

Output JSON keys and rules:
- slug: kebab-case from title, max 120 chars
- title: refined from raw, language-sensitive
- subtitle: concise, optional
- excerpt: 18–30 words, human-readable summary
- authors: [{ id: "{{AUTHOR_ID}}", name: "", role: "reporter" }]
- status: "published" if {{IS_PUBLISHED}} is true else "draft"
- publishedAt: current timestamp in +05:30 (ISO 8601, e.g. 2025-12-03T15:32:11+05:30)
- readingTimeMin: max(1, round(total_words/200))
- categories: array of strings (names or ids), non-empty
- tags: 3–7 concise strings
- coverImage: { url: first of {{IMAGE_URLS}} or "", alt: "", caption: "" }
- blocks: canonical content blocks. Allowed types:
  - h1: { type: "h1", text: string }
  - h2: { type: "h2", text: string }
  - h3: { type: "h3", text: string }
  - p: { type: "p", text: string }
  - list: { type: "list", ordered: boolean, items: [string, ...] }
  - image: { type: "image", url: string, alt: string, caption: string }
- contentHtml: sanitized HTML rendering of blocks (allow only <p>, <h1>-<h3>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <figure>, <img>, <figcaption>)
- plainText: text-only rendering (headings on new lines, lists as "- item")
- meta: { seoTitle: <=60 chars, metaDescription: 110–155 chars }
- jsonLd: Schema.org NewsArticle with headline, image[], datePublished, dateModified, author, publisher (use publisher name "Kaburlu" or empty if unknown; logo can be empty "")
- audit: { createdAt: current +05:30 timestamp, updatedAt: same, createdBy: "{{AUTHOR_ID}}", updatedBy: "{{AUTHOR_ID}}" }

Hard requirements:
1) Output must be VALID JSON only. No markdown, no fences, no trailing commas.
2) Use ONLY the allowed HTML tags when generating contentHtml. Strip others.
3) If {{LANGUAGE_CODE}} is "te", produce article text in Telugu; metadata can be Telugu or English but must be brief.
4) Combine all 'p' block texts to total between 600 and 1200 words. Expand or condense neutrally without inventing facts.
5) Preserve factual content from raw; do not add unsupported claims or numbers.
6) If a required field cannot be derived, use empty string or empty array.
7) Dates must be in ISO 8601 with +05:30 offset.
8) Return a single JSON object exactly matching the keys above.

Data to use (raw editor payload):
{{RAW_JSON}}`;

async function main() {
  const existing = await prisma.prompt.findUnique({ where: { key: KEY } });
  if (existing) {
    await prisma.prompt.update({ where: { key: KEY }, data: { content: STRICT_TEMPLATE, description: 'Strict website article JSON with Telugu support and 600–1200 word guard' } });
    console.log(`Updated prompt ${KEY}`);
  } else {
    await prisma.prompt.create({ data: { key: KEY, content: STRICT_TEMPLATE, description: 'Strict website article JSON with Telugu support and 600–1200 word guard' } });
    console.log(`Created prompt ${KEY}`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
