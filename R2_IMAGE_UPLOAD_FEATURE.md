# R2 Image Upload Feature - Production Ready Images 🖼️

## Overview

Images ని BunnyStorage (R2) లోకి upload చేసుకొని వాడొచ్చు! External URLs కంటే better control మరియు ownership!

## 🎯 Image Options Comparison

### Option 1: External URLs (Default)
```typescript
{
  "uploadImagesToR2": false,
  "imageSource": "placeholder"  // or "unsplash"
}
```

**URLs Used**:
- Placeholder: `https://via.placeholder.com/800x600/4A90E2/ffffff?text=Politics+1`
- Unsplash: `https://source.unsplash.com/800x600/?politics,government`

**Pros**:
- ✅ Fast (no upload time)
- ✅ No storage cost
- ✅ Works immediately

**Cons**:
- ❌ Depends on external services
- ❌ No control over images
- ❌ May break if service down
- ❌ No customization

### Option 2: R2 Upload (Recommended for Production) ⭐
```typescript
{
  "uploadImagesToR2": true,
  "imageSource": "placeholder"  // or "unsplash"
}
```

**How it works**:
1. Downloads image from placeholder/Unsplash
2. Uploads to your R2 storage
3. Returns R2 URL

**URLs Created**:
```
https://your-r2-bucket.r2.cloudflarestorage.com/bootstrap/tenant_123/politics-0-1706024400000.jpg
```

**Pros**:
- ✅ Full ownership
- ✅ No external dependencies
- ✅ Permanent storage
- ✅ Fast CDN delivery
- ✅ Production-ready

**Cons**:
- ⏱️ Slower (download + upload)
- 💰 Minimal storage cost (~$0.015/GB)

## Usage

### Auto-Trigger (Domain Verification)

**Default (External URLs)**:
```typescript
// Current default in domains.routes.ts
{
  uploadImagesToR2: false  // Fast, external URLs
}
```

**Enable R2 Upload** (recommended for production):
```typescript
// Update in domains.routes.ts verify endpoint
{
  articlesPerCategory: 15,
  useNewsAPI: true,
  aiRewriteNews: true,
  uploadImagesToR2: true,  // 🎯 Upload to R2!
  addImages: true,
  imageSource: 'placeholder'
}
```

### Manual Backfill

**With External URLs** (fast):
```bash
POST /api/v1/domains/{domainId}/backfill-content
{
  "articlesPerCategory": 15,
  "uploadImagesToR2": false,
  "imageSource": "placeholder"
}
```

**With R2 Upload** (recommended):
```bash
POST /api/v1/domains/{domainId}/backfill-content
{
  "articlesPerCategory": 15,
  "uploadImagesToR2": true,  # ⭐ Upload to R2
  "imageSource": "unsplash"
}
```

## File Structure in R2

```
bootstrap/
├── tenant_abc123/
│   ├── politics-0-1706024400000.jpg
│   ├── politics-1-1706024401000.jpg
│   ├── sports-0-1706024402000.jpg
│   ├── sports-1-1706024403000.jpg
│   ├── business-0-1706024404000.jpg
│   └── ...
└── tenant_xyz789/
    ├── politics-0-1706024500000.jpg
    └── ...
```

**Naming Pattern**: `{categorySlug}-{index}-{timestamp}.jpg`

## Performance Impact

### External URLs (Fast):
- **Time per article**: ~50ms
- **105 articles**: ~5 seconds
- **Network**: Minimal

### R2 Upload:
- **Time per article**: ~200-500ms (download + upload)
- **105 articles**: ~20-50 seconds
- **Network**: ~10MB download + upload

**Recommendation**: 
- **Development/Testing**: Use external URLs (faster)
- **Production**: Use R2 upload (reliable, owned)

## Cost Analysis

### R2 Storage Cost:
- Image size: ~100KB each
- 105 articles: ~10MB
- Storage cost: ~$0.015/GB/month = **$0.00015/month per domain**
- 100 domains: ~**$0.015/month**

**Conclusion**: Negligible cost, huge reliability benefit! 💰✅

## Error Handling

```typescript
try {
  // Try R2 upload
  const r2Url = await downloadAndUploadToR2(...);
  return r2Url;
} catch (error) {
  // Fallback to external URL
  console.error('R2 upload failed, using external URL');
  return externalUrl;
}
```

**Graceful degradation**: Falls back to external URLs if R2 upload fails

## Implementation Details

### Download & Upload Function:
```typescript
async function downloadAndUploadToR2(
  sourceUrl: string,
  tenantId: string,
  categorySlug: string,
  index: number
): Promise<string> {
  // 1. Download image from source
  // 2. Upload to R2 with proper path
  // 3. Return R2 public URL
}
```

### Article Creation with R2:
```typescript
// Generate image (with R2 upload if enabled)
const imageUrl = addImages 
  ? await generateArticleImage(
      category.name, 
      category.slug, 
      imageSource, 
      i, 
      tenantId, 
      uploadImagesToR2  // 🎯 Enable R2 upload
    ) 
  : null;
```

## Testing

### Test External URLs:
```bash
curl -X POST http://localhost:3000/api/v1/domains/{domainId}/backfill-content \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 3,
    "uploadImagesToR2": false,
    "force": true
  }'

# Check article images (should be placeholder/unsplash URLs)
```

### Test R2 Upload:
```bash
curl -X POST http://localhost:3000/api/v1/domains/{domainId}/backfill-content \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "articlesPerCategory": 3,
    "uploadImagesToR2": true,
    "imageSource": "unsplash",
    "force": true
  }'

# Check article images (should be R2 URLs)
```

## Verify R2 Setup

### Required Environment Variables:
```env
# Cloudflare R2 Configuration
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=kaburlu-media
R2_PUBLIC_BASE_URL=https://your-bucket.r2.cloudflarestorage.com
```

### Test R2 Connection:
```bash
# Should work if R2 is configured
curl http://localhost:3000/api/v1/test-r2-upload
```

## Recommendation by Environment

| Environment | uploadImagesToR2 | Reason |
|-------------|------------------|--------|
| Development | `false` | Faster iteration |
| Staging | `true` | Test production setup |
| Production | `true` ⭐ | Reliability & ownership |

## Migration Strategy

### Phase 1: Keep External URLs (Current)
```typescript
// domains.routes.ts - verify endpoint
uploadImagesToR2: false  // Current default
```

### Phase 2: Enable for New Domains
```typescript
// domains.routes.ts - verify endpoint
uploadImagesToR2: true  // New domains get R2
```

### Phase 3: Backfill Existing Domains
```bash
# Run for each existing domain
POST /api/v1/domains/{domainId}/backfill-content
{
  "uploadImagesToR2": true,
  "force": true
}
```

## Benefits Summary

| Feature | External URLs | R2 Upload |
|---------|--------------|-----------|
| Speed | ⚡ Fast | ⏱️ Slower |
| Reliability | Medium | ⭐ High |
| Ownership | ❌ No | ✅ Yes |
| Cost | Free | ~$0.00015/domain |
| Production Ready | Testing | ⭐ Production |
| CDN | External | ✅ Your CDN |
| Customization | Limited | ✅ Full |

## Quick Summary

**Development**: 
```json
{ "uploadImagesToR2": false }  // Fast
```

**Production**: 
```json
{ "uploadImagesToR2": true }   // Reliable ⭐
```

---

**Ready to use!** R2 upload option available, choose based on your environment! 🚀

**Recommendation**: Enable `uploadImagesToR2: true` for production domains! 💪
