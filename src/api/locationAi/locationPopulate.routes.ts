import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireReporterOrAdmin, requireSuperOrTenantAdmin } from '../middlewares/authz';
import { OPENAI_KEY } from '../../lib/aiConfig';

const router = Router();

// In-memory job tracking (use Redis/BullMQ in production)
// Languages to auto-generate (you can configure this)
const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr']; // Telugu, Hindi, Kannada, Tamil, Marathi

const jobStore = new Map<string, {
  id: string;
  stateName: string;
  languages: string[];
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: {
    currentStep: string;
    districtsProcessed: number;
    totalDistricts: number;
    mandalsProcessed: number;
    villagesProcessed: number;
    languagesCompleted: string[];
  };
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}>();

/**
 * OpenAI helper - generate location data
 */
async function askChatGPT(prompt: string, model = 'gpt-4o-mini'): Promise<string> {
  const axios = require('axios');
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_KEY');

  const timeoutMs = Number(process.env.AI_TIMEOUT_MS || 120_000);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const resp = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a geographic data expert. Provide accurate Indian administrative location data in valid JSON format only. Do not add any extra text or explanations.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0,
        response_format: { type: 'json_object' }
      },
      {
        headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
        signal: ctrl.signal,
      }
    );
    return resp?.data?.choices?.[0]?.message?.content || '';
  } finally {
    clearTimeout(t);
  }
}

function parseJSON(text: string): any {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract JSON array/object
    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
      try { return JSON.parse(cleaned.slice(arrStart, arrEnd + 1)); } catch {}
    }
    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
      try { return JSON.parse(cleaned.slice(objStart, objEnd + 1)); } catch {}
    }
  }
  return null;
}

/**
 * Background worker function - processes one state hierarchically
 * Automatically generates data in English + multiple Indian languages
 */
