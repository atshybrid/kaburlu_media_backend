# 🤖 Automatic Location Population Cron Job

## 📌 Overview

**Fully automated cron job** that processes all 28 Indian states sequentially, generating complete hierarchical location data (States → Districts → Mandals → Villages) in **6 languages** (English + Telugu + Hindi + Kannada + Tamil + Marathi).

---

## 🎯 How It Works

### **Automatic Flow:**

```
START CRON JOB
     ↓
┌────────────────────────────────────────────────┐
│  FOR EACH STATE (Telangana, AP, Karnataka...)  │
│  ┌──────────────────────────────────────────┐  │
│  │ 1. Check if state exists in DB           │  │
│  │    → If yes, skip                        │  │
│  │    → If no, continue                     │  │
│  └──────────────────────────────────────────┘  │
│                  ↓                             │
│  ┌──────────────────────────────────────────┐  │
│  │ 2. Ask ChatGPT:                          │  │
│  │    "Give me state name in                │  │
│  │     EN, TE, HI, KN, TA, MR"              │  │
│  │    → Store in State table                │  │
│  │    → Store in StateTranslation (5 langs) │  │
│  └──────────────────────────────────────────┘  │
│                  ↓                             │
│  ┌──────────────────────────────────────────┐  │
│  │ 3. Ask ChatGPT:                          │  │
│  │    "List ALL districts in [state]        │  │
│  │     with names in EN, TE, HI, KN, TA, MR"│  │
│  │                                          │  │
│  │    Response (example for Telangana):     │  │
│  │    {                                     │  │
│  │      "districts": [                      │  │
│  │        {                                 │  │
│  │          "en": "Adilabad",               │  │
│  │          "te": "ఆదిలాబాద్",              │  │
│  │          "hi": "आदिलाबाद",               │  │
│  │          "kn": "ಆದಿಲಾಬಾದ್",              │  │
│  │          "ta": "ஆதிலாபாத்",              │  │
│  │          "mr": "आदिलाबाद"                │  │
│  │        },                                │  │
│  │        ... 32 more districts             │  │
│  │      ]                                   │  │
│  │    }                                     │  │
│  │                                          │  │
│  │    → Store each in District table       │  │
│  │    → Store translations (×5 languages)   │  │
│  └──────────────────────────────────────────┘  │
│                  ↓                             │
│  ┌──────────────────────────────────────────┐  │
│  │ 4. FOR EACH DISTRICT:                   │  │
│  │    Ask ChatGPT:                          │  │
│  │    "List mandals in [district]           │  │
│  │     with names in EN, TE, HI, KN, TA, MR"│  │
│  │    → Store in Mandal table               │  │
│  │    → Store translations (×5 languages)   │  │
│  │    → WAIT 500ms (rate limit protection) │  │
│  └──────────────────────────────────────────┘  │
│                  ↓                             │
│  ┌──────────────────────────────────────────┐  │
│  │ 5. FOR FIRST 10 MANDALS PER DISTRICT:   │  │
│  │    Ask ChatGPT:                          │  │
│  │    "List villages in [mandal]            │  │
│  │     with names in EN, TE, HI, KN, TA, MR"│  │
│  │    → Store in Village table              │  │
│  │    → WAIT 250ms (rate limit)            │  │
│  └──────────────────────────────────────────┘  │
│                  ↓                             │
│  ✅ State Complete!                            │
│  WAIT 60 seconds before next state            │
└────────────────────────────────────────────────┘
     ↓
REPEAT FOR ALL 28 STATES
     ↓
DONE! 🎉
```

---

## 🚀 Usage

### **Method 1: Run Script Directly (Recommended)**

```powershell
# Windows PowerShell
.\run_location_cron.ps1
```

**OR**

```bash
# Run via npm
npm run jobs:location-populate
```

---

### **Method 2: Trigger via API**

```bash
# Trigger the cron job via REST API
curl -X POST http://localhost:3001/location/ai/populate/cron/trigger \
  -H "Authorization: Bearer YOUR_SUPER_ADMIN_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "message": "Location population cron job triggered. This will process all Indian states automatically.",
  "estimatedDuration": "2-4 hours",
  "states": 28,
  "languages": ["en", "te", "hi", "kn", "ta", "mr"]
}
```

