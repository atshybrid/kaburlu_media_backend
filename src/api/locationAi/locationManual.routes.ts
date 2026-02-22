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
 *     security: [{bearerAuth: []}]
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
 *       - Accept location names in any language (English, Telugu, Hindi, etc.)
 *       - Auto-translate to English for primary record if input is non-English
 *       - Create translation records for the original language
 *       - Identify if area is district or mandal
 *       - Find correct parent (state/district) across all states
 *       - Auto-detect parent district for mandals
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
 *                 example: "పెండ్లిమర్రి"
 *                 description: Name of area to add (can be in any language - English, Telugu, Hindi, etc.)
 *               stateId:
 *                 type: string
 *                 description: State ID (required for districts, optional for mandals if parentDistrictName provided)
 *               stateName:
 *                 type: string
 *                 description: State name (alternative to stateId)
 *                 example: "Telangana"
 *               languageCode:
 *                 type: string
 *                 description: Language code of the input areaName (default 'en'). Used to create translation records.
 *                 example: "te"
 *                 enum: [en, te, hi, kn, ta, ml]
 *               forceType:
 *                 type: string
 *                 enum: [district, mandal]
 *                 description: Override AI detection (optional)
 *               parentDistrictName:
 *                 type: string
 *                 description: For mandals - specify parent district name (searches across all states)
 *                 example: "YSR Kadapa"
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
      // Search across all states or within provided state if specified
      const districtWhere: any = {
        name: { equals: parentDistrictName.trim(), mode: 'insensitive' },
        isDeleted: false
      };
      
      // If stateName was provided, prefer districts in that state but don't make it exclusive
      const parentDistrict = await prisma.district.findFirst({
        where: districtWhere,
        include: { 
          state: { include: { translations: true } }
        }
      });
      
      if (!parentDistrict) {
        return res.status(404).json({ 
          error: 'Parent district not found',
          district: parentDistrictName,
          hint: 'Make sure the district name is spelled correctly'
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

    // Determine input language and prepare for translation
    const targetLanguage = languageCode?.toLowerCase() || 'en';
    
    // Detect if input is in non-English script (Telugu, Hindi, etc.)
    const isNonEnglishInput = /[^\x00-\x7F]/.test(areaName); // Contains non-ASCII characters
    
    let englishName = areaName.trim();
    let translatedName: string | null = null;
    
    // If input is non-English, translate TO English for primary record
    if (isNonEnglishInput && targetLanguage !== 'en') {
      const languageMap: { [key: string]: string } = {
        'te': 'Telugu',
        'hi': 'Hindi',
        'kn': 'Kannada',
        'ta': 'Tamil',
        'ml': 'Malayalam'
      };
      
      const sourceLanguageName = languageMap[targetLanguage] || targetLanguage.toUpperCase();
      
      const toEnglishPrompt = `Translate this ${sourceLanguageName} location name to English:

${sourceLanguageName}: ${areaName}
State: ${stateName_actual}

Provide ONLY the English name, nothing else. Use proper English spelling.`;

      const englishAI = await aiGenerateText({
        prompt: toEnglishPrompt,
        purpose: 'translation'
      });

      englishName = englishAI.text.trim().replace(/['"]/g, '');
      translatedName = areaName.trim(); // Original input becomes the translation
    }

    // Step 1: AI detection - is it district or mandal?
    let locationType = typeof forceType === 'string' ? forceType.trim().toLowerCase() : forceType;
    if (locationType && !['district', 'mandal'].includes(locationType)) {
      return res.status(400).json({
        error: 'Invalid forceType. Use "district" or "mandal" (case-insensitive).',
        received: forceType,
      });
    }
    let parentDistrictId: string | null = null;

    if (!locationType) {
      const detectionPrompt = `You are a location classifier for Indian administrative divisions.
      
State: ${stateName_actual}
Area Name: ${englishName}

Determine if "${englishName}" is a DISTRICT or MANDAL (sub-district) in ${stateName_actual} state.

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
Mandal Name: ${englishName}
Available Districts: ${districts.map(d => d.name).join(', ')}

Which district does "${englishName}" mandal belong to?

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

    // Step 3: Create location with English name
    if (locationType === 'district') {
      // Check if exists
      const existing = await prisma.district.findFirst({
        where: {
          name: { equals: englishName, mode: 'insensitive' },
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
          name: englishName,
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
          name: { equals: englishName, mode: 'insensitive' },
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
          name: englishName,
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

/**
 * @swagger
 * /location/smart-add-district:
 *   post:
 *     summary: Add a new district and auto-move its mandals from old districts
 *     description: |
 *       When a new district is created (e.g. AP reorganisation):
 *       1. Creates the district in DB (or finds existing)
 *       2. Uses AI to get the official mandal list for that district
 *       3. Verifies each mandal using Google Places API
 *       4. Moves verified mandals from wrong districts → new district
 *       5. Deduplicates any resulting duplicate rows
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [districtName, stateName]
 *             properties:
 *               districtName:
 *                 type: string
 *                 example: "Anakapalli"
 *               stateName:
 *                 type: string
 *                 example: "Andhra Pradesh"
 *               translations:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     language: {type: string, example: "te"}
 *                     name: {type: string, example: "అనకాపల్లి"}
 *               skipGoogleVerify:
 *                 type: boolean
 *                 description: Skip Google Places verification (use AI only). Default false.
 *     responses:
 *       200:
 *         description: District processed with mandal move results
 */
router.post('/smart-add-district', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { districtName, stateName, translations, skipGoogleVerify = false } = req.body;

    if (!districtName || !stateName) {
      return res.status(400).json({ error: 'districtName and stateName are required' });
    }

    // ── 1. Find state ────────────────────────────────────────────────
    const state = await prisma.state.findFirst({
      where: { name: { equals: stateName.trim(), mode: 'insensitive' } },
    });
    if (!state) {
      return res.status(404).json({ error: `State "${stateName}" not found` });
    }

    // ── 2. Ensure district exists ────────────────────────────────────
    let district = await prisma.district.findFirst({
      where: { name: { equals: districtName.trim(), mode: 'insensitive' }, stateId: state.id },
    });
    let districtCreated = false;
    if (!district) {
      district = await prisma.district.create({
        data: { name: districtName.trim(), stateId: state.id, isDeleted: false },
      });
      districtCreated = true;
    }

    // Upsert translations
    if (Array.isArray(translations)) {
      for (const t of translations) {
        if (t.language && t.name) {
          await prisma.districtTranslation.upsert({
            where: { districtId_language: { districtId: district.id, language: t.language } },
            update: { name: t.name },
            create: { districtId: district.id, language: t.language, name: t.name },
          }).catch(() => {});
        }
      }
    }

    // ── 3. AI → get official mandal list for this district ───────────
    const aiPrompt = `List ALL mandals (administrative sub-divisions / tehsils) in ${districtName.trim()} district, ${stateName.trim()}, India.
Return ONLY a JSON array of English mandal names. No explanation. No extra text.
Example: ["Mandal1", "Mandal2", "Mandal3"]`;

    const aiResponse = await aiGenerateText({ prompt: aiPrompt, purpose: 'translation' });
    let aiMandals: string[] = [];
    try {
      let clean = aiResponse.text.trim().replace(/^```json\s*/i, '').replace(/\n?```\s*$/i, '');
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed)) aiMandals = parsed.map((m: any) => String(m).trim()).filter(Boolean);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON for mandal list', raw: aiResponse.text });
    }

    if (aiMandals.length === 0) {
      return res.status(400).json({ error: 'AI returned empty mandal list', raw: aiResponse.text });
    }

    // ── 4. Optional Google Places verification ───────────────────────
    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    const verifiedMandals: string[] = [];
    const unverifiedMandals: string[] = [];

    if (!skipGoogleVerify && googleApiKey) {
      for (const mandalName of aiMandals) {
        try {
          const query = encodeURIComponent(`${mandalName} mandal, ${districtName}, ${stateName}, India`);
          const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${googleApiKey}`;
          const resp = await fetch(url);
          const data: any = await resp.json();

          if (data.status === 'OK' && data.results?.length > 0) {
            // Check if result contains our district or state in address components
            const addressComponents: any[] = data.results[0]?.address_components || [];
            const hasState = addressComponents.some((c: any) =>
              c.long_name?.toLowerCase().includes(stateName.toLowerCase()) ||
              c.short_name?.toLowerCase().includes(stateName.toLowerCase())
            );
            if (hasState) {
              verifiedMandals.push(mandalName);
            } else {
              unverifiedMandals.push(mandalName);
            }
          } else {
            unverifiedMandals.push(mandalName);
          }
        } catch {
          unverifiedMandals.push(mandalName);
        }
      }
    } else {
      // No Google key or skip → trust AI list entirely
      verifiedMandals.push(...aiMandals);
    }

    const mandalsToProcess = verifiedMandals.length > 0 ? verifiedMandals : aiMandals;

    // ── 5. Move mandals from wrong districts → this district ─────────
    const results: { mandal: string; action: 'moved' | 'created' | 'already_correct' | 'error'; from?: string; error?: string }[] = [];

    for (const mandalName of mandalsToProcess) {
      try {
        const allInState = await prisma.mandal.findMany({
          where: { name: { equals: mandalName, mode: 'insensitive' }, district: { stateId: state.id } },
          include: { district: { select: { name: true, id: true } } },
        });

        if (allInState.length === 0) {
          // Not in DB yet → create
          await prisma.mandal.create({ data: { name: mandalName, districtId: district.id, isDeleted: false } });
          results.push({ mandal: mandalName, action: 'created' });
        } else {
          const correctOnes = allInState.filter(m => m.districtId === district.id);
          const wrongOnes = allInState.filter(m => m.districtId !== district.id);

          if (correctOnes.length > 0 && wrongOnes.length === 0) {
            results.push({ mandal: mandalName, action: 'already_correct' });
          } else {
            for (const m of wrongOnes) {
              await prisma.mandal.update({ where: { id: m.id }, data: { districtId: district.id } });
              results.push({ mandal: mandalName, action: 'moved', from: m.district.name });
            }
          }

          // ── 6. Deduplicate ───────────────────────────────────────────
          const afterMove = await prisma.mandal.findMany({
            where: { name: { equals: mandalName, mode: 'insensitive' }, districtId: district.id },
            orderBy: { id: 'asc' },
          });
          if (afterMove.length > 1) {
            const [, ...dups] = afterMove;
            for (const dup of dups) {
              await prisma.mandalTranslation.deleteMany({ where: { mandalId: dup.id } });
              await prisma.mandal.delete({ where: { id: dup.id } });
            }
          }
        }
      } catch (err: any) {
        results.push({ mandal: mandalName, action: 'error', error: err.message });
      }
    }

    // ── 7. Summary ───────────────────────────────────────────────────
    const summary = {
      moved: results.filter(r => r.action === 'moved').length,
      created: results.filter(r => r.action === 'created').length,
      already_correct: results.filter(r => r.action === 'already_correct').length,
      errors: results.filter(r => r.action === 'error').length,
    };

    const districtResult = await prisma.district.findUnique({
      where: { id: district.id },
      include: { translations: true, _count: { select: { mandals: true } } },
    });

    return res.status(districtCreated ? 201 : 200).json({
      success: true,
      districtCreated,
      district: districtResult,
      aiMandalsCount: aiMandals.length,
      googleVerified: !skipGoogleVerify && googleApiKey ? verifiedMandals.length : null,
      googleUnverified: !skipGoogleVerify && googleApiKey ? unverifiedMandals.length : null,
      summary,
      details: results,
    });

  } catch (error: any) {
    console.error('smart-add-district error:', error);
    return res.status(500).json({ error: 'Failed to process district', message: error.message });
  }
});

