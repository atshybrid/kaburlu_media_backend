# Location Smart-Add Fix & Usage Guide

## 🎯 Problem Fixed

The `/api/v1/location/smart-add` endpoint had two major issues:

### 1. **Parent District Search Was Limited to One State**
**Before:** When creating a mandal with `parentDistrictName: "YSR Kadapa"` and `stateName: "Telangana"`, it would fail because YSR Kadapa is actually in Andhra Pradesh.

**After:** Now searches for parent district across ALL states, automatically inferring the correct state.

### 2. **Translation Logic Was Reversed**
**Before:** If you provided Telugu input `"పెండ్లిమర్రి"`, it would:
- ❌ Store Telugu in primary `name` field
- ❌ Create Telugu translation record
- ❌ No English version existed
- ❌ Searching for "pendlimarri" (English) would fail

**After:** If you provide Telugu input, it will:
- ✅ Translate to English using AI → "Pendlimarri"
- ✅ Store English in primary `name` field
- ✅ Create Telugu translation record
- ✅ Both English and Telugu searches work!

---

## 🚀 How to Use Smart-Add (Fixed)

### Example 1: Create Mandal (Telugu Input)

```bash
curl -X 'POST' \
  'https://api.kaburlumedia.com/api/v1/location/smart-add' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "areaName": "పెండ్లిమర్రి",
  "languageCode": "te",
  "forceType": "mandal",
  "parentDistrictName": "YSR Kadapa"
}'
```

**Result:**
```json
{
  "success": true,
  "type": "mandal",
  "location": {
    "id": "...",
    "name": "Pendlimarri",  // ✅ English primary name
    "translations": [
      {
        "language": "te",
        "name": "పెండ్లిమర్రి"  // ✅ Telugu translation
      }
    ]
  }
}
```

### Example 2: Create District (English Input)

```bash
curl -X 'POST' \
  'https://api.kaburlumedia.com/api/v1/location/smart-add' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "areaName": "Kamareddy",
  "stateName": "Telangana",
  "languageCode": "te",
  "forceType": "district"
}'
```

**Result:**
```json
{
  "success": true,
  "type": "district",
  "location": {
    "id": "...",
    "name": "Kamareddy",  // ✅ English primary name
    "translations": [
      {
        "language": "te",
        "name": "కామారెడ్డి"  // ✅ AI-generated Telugu translation
      }
    ]
  }
}
```

### Example 3: Wrong State Name (Auto-Corrects)

```bash
curl -X 'POST' \
  'https://api.kaburlumedia.com/api/v1/location/smart-add' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
  "areaName": "Vempalli",
  "stateName": "Telangana",           // ❌ Wrong state!
  "languageCode": "te",
  "forceType": "mandal",
  "parentDistrictName": "YSR Kadapa"  // ✅ This district is in Andhra Pradesh
}'
```

**Result:**
- ✅ Will find "YSR Kadapa" district (in Andhra Pradesh)
- ✅ Auto-links mandal to Andhra Pradesh (not Telangana)
- ✅ Creates mandal successfully

---

## 🔍 Search Works Both Ways

### English Search
```bash
curl 'https://api.kaburlumedia.com/api/v1/locations/search-combined?q=pendlimarri'
```

**Response:**
```json
{
  "items": [{
    "type": "MANDAL",
    "match": {
      "name": "Pendlimarri",
      "names": {
        "en": "Pendlimarri",      // ✅ Found by English search
        "te": "పెండ్లిమర్రి"
      }
    }
  }]
}
```

### Telugu Search
```bash
curl 'https://api.kaburlumedia.com/api/v1/locations/search-combined?q=పెండ్లిమర్రి'
```

**Response:**
```json
{
  "items": [{
    "type": "MANDAL",
    "match": {
      "name": "Pendlimarri",
      "names": {
        "en": "Pendlimarri",
        "te": "పెండ్లిమర్రి"    // ✅ Found by Telugu search
      }
    }
  }]
}
```

---

## 🛠 Cleanup Script (For Existing Data)

### Fixed Existing Telugu Records

The script `scripts/fix-telugu-location-names.ts` was created and run to fix existing records that had Telugu in the primary `name` field.

**What it does:**
1. ✅ Finds all locations with non-English names
2. ✅ Auto-detects language (Telugu/Hindi/Kannada/Tamil/Malayalam)
3. ✅ Translates to English using AI
4. ✅ Updates primary `name` to English
5. ✅ Creates/updates translation record

**Run it again if needed:**
```bash
npx ts-node scripts/fix-telugu-location-names.ts
```

**Output Example:**
```
📍 Checking Mandals...
Found 1 mandals with non-English names

🔧 Fixing mandal: పెండ్లిమర్రి (te)
   → English: Pendlimarri
   ✅ Fixed
```

---

## 📋 Supported Languages

The smart-add endpoint supports these languages:

| Code | Language   | Example Input          | Auto-Translates To English |
|------|------------|------------------------|----------------------------|
| `en` | English    | "Kamareddy"            | No (already English)       |
| `te` | Telugu     | "పెండ్లిమర్రి"         | Yes                        |
| `hi` | Hindi      | "हैदराबाद"              | Yes                        |
| `kn` | Kannada    | "ಬೆಂಗಳೂರು"              | Yes                        |
| `ta` | Tamil      | "சென்னை"               | Yes                        |
| `ml` | Malayalam  | "കോഴിക്കോട്"            | Yes                        |

