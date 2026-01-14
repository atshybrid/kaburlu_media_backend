# 🚀 Location AI Populate API - Redesigned with Background Jobs

## 📌 **Overview**

The new **Location AI Populate API** intelligently generates hierarchical location data (States → Districts → Mandals → Villages) using ChatGPT in the background, avoiding rate limits and API overload.

---

## 🎯 **Key Improvements**

| Old Approach | New Approach ✅ |
|--------------|----------------|
| Translate existing DB data | **Generate new data hierarchically** |
| Synchronous API calls | **Background job processing** |
| Large batch requests | **Small incremental requests** |
| No rate limit protection | **Built-in delays (250-500ms)** |
| All-or-nothing | **Progressive storage** |
| No progress tracking | **Real-time job status** |

---

## 🔄 **How It Works**

### **Flow Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│  1. CLIENT CALLS API                                        │
│     POST /location/ai/populate                              │
│     { stateName: "Telangana", languageCode: "te" }          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. CHECK DATABASE                                          │
│     - Does state exist?                                     │
│     - Does translation exist for language?                  │
│     - Skip if already complete                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. QUEUE BACKGROUND JOB                                    │
│     - Generate job ID                                       │
│     - Return 202 Accepted immediately                       │
│     - Client gets job ID for tracking                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. BACKGROUND PROCESSING STARTS                            │
│                                                             │
│  Step 1: Process State                                     │
│  ┌────────────────────────────────────────────────┐        │
│  │ Ask ChatGPT: "Give me Telangana state name     │        │
│  │              in English and Telugu"             │        │
│  │ Response: { "en": "Telangana", "te": "తెలంగాణ" }│       │
│  │ Store in State + StateTranslation tables        │        │
│  └────────────────────────────────────────────────┘        │
│                                                             │
│  Step 2: Process Districts                                 │
│  ┌────────────────────────────────────────────────┐        │
│  │ Ask ChatGPT: "List ALL districts in Telangana  │        │
│  │              with English and Telugu names.     │        │
│  │              Max 40 districts."                 │        │
│  │                                                 │        │
│  │ Response: {                                     │        │
│  │   "districts": [                                │        │
│  │     { "en": "Adilabad", "te": "ఆదిలాబాద్" },   │        │
│  │     { "en": "Nizamabad", "te": "నిజామాబాద్" }, │        │
│  │     ...                                         │        │
│  │   ]                                             │        │
│  │ }                                               │        │
│  │                                                 │        │
│  │ Store each in District + DistrictTranslation    │        │
│  └────────────────────────────────────────────────┘        │
│                     │                                       │
│                     │ Wait 500ms (rate limit protection)   │
│                     ▼                                       │
│                                                             │
│  Step 3: Process Mandals (for each district)               │
│  ┌────────────────────────────────────────────────┐        │
│  │ Ask ChatGPT: "List mandals in Adilabad         │        │
│  │              district with English and Telugu.  │        │
│  │              Max 30 mandals."                   │        │
│  │                                                 │        │
│  │ Response: {                                     │        │
│  │   "mandals": [                                  │        │
│  │     { "en": "Bhiknoor", "te": "భీక్నూర్" },     │        │
│  │     { "en": "Utnoor", "te": "ఉట్నూర్" },       │        │
│  │     ...                                         │        │
│  │   ]                                             │        │
│  │ }                                               │        │
│  │                                                 │        │
│  │ Store each in Mandal + MandalTranslation        │        │
│  └────────────────────────────────────────────────┘        │
│                     │                                       │
│                     │ Wait 250ms (rate limit protection)   │
│                     ▼                                       │
│                                                             │
│  Step 4: Process Villages (for first 5 mandals only)       │
│  ┌────────────────────────────────────────────────┐        │
│  │ Ask ChatGPT: "List villages in Bhiknoor        │        │
│  │              mandal with English and Telugu.    │        │
│  │              Max 20 villages."                  │        │
│  │                                                 │        │
│  │ Response: {                                     │        │
│  │   "villages": [                                 │        │
│  │     { "en": "Pippaldhari", "te": "పిప్పల్ధారి" }│       │
│  │     ...                                         │        │
│  │   ]                                             │        │
│  │ }                                               │        │
│  │                                                 │        │
│  │ Store in Village table (if schema supports)    │        │
│  └────────────────────────────────────────────────┘        │
│                     │                                       │
│                     │ Repeat for all districts & mandals   │
│                     ▼                                       │
└─────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. JOB COMPLETION                                          │
│     - Status: completed                                     │
│     - All data stored in DB                                 │
│     - Client can query status endpoint anytime              │
└─────────────────────────────────────────────────────────────┘
```

---

## 📡 **API Endpoints**

### **1. Start Location Population Job**

**`POST /location/ai/populate`**

Queues a background job to populate location hierarchy.

**Request:**
```json
{
  "stateName": "Telangana",
  "languageCode": "te"
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "jobId": "loc_1737691234567_abc123xyz",
  "message": "Location population job queued. Use GET /location/ai/populate/status/:jobId to track progress."
}
```

**Auth:** JWT required (SUPER_ADMIN or TENANT_ADMIN)

---

### **2. Check Job Status**

**`GET /location/ai/populate/status/:jobId`**

Track real-time progress of the background job.

**Response:**
```json
{
  "jobId": "loc_1737691234567_abc123xyz",
  "stateName": "Telangana",
  "languageCode": "te",
  "status": "processing",
  "progress": {
    "currentStep": "Processing district: Adilabad",
    "districtsProcessed": 5,
    "totalDistricts": 33,
    "mandalsProcessed": 87,
    "villagesProcessed": 245
  },
  "startedAt": "2026-01-14T10:30:00.000Z",
  "completedAt": null
}
```

**Status Values:**
- `queued` - Job is waiting to start
- `processing` - Currently running
- `completed` - Successfully finished
- `failed` - Error occurred (check `error` field)

**Auth:** JWT required (Reporter/Admin)

---

### **3. List All Jobs**

**`GET /location/ai/populate/jobs`**

View all location population jobs (for monitoring).

**Response:**
```json
{
  "count": 3,
  "jobs": [
    {
      "jobId": "loc_1737691234567_abc123xyz",
      "stateName": "Telangana",
      "languageCode": "te",
      "status": "completed",
      "progress": { ... },
      "startedAt": "2026-01-14T10:30:00.000Z",
      "completedAt": "2026-01-14T10:45:00.000Z"
    }
  ]
}
```

**Auth:** JWT required (SUPER_ADMIN or TENANT_ADMIN)

---

## 🛡️ **Rate Limit Protection**

To avoid hitting ChatGPT API limits, the system implements:

| Level | Delay | Max Items per Request |
|-------|-------|-----------------------|
| **Districts** | 500ms between requests | 40 districts |
| **Mandals** | 250ms between requests | 30 mandals |
| **Villages** | 250ms between requests | 20 villages |

**Total Estimated Time for Telangana (33 districts):**
- Districts: ~1 request = 3 seconds
- Mandals: ~33 requests × 250ms = ~8 seconds
- Villages: ~165 requests × 250ms = ~40 seconds (first 5 mandals per district)
- **Total: ~50 seconds** (without villages for all mandals)

---

## 🎯 **Example Usage**

### **Step 1: Start Job**

```bash
curl -X POST http://localhost:3001/location/ai/populate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stateName": "Telangana",
    "languageCode": "te"
  }'
