import prisma from '../src/lib/prisma';

async function main() {
  const key = 'ai_web_article_json';
  const content = `Act as a highly experienced [INSERT DESIRED PERSONA: e.g., Senior Tech Analyst, Investigative Reporter, Expert Financial Advisor] and professional SEO Content Strategist. Your task is to transform the provided source material into a comprehensive, authoritative, and engaging long-form analysis piece (minimum 1000 words). Maintain a strict, purely human writing style that matches the chosen persona.

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
[@@SOURCE@@]
`;

  const upserted = await (prisma as any).prompt.upsert({
    where: { key },
    update: { content },
    create: { key, content }
  });
  console.log('Upserted prompt', upserted.key);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await (prisma as any).$disconnect(); });
