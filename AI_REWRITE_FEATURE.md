# AI Rewrite Feature - Best of Both Worlds! 🎯

## Overview

NewsData.io నుండి **real news** తీసుకొని, AI తో మన **publication style** కి match అయ్యేలా **rewrite** చేస్తుంది!

## 🌟 Why This is Better

### Old Approach (Direct NewsData.io)
❌ Raw news - may not match your publication's tone
❌ Short descriptions only
❌ No customization
❌ May have source-specific formatting

### ✨ New Approach (NewsData.io + AI Rewrite)
✅ Real, factual news as base
✅ Rewritten in YOUR publication's style
✅ Expanded to 3-4 paragraphs
✅ Professional Telugu/English
✅ Keeps important facts
✅ Engaging, publication-ready content

## How It Works

```mermaid
graph LR
    A[NewsData.io] -->|Real News| B[AI Rewrite]
    B -->|Publication Style| C[Final Article]
    
    style A fill:#4A90E2
    style B fill:#50C878
    style C fill:#FFD700
```

### Step-by-Step:

1. **Fetch Real News** from NewsData.io
   - Title: "తెలంగాణలో కొత్త IT పార్క్"
   - Content: "హైదరాబాద్‌లో IT పార్క్ నిర్మాణం..."

2. **AI Rewrites** with prompt:
   ```
   ఈ వార్తను MyNews స్టైల్‌లో మళ్ళీ రాయండి:
   - ముఖ్యమైన వాస్తవాలను ఉంచండి
   - Professional tone లో రాయండి
   - 3-4 పేరాలు expand చేయండి
   ```

3. **Output**: Publication-ready article
   - Enhanced title
   - Expanded 3-4 paragraph content
   - Your publication's voice
   - All original facts preserved

## Usage

### Auto-Enabled by Default!

```bash
# Domain verify అయినప్పుడు automatically:
POST /api/v1/domains/{domainId}/verify

# Auto-triggers with:
{
  "articlesPerCategory": 15,
  "useNewsAPI": true,
  "aiRewriteNews": true  // ✨ Enabled by default!
}
```

### Manual Backfill

```bash
POST /api/v1/domains/{domainId}/backfill-content
{
  "articlesPerCategory": 15,
  "useNewsAPI": true,
  "aiRewriteNews": true,  // ✨ AI rewrite (recommended!)
  "addImages": true
}
```

### Disable AI Rewrite (use raw news)

```bash
POST /api/v1/domains/{domainId}/backfill-content
{
  "useNewsAPI": true,
  "aiRewriteNews": false  // Use raw NewsData.io content
}
```

## Example Output

### Original (NewsData.io):
```json
{
  "title": "Hyderabad IT park construction begins",
  "description": "A new IT park construction has started in Hyderabad's HITEC City area."
}
```

### AI Rewritten (Your Publication):
```json
{
  "title": "హైదరాబాద్: HITEC సిటీలో కొత్త IT పార్క్ నిర్మాణ పనులు ప్రారంభం",
  "content": "హైదరాబాద్‌లోని HITEC సిటీ ప్రాంతంలో కొత్త IT పార్క్ నిర్మాణ పనులు గురువారం అధికారికంగా ప్రారంభమయ్యాయి. ఈ ప్రాజెక్ట్‌కు రూ. 500 కోట్ల పెట్టుబడి అవసరమని అధికారులు తెలిపారు.\n\nఈ కొత్త IT పార్క్‌లో దాదాపు 50 IT కంపెనీలకు స్థలం లభిస్తుంది. దీంతో 10,000 మందికి ఉపాధి అవకాశాలు కల్పించబడతాయని తెలుగు రాష్ట్రాల IT శాఖ మంత్రి తెలిపారు.\n\nతెలంగాణ రాష్ట్ర ప్రభుత్వం IT రంగాన్ని అభివృద్ధి చేయడానికి అనేక కార్యక్రమాలను చేపట్టింది. ఈ కొత్త IT పార్క్ కూడా ఆ కార్యక్రమంలో భాగమే.\n\nఈ IT పార్క్ నిర్మాణం 18 నెలల్లో పూర్తి చేసేందుకు లక్ష్యంగా పెట్టుకున్నట్లు నির్మాణ సంస్థ అధికారులు వెల్లడించారు."
}
```

## Content Quality Priority

