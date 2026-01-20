# Best Practice: Single AI Generation → Multi-Format Distribution

## Current Flow Analysis

### ✅ Your 3 Existing APIs (Already Working)
```
1. POST /articles/newspaper     - Newspaper format articles
2. POST /articles/tenant        - Web/website articles  
3. POST /shortnews              - Short news summaries
```

## Recommended Implementation

### Option 1: New Unified API (RECOMMENDED)
Create a **single endpoint** that generates all 3 formats in one AI call.

#### New API Endpoint
```
POST /articles/ai/multi-format
```

**Request:**
```json
{
  "tenantId": "cmk...",
  "reporterInput": "Raw news text or bullet points...",
  "categoryId": "cmcat...",
  "languageCode": "te",
  "images": ["https://..."],
  "location": {
    "stateId": "...",
    "districtId": "...",
    "mandalId": "..."
  }
}
```

**AI Prompt Structure:**
```
Generate 3 versions of this news:

1. NEWSPAPER (Print Format):
   - Formal tone
   - 400-600 words
   - Traditional inverted pyramid structure
   - Include headline, subheadline, dateline

2. WEB ARTICLE (Digital Format):
   - Scannable paragraphs (2-3 sentences each)
   - SEO-optimized headline
   - Bullet points for key facts
   - 300-400 words

3. SHORT NEWS (Mobile/Social):
   - 2-3 sentences maximum
   - 50-100 words
   - Lead with most important fact
   - Include emoji if appropriate

Return as JSON:
{
  "newspaper": { "title": "...", "subTitle": "...", "content": "...", "dateline": "..." },
  "web": { "title": "...", "sections": [...], "summary": "..." },
  "shortNews": { "title": "...", "summary": "..." }
}
```

**Response:**
```json
{
  "newspaperId": "cmart123",
  "webArticleId": "cmart456", 
  "shortNewsId": "cmsn789",
  "aiCost": 0.0042,
  "processingTime": "2.3s"
}
```

**Implementation Steps:**

1. **Create New Controller** - `src/api/articles/multiFormat.controller.ts`
2. **Single AI Call** - Generate all 3 versions simultaneously
3. **Parallel API Calls** - Use `Promise.all()` to post to all 3 APIs
4. **Transaction Safety** - If any format fails, rollback all

---

### Option 2: Update Existing Newspaper API (SIMPLER)
Enhance the **existing** `/articles/newspaper` to auto-generate other formats.

#### Modify POST /articles/newspaper

**Add Query Parameter:**
```
POST /articles/newspaper?autoGenerateFormats=true
```

**Current Behavior (No Change):**
```
autoGenerateFormats=false → Only creates newspaper article
```

**New Enhanced Behavior:**
```
autoGenerateFormats=true → Creates all 3 formats in background
```

**Response:**
```json
{
  "newspaperId": "cmart123",
  "status": "PUBLISHED",
  "autoGeneration": {
    "enabled": true,
    "status": "processing",
    "webArticleId": "cmart456",      // Created immediately
    "shortNewsId": "cmsn789",         // Created immediately
    "estimatedTime": "2s"
  }
}
```

**Implementation Steps:**

1. **Update** `src/api/articles/newspaper.controller.ts`
2. **Add AI logic** to generate web + short versions from newspaper content
3. **Call existing APIs** in parallel:
   ```typescript
   const [webArticle, shortNews] = await Promise.all([
     createWebArticle(webPayload),
     createShortNews(shortPayload)
   ]);
   ```

---

## Code Changes Needed

### 1. Create AI Prompt for Multi-Format Generation

**File:** `src/lib/prompts/multiFormatPrompt.ts`
```typescript
export function buildMultiFormatPrompt(input: {
  rawContent: string;
  languageCode: string;
  categoryName?: string;
  location?: string;
}): string {
  return `
You are a professional news editor. Generate 3 versions of this news in ${input.languageCode}:

INPUT:
${input.rawContent}

OUTPUT FORMAT (JSON):
{
  "newspaper": {
    "title": "Formal headline (max 80 chars)",
    "subTitle": "Secondary headline (max 100 chars)",
    "lead": "First paragraph (50-80 words)",
    "content": "Full article (400-600 words, formal tone)",
    "dateline": "${input.location || 'HYDERABAD'}"
  },
  "web": {
    "title": "SEO headline (max 70 chars)",
    "summary": "Brief summary (100-150 words)",
    "sections": [
      { "heading": "Key Points", "content": "Bullet points..." },
      { "heading": "Details", "content": "Detailed paragraphs..." }
    ]
  },
  "shortNews": {
    "title": "Concise headline (max 50 chars)",
    "summary": "2-3 sentences with most important facts (50-100 words)"
  }
}

RULES:
- All content in ${input.languageCode} language
- Maintain factual accuracy across all versions
- Newspaper: Formal, traditional style
- Web: Scannable, modern style with subheadings
- Short: Mobile-first, concise
`;
}
```

