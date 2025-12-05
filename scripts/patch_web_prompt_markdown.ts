import prisma from '../src/lib/prisma';

const KEY = 'ai_web_article_markdown';

const MD_TEMPLATE = `**SYSTEM INSTRUCTION (Optional, but best practice):**
You are a Senior SEO Content Strategist and a professional Journalist specialized in creating long-form, optimized web articles. Your task is to rewrite, expand, and structure the user's RAW ARTICLE TEXT into a high-quality article that strictly adheres to all specified constraints. You must output **only** the content that follows the exact structure provided below. Do not include any preambles, explanations, or conversational text.

**USER PROMPT:**

**TASK:**
Rewrite and significantly expand the provided RAW ARTICLE TEXT into a comprehensive web article between **600 and 1200 words**.

**CONSTRAINTS:**
1.  **Length:** Main article body must be 600–1200 words.
2.  **Language:** Maintain the original language (e.g., Telugu, based on the input sample).
3.  **Tone:** Professional, authoritative, and journalistic.
4.  **Formatting:** The main article must use a clear hierarchy of **H2 and H3 headings** (use Markdown: \`##\` and \`###\`).

**OUTPUT FORMAT:**
The entire output must follow this exact Markdown structure with all fields filled.

### 1. SHORT TITLE (Maximum 50 characters)
[Title here]

### 2. ARTICLE BRIEF (Maximum 60 words, compelling summary)
[Brief summary here]

### 3. MAIN ARTICLE (600-1200 Words)
## [Generated H2 Heading 1]
[Expanded article content paragraph 1]
[Expanded article content paragraph 2]
### [Generated H3 Subheading 1.1]
[Expanded content...]
## [Generated H2 Heading 2]
[Expanded article content...]
### [Generated H3 Subheading 2.1]
[Expanded content...]
[Continue using H2/H3 until 600-1200 word count is reached]

### 4. SEO METADATA
* **SEO Title (Max 60 chars):** [Generated SEO Title]
* **Meta Description (110-155 chars):** [Generated Meta Description]
* **Target Keywords (5-8 High-Value Terms):** [Keyword 1, Keyword 2, Keyword 3, Keyword 4, ...]
* **Focus Slug (Kebab-case, Max 120 chars):** [generated-slug-from-title]

---

**RAW ARTICLE TEXT TO REWRITE:**
{{RAW_TEXT}}
`;

async function main() {
  const existing = await prisma.prompt.findFirst({ where: { key: KEY } });
  if (existing) {
    await prisma.prompt.update({ where: { id: existing.id }, data: { content: MD_TEMPLATE, updatedAt: new Date() } });
    console.log(`Updated prompt ${KEY} -> markdown rewrite`);
  } else {
    await prisma.prompt.create({ data: { key: KEY, content: MD_TEMPLATE } as any });
    console.log(`Created prompt ${KEY} -> markdown rewrite`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