/**
 * @swagger
 * /location/move-mandals:
 *   post:
 *     summary: Move one or many mandals to a different district
 *     description: |
 *       Move mandals from any wrong district to the correct target district.
 *       Supports single or bulk moves in one call.
 *       Automatically deduplicates if the same mandal already exists in target district.
 *     tags: [Location AI]
 *     security: [{bearerAuth: []}]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mandals, targetDistrict, stateName]
 *             properties:
 *               mandals:
 *                 type: array
 *                 description: One or more mandal names to move
 *                 items:
 *                   type: string
 *                 example: ["Kasimkota", "Munagapaka", "Paravada"]
 *               targetDistrict:
 *                 type: string
 *                 description: District name to move mandals into
 *                 example: "Anakapalli"
 *               stateName:
 *                 type: string
 *                 description: State name (to scope search)
 *                 example: "Andhra Pradesh"
 *     responses:
 *       200:
 *         description: Move results with summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: {type: boolean}
 *                 targetDistrict: {type: string}
 *                 summary:
 *                   type: object
 *                   properties:
 *                     moved: {type: number}
 *                     already_correct: {type: number}
 *                     not_found: {type: number}
 *                     errors: {type: number}
 *                 details:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       mandal: {type: string}
 *                       action: {type: string, enum: [moved, already_correct, not_found, error]}
 *                       from: {type: string}
 *                       error: {type: string}
 */