```

**Response:**
```json
{
  "success": true,
  "jobId": "loc_1737691234567_abc123xyz",
  "message": "Location population job queued..."
}
```

---

### **Step 2: Check Progress**

```bash
curl http://localhost:3001/location/ai/populate/status/loc_1737691234567_abc123xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (In Progress):**
```json
{
  "status": "processing",
  "progress": {
    "currentStep": "Processing district: Nizamabad",
    "districtsProcessed": 12,
    "totalDistricts": 33,
    "mandalsProcessed": 156,
    "villagesProcessed": 89
  }
}
```

---

### **Step 3: Verify Completion**

```bash
# Same status endpoint
curl http://localhost:3001/location/ai/populate/status/loc_1737691234567_abc123xyz \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response (Completed):**
```json
{
  "status": "completed",
  "progress": {
    "currentStep": "Completed successfully",
    "districtsProcessed": 33,
    "totalDistricts": 33,
    "mandalsProcessed": 587,
    "villagesProcessed": 165
  },
  "completedAt": "2026-01-14T10:45:23.456Z"
}
```

---

## 🔧 **Technical Details**

### **Database Tables Updated**

1. **State** - Stores state records
2. **StateTranslation** - Stores state names in target language
3. **District** - Stores districts with `stateId`
4. **DistrictTranslation** - Stores district names in target language
5. **Mandal** - Stores mandals with `districtId`
6. **MandalTranslation** - Stores mandal names in target language
7. **Village** - Stores villages (if schema supports)

### **ChatGPT Prompts Used**

**For Districts:**
```
List ALL districts in Telangana state, India.
For each district, provide English name and Telugu translation.
Return ONLY valid JSON in this exact format:
{
  "districts": [
    { "en": "District Name", "te": "Translated Name" }
  ]
}
Maximum 40 districts per response to keep it small.
```

**For Mandals:**
```
List mandals/tehsils in Adilabad district, Telangana state, India.
For each mandal, provide English name and Telugu translation.
Return ONLY valid JSON in this exact format:
{
  "mandals": [
    { "en": "Mandal Name", "te": "Translated Name" }
  ]
}
Maximum 30 mandals to keep response small.
```

### **Supported Languages**

Currently supports 13 Indian languages:
- `en` - English
- `te` - Telugu (తెలుగు)
- `hi` - Hindi (हिंदी)
- `bn` - Bengali (বাংলা)
- `mr` - Marathi (मराठी)
- `ta` - Tamil (தமிழ்)
- `ur` - Urdu (اردو)
- `gu` - Gujarati (ગુજરાતી)
- `kn` - Kannada (ಕನ್ನಡ)
- `ml` - Malayalam (മലയാളം)
- `pa` - Punjabi (ਪੰਜਾਬੀ)
- `or` - Odia (ଓଡ଼ିଆ)
- `as` - Assamese (অসমীয়া)

---

## 🚨 **Current Limitations & Future Enhancements**

### **Current Limitations:**

1. **Village Processing Limited**: Only processes first 5 mandals per district for villages (to avoid timeout)
2. **In-Memory Job Store**: Jobs stored in memory (lost on server restart) - should use Redis/BullMQ in production
3. **No Retry Logic**: Failed ChatGPT requests don't retry automatically
4. **Sequential Processing**: Processes one state at a time

### **Recommended Production Enhancements:**

1. **Use BullMQ + Redis** for persistent job queue:
   ```typescript
   import Queue from 'bull';
   const locationQueue = new Queue('location-populate', process.env.REDIS_URL);
   ```

2. **Add Retry Logic**:
   ```typescript
   const job = await locationQueue.add({ stateName, languageCode }, {
     attempts: 3,
     backoff: { type: 'exponential', delay: 5000 }
   });
   ```

3. **Process Villages in Separate Jobs**: Create child jobs for village processing per mandal

4. **Add Job Cleanup Cron**: Remove completed jobs older than 7 days

5. **Add Pause/Resume**: Allow admins to pause long-running jobs

---

## 📊 **Comparison: Old vs New API**

### **Old API (`POST /location/states`)**
```bash
POST /location/states
{
  "limit": 50,
  "offset": 0
}
# Returns: Translations for existing states in DB
# Problem: Only translates what's already there
```

### **New API (`POST /location/ai/populate`)**
```bash
POST /location/ai/populate
{
  "stateName": "Telangana",
  "languageCode": "te"
}
# Returns: Job ID
# Generates: State + Districts + Mandals + Villages hierarchically
# Stores: Everything in DB with translations
```

---

## ✅ **Testing Checklist**

- [ ] Start dev server: `npm run dev`
- [ ] Get JWT token (SUPER_ADMIN or TENANT_ADMIN)
- [ ] Call populate API with "Telangana" and "te"
- [ ] Get job ID from response
- [ ] Poll status endpoint every 5 seconds
- [ ] Verify database has new records:
  ```sql
  SELECT * FROM "State" WHERE name = 'Telangana';
  SELECT * FROM "StateTranslation" WHERE language = 'te';
  SELECT * FROM "District" WHERE "stateId" = '...';
  SELECT * FROM "DistrictTranslation" WHERE language = 'te';
  ```
- [ ] Check job completes successfully
- [ ] Test error handling (invalid state name)
- [ ] Test duplicate prevention (run same state twice)

---

## 🎉 **Benefits**

✅ **Automatic Data Generation** - No manual entry needed  
✅ **Hierarchical Processing** - Maintains state → district → mandal → village relationships  
✅ **Rate Limit Safe** - Built-in delays prevent API throttling  
✅ **Progressive Storage** - Data saved incrementally (partial progress preserved)  
✅ **Real-time Tracking** - Monitor job progress anytime  
✅ **Scalable** - Can process multiple states in queue  
✅ **ChatGPT Only** - Uses OpenAI exclusively (Gemini disabled)  

---

**Ready to populate your location database intelligently! 🚀**
