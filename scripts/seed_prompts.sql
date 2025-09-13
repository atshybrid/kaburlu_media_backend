-- Upsert default prompts for SEO, Moderation, and Category Translation

INSERT INTO "Prompt" (id, key, content, description)
VALUES
  ('seo_default', 'SEO_GENERATION', $$You are an SEO assistant. Given a news title and content, produce strict JSON with keys: metaTitle, metaDescription, tags, altTexts.
- metaTitle: short, compelling, <= 70 chars.
- metaDescription: <= 160 chars.
- tags: 5-10 concise tags.
- altTexts: object mapping provided image URL -> descriptive alt text.
Respond entirely in language code: {{languageCode}}.
Title: {{title}}
Content: {{content}}
Images: {{images}}
Output JSON schema: {"metaTitle": string, "metaDescription": string, "tags": string[], "altTexts": { [url: string]: string }}$$, 'Default SEO generation template'),
  ('mod_default', 'MODERATION', $$Content moderation for news. Analyze the text for plagiarism likelihood and sensitive content (violence, hate, adult, personal data).
Return STRICT JSON: {"plagiarismScore": number (0-1), "sensitiveFlags": string[], "decision": "ALLOW"|"REVIEW"|"BLOCK", "remark": string (short, in {{languageCode}})}.
Text: {{content}}$$, 'Default moderation template'),
  ('cat_default', 'CATEGORY_TRANSLATION', $$You are a translator. Translate the news category name exactly into {{targetLanguage}}.
Rules:
- Respond with ONLY the translated category name.
- No quotes, no extra words, no punctuation.
- Use the native script of {{targetLanguage}}{{latinGuard}}.
Category: {{text}}$$, 'Default category translation template')
ON CONFLICT (key) DO UPDATE SET content = EXCLUDED.content, description = EXCLUDED.description;