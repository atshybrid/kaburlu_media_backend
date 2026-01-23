# Article Images Guide

## Overview

Sample articles automatically images తో create చేసే feature.

---

## Image Sources

### 1. **Placeholder Images** (Default ⭐)

```bash
POST /api/v1/tenants/:tenantId/bootstrap-content
{
  "articlesPerCategory": 15,
  "imageSource": "placeholder"  # or omit (default)
}
```

**Features:**
- ✅ Fast (no API calls)
- ✅ Free
- ✅ Category-specific colors
- ✅ Works offline
- ✅ Always available

**Example URLs:**
- Politics: `https://via.placeholder.com/800x600/DC143C/ffffff?text=Politics+1`
- Sports: `https://via.placeholder.com/800x600/228B22/ffffff?text=Sports+1`
- Tech: `https://via.placeholder.com/800x600/4169E1/ffffff?text=Technology+1`

### 2. **Unsplash Stock Photos** (Best Quality 🚀)

```bash
POST /api/v1/tenants/:tenantId/bootstrap-content
{
  "articlesPerCategory": 15,
  "imageSource": "unsplash"
}
```

**Features:**
- ✅ Real stock photos
- ✅ High quality
- ✅ Category-relevant images
- ✅ Free (Unsplash API)
- ⚠️ Requires internet

**Example URLs:**
- Politics: `https://source.unsplash.com/800x600/?government,politics,parliament`
- Sports: `https://source.unsplash.com/800x600/?sports,athlete,game`
- Tech: `https://source.unsplash.com/800x600/?technology,computer,innovation`

---

## Category Colors (Placeholder Mode)

| Category | Color | Hex Code |
|----------|-------|----------|
| Politics | Crimson | `#DC143C` |
| Sports | Forest Green | `#228B22` |
| Entertainment | Deep Pink | `#FF1493` |
| Technology | Royal Blue | `#4169E1` |
| Business | Dark Slate Gray | `#2F4F4F` |
| Health | Lime Green | `#32CD32` |
| Education | Dark Orange | `#FF8C00` |
| Science | Medium Purple | `#9370DB` |
| Crime | Dark Red | `#8B0000` |
| International | Steel Blue | `#4682B4` |
| National | Orange Red | `#FF4500` |
| State News | Light Sea Green | `#20B2AA` |
| Lifestyle | Hot Pink | `#FF69B4` |
| Opinion | Dim Gray | `#696969` |
| Weather | Sky Blue | `#87CEEB` |

---

## Usage Examples

### Example 1: Default (Placeholder Images)

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15
  }'
```

**Result:**
- 150 articles with placeholder images (category-colored)
- Fast generation (~30 seconds)

### Example 2: Unsplash Stock Photos

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15,
    "imageSource": "unsplash"
  }'
```

**Result:**
- 150 articles with real stock photos
- Category-relevant images
- ~1 minute (Unsplash is fast)

### Example 3: AI Content + Unsplash Images

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15,
    "useAI": true,
    "imageSource": "unsplash"
  }'
```

**Result:**
- 150 unique AI-generated articles
- Real stock photos from Unsplash
- ~5-10 minutes (AI is slow)

### Example 4: No Images

```bash
curl -X POST "http://localhost:3000/api/v1/tenants/tenant_123/bootstrap-content" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 15,
    "addImages": false
  }'
```

**Result:**
- 150 articles without images
- Fastest (~20 seconds)

---

## API Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `addImages` | boolean | `true` | Add images to articles |
| `imageSource` | string | `placeholder` | `placeholder` or `unsplash` |

---

## How It Works

### Placeholder Mode

```typescript
// Backend generates URL like:
const color = getCategoryColor(categorySlug); // e.g., "DC143C" for politics
const text = encodeURIComponent(categoryName); // e.g., "Politics"
const url = `https://via.placeholder.com/800x600/${color}/ffffff?text=${text}+${index}`;

// Example result:
"https://via.placeholder.com/800x600/DC143C/ffffff?text=Politics+5"
```

### Unsplash Mode

```typescript
// Backend generates keyword-based URL:
const keywords = getCategoryKeywords(categorySlug); // e.g., "government,politics,parliament"
const url = `https://source.unsplash.com/800x600/?${keywords}`;

// Example result:
"https://source.unsplash.com/800x600/?government,politics,parliament"
```

**Unsplash returns random photo matching keywords on each request!**

---

## Database Schema

Articles created with images:

```sql
{
  "id": "article_123",
  "title": "Politics: Sample Article 1",
  "content": "...",
  "imageUrl": "https://via.placeholder.com/800x600/DC143C/ffffff?text=Politics+1",
  "tags": ["sample", "bootstrap", "politics"],
  ...
}
```

---

## Frontend Display

### React Component

```tsx
export function ArticleCard({ article }: { article: any }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      {article.imageUrl && (
        <img 
          src={article.imageUrl} 
          alt={article.title}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-4">
        <h3 className="font-bold">{article.title}</h3>
        <p className="text-sm text-gray-600">{article.content.substring(0, 100)}...</p>
        <div className="flex gap-2 mt-2">
          {article.tags.map((tag: string) => (
            <span key={tag} className="px-2 py-1 bg-gray-100 rounded text-xs">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Performance Comparison

| Mode | Articles | Time | Image Quality |
|------|----------|------|---------------|
| No Images | 150 | ~20s | - |
| Placeholder | 150 | ~30s | Basic colored boxes |
| Unsplash | 150 | ~1m | Real stock photos |
| AI + Unsplash | 150 | ~5-10m | Best quality |

---

## Best Practices

1. **Development/Testing** → Placeholder (fast, reliable)
2. **Demo/Staging** → Unsplash (good looking)
3. **Production** → Unsplash + AI content (best quality)

---

## Troubleshooting

### Images not showing?

**Check:**
1. `addImages: true` in request (default)
2. Article has `imageUrl` field in database
3. Image URL is accessible (try opening in browser)

### Unsplash images not loading?

**Possible issues:**
1. No internet connection
2. Unsplash service down (use placeholder as fallback)
3. Too many requests (rate limiting)

**Solution:** Backend automatically falls back to placeholder if Unsplash fails

---

## Customization

### Add Your Own Image Source

Edit [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts):

```typescript
function generateArticleImage(
  categoryName: string,
  categorySlug: string,
  imageSource: 'placeholder' | 'unsplash' | 'custom',
  index: number
): string {
  if (imageSource === 'custom') {
    // Your custom logic here
    return `https://your-cdn.com/images/${categorySlug}/${index}.jpg`;
  }
  
  // ... existing code
}
```

---

## Related Files

- [src/lib/tenantBootstrap.ts](../src/lib/tenantBootstrap.ts) - Image generation logic
- [src/api/tenants/tenants.routes.ts](../src/api/tenants/tenants.routes.ts) - API endpoints
- [BULK_SAMPLE_CONTENT_GUIDE.md](BULK_SAMPLE_CONTENT_GUIDE.md) - Main guide

---

**Summary:**
- ✅ Placeholder = Fast + Free (default)
- ✅ Unsplash = Real photos + Free
- ✅ AI + Unsplash = Best quality