async function processLocationHierarchy(jobId: string, stateName: string, languages: string[]) {
  const job = jobStore.get(jobId);
  if (!job) return;

  // BEST PRACTICE: Keep API calls small (max 40 items) to avoid overwhelming ChatGPT
  const MAX_DISTRICTS_PER_STATE = 40;  // Max districts in one ChatGPT call
  const MAX_MANDALS_PER_DISTRICT = 40; // Max mandals in one ChatGPT call
  const MAX_VILLAGES_PER_MANDAL = 40;  // Max villages in one ChatGPT call
  const DELAY_BETWEEN_DISTRICTS = 1000; // 1 second delay between district processing
  const DELAY_BETWEEN_MANDALS = 500;    // 500ms delay between mandal processing

  try {
    job.status = 'processing';
    job.progress.currentStep = 'Fetching state';

    // Helper function to build language names
    const buildLanguageNames = (langs: string[]): string => {
      const map: Record<string, string> = {
        'te': 'Telugu', 'hi': 'Hindi', 'kn': 'Kannada',
        'ta': 'Tamil', 'mr': 'Marathi', 'bn': 'Bengali',
        'ur': 'Urdu', 'gu': 'Gujarati', 'ml': 'Malayalam',
        'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese'
      };
      return langs.map(l => map[l] || l).join(', ');
    };

    // Helper function to build language keys for JSON (with language name hints for ChatGPT)
    const buildLanguageKeys = (langs: string[]): string => {
      const map: Record<string, string> = {
        'te': 'Telugu', 'hi': 'Hindi', 'kn': 'Kannada',
        'ta': 'Tamil', 'mr': 'Marathi', 'bn': 'Bengali',
        'ur': 'Urdu', 'gu': 'Gujarati', 'ml': 'Malayalam',
        'pa': 'Punjabi', 'or': 'Odia', 'as': 'Assamese'
      };
      // Format: "te": "translated name in Telugu", "hi": "translated name in Hindi"
      // This gives ChatGPT clear guidance while using proper language codes as keys
      return langs.map(l => `"${l}": "translated name in ${map[l] || l}"`).join(', ');
    };

    const langNames = buildLanguageNames(languages);
    const langKeys = buildLanguageKeys(languages);

    // Step 1: Get or create state
    const india = await prisma.country.findFirst({ where: { name: 'India' } });
    if (!india) throw new Error('India country not found in database');

    let state = await prisma.state.findFirst({
      where: { name: { equals: stateName, mode: 'insensitive' }, isDeleted: false }
    });

    if (!state) {
      state = await prisma.state.create({
        data: { name: stateName, countryId: india.id, isDeleted: false }
      });
    }

    // Step 2: Create state translations
    for (const lang of languages) {
      const existing = await prisma.stateTranslation.findFirst({
        where: { stateId: state.id, language: lang }
      });

      if (!existing) {
        const langName = buildLanguageNames([lang]);
        const prompt = `Translate the Indian state name "${stateName}" to ${langName}. Return JSON: { "name": "translated name" }`;
        const result = await askChatGPT(prompt);
        const data = parseJSON(result);

        if (data?.name) {
          await prisma.stateTranslation.create({
            data: { stateId: state.id, language: lang, name: data.name }
          });
        }
      }
      if (!job.progress.languagesCompleted.includes(lang)) {
        job.progress.languagesCompleted.push(lang);
      }
    }

    job.progress.currentStep = 'Checking existing data';

    // Step 3: Check if districts already exist with translations
    // If all districts already have all translations, skip ChatGPT call
    const existingDistricts = await prisma.district.findMany({
      where: { stateId: state.id, isDeleted: false },
      include: {
        translations: {
          where: { language: { in: languages } }
        }
      }
    });

    const hasCompleteData = existingDistricts.length > 0 && existingDistricts.every(d => 
      languages.every(lang => d.translations.some(t => t.language === lang))
    );

    let districts: any[] = [];

    if (hasCompleteData) {
      // Use existing data, no need to call ChatGPT
      console.log(`✓ All districts for ${stateName} already exist with complete translations. Skipping AI call.`);
      districts = existingDistricts.map(d => ({
        en: d.name,
        ...Object.fromEntries(
          d.translations.map(t => [t.language, t.name])
        )
      }));
      job.progress.totalDistricts = districts.length;
    } else {
      // Need to fetch from ChatGPT
      job.progress.currentStep = 'Fetching districts from AI';
      
      const districtPrompt = `List ALL districts in ${stateName} state, India.
For each district, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON in this exact format:
{
  "districts": [
    { "en": "District Name", ${langKeys} }
  ]
}
Maximum ${MAX_DISTRICTS_PER_STATE} districts to keep response manageable.`;

      const districtResult = await askChatGPT(districtPrompt);
      const districtData = parseJSON(districtResult);

      if (!districtData?.districts || !Array.isArray(districtData.districts)) {
        throw new Error('Invalid district data from ChatGPT');
      }

      districts = districtData.districts.slice(0, MAX_DISTRICTS_PER_STATE);
      job.progress.totalDistricts = districts.length;
    }

    // Process each district
    for (let i = 0; i < districts.length; i++) {
      const distData = districts[i];
      job.progress.currentStep = `Processing district: ${distData.en}`;
      job.progress.districtsProcessed = i + 1;

      // Create or find district
      let district = await prisma.district.findFirst({
        where: {
          name: { equals: distData.en, mode: 'insensitive' },
          stateId: state.id,
          isDeleted: false
        }
      });

      if (!district) {
        district = await prisma.district.create({
          data: { name: distData.en, stateId: state.id, isDeleted: false }
        });
      }

      // Create translations
      for (const lang of languages) {
        if (distData[lang]) {
          const existing = await prisma.districtTranslation.findFirst({
            where: { districtId: district.id, language: lang }
          });

          if (!existing) {
            await prisma.districtTranslation.create({
              data: { districtId: district.id, language: lang, name: distData[lang] }
            });
          }
        }
      }

      // Step 4: Get mandals for this district
      // Check if mandals already exist with translations
      const existingMandals = await prisma.mandal.findMany({
        where: { districtId: district.id, isDeleted: false },
        include: {
          translations: {
            where: { language: { in: languages } }
          }
        }
      });

      const hasCompleteMandals = existingMandals.length > 0 && existingMandals.every(m => 
        languages.every(lang => m.translations.some(t => t.language === lang))
      );

      let mandals: any[] = [];

      if (hasCompleteMandals) {
        // Use existing data, skip AI call
        console.log(`✓ All mandals for ${distData.en} district already exist with complete translations. Skipping AI call.`);
        mandals = existingMandals.map(m => ({
          en: m.name,
          ...Object.fromEntries(
            m.translations.map(t => [t.language, t.name])
          )
        }));
      } else {
        // Need to fetch from ChatGPT
        const mandalPrompt = `List mandals/tehsils in ${distData.en} district, ${stateName} state, India.
For each mandal, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON:
{
  "mandals": [
    { "en": "Mandal Name", ${langKeys} }
  ]
}
Maximum ${MAX_MANDALS_PER_DISTRICT} mandals.`;

        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DISTRICTS));

        const mandalResult = await askChatGPT(mandalPrompt);
        const mandalData = parseJSON(mandalResult);

        if (mandalData?.mandals && Array.isArray(mandalData.mandals)) {
          mandals = mandalData.mandals.slice(0, MAX_MANDALS_PER_DISTRICT);
        }
      }

      if (mandals.length > 0) {

        for (let j = 0; j < mandals.length; j++) {
          const manData = mandals[j];
          job.progress.mandalsProcessed++;

          // Create or find mandal
          let mandal = await prisma.mandal.findFirst({
            where: {
              name: { equals: manData.en, mode: 'insensitive' },
              districtId: district.id,
              isDeleted: false
            }
          });

          if (!mandal) {
            mandal = await prisma.mandal.create({
              data: { name: manData.en, districtId: district.id, isDeleted: false }
            });
          }

          // Create translations
          for (const lang of languages) {
            if (manData[lang]) {
              const existing = await prisma.mandalTranslation.findFirst({
                where: { mandalId: mandal.id, language: lang }
              });

              if (!existing) {
                await prisma.mandalTranslation.create({
                  data: { mandalId: mandal.id, language: lang, name: manData[lang] }
                });
              }
            }
          }

          // Step 5: Get villages for this mandal (limit to first 10 mandals to avoid overwhelming)
          if (j < 10) {
            // Check if villages already exist with translations
            const existingVillages = await prisma.village.findMany({
              where: { mandalId: mandal.id, isDeleted: false },
              include: {
                translations: {
                  where: { language: { in: languages } }
                }
              }
            });

            const hasCompleteVillages = existingVillages.length > 0 && existingVillages.every(v => 
              languages.every(lang => v.translations.some(t => t.language === lang))
            );

            if (hasCompleteVillages) {
              // Use existing data, skip AI call
              console.log(`✓ All villages for ${manData.en} mandal already exist with complete translations. Skipping AI call.`);
              job.progress.villagesProcessed += existingVillages.length;
            } else {
              // Need to fetch from ChatGPT
              const villagePrompt = `List villages in ${manData.en} mandal, ${distData.en} district, India.
For each village, provide the name in English and translations in: ${langNames}.
Return ONLY valid JSON in this exact format:
{
  "villages": [
    { "en": "Village Name", ${langKeys} }
  ]
}
Maximum ${MAX_VILLAGES_PER_MANDAL} villages.`;

              await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MANDALS));

              try {
                const villageResult = await askChatGPT(villagePrompt);
                const villageData = parseJSON(villageResult);

                if (villageData?.villages && Array.isArray(villageData.villages)) {
                  const villages = villageData.villages.slice(0, MAX_VILLAGES_PER_MANDAL);
                  
                  // Create village records with translations
                  for (const villData of villages) {
                    // Create or find village
                    let village = await prisma.village.findFirst({
                      where: {
                        name: { equals: villData.en, mode: 'insensitive' },
                        mandalId: mandal.id,
                        isDeleted: false
                      }
                    });

                    if (!village) {
                      village = await (prisma as any).village.create({
                      data: { name: villData.en, mandalId: mandal.id, isDeleted: false }
                      });
                    }

                    // Create translations for each language
                  if (village) {
                    for (const lang of languages) {
                      if (villData[lang]) {
                        const existing = await prisma.villageTranslation.findFirst({
                          where: { villageId: village.id, language: lang }
                        });

                        if (!existing) {
                          await prisma.villageTranslation.create({
                            data: { villageId: village.id, language: lang, name: villData[lang] }
                          });
                        }
                        }
                      }
                    }
                  }
                  
                  job.progress.villagesProcessed += villages.length;
                }

                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_MANDALS));
              } catch (err) {
                console.error(`Failed to fetch villages for ${manData.en}:`, err);
                // Continue with next mandal
              }
            }
          }
        }
      }
    }

    job.status = 'completed';
    job.completedAt = new Date();
    job.progress.currentStep = 'Completed successfully';

  } catch (error: any) {
    console.error(`Job ${jobId} failed:`, error);
    job.status = 'failed';
    job.error = error.message || String(error);
    job.completedAt = new Date();
  }
}