---

## 📊 States Processed (28 Total)

| # | State | Capital | Expected Districts |
|---|-------|---------|-------------------|
| 1 | Telangana | Hyderabad | ~33 |
| 2 | Andhra Pradesh | Amaravati | ~26 |
| 3 | Karnataka | Bengaluru | ~30 |
| 4 | Tamil Nadu | Chennai | ~38 |
| 5 | Maharashtra | Mumbai | ~36 |
| 6 | Gujarat | Gandhinagar | ~33 |
| 7 | Rajasthan | Jaipur | ~33 |
| 8 | Uttar Pradesh | Lucknow | ~75 |
| 9 | Bihar | Patna | ~38 |
| 10 | West Bengal | Kolkata | ~23 |
| 11 | Madhya Pradesh | Bhopal | ~52 |
| 12 | Odisha | Bhubaneswar | ~30 |
| 13 | Kerala | Thiruvananthapuram | ~14 |
| 14 | Punjab | Chandigarh | ~23 |
| 15 | Haryana | Chandigarh | ~22 |
| 16 | Assam | Dispur | ~33 |
| 17 | Jharkhand | Ranchi | ~24 |
| 18 | Chhattisgarh | Raipur | ~28 |
| 19 | Uttarakhand | Dehradun | ~13 |
| 20 | Himachal Pradesh | Shimla | ~12 |
| 21 | Goa | Panaji | ~2 |
| 22 | Manipur | Imphal | ~16 |
| 23 | Meghalaya | Shillong | ~11 |
| 24 | Tripura | Agartala | ~8 |
| 25 | Mizoram | Aizawl | ~11 |
| 26 | Nagaland | Kohima | ~12 |
| 27 | Sikkim | Gangtok | ~4 |
| 28 | Arunachal Pradesh | Itanagar | ~25 |

**Total Expected:** ~750-800 districts, ~15,000+ mandals, ~50,000+ villages

---

## ⚙️ Configuration

### **File:** `src/workers/locationPopulateCron.ts`

```typescript
// Languages to auto-generate
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr'];

// Rate limiting delays
const DELAY_BETWEEN_STATES = 60000;      // 1 minute
const DELAY_BETWEEN_DISTRICTS = 500;     // 500ms
const DELAY_BETWEEN_MANDALS = 250;       // 250ms
const DELAY_BETWEEN_VILLAGES = 250;      // 250ms

// Limits per ChatGPT request
const MAX_DISTRICTS_PER_STATE = 50;
const MAX_MANDALS_PER_DISTRICT = 40;
const MAX_VILLAGES_PER_MANDAL = 30;
```

**To customize languages:**
```typescript
// Edit to add/remove languages
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'bn', 'mr', 'ta'];
```

---

## 📋 Real-Time Console Output

```
╔════════════════════════════════════════════════════════════════════════════╗
║         LOCATION POPULATION CRON JOB - STARTED                             ║
╚════════════════════════════════════════════════════════════════════════════╝

Started at: 2026-01-14T10:30:00.000Z
States to process: 28
Languages: te, hi, kn, ta, mr

[1/28] State: Telangana

================================================================================
🚀 Processing State: Telangana
================================================================================

  ➕ Creating state: Telangana
  📝 Creating state translations...
    ✓ Translation created: te → తెలంగాణ
    ✓ Translation created: hi → तेलंगाना
    ✓ Translation created: kn → ತೆಲಂಗಾಣ
    ✓ Translation created: ta → தெலங்கானா
    ✓ Translation created: mr → तेलंगणा
  🏘️  Fetching districts for Telangana...
  📊 Found 33 districts

  [1/33] Processing District: Adilabad
    ➕ Created district: Adilabad
    📊 Found 38 mandals
      ➕ 25 villages for Bhiknoor

  [2/33] Processing District: Nizamabad
    ➕ Created district: Nizamabad
    📊 Found 35 mandals
      ➕ 22 villages for Armoor

✅ Completed: Telangana
   Districts: 33 | Mandals: 587 | Translations: 2,348

⏸️  Waiting 60s before next state...

[2/28] State: Andhra Pradesh
...
```