### 2. Create Multi-Format Controller

**File:** `src/api/articles/multiFormat.controller.ts`
```typescript
import { aiProvider } from '../../lib/aiProvider';
import { buildMultiFormatPrompt } from '../../lib/prompts/multiFormatPrompt';

export async function createMultiFormatArticle(req: any, res: any) {
  try {
    const { tenantId, reporterInput, categoryId, languageCode, images, location } = req.body;
    
    // 1. Generate all 3 versions with single AI call
    const prompt = buildMultiFormatPrompt({
      rawContent: reporterInput,
      languageCode,
      location: location?.mandalName || location?.districtName
    });

    const aiResponse = await aiProvider.generateStructuredContent(prompt);
    const formats = JSON.parse(aiResponse.content);

    // 2. Create all 3 articles in parallel
    const [newspaper, webArticle, shortNews] = await Promise.all([
      // POST /articles/newspaper internally
      createNewspaperArticleInternal({
        tenantId,
        authorId: req.user.sub,
        categoryId,
        languageId: getLanguageId(languageCode),
        title: formats.newspaper.title,
        subTitle: formats.newspaper.subTitle,
        lead: formats.newspaper.lead,
        heading: formats.newspaper.content,
        dateline: formats.newspaper.dateline,
        images
      }),
      
      // POST /articles/tenant internally
      createWebArticleInternal({
        tenantId,
        title: formats.web.title,
        content: formats.web.summary,
        sections: formats.web.sections,
        categoryIds: [categoryId],
        languageCode,
        images
      }),
      
      // POST /shortnews internally  
      createShortNewsInternal({
        tenantId,
        title: formats.shortNews.title,
        summary: formats.shortNews.summary,
        categoryId,
        languageCode,
        images
      })
    ]);

    return res.status(201).json({
      success: true,
      newspaperId: newspaper.id,
      webArticleId: webArticle.id,
      shortNewsId: shortNews.id,
      aiCost: aiResponse.cost,
      processingTime: aiResponse.processingTime
    });

  } catch (error: any) {
    console.error('Multi-format generation error:', error);
    return res.status(500).json({ error: error.message });
  }
}
```

### 3. Add Route

**File:** `src/api/articles/articles.routes.ts`
```typescript
import { createMultiFormatArticle } from './multiFormat.controller';

/**
 * @swagger
 * /articles/ai/multi-format:
 *   post:
 *     summary: Generate newspaper, web, and short news in single AI call
 *     tags: [Articles]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, reporterInput, categoryId, languageCode]
 *             properties:
 *               tenantId: { type: string }
 *               reporterInput: { type: string, description: "Raw news content" }
 *               categoryId: { type: string }
 *               languageCode: { type: string, example: "te" }
 *               images: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: All 3 formats created successfully
 */
router.post(
  '/ai/multi-format',
  passport.authenticate('jwt', { session: false }),
  requireReporterOrAdmin,
  createMultiFormatArticle
);
```

---

## Benefits Summary

| Aspect | Current (Sequential) | New (Single AI) | Improvement |
|--------|---------------------|-----------------|-------------|
| **AI Calls** | 3 separate calls | 1 unified call | 66% fewer calls |
| **Cost** | ~$0.012 | ~$0.004 | 67% cheaper |
| **Speed** | 6-9 seconds | 2-3 seconds | 60% faster |
| **Consistency** | May vary | Always consistent | 100% aligned |
| **Queue Load** | 2 background jobs | 0 jobs | No queue needed |

---

## Migration Path

### Phase 1: Add New API (No Breaking Changes)
1. Create `/articles/ai/multi-format` endpoint
2. Test with reporters
3. Keep existing APIs working

### Phase 2: Update Reporter UI
1. Change "Post Article" button to call new multi-format API
2. Show all 3 generated articles in UI
3. Allow reporters to edit before final publish

### Phase 3: Deprecate Old Flow (Optional)
1. Add deprecation notice to old rewrite APIs
2. Monitor usage
3. Remove queue-based rewrites after 30 days

---

## Testing Commands

```bash
# Test new multi-format API
curl -X POST http://localhost:3001/api/v1/articles/ai/multi-format \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tenantId": "cmk...",
    "reporterInput": "Today rainfall in Hyderabad...",
    "categoryId": "cmcat...",
    "languageCode": "te",
    "images": ["https://..."]
  }'

# Expected response:
{
  "newspaperId": "cmart123",
  "webArticleId": "cmart456",
  "shortNewsId": "cmsn789",
  "aiCost": 0.0042,
  "processingTime": "2.3s"
}
```

---

## Next Steps

**Choose Option:**
- ✅ **Option 1** (Recommended): Create new `/articles/ai/multi-format` API
- ⚡ **Option 2** (Faster): Enhance existing `/articles/newspaper` with `autoGenerateFormats=true`

**I can implement either option for you. Which would you prefer?**