---

## ⚙️ API Parameters

### `areaName` (required)
- **Type:** String
- **Description:** Name of the area in ANY language
- **Examples:**
  - English: `"Kamareddy"`
  - Telugu: `"పెండ్లిమర్రి"`
  - Hindi: `"हैदराबाद"`

### `languageCode` (optional, default: `"en"`)
- **Type:** String (`en`, `te`, `hi`, `kn`, `ta`, `ml`)
- **Description:** Language of the input `areaName`
- **Important:** 
  - If `areaName` is in Telugu, set `languageCode: "te"`
  - If `areaName` is in English, set `languageCode: "en"` or omit

### `stateName` or `stateId` (optional for mandals)
- **Description:** State where the location is
- **Note:** For mandals, you can omit this if you provide `parentDistrictName`

### `parentDistrictName` (optional for mandals)
- **Description:** District name for mandals
- **Searches:** Across ALL states (not limited to provided `stateName`)

### `forceType` (optional)
- **Type:** `"district"` or `"mandal"`
- **Description:** Override AI type detection
- **Recommended:** Always specify to avoid AI guessing errors

---

## 🎓 Best Practices

### 1. **Always Specify `forceType`**
```json
{"forceType": "mandal"}  // ✅ Good
// vs omitting (AI will guess) ❌
```

### 2. **Match `languageCode` to Input**
```json
{
  "areaName": "పెండ్లిమర్రి",
  "languageCode": "te"  // ✅ Correct
}
```

```json
{
  "areaName": "Kamareddy",
  "languageCode": "en"  // ✅ Correct (or omit)
}
```

### 3. **Don't Worry About State for Mandals**
```json
{
  "areaName": "Vempalli",
  "parentDistrictName": "YSR Kadapa",
  // No need to provide stateName - will auto-detect!
}
```

### 4. **Use Cleanup Script for Bulk Fixes**
If you accidentally created many records with wrong language in primary field:
```bash
npx ts-node scripts/fix-telugu-location-names.ts
```

---

## 🐛 Troubleshooting

### Issue: "Parent district not found"
**Cause:** District name is misspelled or doesn't exist

**Solution:**
1. Check exact district name spelling
2. Search for district first: `/locations/search-combined?q=kadapa`
3. Use exact name from search results

### Issue: "Area Not adding contact admin" (404)
**Cause:** 
- Location doesn't exist yet (create it first)
- Searching in wrong language (Telugu text with English search)

**Solution:**
1. Create location using smart-add
2. Make sure search query language matches available names

### Issue: English search not working for Telugu locations
**Cause:** Old records created before the fix

**Solution:**
```bash
# Run cleanup script
npx ts-node scripts/fix-telugu-location-names.ts
```

---

## 📝 Implementation Summary

### Files Modified

1. **[src/api/locationAi/locationManual.routes.ts](src/api/locationAi/locationManual.routes.ts#L820-L900)**
   - Fixed parent district search (now searches across all states)
   - Reversed translation logic (non-English input → translates to English primary name)
   - Updated API documentation

2. **[scripts/fix-telugu-location-names.ts](scripts/fix-telugu-location-names.ts)** (NEW)
   - Cleanup script for existing data
   - Auto-detects language by Unicode ranges
   - Uses AI to translate to English
   - Preserves original as translation

### Database Schema (No Changes Required)

The fix works with existing schema:
```prisma
model Mandal {
  id           String               @id @default(cuid())
  name         String               // ✅ Now always English
  districtId   String
  translations MandalTranslation[]  // ✅ Non-English versions here
}

model MandalTranslation {
  mandalId String
  language String  // 'te', 'hi', 'kn', etc.
  name     String  // Telugu/Hindi/etc translation
  @@unique([mandalId, language])
}
```

---

## ✅ Testing Checklist

- [x] Telugu input creates English primary name ✅
- [x] Telugu translation is preserved ✅
- [x] English search finds Telugu-input locations ✅
- [x] Telugu search still works ✅
- [x] Parent district search works across states ✅
- [x] Wrong state name doesn't break mandal creation ✅
- [x] Cleanup script fixes existing data ✅
- [x] AI fallback (OpenAI when Gemini fails) works ✅

---

## 🚀 Deployment

### Production Deployment Steps

1. **Deploy code changes:**
   ```bash
   npm run build
   # Deploy to production (DigitalOcean/Render/etc.)
   ```

2. **Run cleanup script on production DB:**
   ```bash
   # On production server
   DATABASE_URL="postgresql://..." npx ts-node scripts/fix-telugu-location-names.ts
   ```

3. **Verify:**
   ```bash
   # Test English search
   curl '/api/v1/locations/search-combined?q=pendlimarri'
   
   # Test Telugu search
   curl '/api/v1/locations/search-combined?q=పెండ్లిమర్రి'
   ```

---

## 📞 Support

If you encounter issues:

1. Check this guide first
2. Run cleanup script if data looks wrong
3. Check server logs for AI translation errors
4. Verify `GEMINI_API_KEY` or `OPENAI_API_KEY` is set

---

**Last Updated:** February 14, 2026  
**Script Location:** `scripts/fix-telugu-location-names.ts`  
**Main Fix:** `src/api/locationAi/locationManual.routes.ts` lines 820-900