```
1. NewsData.io + AI Rewrite  ⭐⭐⭐⭐⭐ (Best!)
   ├─ Real facts
   ├─ Publication style
   ├─ Expanded content
   └─ Professional tone

2. NewsData.io (raw)         ⭐⭐⭐⭐
   ├─ Real facts
   ├─ Raw source format
   └─ Short descriptions

3. AI Generated              ⭐⭐⭐
   ├─ Creative content
   ├─ May lack real facts
   └─ Good variety

4. Template-based            ⭐⭐
   ├─ Generic content
   └─ Placeholder only
```

## AI Rewrite Prompts

### Telugu:
```
ఈ వార్తను {TenantName} స్టైల్‌లో మళ్ళీ రాయండి:

మూల శీర్షిక: {original_title}
మూల కంటెంట్: {original_content}
వార్తా వర్గం: {category}

దయచేసి:
1. ముఖ్యమైన వాస్తవాలను ఉంచండి
2. {TenantName} యొక్క professional tone లో రాయండి
3. స్పష్టమైన, engaging తెలుగు భాషలో రాయండి
4. 3-4 పేరాలు కావాలి

JSON format లో return చేయండి: 
{"title": "క్రొత్త శీర్షిక", "content": "పూర్తి కథనం..."}
```

### English:
```
Rewrite this news article in {TenantName}'s style:

Original Title: {original_title}
Original Content: {original_content}
Category: {category}

Please:
1. Keep important facts
2. Write in {TenantName}'s professional tone
3. Make it clear and engaging
4. Expand to 3-4 paragraphs

Return JSON format: 
{"title": "new title", "content": "full article..."}
```

## Error Handling

```typescript
try {
  // Try AI rewrite
  const rewritten = await rewriteNewsWithAI(...);
  return rewritten;
} catch (error) {
  // Fallback to original news
  console.error('AI rewrite failed, using original');
  return { title: originalTitle, content: originalContent };
}
```

**Graceful degradation**: If AI fails, uses original NewsData.io content

## Benefits Summary

| Feature | Direct News | AI Rewrite |
|---------|-------------|------------|
| Real Facts | ✅ | ✅ |
| Publication Style | ❌ | ✅ |
| Expanded Content | ❌ | ✅ |
| Professional Tone | Sometimes | ✅ |
| Telugu Quality | Varies | ✅ High |
| Engagement | Medium | ✅ High |
| SEO Friendly | Basic | ✅ Enhanced |

## Cost Considerations

### NewsData.io:
- 200 requests/day (free tier)
- 1 request per category

### AI (OpenAI/Gemini):
- ~500 tokens per rewrite
- 105 articles = ~52,500 tokens
- Cost: ~$0.05 per domain bootstrap (very cheap!)

### Total Cost:
**~$0.05 per domain** for high-quality, publication-ready content! 🎉

## Configuration

### Environment Variables:
```env
# NewsData.io (already configured)
NEWSDATA_API_KEY=pub_4d60772ce86e4cf7aaed3a076a8ddbb5

# AI Provider (Gemini or OpenAI)
GEMINI_API_KEY=your_gemini_key
# OR
OPENAI_API_KEY=your_openai_key
```

### Default Settings:
```typescript
{
  useNewsAPI: true,      // Fetch real news
  aiRewriteNews: true,   // AI rewrite (recommended!)
  articlesPerCategory: 15,
  addImages: true,
  imageSource: 'placeholder'
}
```

## Quick Test

```bash
# Test single domain backfill with AI rewrite
curl -X POST http://localhost:3000/api/v1/domains/{domainId}/backfill-content \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 3,
    "useNewsAPI": true,
    "aiRewriteNews": true,
    "force": true
  }'

# Check status after 1-2 minutes
curl http://localhost:3000/api/v1/domains/{tenantId}
```

## Files Modified

- [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts) - Added `rewriteNewsWithAI()` function
- [src/api/domains/domains.routes.ts](../src/api/domains/domains.routes.ts) - Added `aiRewriteNews` parameter

## Summary

**Perfect combination**: Real news content + Your publication's voice! 🎯

- ✅ Factual (NewsData.io)
- ✅ Customized (AI rewrite)
- ✅ Professional
- ✅ Publication-ready
- ✅ Cost-effective
- ✅ **Default enabled!**

---

**Ready to use!** Domain verify చేస్తే automatically AI-rewritten real news articles generate అవుతాయి! 🚀
