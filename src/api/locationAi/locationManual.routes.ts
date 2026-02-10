import { Router } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';
import { requireSuperOrTenantAdmin } from '../middlewares/authz';
import { aiGenerateText } from '../../lib/aiProvider';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

/**
 * @swagger
 * /location/states:
 *   post:
 *     summary: Manually create a state with translations
 *     tags: [Location AI]
 *     security: [{bearer Auth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: {type: string, example: "Telangana"}
 *               translations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     language: {type: string, example: "te"}
 *                     name: {type: string, example: "తెలంగాణ"}
 *     responses:
 *       201:
 *         description: State created successfully
 */
router.post('/states', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { name, translations, countryId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    if (!countryId) {
      return res.status(400).json({ error: 'countryId is required' });
    }

    // Check if state already exists
    const existing = await prisma.state.findFirst({
      where: { name: { equals: name.trim(), mode: 'insensitive' } }
    });

    if (existing) {
      return res.status(409).json({ error: 'State already exists', stateId: existing.id });
    }

    const state = await prisma.state.create({
      data: { name: name.trim(), countryId, isDeleted: false }
    });

    // Create translations if provided
    if (Array.isArray(translations)) {
      for (const trans of translations) {
        if (trans.language && trans.name) {
          await prisma.stateTranslation.create({
            data: {
              stateId: state.id,
              language: trans.language,
              name: trans.name
            }
          }).catch(() => {}); // Ignore duplicate errors
        }
      }
    }

    const result = await prisma.state.findUnique({
      where: { id: state.id },
      include: { translations: true }
    });

    return res.status(201).json({ success: true, state: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create state', message: error.message });
  }
});

/**
 * @swagger
 * /location/states/{id}/translations:
 *   put:
 *     summary: Update state translation
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [language, name]
 *             properties:
 *               language: {type: string, example: "te"}
 *               name: {type: string, example: "తెలంగాణ"}
 *     responses:
 *       200:
 *         description: Translation updated successfully
 */
router.put('/states/:id/translations', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { language, name } = req.body;

    if (!language || !name) {
      return res.status(400).json({ error: 'language and name are required' });
    }

    const state = await prisma.state.findUnique({ where: { id } });
    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    const existing = await prisma.stateTranslation.findFirst({
      where: { stateId: id, language }
    });

    if (existing) {
      await prisma.stateTranslation.update({
        where: { id: existing.id },
        data: { name }
      });
    } else {
      await prisma.stateTranslation.create({
        data: { stateId: id, language, name }
      });
    }

    const result = await prisma.state.findUnique({
      where: { id },
      include: { translations: true }
    });

    return res.json({ success: true, state: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update translation', message: error.message });
  }
});

/**
 * @swagger
 * /location/districts:
 *   post:
 *     summary: Manually create a district with translations
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, stateId]
 *             properties:
 *               name: {type: string, example: "Hyderabad"}
 *               stateId: {type: string}
 *               translations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     language: {type: string, example: "te"}
 *                     name: {type: string, example: "హైదరాబాద్"}
 *     responses:
 *       201:
 *         description: District created successfully
 */
router.post('/districts', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { name, stateId, translations } = req.body;

    if (!name || !stateId) {
      return res.status(400).json({ error: 'name and stateId are required' });
    }

    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    const existing = await prisma.district.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        stateId,
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'District already exists', districtId: existing.id });
    }

    const district = await prisma.district.create({
      data: { name: name.trim(), stateId, isDeleted: false }
    });

    if (Array.isArray(translations)) {
      for (const trans of translations) {
        if (trans.language && trans.name) {
          await prisma.districtTranslation.create({
            data: {
              districtId: district.id,
              language: trans.language,
              name: trans.name
            }
          }).catch(() => {});
        }
      }
    }

    const result = await prisma.district.findUnique({
      where: { id: district.id },
      include: { translations: true }
    });

    return res.status(201).json({ success: true, district: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create district', message: error.message });
  }
});