router.post('/move-mandals', auth, requireSuperOrTenantAdmin, async (req, res) => {
  try {
    const { mandals, targetDistrict, stateName } = req.body;

    // ── Validate input ───────────────────────────────────────────────
    if (!mandals || !Array.isArray(mandals) || mandals.length === 0) {
      return res.status(400).json({ error: 'mandals must be a non-empty array' });
    }
    if (!targetDistrict) {
      return res.status(400).json({ error: 'targetDistrict is required' });
    }
    if (!stateName) {
      return res.status(400).json({ error: 'stateName is required' });
    }

    // ── Find state ───────────────────────────────────────────────────
    const state = await prisma.state.findFirst({
      where: { name: { equals: stateName.trim(), mode: 'insensitive' } },
    });
    if (!state) {
      return res.status(404).json({ error: `State "${stateName}" not found` });
    }

    // ── Find target district ─────────────────────────────────────────
    const district = await prisma.district.findFirst({
      where: {
        name: { equals: targetDistrict.trim(), mode: 'insensitive' },
        stateId: state.id,
        isDeleted: false,
      },
    });
    if (!district) {
      // Show available districts to help
      const available = await prisma.district.findMany({
        where: { stateId: state.id, isDeleted: false },
        select: { name: true },
        orderBy: { name: 'asc' },
      });
      return res.status(404).json({
        error: `District "${targetDistrict}" not found in ${stateName}`,
        availableDistricts: available.map(d => d.name),
      });
    }

    // ── Process each mandal ──────────────────────────────────────────
    const details: { mandal: string; action: string; from?: string; error?: string }[] = [];

    for (const rawName of mandals) {
      const mandalName = String(rawName).trim();
      if (!mandalName) continue;

      try {
        // Find all rows with this name in the state
        const found = await prisma.mandal.findMany({
          where: {
            name: { equals: mandalName, mode: 'insensitive' },
            district: { stateId: state.id },
            isDeleted: false,
          },
          include: { district: { select: { id: true, name: true } } },
        });

        if (found.length === 0) {
          details.push({ mandal: mandalName, action: 'not_found' });
          continue;
        }

        const alreadyCorrect = found.filter(m => m.districtId === district.id);
        const wrongOnes = found.filter(m => m.districtId !== district.id);

        if (wrongOnes.length === 0) {
          details.push({ mandal: mandalName, action: 'already_correct' });
          continue;
        }

        // Move all wrong ones
        for (const m of wrongOnes) {
          await prisma.mandal.update({
            where: { id: m.id },
            data: { districtId: district.id },
          });
          details.push({ mandal: mandalName, action: 'moved', from: m.district.name });
        }

        // Deduplicate: keep the one with most translations
        const afterMove = await prisma.mandal.findMany({
          where: {
            name: { equals: mandalName, mode: 'insensitive' },
            districtId: district.id,
          },
          include: { translations: { select: { id: true } } },
          orderBy: { id: 'asc' },
        });

        if (afterMove.length > 1) {
          // Keep row with most translations, else keep oldest (first id)
          afterMove.sort((a, b) => b.translations.length - a.translations.length || a.id.localeCompare(b.id));
          const [, ...dups] = afterMove;
          for (const dup of dups) {
            await prisma.mandalTranslation.deleteMany({ where: { mandalId: dup.id } });
            await prisma.mandal.delete({ where: { id: dup.id } });
          }
        }

      } catch (err: any) {
        details.push({ mandal: mandalName, action: 'error', error: err.message });
      }
    }

    // ── Summary ──────────────────────────────────────────────────────
    const summary = {
      moved:           details.filter(d => d.action === 'moved').length,
      already_correct: details.filter(d => d.action === 'already_correct').length,
      not_found:       details.filter(d => d.action === 'not_found').length,
      errors:          details.filter(d => d.action === 'error').length,
    };

    const districtResult = await prisma.district.findUnique({
      where: { id: district.id },
      select: { id: true, name: true, _count: { select: { mandals: true } } },
    });

    return res.json({
      success: true,
      targetDistrict: districtResult,
      summary,
      details,
    });

  } catch (error: any) {
    console.error('move-mandals error:', error);
    return res.status(500).json({ error: 'Failed to move mandals', message: error.message });
  }
});

export default router;