/**
 * @swagger
 * /location/ai/populate/status/{jobId}:
 *   get:
 *     summary: Check status of location population job
 *     description: |
 *       Returns real-time progress of a background location population job.
 *       Use this to monitor:
 *       - Current processing step (which district/mandal/village)
 *       - Number of items processed vs total
 *       - Languages completed
 *       - Whether job is queued, processing, completed, or failed
 *       
 *       **Typical workflow:**
 *       1. POST /location/ai/populate/state → get jobId
 *       2. Poll GET /location/ai/populate/status/{jobId} every 5-10 seconds
 *       3. When status='completed', data is ready in database
 *       
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: 
 *           type: string
 *           example: "loc_1234567890_abc123def"
 *         description: Job ID returned from /populate/state endpoint
 *     responses:
 *       200:
 *         description: Job status and progress
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId: 
 *                   type: string
 *                   example: "loc_1234567890_abc123def"
 *                 stateName:
 *                   type: string
 *                   example: "Telangana"
 *                 languages:
 *                   type: array
 *                   items: { type: string }
 *                   example: ["te", "hi", "kn", "ta", "mr"]
 *                 status: 
 *                   type: string
 *                   enum: [queued, processing, completed, failed]
 *                   example: "processing"
 *                 progress:
 *                   type: object
 *                   properties:
 *                     currentStep: 
 *                       type: string
 *                       example: "Processing district: Hyderabad"
 *                     districtsProcessed: 
 *                       type: integer
 *                       example: 15
 *                     totalDistricts: 
 *                       type: integer
 *                       example: 33
 *                     mandalsProcessed: 
 *                       type: integer
 *                       example: 152
 *                     villagesProcessed: 
 *                       type: integer
 *                       example: 78
 *                     languagesCompleted:
 *                       type: array
 *                       items: { type: string }
 *                       example: ["te", "hi", "kn"]
 *                 error: 
 *                   type: string
 *                   example: null
 *                 startedAt: 
 *                   type: string
 *                   format: date-time
 *                   example: "2026-01-14T10:30:00.000Z"
 *                 completedAt: 
 *                   type: string
 *                   format: date-time
 *                   example: "2026-01-14T10:42:35.000Z"
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string, example: "Job not found" }
 *       401:
 *         description: Unauthorized
 */
