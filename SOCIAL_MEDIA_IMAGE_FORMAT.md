# Social Media Sharing - Image Format Requirements

## ⚠️ CRITICAL: Use JPG for OG Images

### Problem
PNG images in Open Graph (OG) and Twitter Card metadata can cause sharing issues on social platforms:
- **Facebook**: May not display PNG thumbnails properly
- **Twitter**: Prefers JPG for better compatibility
- **WhatsApp**: JPG works more reliably
- **LinkedIn**: Better JPG support
- **Larger file sizes**: PNG files are typically larger than JPG

### Solution
**Always use JPG format** for social sharing images:

```javascript
// ✅ CORRECT
ogImageUrl: "https://kaburlu-news.b-cdn.net/og-image.jpg"
twitterImageUrl: "https://kaburlu-news.b-cdn.net/twitter-card.jpg"

// ❌ WRONG - Will cause sharing issues
ogImageUrl: "https://kaburlu-news.b-cdn.net/kaburu_logo.png"
twitterImageUrl: "https://kaburlu-news.b-cdn.net/kaburu_logo.png"
```

## Where These Images Are Used

### 1. Open Graph (Facebook, LinkedIn, WhatsApp)
```html
<meta property="og:image" content="https://example.com/og-image.jpg" />
```

### 2. Twitter Cards
```html
<meta name="twitter:image" content="https://example.com/twitter-card.jpg" />
```

### 3. API Response (Public Config)
```json
{
  "seo": {
    "openGraph": {
      "imageUrl": "https://kaburlu-news.b-cdn.net/og-image.jpg"
    },
    "twitter": {
      "imageUrl": "https://kaburlu-news.b-cdn.net/twitter-card.jpg"
    }
  }
}
```

## Image Requirements

### Format
- **Format**: JPG (JPEG)
- **Fallback**: PNG only if transparency is absolutely required (rare for social sharing)

### Dimensions
- **Recommended**: 1200 x 630 px (Facebook/Twitter standard)
- **Minimum**: 600 x 315 px
- **Aspect Ratio**: 1.91:1 (ideal for all platforms)

### File Size
- **Maximum**: 8 MB (Facebook limit)
- **Recommended**: Under 1 MB for fast loading
- **Optimize**: Use image compression tools

### Quality
- **JPG Quality**: 80-85% (good balance of quality and file size)
- **Color Space**: RGB (not CMYK)

## Platform-Specific Guidelines

### Facebook
- Minimum: 600 x 315 px
- Recommended: 1200 x 630 px
- Max file size: 8 MB
- Format: JPG preferred

### Twitter
- Minimum: 300 x 157 px
- Recommended: 1200 x 630 px (summary_large_image)
- Max file size: 5 MB
- Format: JPG, PNG, WEBP (JPG recommended)

### WhatsApp
- Works best with JPG
- Recommended: 800 x 418 px minimum
- PNG may not show thumbnail preview

### LinkedIn
- Minimum: 1200 x 627 px
- Recommended: 1200 x 627 px
- Format: JPG, PNG (JPG preferred)

## How to Set Correct Images

### Via Admin Panel (Domain Settings)
1. Go to Settings → SEO Configuration
2. Set **OG Image URL**: Upload JPG image (1200x630)
3. Set **Twitter Image URL**: Use same JPG or create Twitter-specific variant
4. **Do not use PNG** for these fields

### Via API (Tenant Settings Update)
```bash
curl -X PUT 'https://api.kaburlumedia.com/api/v1/settings/domain/{domainId}' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "seo": {
      "ogImageUrl": "https://kaburlu-news.b-cdn.net/og-image.jpg",
      "twitterImageUrl": "https://kaburlu-news.b-cdn.net/twitter-card.jpg"
    }
  }'
```

### Image Upload to Bunny CDN
```bash
# Upload optimized JPG
curl -X PUT 'https://storage.bunnycdn.com/kaburlu-news/og-image.jpg' \
  -H 'AccessKey: YOUR_BUNNY_KEY' \
  --data-binary '@og-image.jpg'

# Result URL
https://kaburlu-news.b-cdn.net/og-image.jpg
```

## System Behavior

### Current Implementation
The API now includes a warning system:
```typescript
// Backend validates and warns about PNG usage
function ensureSocialImageFormat(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  
  if (imageUrl.toLowerCase().endsWith('.png')) {
    console.warn(`[Social Image Warning] PNG detected for OG/Twitter image: ${imageUrl}. 
                  Consider using JPG for better social media compatibility.`);
  }
  
  return imageUrl;
}
```

### Where Applied
- `/api/v1/public/config` (News Website API 2.0)
- `/public-tenant/config` (Legacy public API)

## Testing Social Sharing

### Facebook Debugger
https://developers.facebook.com/tools/debug/
- Enter your article URL
- Check if OG image displays correctly
- Use "Scrape Again" to refresh cache

### Twitter Card Validator
https://cards-dev.twitter.com/validator
- Enter your article URL
- Verify card preview shows image

### LinkedIn Post Inspector
https://www.linkedin.com/post-inspector/
- Enter your article URL
- Check preview rendering

## Image Optimization Tools

### Online Tools
- **TinyJPG**: https://tinyjpg.com/ (compress JPG)
- **Squoosh**: https://squoosh.app/ (Google's image optimizer)
- **ImageOptim**: https://imageoptim.com/ (Mac app)

### Command Line
```bash
# Convert PNG to JPG with ImageMagick
convert input.png -quality 85 -background white -flatten output.jpg

# Resize to 1200x630
convert input.jpg -resize 1200x630^ -gravity center -extent 1200x630 output.jpg

# Optimize with jpegoptim
jpegoptim --max=85 --strip-all output.jpg
```

### Node.js (Sharp)
```javascript
const sharp = require('sharp');

await sharp('input.png')
  .resize(1200, 630, { fit: 'cover' })
  .flatten({ background: '#ffffff' })
  .jpeg({ quality: 85 })
  .toFile('output.jpg');
```

## Checklist for New Tenants

- [ ] Create OG image (1200x630 JPG, under 1MB)
- [ ] Upload to Bunny CDN
- [ ] Set `ogImageUrl` in domain settings (JPG URL)
- [ ] Set `twitterImageUrl` if different (JPG URL)
- [ ] Test with Facebook Debugger
- [ ] Test with Twitter Card Validator
- [ ] Test WhatsApp share preview
- [ ] Verify no console warnings about PNG

## Common Mistakes

### ❌ Wrong
```json
{
  "seo": {
    "ogImageUrl": "https://kaburlu-news.b-cdn.net/logo.png",
    "twitterImageUrl": null  // Falls back to PNG logo
  }
}
```

### ✅ Correct
```json
{
  "seo": {
    "ogImageUrl": "https://kaburlu-news.b-cdn.net/og-share-image.jpg",
    "twitterImageUrl": "https://kaburlu-news.b-cdn.net/og-share-image.jpg"
  }
}
```

## Notes

- **Logo vs OG Image**: Your site logo (for header) can be PNG, but social sharing images must be JPG
- **Transparency**: Social sharing doesn't need transparency; JPG's solid background works perfectly
- **File Naming**: Use descriptive names like `og-image.jpg`, not generic `image.jpg`
- **Cache Busting**: After changing OG image, use Facebook Debugger to clear cache
- **Mobile Testing**: Test share previews on actual mobile devices (WhatsApp, Messenger)

## References

- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters/)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Open Graph Protocol](https://ogp.me/)