/**
 * @swagger
 * /location/districts/{id}/translations:
 *   put:
 *     summary: Update district translation
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [language, name]
 *             properties:
 *               language: {type: string, example: "te"}
 *               name: {type: string, example: "హైదరాబాద్"}
 *     responses:
 *       200:
 *         description: Translation updated
 */
router.put('/districts/:id/translations', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { language, name } = req.body;

    if (!language || !name) {
      return res.status(400).json({ error: 'language and name are required' });
    }

    const district = await prisma.district.findUnique({ where: { id } });
    if (!district) {
      return res.status(404).json({ error: 'District not found' });
    }

    const existing = await prisma.districtTranslation.findFirst({
      where: { districtId: id, language }
    });

    if (existing) {
      await prisma.districtTranslation.update({
        where: { id: existing.id },
        data: { name }
      });
    } else {
      await prisma.districtTranslation.create({
        data: { districtId: id, language, name }
      });
    }

    const result = await prisma.district.findUnique({
      where: { id },
      include: { translations: true }
    });

    return res.json({ success: true, district: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update translation', message: error.message });
  }
});

/**
 * @swagger
 * /location/mandals:
 *   post:
 *     summary: Manually create a mandal with translations
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, districtId]
 *             properties:
 *               name: {type: string, example: "Secunderabad"}
 *               districtId: {type: string}
 *               translations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     language: {type: string, example: "te"}
 *                     name: {type: string, example: "సికింద్రాబాద్"}
 *     responses:
 *       201:
 *         description: Mandal created successfully
 */
router.post('/mandals', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { name, districtId, translations } = req.body;

    if (!name || !districtId) {
      return res.status(400).json({ error: 'name and districtId are required' });
    }

    const district = await prisma.district.findUnique({ where: { id: districtId } });
    if (!district) {
      return res.status(404).json({ error: 'District not found' });
    }

    const existing = await prisma.mandal.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        districtId,
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Mandal already exists', mandalId: existing.id });
    }

    const mandal = await prisma.mandal.create({
      data: { name: name.trim(), districtId, isDeleted: false }
    });

    if (Array.isArray(translations)) {
      for (const trans of translations) {
        if (trans.language && trans.name) {
          await prisma.mandalTranslation.create({
            data: {
              mandalId: mandal.id,
              language: trans.language,
              name: trans.name
            }
          }).catch(() => {});
        }
      }
    }

    const result = await prisma.mandal.findUnique({
      where: { id: mandal.id },
      include: { translations: true }
    });

    return res.status(201).json({ success: true, mandal: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create mandal', message: error.message });
  }
});

/**
 * @swagger
 * /location/mandals/{id}/translations:
 *   put:
 *     summary: Update mandal translation
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [language, name]
 *             properties:
 *               language: {type: string, example: "te"}
 *               name: {type: string, example: "సికింద్రాబాద్"}
 *     responses:
 *       200:
 *         description: Translation updated
 */
router.put('/mandals/:id/translations', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { language, name } = req.body;

    if (!language || !name) {
      return res.status(400).json({ error: 'language and name are required' });
    }

    const mandal = await prisma.mandal.findUnique({ where: { id } });
    if (!mandal) {
      return res.status(404).json({ error: 'Mandal not found' });
    }

    const existing = await prisma.mandalTranslation.findFirst({
      where: { mandalId: id, language }
    });

    if (existing) {
      await prisma.mandalTranslation.update({
        where: { id: existing.id },
        data: { name }
      });
    } else {
      await prisma.mandalTranslation.create({
        data: { mandalId: id, language, name }
      });
    }

    const result = await prisma.mandal.findUnique({
      where: { id },
      include: { translations: true }
    });

    return res.json({ success: true, mandal: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update translation', message: error.message });
  }
});

/**
 * @swagger
 * /location/villages:
 *   post:
 *     summary: Manually create a village with translations
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, mandalId]
 *             properties:
 *               name: {type: string, example: "Gachibowli"}
 *               mandalId: {type: string}
 *               translations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     language: {type: string, example: "te"}
 *                     name: {type: string, example: "గచ్చిబౌలి"}
 *     responses:
 *       201:
 *         description: Village created successfully
 */