router.get('/populate/status/:jobId', passport.authenticate('jwt', { session: false }), requireReporterOrAdmin, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = jobStore.get(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    return res.json({
      jobId: job.id,
      stateName: job.stateName,
      languages: job.languages,
      status: job.status,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    return res.status(500).json({ error: 'Failed to get status', message: error.message });
  }
});

/**
 * @swagger
 * /location/ai/populate/jobs:
 *   get:
 *     summary: List all location population jobs
 *     description: |
 *       Returns list of all background jobs (queued, processing, completed, failed).
 *       Useful for monitoring which states have been processed.
 *       
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: List of all jobs with their status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 jobs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobId: { type: string, example: "loc_1234567890_abc123def" }
 *                       stateName: { type: string, example: "Telangana" }
 *                       languages: { type: array, items: { type: string }, example: ["te", "hi", "kn", "ta", "mr"] }
 *                       status: { type: string, enum: [queued, processing, completed, failed] }
 *                       progress: { type: object }
 *                       startedAt: { type: string, format: date-time }
 *                       completedAt: { type: string, format: date-time }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (requires SUPER_ADMIN or TENANT_ADMIN)
 */
router.get('/populate/jobs', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdmin, async (_req, res) => {
  try {
    const jobs = Array.from(jobStore.values()).map(job => ({
      jobId: job.id,
      stateName: job.stateName,
      languages: job.languages,
      status: job.status,
      progress: job.progress,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    }));

    return res.json({ count: jobs.length, jobs });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to list jobs', message: error.message });
  }
});


/**
 * @swagger
 * /location/ai/populate/state:
 *   post:
 *     summary: Generate complete location hierarchy for ONE Indian state using ChatGPT
 *     description: |
 *       Triggers background job to generate hierarchical location data (districts→mandals→villages) 
 *       for a single Indian state using ChatGPT AI.
 *       
 *       **What makes this better:**
 *       - ChatGPT generates authentic Indian location data (not just translations)
 *       - Automatically creates data in 6 languages simultaneously (English + 5 Indian languages)
 *       - Processes one state at a time (on-demand control)
 *       - Creates complete hierarchy: State → Districts → Mandals → Villages
 *       - Background job with progress tracking
 *       
 *       **How it works:**
 *       1. Provide just the state name (e.g., "Telangana")
 *       2. System automatically asks ChatGPT for data in English + 5 major Indian languages
 *       3. Queues background job to:
 *          - Ask ChatGPT for state name in all languages → Store in State + StateTranslation
 *          - Ask ChatGPT for all districts with English + Telugu/Hindi/Kannada/Tamil/Marathi names
 *          - Store each district with all translations
 *          - For each district, ask ChatGPT for mandals in all languages
 *          - Store mandals with translations
 *          - For first 10 mandals per district, get villages in all languages
 *       4. Processes incrementally with delays to avoid ChatGPT rate limits
 *       5. Returns job ID to track progress
 *       
 *       **Best practices:**
 *       - Each ChatGPT request includes multiple languages at once (efficient)
 *       - Max 40 districts, 30 mandals, 20 villages per request
 *       - 250-500ms delays between requests
 *       - Only processes first 10 mandals fully (villages) - expandable with queue system
 *       
 *       **Example usage:**
 *       ```
 *       POST /location/ai/populate/state
 *       { "stateName": "Telangana" }
 *       ```
 *       or with custom languages:
 *       ```
 *       POST /location/ai/populate/state
 *       { "stateName": "Karnataka", "languages": ["kn", "te", "hi"] }
 *       ```
 *       
 *     tags: [Location AI]
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [stateName]
 *             properties:
 *               stateName:
 *                 type: string
 *                 example: "Telangana"
 *                 description: Name of the Indian state to process
 *               languages:
 *                 type: array
 *                 items: 
 *                   type: string
 *                   enum: [te, hi, kn, ta, mr, bn, ur, gu, ml, pa, or, as]
 *                 example: ["te", "hi", "kn"]
 *                 description: Optional array of language codes. Defaults to ["te", "hi", "kn", "ta", "mr"] if not provided
 *     responses:
 *       202:
 *         description: Job queued successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: 
 *                   type: boolean
 *                   example: true
 *                 jobId: 
 *                   type: string
 *                   example: "loc_1234567890_abc123def"
 *                   description: Job ID for tracking progress
 *                 languages:
 *                   type: array
 *                   items: { type: string }
 *                   example: ["te", "hi", "kn", "ta", "mr"]
 *                   description: Languages that will be generated
 *                 message: 
 *                   type: string
 *                   example: "Location population job queued. Data will be generated in English + TE, HI, KN, TA, MR"
 *       400:
 *         description: Bad request (missing stateName)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *       401:
 *         description: Unauthorized (missing or invalid JWT token)
 *       403:
 *         description: Forbidden (requires SUPER_ADMIN or TENANT_ADMIN role)
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error: { type: string }
 *                 message: { type: string }
 */
router.post('/populate/state', passport.authenticate('jwt', { session: false }), requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { stateName, languages } = req.body;
    
    if (!stateName || typeof stateName !== 'string' || !stateName.trim()) {
      return res.status(400).json({ error: 'stateName is required' });
    }

    const normalizedStateName = stateName.trim();
    const targetLanguages = Array.isArray(languages) && languages.length > 0
      ? languages
      : ['te', 'hi', 'kn', 'ta', 'mr'];

    // BEST PRACTICE: Check if job already running or completed for this state
    const existingJob = Array.from(jobStore.values()).find(j => 
      j.stateName.toLowerCase() === normalizedStateName.toLowerCase()
    );

    if (existingJob) {
      if (existingJob.status === 'processing' || existingJob.status === 'queued') {
        return res.status(409).json({
          error: 'Job already running',
          message: `A job for "${existingJob.stateName}" is already ${existingJob.status}. Check /location/ai/populate/state/status for progress.`,
          existingJobId: existingJob.id,
          status: existingJob.status,
          progress: existingJob.progress,
          suggestion: `GET /location/ai/populate/state/status/${existingJob.id}`
        });
      }

      if (existingJob.status === 'completed') {
        return res.status(409).json({
          error: 'Job already completed',
          message: `Location data for "${existingJob.stateName}" has already been populated. Use manual CRUD APIs to add missing data or fix translations.`,
          existingJobId: existingJob.id,
          completedAt: existingJob.completedAt,
          suggestion: 'Use POST /location/districts, POST /location/mandals, POST /location/villages for manual additions. Use PUT endpoints to fix translation names.'
        });
      }
    }

    // Import the cron worker
    const { runLocationPopulateCron } = require('../../workers/locationPopulateCron');
    
    // Start in background (don't await)
    runLocationPopulateCron(normalizedStateName, targetLanguages).catch((err: any) => {
      console.error('State processing error:', err);
    });

    return res.status(202).json({
      success: true,
      message: `Processing ${normalizedStateName} state completely (districts → mandals → villages). Check server logs for progress.`,
      stateName: normalizedStateName,
      languages: targetLanguages,
      estimatedDuration: '5-15 minutes depending on state size',
      checkProgress: 'Use GET /location/ai/populate/jobs to see all running jobs'
    });

  } catch (error: any) {
    console.error('Failed to trigger state processing:', error);
    return res.status(500).json({ error: 'Failed to trigger state processing', message: error.message });
  }
});

export default router;
