# Location AI Flow & Language Cleanup Guide

## Complete Flow Diagram

### 1. Population Job Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ POST /location/ai/populate/state                                │
│ { stateName: "Telangana", languages: ["en","te","hi","kn","ka"] }│
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Validation & Duplicate Check                            │
├─────────────────────────────────────────────────────────────────┤
│ • Check jobStore: Is job already running? → 409 Error          │
│ • Check jobStore: Is state already completed? → 409 Error      │
│ • Check database: Does state have existing data? → 409 Error    │
│ • If all checks pass → Create job & queue it                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Create State & State Translations                       │
├─────────────────────────────────────────────────────────────────┤
│ State Table:                                                     │
│   id: "abc123"                                                   │
│   name: "Telangana"                                              │
│   countryId: "india-id"                                          │
│                                                                  │
│ ChatGPT Call: "Translate 'Telangana' to te, hi, kn, ka"         │
│                                                                  │
│ StateTranslation Table:                                          │
│   { stateId: "abc123", language: "en", name: "Telangana" }      │
│   { stateId: "abc123", language: "te", name: "తెలంగాణ" }       │
│   { stateId: "abc123", language: "hi", name: "तेलंगाना" }       │
│   { stateId: "abc123", language: "kn", name: "ತೆಲಂಗಾಣ" }        │
│   { stateId: "abc123", language: "ka", name: "ತೆಲಂಗಾಣ" }        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Get Districts for Telangana                             │
├─────────────────────────────────────────────────────────────────┤
│ ChatGPT Call: "Get all district names in Telangana (max 40)"    │
│                                                                  │
│ Returns: [                                                       │
│   "Adilabad", "Nizamabad", "Karimnagar", "Warangal",           │
│   "Khammam", "Nalgonda", "Mahbubnagar", ...                    │
│ ]                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ FOR EACH DISTRICT (Sequential)         │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Create District & District Translations                 │
├─────────────────────────────────────────────────────────────────┤
│ Example: District "Adilabad"                                     │
│                                                                  │
│ District Table:                                                  │
│   id: "dist-001"                                                 │
│   name: "Adilabad"                                               │
│   stateId: "abc123"                                              │
│                                                                  │
│ ChatGPT: Translate "Adilabad" to [te, hi, kn, ka]              │
│                                                                  │
│ DistrictTranslation Table:                                       │
│   { districtId: "dist-001", language: "en", name: "Adilabad" }  │
│   { districtId: "dist-001", language: "te", name: "ఆదిలాబాద్" } │
│   { districtId: "dist-001", language: "hi", name: "आदिलाबाद" }  │
│   { districtId: "dist-001", language: "kn", name: "ಆದಿಲಾಬಾದ್" }│
│   { districtId: "dist-001", language: "ka", name: "ಆದಿಲಾಬಾದ್" }│
│                                                                  │
│ [DELAY 1000ms before next district]                             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 5: Get Mandals for Current District                        │
├─────────────────────────────────────────────────────────────────┤
│ ChatGPT: "Get all mandal names in Adilabad district (max 40)"   │
│                                                                  │
│ Returns: [                                                       │
│   "Adilabad Urban", "Bazarhatnoor", "Jainad", ...              │
│ ]                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ FOR EACH MANDAL (Sequential)           │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 6: Create Mandal & Mandal Translations                     │
├─────────────────────────────────────────────────────────────────┤
│ Example: Mandal "Adilabad Urban"                                 │
│                                                                  │
│ Mandal Table:                                                    │
│   id: "mandal-001"                                               │
│   name: "Adilabad Urban"                                         │
│   districtId: "dist-001"                                         │
│                                                                  │
│ ChatGPT: Translate "Adilabad Urban" to [te, hi, kn, ka]        │
│                                                                  │
│ MandalTranslation Table:                                         │
│   { mandalId: "mandal-001", language: "en", name: "Adilabad..." }│
│   { mandalId: "mandal-001", language: "te", name: "ఆదిలాబాద్..." }│
│   { mandalId: "mandal-001", language: "hi", name: "आदिलाबाद..." }│
│   { mandalId: "mandal-001", language: "kn", name: "ಆದಿಲಾಬಾದ್..." }│
│   { mandalId: "mandal-001", language: "ka", name: "ಆದಿಲಾಬಾದ್..." }│
│                                                                  │
│ [DELAY 500ms before next mandal]                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 7: Get Villages for Current Mandal                         │
├─────────────────────────────────────────────────────────────────┤
│ ChatGPT: "Get all village names in Adilabad Urban (max 40)"     │
│                                                                  │
│ Returns: [                                                       │
│   "Kouthala", "Laxmanchanda", "Pochampad", ...                 │
│ ]                                                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ FOR EACH VILLAGE (Sequential)          │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 8: Create Village & Village Translations                   │
├─────────────────────────────────────────────────────────────────┤
│ Example: Village "Kouthala"                                      │
│                                                                  │
│ Village Table:                                                   │
│   id: "village-001"                                              │
│   name: "Kouthala"                                               │
│   mandalId: "mandal-001"                                         │
│   tenantId: "tenant-xyz"  ← REQUIRED!                           │
│                                                                  │
│ ChatGPT: Translate "Kouthala" to [te, hi, kn, ka]              │
│                                                                  │
│ VillageTranslation Table:                                        │
│   { villageId: "village-001", language: "en", name: "Kouthala" }│
│   { villageId: "village-001", language: "te", name: "కౌతల" }   │
│   { villageId: "village-001", language: "hi", name: "कौथला" }   │
│   { villageId: "village-001", language: "kn", name: "ಕೌತಲ" }   │
│   { villageId: "village-001", language: "ka", name: "ಕೌತಲ" }   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
        ┌───────────────────────────────────────┐
        │ REPEAT for all villages in mandal      │
        │ Then next mandal → all its villages    │
        │ Then next district → all its mandals   │
        └───────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Final Result: Complete Hierarchy Created                        │