router.post('/villages', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { name, mandalId, tenantId, translations } = req.body;

    if (!name || !mandalId || !tenantId) {
      return res.status(400).json({ error: 'name, mandalId, and tenantId are required' });
    }

    const mandal = await prisma.mandal.findUnique({ where: { id: mandalId } });
    if (!mandal) {
      return res.status(404).json({ error: 'Mandal not found' });
    }

    const existing = await (prisma as any).village.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        mandalId,
        tenantId,
        isDeleted: false
      }
    });

    if (existing) {
      return res.status(409).json({ error: 'Village already exists', villageId: existing.id });
    }

    const village = await (prisma as any).village.create({
      data: { name: name.trim(), mandalId, tenantId, isDeleted: false }
    });

    if (Array.isArray(translations)) {
      for (const trans of translations) {
        if (trans.language && trans.name) {
          await prisma.villageTranslation.create({
            data: {
              villageId: village.id,
              language: trans.language,
              name: trans.name
            }
          }).catch(() => {});
        }
      }
    }

    const result = await (prisma as any).village.findUnique({
      where: { id: village.id },
      include: { translations: true }
    });

    return res.status(201).json({ success: true, village: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to create village', message: error.message });
  }
});

/**
 * @swagger
 * /location/villages/{id}/translations:
 *   put:
 *     summary: Update village translation
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: {type: string}
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [language, name]
 *             properties:
 *               language: {type: string, example: "te"}
 *               name: {type: string, example: "గచ్చిబౌలి"}
 *     responses:
 *       200:
 *         description: Translation updated
 */
router.put('/villages/:id/translations', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { language, name } = req.body;

    if (!language || !name) {
      return res.status(400).json({ error: 'language and name are required' });
    }

    const village = await (prisma as any).village.findUnique({ where: { id } });
    if (!village) {
      return res.status(404).json({ error: 'Village not found' });
    }

    const existing = await prisma.villageTranslation.findFirst({
      where: { villageId: id, language }
    });

    if (existing) {
      await prisma.villageTranslation.update({
        where: { id: existing.id },
        data: { name }
      });
    } else {
      await prisma.villageTranslation.create({
        data: { villageId: id, language, name }
      });
    }

    const result = await (prisma as any).village.findUnique({
      where: { id },
      include: { translations: true }
    });

    return res.json({ success: true, village: result });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to update translation', message: error.message });
  }
});

/**
 * @swagger
 * /location/manual/states/{stateId}/translations/languages:
 *   delete:
 *     summary: Delete specific language translations for entire state hierarchy
 *     description: Removes all translations for specified languages from State, Districts, Mandals, and Villages under this state. Example - Remove Hindi and Kannada translations from all Telangana locations.
 *     tags: [Location Manual Management]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: stateId
 *         required: true
 *         schema: {type: string}
 *         description: State ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [languages]
 *             properties:
 *               languages:
 *                 type: array
 *                 items: {type: string}
 *                 example: ["hi", "ka"]
 *                 description: Language codes to delete (e.g., ["hi", "ka"] to remove Hindi and Kannada)
 *     responses:
 *       200:
 *         description: Translations deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: {type: boolean}
 *                 message: {type: string}
 *                 deleted:
 *                   type: object
 *                   properties:
 *                     stateTranslations: {type: number}
 *                     districtTranslations: {type: number}
 *                     mandalTranslations: {type: number}
 *                     villageTranslations: {type: number}
 *                     totalDeleted: {type: number}
 */
