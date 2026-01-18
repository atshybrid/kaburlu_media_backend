import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdmin } from '../middlewares/authz';
import { OPENAI_KEY } from '../../lib/aiConfig';
import axios from 'axios';

const router = Router();

const AUTO_LANGUAGES = ['te', 'hi', 'kn', 'ta', 'mr'];

// Helper: Call ChatGPT
async function askChatGPT(prompt: string): Promise<string> {
  if (!OPENAI_KEY) throw new Error('Missing OPENAI_API_KEY');
  
  const resp = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an official Indian administrative data assistant. Return ONLY valid JSON.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0,
      response_format: { type: 'json_object' }
    },
    {
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' }
    }
  );
  return resp?.data?.choices?.[0]?.message?.content || '';
}

function parseJSON(text: string): any {
  try {
    return JSON.parse(text.trim());
  } catch {
    return null;
  }
}

async function translateNames(names: string[], languages: string[]): Promise<any> {
  const langMap: any = { te: 'Telugu', hi: 'Hindi', kn: 'Kannada', ta: 'Tamil', mr: 'Marathi' };
  const langNames = languages.map(l => langMap[l]).join(', ');

  const prompt = `Translate these place names to ${langNames}.
Names: ${JSON.stringify(names)}
Return ONLY valid JSON:
{
  "translations": {
    "Place Name": { "te": "తెలుగు", "hi": "हिंदी", "kn": "ಕನ್ನಡ", "ta": "தமிழ்", "mr": "मराठी" }
  }
}`;

  const result = await askChatGPT(prompt);
  return parseJSON(result);
}

/**
 * @swagger
 * /location/status/{stateName}:
 *   get:
 *     summary: Get location data status for a state
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: stateName
 *         required: true
 *         schema:
 *           type: string
 *         description: State name (e.g., "Telangana")
 *     responses:
 *       200:
 *         description: Location data status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 state:
 *                   type: string
 *                 totalDistricts:
 *                   type: number
 *                 totalMandals:
 *                   type: number
 *                 totalVillages:
 *                   type: number
 *                 districtsWithMandals:
 *                   type: number
 *                 districtsWithoutMandals:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       districtId:
 *                         type: string
 *                       districtName:
 *                         type: string
 *                       mandalCount:
 *                         type: number
 *                 mandalsWithoutVillages:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       mandalId:
 *                         type: string
 *                       mandalName:
 *                         type: string
 *                       districtName:
 *                         type: string
 *                       villageCount:
 *                         type: number
 */