├─────────────────────────────────────────────────────────────────┤
│ State: 1 record + 5 translations                                 │
│ Districts: ~33 records + ~165 translations                       │
│ Mandals: ~500 records + ~2,500 translations                      │
│ Villages: ~10,000 records + ~50,000 translations                 │
│                                                                  │
│ Job Status: "completed"                                          │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Language Cleanup Flow

### Problem
After population, you realize you don't want Hindi (hi) and Kannada (ka) translations for Telangana.

### Solution: Delete Language Translations API

```
DELETE /location/manual/states/{stateId}/translations/languages
{
  "languages": ["hi", "ka"]
}
```

### Cleanup Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ DELETE /location/manual/states/abc123/translations/languages    │
│ { languages: ["hi", "ka"] }                                      │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Verify State Exists                                     │
├─────────────────────────────────────────────────────────────────┤
│ Query: SELECT * FROM State WHERE id = 'abc123'                  │
│ Result: State "Telangana" found ✓                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: Get All Child IDs                                       │
├─────────────────────────────────────────────────────────────────┤
│ Get Districts:                                                   │
│   districtIds = [dist-001, dist-002, dist-003, ...dist-033]    │
│                                                                  │
│ Get Mandals:                                                     │
│   mandalIds = [mandal-001, mandal-002, ...mandal-500]          │
│                                                                  │
│ Get Villages:                                                    │
│   villageIds = [village-001, village-002, ...village-10000]    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 3: Delete Translations (Parallel)                          │
├─────────────────────────────────────────────────────────────────┤
│ DELETE FROM StateTranslation                                     │
│ WHERE stateId = 'abc123' AND language IN ('hi', 'ka')          │
│ ✓ Deleted: 2 rows                                               │
│                                                                  │
│ DELETE FROM DistrictTranslation                                  │
│ WHERE districtId IN (dist-001...dist-033)                       │
│   AND language IN ('hi', 'ka')                                  │
│ ✓ Deleted: 66 rows (33 districts × 2 languages)                │
│                                                                  │
│ DELETE FROM MandalTranslation                                    │
│ WHERE mandalId IN (mandal-001...mandal-500)                     │
│   AND language IN ('hi', 'ka')                                  │
│ ✓ Deleted: 1000 rows (500 mandals × 2 languages)               │
│                                                                  │
│ DELETE FROM VillageTranslation                                   │
│ WHERE villageId IN (village-001...village-10000)                │
│   AND language IN ('hi', 'ka')                                  │
│ ✓ Deleted: 20000 rows (10000 villages × 2 languages)           │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ Step 4: Response                                                 │
├─────────────────────────────────────────────────────────────────┤
│ {                                                                │
│   "success": true,                                               │
│   "message": "Deleted hi, ka translations for Telangana...",    │
│   "deleted": {                                                   │
│     "stateTranslations": 2,                                      │
│     "districtTranslations": 66,                                  │
│     "mandalTranslations": 1000,                                  │
│     "villageTranslations": 20000,                                │
│     "totalDeleted": 21068                                        │
│   }                                                              │
│ }                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### After Cleanup - Remaining Data