---

## 📈 Performance Estimates

| Metric | Estimate |
|--------|----------|
| **Total Duration** | 2-4 hours |
| **States** | 28 |
| **Districts** | ~750-800 |
| **Mandals** | ~15,000+ |
| **Villages** | ~50,000+ (first 10 mandals/district) |
| **Translations** | ~200,000+ records |
| **ChatGPT API Calls** | ~16,000+ |
| **Cost (OpenAI)** | ~$5-10 (gpt-4o-mini) |

**Rate Limit Safety:**
- Stays well under OpenAI's 10,000 requests/minute limit
- Built-in delays prevent throttling
- Processes one state at a time

---

## 🔄 Schedule as Cron Job (Production)

### **Linux/Mac (crontab)**

```bash
# Run every Sunday at 2 AM
0 2 * * 0 cd /path/to/project && npm run jobs:location-populate:prod >> /var/log/location-cron.log 2>&1
```

### **Windows Task Scheduler**

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Weekly, Sunday, 2:00 AM
4. Action: Start a Program
   - Program: `node`
   - Arguments: `dist/workers/locationPopulateCron.js`
   - Start in: `D:\Kaburlu Softwares\Kaburlu_Media_Backend\Kaburlu_Media_Backend`

### **PM2 (Node Process Manager)**

```bash
# Install PM2
npm install -g pm2

# Add to ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'location-cron',
      script: 'dist/workers/locationPopulateCron.js',
      cron_restart: '0 2 * * 0',  // Every Sunday at 2 AM
      autorestart: false
    }
  ]
};

# Start with PM2
pm2 start ecosystem.config.cjs
```

---

## 🛡️ Safety Features

### **1. Duplicate Prevention**
- Checks if state already has districts before processing
- Skips states with existing data automatically

### **2. Error Handling**
- If one state fails, continues with next state
- Logs all errors at the end
- Partial progress is saved (districts/mandals created before failure)

### **3. Rate Limit Protection**
- 60 second wait between states
- 500ms wait between districts
- 250ms wait between mandals/villages
- Stays under ChatGPT API limits

### **4. Progress Tracking**
- Real-time console output
- Statistics at the end
- Error summary

---

## 📊 Final Statistics

```
╔════════════════════════════════════════════════════════════════════════════╗
║         LOCATION POPULATION CRON JOB - COMPLETED                           ║
╚════════════════════════════════════════════════════════════════════════════╝

Completed at: 2026-01-14T14:45:23.456Z
Duration: 253.42 minutes

📊 STATISTICS:
   States Processed: 28
   States Skipped: 0
   States Failed: 0
   Districts Created: 768
   Mandals Created: 14,523
   Villages Created: 48,392
   Translations Created: 198,456

✅ Cron job finished successfully!
```

---

## 🎯 Benefits Over Manual API Calls

| Manual API | Automated Cron ✅ |
|------------|------------------|
| Call for each state manually | **One command processes all 28 states** |
| Need to track which states done | **Auto-skips completed states** |
| Risk of rate limiting | **Built-in delays prevent limits** |
| No error recovery | **Continues on errors** |
| Manual progress tracking | **Real-time console logs** |
| Can forget states | **Processes complete list** |

---

## 🧪 Testing

### **Test with One State First:**

Edit `src/workers/locationPopulateCron.ts`:
```typescript
// Change this line:
const STATES_TO_PROCESS = [
  'Telangana',  // Test with just one state first
  // 'Andhra Pradesh',  // Comment out others
  // 'Karnataka',
];
```

Run:
```powershell
npm run jobs:location-populate
```

**Expected Duration:** ~5-10 minutes for Telangana

---

## ✅ **Ready to Use!**

**Start the automatic population:**
```powershell
.\run_location_cron.ps1
```

**Or via npm:**
```bash
npm run jobs:location-populate
```

**Sit back and let ChatGPT populate your entire location database automatically! 🚀**