router.get('/status/:stateName', async (req: Request, res: Response) => {
  try {
    const { stateName } = req.params;

    const state = await prisma.state.findFirst({
      where: { name: { equals: stateName, mode: 'insensitive' } }
    });

    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    // Get all districts
    const districts = await prisma.district.findMany({
      where: { stateId: state.id, isDeleted: false },
      include: {
        _count: { select: { mandals: true } }
      }
    });

    // Get total mandals
    const totalMandals = await prisma.mandal.count({
      where: { district: { stateId: state.id }, isDeleted: false }
    });

    // Get total villages
    const totalVillages = await prisma.village.count({
      where: {
        mandal: { district: { stateId: state.id } },
        isDeleted: false
      }
    });

    // Districts without mandals
    const districtsWithoutMandals = districts
      .filter(d => d._count.mandals === 0)
      .map(d => ({
        districtId: d.id,
        districtName: d.name,
        mandalCount: 0
      }));

    // Mandals without villages
    const mandalsWithoutVillages = await prisma.mandal.findMany({
      where: {
        district: { stateId: state.id },
        isDeleted: false
      },
      include: {
        district: true,
        _count: { select: { villages: true } }
      }
    });

    const mandalsNeedVillages = mandalsWithoutVillages
      .filter(m => m._count.villages === 0)
      .map(m => ({
        mandalId: m.id,
        mandalName: m.name,
        districtName: m.district.name,
        villageCount: 0
      }));

    res.json({
      state: state.name,
      totalDistricts: districts.length,
      totalMandals,
      totalVillages,
      districtsWithMandals: districts.length - districtsWithoutMandals.length,
      districtsWithoutMandals,
      mandalsWithoutVillages: mandalsNeedVillages
    });

  } catch (error: any) {
    console.error('Error getting status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /location/retry/district/{districtId}/mandals:
 *   post:
 *     summary: Retry populating mandals for a specific district
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: districtId
 *         required: true
 *         schema:
 *           type: string
 *         description: District ID
 *     responses:
 *       200:
 *         description: Mandals populated successfully
 */
router.post(
  '/retry/district/:districtId/mandals',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdmin,
  async (req: Request, res: Response) => {
    try {
      const { districtId } = req.params;

      const district = await prisma.district.findUnique({
        where: { id: districtId },
        include: {
          state: true,
          _count: { select: { mandals: true } }
        }
      });

      if (!district) {
        return res.status(404).json({ error: 'District not found' });
      }

      // Check if already has mandals
      if (district._count.mandals > 0) {
        return res.status(400).json({ 
          error: 'District already has mandals',
          count: district._count.mandals
        });
      }

      // Call AI to get mandals
      const mandalPrompt = `You are an official ${district.state.name} administrative division assistant.

TASK: Return the list of mandals for a given district.

STRICT RULES:
- District must be matched EXACTLY
- Use only government or Census 2011 data
- Return correct mandal count
- No duplicate mandals

INPUT:
State: ${district.state.name}
District: ${district.name}

OUTPUT (JSON only):
{
  "state": "${district.state.name}",
  "district": "${district.name}",
  "totalMandals": number,
  "mandals": [
    {
      "mandalName": "",
      "mandalId": ""
    }
  ]
}`;

      const mandalResult = await askChatGPT(mandalPrompt);
      const mandalData = parseJSON(mandalResult);

      if (!mandalData?.mandals || !Array.isArray(mandalData.mandals)) {
        return res.status(500).json({ error: 'Invalid AI response' });
      }

      // Translate names
      const mandalNames = mandalData.mandals.map((m: any) => m.mandalName);
      const translations = await translateNames(mandalNames, AUTO_LANGUAGES);

      // Create mandals
      const created = [];
      for (const mand of mandalData.mandals) {
        const mandal = await prisma.mandal.create({
          data: {
            name: mand.mandalName,
            districtId: district.id,
            isDeleted: false
          }
        });

        // Add translations
        const trans = translations?.translations?.[mand.mandalName];
        if (trans) {
          for (const lang of AUTO_LANGUAGES) {
            if (trans[lang]) {
              await prisma.mandalTranslation.create({
                data: { mandalId: mandal.id, language: lang, name: trans[lang] }
              });
            }
          }
        }

        created.push({
          id: mandal.id,
          name: mandal.name
        });
      }

      res.json({
        success: true,
        district: district.name,
        mandalsCreated: created.length,
        mandals: created
      });

    } catch (error: any) {
      console.error('Error retrying mandals:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * @swagger
 * /location/retry/mandal/{mandalId}/villages:
 *   post:
 *     summary: Retry populating villages for a specific mandal
 *     tags: [Location]
 *     parameters:
 *       - in: path
 *         name: mandalId
 *         required: true
 *         schema:
 *           type: string
 *         description: Mandal ID
 *     responses:
 *       200:
 *         description: Villages populated successfully
 */
router.post(
  '/retry/mandal/:mandalId/villages',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdmin,
  async (req: Request, res: Response) => {
    try {
      const { mandalId } = req.params;

      const mandal = await prisma.mandal.findUnique({
        where: { id: mandalId },
        include: {
          district: { include: { state: true } },
          _count: { select: { villages: true } }
        }
      });

      if (!mandal) {
        return res.status(404).json({ error: 'Mandal not found' });
      }

      if (mandal._count.villages > 0) {
        return res.status(400).json({ 
          error: 'Mandal already has villages',
          count: mandal._count.villages
        });
      }

      // Call AI to get villages
      const villagePrompt = `You are an official ${mandal.district.state.name} village directory assistant.

TASK: Return the list of villages for a mandal.

STRICT RULES:
- Use only Census 2011 or government records
- Return accurate village count
- No duplicate villages

INPUT:
State: ${mandal.district.state.name}
District: ${mandal.district.name}
Mandal: ${mandal.name}

OUTPUT (JSON only):
{
  "state": "${mandal.district.state.name}",
  "district": "${mandal.district.name}",
  "mandal": "${mandal.name}",
  "totalVillages": number,
  "villages": [
    {
      "villageName": ""
    }
  ]
}`;

      const villageResult = await askChatGPT(villagePrompt);
      const villageData = parseJSON(villageResult);

      if (!villageData?.villages || !Array.isArray(villageData.villages)) {
        return res.status(500).json({ error: 'Invalid AI response' });
      }

      // Get first tenant for village association (villages are shared across tenants)
      const firstTenant = await prisma.tenant.findFirst();
      if (!firstTenant) {
        return res.status(500).json({ error: 'No tenant found in database' });
      }

      // Translate names
      const villageNames = villageData.villages.map((v: any) => v.villageName);
      const translations = await translateNames(villageNames, AUTO_LANGUAGES);

      // Create villages
      const created = [];
      for (const vill of villageData.villages) {
        const village = await prisma.village.create({
          data: {
            name: vill.villageName,
            mandalId: mandal.id,
            tenantId: firstTenant.id,
            isDeleted: false
          }
        });

        // Add translations
        const trans = translations?.translations?.[vill.villageName];
        if (trans) {
          for (const lang of AUTO_LANGUAGES) {
            if (trans[lang]) {
              await prisma.villageTranslation.create({
                data: { villageId: village.id, language: lang, name: trans[lang] }
              });
            }
          }
        }

        created.push({
          id: village.id,
          name: village.name
        });
      }

      res.json({
        success: true,
        mandal: mandal.name,
        district: mandal.district.name,
        villagesCreated: created.length,
        villages: created
      });

    } catch (error: any) {
      console.error('Error retrying villages:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