router.delete('/states/:stateId/translations/languages', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { stateId } = req.params;
    const { languages } = req.body;

    if (!Array.isArray(languages) || languages.length === 0) {
      return res.status(400).json({ error: 'languages array is required and must not be empty' });
    }

    // Verify state exists
    const state = await prisma.state.findUnique({ where: { id: stateId } });
    if (!state) {
      return res.status(404).json({ error: 'State not found' });
    }

    // Get all districts for this state
    const districts = await prisma.district.findMany({
      where: { stateId, isDeleted: false },
      select: { id: true }
    });
    const districtIds = districts.map(d => d.id);

    // Get all mandals for these districts
    const mandals = await prisma.mandal.findMany({
      where: { districtId: { in: districtIds }, isDeleted: false },
      select: { id: true }
    });
    const mandalIds = mandals.map(m => m.id);

    // Get all villages for these mandals
    const villages = await (prisma as any).village.findMany({
      where: { mandalId: { in: mandalIds }, isDeleted: false },
      select: { id: true }
    });
    const villageIds = villages.map((v: any) => v.id);

    // Delete translations for all hierarchy levels
    const [stateDeleted, districtDeleted, mandalDeleted, villageDeleted] = await Promise.all([
      // Delete state translations
      prisma.stateTranslation.deleteMany({
        where: { stateId, language: { in: languages } }
      }),
      
      // Delete district translations
      prisma.districtTranslation.deleteMany({
        where: { districtId: { in: districtIds }, language: { in: languages } }
      }),
      
      // Delete mandal translations
      prisma.mandalTranslation.deleteMany({
        where: { mandalId: { in: mandalIds }, language: { in: languages } }
      }),
      
      // Delete village translations
      prisma.villageTranslation.deleteMany({
        where: { villageId: { in: villageIds }, language: { in: languages } }
      })
    ]);

    const totalDeleted = 
      stateDeleted.count + 
      districtDeleted.count + 
      mandalDeleted.count + 
      villageDeleted.count;

    return res.json({
      success: true,
      message: `Deleted ${languages.join(', ')} translations for ${state.name} and all child locations`,
      deleted: {
        stateTranslations: stateDeleted.count,
        districtTranslations: districtDeleted.count,
        mandalTranslations: mandalDeleted.count,
        villageTranslations: villageDeleted.count,
        totalDeleted
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete translations', message: error.message });
  }
});

/**
 * @swagger
 * /location/smart-add:
 *   post:
 *     summary: AI-powered location creation (auto-detects district/mandal)
 *     description: |
 *       Smart endpoint that uses AI to:
 *       - Identify if area is district or mandal
 *       - Find correct parent (state/district)
 *       - Auto-translate to tenant language if Telugu
 *       - Create location with translations
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [areaName]
 *             properties:
 *               areaName:
 *                 type: string
 *                 example: "Kamareddy"
 *                 description: Name of area to add (English)
 *               stateId:
 *                 type: string
 *                 description: State ID (required for districts, optional for mandals if parentDistrictName provided)
 *               stateName:
 *                 type: string
 *                 description: State name (alternative to stateId)
 *                 example: "Telangana"
 *               languageCode:
 *                 type: string
 *                 description: Language code for translation (default 'en')
 *                 example: "te"
 *                 enum: [en, te, hi, kn, ta, ml]
 *               forceType:
 *                 type: string
 *                 enum: [district, mandal]
 *                 description: Override AI detection (optional)
 *               parentDistrictName:
 *                 type: string
 *                 description: For mandals - specify parent district name (optional, AI will detect if not provided)
 *     responses:
 *       201:
 *         description: Location created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: {type: boolean}
 *                 type: {type: string, example: "district"}
 *                 location: {type: object}
 *                 translation: {type: object}
 *       400:
 *         description: Validation error or AI detection failed
 *       409:
 *         description: Location already exists
 */
router.post('/smart-add', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { areaName, stateId, stateName, languageCode, forceType, parentDistrictName } = req.body;

    if (!areaName) {
      return res.status(400).json({ error: 'areaName is required' });
    }

    // Get state (can be inferred from parentDistrictName for mandals)
    let state;
    
    if (stateId || stateName) {
      // State provided directly
      if (stateId) {
        state = await prisma.state.findUnique({
          where: { id: stateId },
          include: { translations: true }
        });
      } else {
        state = await prisma.state.findFirst({
          where: { name: { equals: stateName.trim(), mode: 'insensitive' } },
          include: { translations: true }
        });
      }
      
      if (!state) {
        return res.status(404).json({ error: 'State not found' });
      }
    } else if (parentDistrictName) {
      // For mandals: infer state from parent district
      const parentDistrict = await prisma.district.findFirst({
        where: {
          name: { equals: parentDistrictName.trim(), mode: 'insensitive' },
          isDeleted: false
        },
        include: { 
          state: { include: { translations: true } }
        }
      });
      
      if (!parentDistrict) {
        return res.status(404).json({ 
          error: 'Parent district not found',
          hint: 'Provide stateId/stateName along with parentDistrictName'
        });
      }
      
      state = parentDistrict.state;
    } else {
      return res.status(400).json({ 
        error: 'Either stateId/stateName or parentDistrictName is required',
        hint: 'For districts: provide stateId/stateName. For mandals: provide parentDistrictName (state will be inferred)'
      });
    }

    const stateName_actual = state.name;

    // Determine translation language (default to English)
    const targetLanguage = languageCode?.toLowerCase() || 'en';
    const needsTranslation = targetLanguage !== 'en';

    // Step 1: AI detection - is it district or mandal?
    let locationType = typeof forceType === 'string' ? forceType.trim().toLowerCase() : forceType;
    if (locationType && !['district', 'mandal'].includes(locationType)) {
      return res.status(400).json({
        error: 'Invalid forceType. Use "district" or "mandal" (case-insensitive).',
        received: forceType,
      });
    }
    let parentDistrictId: string | null = null;
    let translatedName: string | null = null;

    if (!locationType) {
      const detectionPrompt = `You are a location classifier for Indian administrative divisions.
      
State: ${stateName_actual}
Area Name: ${areaName}

Determine if "${areaName}" is a DISTRICT or MANDAL (sub-district) in ${stateName_actual} state.

Respond ONLY with valid JSON in this exact format:
{
  "type": "district" or "mandal",
  "confidence": "high" or "medium" or "low",
  "reasoning": "brief explanation"
}`;

      const aiResponse = await aiGenerateText({
        prompt: detectionPrompt,
        purpose: 'translation'
      });

      try {
        // Strip markdown code blocks if present
        let cleanResponse = aiResponse.text.trim();
        cleanResponse = cleanResponse.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
        
        const detection = JSON.parse(cleanResponse);
        locationType = typeof detection.type === 'string' ? detection.type.trim().toLowerCase() : detection.type;
        
        if (!['district', 'mandal'].includes(locationType)) {
          return res.status(400).json({ 
            error: 'AI could not determine location type',
            aiResponse: detection 
          });
        }

        if (detection.confidence === 'low') {
          return res.status(400).json({
            error: 'Low confidence in AI detection. Please specify forceType manually.',
            suggestion: detection
          });
        }
      } catch (e) {
        return res.status(500).json({ 
          error: 'Failed to parse AI response',
          aiResponse: aiResponse.text 
        });
      }
    }

    // Step 2: If mandal, find parent district
    if (locationType === 'mandal') {
      if (parentDistrictName) {
        const district = await prisma.district.findFirst({
          where: {
            stateId: state.id,
            name: { equals: parentDistrictName.trim(), mode: 'insensitive' },
            isDeleted: false
          }
        });
        if (!district) {
          return res.status(404).json({ error: 'Parent district not found', district: parentDistrictName });
        }
        parentDistrictId = district.id;
      } else {
        // AI detection of parent district
        const districts = await prisma.district.findMany({
          where: { stateId: state.id, isDeleted: false },
          select: { id: true, name: true }
        });

        const districtDetectionPrompt = `You are helping identify which district a mandal belongs to.

State: ${stateName_actual}
Mandal Name: ${areaName}
Available Districts: ${districts.map(d => d.name).join(', ')}

Which district does "${areaName}" mandal belong to?

Respond ONLY with valid JSON:
{
  "districtName": "exact district name from the list",
  "confidence": "high" or "medium" or "low"
}`;

        const districtAI = await aiGenerateText({
          prompt: districtDetectionPrompt,
          purpose: 'translation'
        });

        try {
          // Strip markdown code blocks if present
          let cleanResponse = districtAI.text.trim();
          cleanResponse = cleanResponse.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
          
          const districtResult = JSON.parse(cleanResponse);
          const foundDistrict = districts.find(d => 
            d.name.toLowerCase() === districtResult.districtName.toLowerCase()
          );

          if (!foundDistrict) {
            return res.status(400).json({
              error: 'Could not auto-detect parent district. Please provide parentDistrictName.',
              aiSuggestion: districtResult
            });
          }

          parentDistrictId = foundDistrict.id;
        } catch (e) {
          return res.status(400).json({
            error: 'Parent district detection failed. Please provide parentDistrictName.',
            aiResponse: districtAI.text
          });
        }
      }
    }

    // Step 3: Get translation if needed
    if (needsTranslation) {
      const languageMap: { [key: string]: string } = {
        'te': 'Telugu',
        'hi': 'Hindi',
        'kn': 'Kannada',
        'ta': 'Tamil',
        'ml': 'Malayalam'
      };
      
      const targetLanguageName = languageMap[targetLanguage] || targetLanguage.toUpperCase();
      
      const translationPrompt = `Translate this location name to ${targetLanguageName} script:

English: ${areaName}
Location Type: ${locationType}
State: ${stateName_actual}

Provide ONLY the ${targetLanguageName} translation, nothing else. Use proper ${targetLanguageName} script.`;

      const translationAI = await aiGenerateText({
        prompt: translationPrompt,
        purpose: 'translation'
      });

      translatedName = translationAI.text.trim().replace(/['"]/g, '');
    }

    // Step 4: Create location
    if (locationType === 'district') {
      // Check if exists
      const existing = await prisma.district.findFirst({
        where: {
          name: { equals: areaName.trim(), mode: 'insensitive' },
          stateId: state.id,
          isDeleted: false
        }
      });

      if (existing) {
        return res.status(409).json({ 
          error: 'District already exists',
          districtId: existing.id 
        });
      }

      const district = await prisma.district.create({
        data: { 
          name: areaName.trim(),
          stateId: state.id,
          isDeleted: false 
        }
      });

      // Add translation
      let translation = null;
      if (translatedName) {
        translation = await prisma.districtTranslation.create({
          data: {
            districtId: district.id,
            language: targetLanguage,
            name: translatedName
          }
        });
      }

      const result = await prisma.district.findUnique({
        where: { id: district.id },
        include: { translations: true, state: true }
      });

      return res.status(201).json({
        success: true,
        type: 'district',
        location: result,
        translation: translation,
        aiDetected: !forceType
      });

    } else {
      // Create mandal
      if (!parentDistrictId) {
        return res.status(400).json({
          error: 'Parent district is required to create a mandal',
          hint: 'Provide parentDistrictName (and optionally stateId/stateName) or omit forceType to auto-detect',
        });
      }
      const existing = await prisma.mandal.findFirst({
        where: {
          name: { equals: areaName.trim(), mode: 'insensitive' },
          districtId: parentDistrictId,
          isDeleted: false
        }
      });

      if (existing) {
        return res.status(409).json({
          error: 'Mandal already exists',
          mandalId: existing.id
        });
      }

      const mandal = await prisma.mandal.create({
        data: {
          name: areaName.trim(),
          districtId: parentDistrictId,
          isDeleted: false
        }
      });

      // Add translation
      let translation = null;
      if (translatedName) {
        translation = await prisma.mandalTranslation.create({
          data: {
            mandalId: mandal.id,
            language: targetLanguage,
            name: translatedName
          }
        });
      }

      const result = await prisma.mandal.findUnique({
        where: { id: mandal.id },
        include: { translations: true, district: true }
      });

      return res.status(201).json({
        success: true,
        type: 'mandal',
        location: result,
        translation: translation,
        aiDetected: !forceType
      });
    }

  } catch (error: any) {
    console.error('Smart location add error:', error);
    return res.status(500).json({ 
      error: 'Failed to create location',
      message: error.message 
    });
  }
});

export default router;