```
State: Telangana
├── Translations: [en, te, kn] ← hi, ka removed
│
├── District: Adilabad
│   ├── Translations: [en, te, kn] ← hi, ka removed
│   │
│   ├── Mandal: Adilabad Urban
│   │   ├── Translations: [en, te, kn] ← hi, ka removed
│   │   │
│   │   ├── Village: Kouthala
│   │   │   └── Translations: [en, te, kn] ← hi, ka removed
│   │   │
│   │   ├── Village: Laxmanchanda
│   │   │   └── Translations: [en, te, kn] ← hi, ka removed
```

## 3. Real-World Example

### Scenario: Remove Hindi and Kannada from Telangana

**Step 1: Find State ID**
```bash
GET /location/states
# Find Telangana's ID in response
# Let's say stateId = "clx123abc"
```

**Step 2: Delete Unwanted Languages**
```bash
DELETE /location/manual/states/clx123abc/translations/languages
Authorization: Bearer {your-token}
Content-Type: application/json

{
  "languages": ["hi", "ka"]
}
```

**Step 3: Verify Deletion**
```bash
GET /location/districts
{
  "stateId": "clx123abc"
}

# Response will show translations only for: en, te, kn
# Hindi (hi) and Kannada (ka) translations are gone
```

## 4. API Endpoints Summary

### Population APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/location/ai/populate/state` | POST | Create full hierarchy with AI translations |
| `/location/ai/populate/status/{jobId}` | GET | Check population job progress |

### Manual Management APIs
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/location/manual/states` | POST | Manually create state |
| `/location/manual/districts` | POST | Manually create district |
| `/location/manual/mandals` | POST | Manually create mandal |
| `/location/manual/villages` | POST | Manually create village |
| `/location/manual/states/{id}/translations` | PUT | Update state translation |
| `/location/manual/districts/{id}/translations` | PUT | Update district translation |
| `/location/manual/mandals/{id}/translations` | PUT | Update mandal translation |
| `/location/manual/villages/{id}/translations` | PUT | Update village translation |
| `/location/manual/states/{id}/translations/languages` | **DELETE** | **Delete languages from entire hierarchy** ✨ NEW |

## 5. Important Notes

### ChatGPT Call Limits
- **Max 40 items per call** - Prevents timeouts and errors
- **Delays between calls:**
  - 1000ms between districts
  - 500ms between mandals
- **Sequential processing** - One level at a time, not nested

### Duplicate Prevention
- Job already running → **409 Conflict**
- State already completed → **409 Conflict**
- Use manual APIs to add/update existing data

### Database Hierarchy
```
Country (India)
  └── State (Telangana) ← Requires countryId
      └── District (Adilabad) ← Requires stateId
          └── Mandal (Adilabad Urban) ← Requires districtId
              └── Village (Kouthala) ← Requires mandalId + tenantId
```

### Translation Tables
Each level has separate translation table:
- `StateTranslation` - Links to State via `stateId`
- `DistrictTranslation` - Links to District via `districtId`
- `MandalTranslation` - Links to Mandal via `mandalId`
- `VillageTranslation` - Links to Village via `villageId`

All use `language` field: "en", "te", "hi", "kn", "ka", "bn", "mr", "ta", "ur", "gu", "ml", "pa", "or", "as"

## 6. Best Practices

### When Populating New State
1. ✅ Check if state already exists
2. ✅ Use only languages you need (don't add unnecessary ones)
3. ✅ Monitor job status via `/populate/status/{jobId}`
4. ✅ If job fails midway, use manual APIs to complete

### When Cleaning Up Languages
1. ✅ Backup data before deletion (translations can't be recovered)
2. ✅ Delete languages you definitely don't need
3. ✅ Deletion cascades through entire hierarchy automatically
4. ✅ Response shows exact count of deleted records

### When Fixing Bad Translations
1. ✅ Use PUT `/manual/*/translations` to update specific translation
2. ✅ Don't delete and recreate - just update the name
3. ✅ Updates are immediate and don't affect other languages
