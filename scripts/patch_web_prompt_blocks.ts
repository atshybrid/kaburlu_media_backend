/*
  Upsert ai_web_article_json prompt with strict blocks schema.
*/
import prisma from '../src/lib/prisma';

async function main() {
  const key = 'ai_web_article_json';
  const content = `Return ONLY one valid JSON object for a website article. No markdown, no code fences, no text outside JSON.

Fields required:
- tenantId: string
- languageCode: string
- slug: string (kebab-case, <=120)
- title: string
- subtitle: string
- excerpt: string (20–30 words)
- authors: [{ id: string, name: string, role: 'reporter' }]
- status: 'published' | 'draft'
- publishedAt: ISO8601 with +05:30 offset
- readingTimeMin: integer >= 1
- categories: string[]
- tags: string[] (3–7)
- coverImage: { url: string }
- blocks: array of objects with type in ['h1','h2','h3','p','list','image'] only
  - h1/h2/h3: { type: 'h1'|'h2'|'h3', text: string }
  - p: { type: 'p', text: string }
  - list: { type: 'list', items: string[] }
  - image: { type: 'image', url: string, caption?: string, alt?: string }
- contentHtml: string (rendered from blocks; allow only <p>,<h1>,<h2>,<h3>,<ul>,<ol>,<li>,<strong>,<em>,<a>,<figure>,<img>,<figcaption>)
- plainText: string
- meta: { seoTitle: string (<=60 chars), metaDescription: string (110–155 chars) }
- jsonLd: NewsArticle object with headline, image[], datePublished, dateModified, author, publisher (logo may be empty)
- audit: { createdAt: ISO8601 +05:30, updatedAt: ISO8601 +05:30, createdBy: string, updatedBy: string }

Language rules:
- If LANGUAGE_CODE is 'te', produce Telugu text for title, subtitle, excerpt, blocks, and plainText. Meta may be Telugu or English, concise.

Structure rules:
1. Begin with one 'h1' block for the main title.
2. Follow 'h1' with one 'p' block summarizing the article.
3. Use 'h2' blocks for main sections; each 'h2' must be immediately followed by at least one 'p' block.
4. Use 'h3' blocks for sub-sections when needed; each 'h3' must be followed by at least one 'p' block.
5. Lists are optional; when present, use a single 'list' block with 3–6 short items.
6. Images are optional; when present, include one 'image' block with url and short caption.
7. Do NOT output markdown headings (##, ###); only JSON.

Content length:
- The combined article body (all 'p' block texts joined) MUST be between 600 and 1200 words. If source content is shorter, expand with neutral context and quotes from the input without inventing facts. If longer, condense while preserving key points.

Input payload (RAW_JSON):
{RAW_JSON}

Populate fields from RAW_JSON:
- tenantId: TENANT_ID
- languageCode: LANGUAGE_CODE
- authors: [{ id: AUTHOR_ID, name: '', role: 'reporter' }]
- categories: CATEGORY_IDS (array)
- coverImage.url: first entry in IMAGE_URLS if present
- status: 'published' when IS_PUBLISHED == 'true' else 'draft'
- publishedAt, audit.createdAt/updatedAt: current timestamp with +05:30 offset
- slug: derive from title (kebab-case)

Output requirements:
- Output ONLY JSON. DO NOT include any explanation or text before/after JSON.
- Ensure the JSON is valid and parseable.
`;

  const description = 'Strict JSON-only website article with blocks schema (h1/h2/h3 + p, list, image).';

  const upserted = await (prisma as any).prompt?.upsert?.({
    where: { key },
    update: { content, description },
    create: { key, content, description }
  });
  console.log('Upserted prompt:', upserted?.key || key);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await (prisma as any).$disconnect?.(); });
