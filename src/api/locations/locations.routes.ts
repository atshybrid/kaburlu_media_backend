
import { Router } from 'express';
import multer from 'multer';
import * as locationService from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto';
import { PrismaClient } from '@prisma/client';
import passport from 'passport';
import { requireSuperOrTenantAdmin } from '../middlewares/authz';

const router = Router();
const upload = multer({ dest: 'uploads/' });
const prisma = new PrismaClient();

function normalizeLangCode(raw?: string | null): string {
    const v = raw ? String(raw).trim().toLowerCase() : '';
    if (v === 'te' || v === 'telugu') return 'te';
    if (v === 'hi' || v === 'hindi') return 'hi';
    if (v === 'en' || v === 'english') return 'en';
    return '';
}

async function getUserLanguageCodeFromAuth(req: any): Promise<string> {
    // Optional auth: if Authorization token exists, try passport JWT.
    const hasAuth = !!req.headers?.authorization;
    if (!hasAuth) return '';

    const user = await new Promise<any>((resolve) => {
        (passport as any).authenticate('jwt', { session: false }, (_err: any, u: any) => resolve(u || null))(req, null, () => resolve(null));
    });
    const languageId = user?.languageId ? String(user.languageId) : '';
    if (!languageId) return '';
    const langRow = await (prisma as any).language.findUnique({ where: { id: languageId }, select: { code: true } }).catch(() => null);
    return normalizeLangCode(langRow?.code || '');
}

async function loadTranslationsByIds(params: {
    lang: string;
    stateIds: string[];
    districtIds: string[];
    mandalIds: string[];
    villageIds: string[];
}): Promise<{ states: Record<string, string>; districts: Record<string, string>; mandals: Record<string, string>; villages: Record<string, string> }> {
    const lang = normalizeLangCode(params.lang);
    if (!lang || lang === 'en') return { states: {}, districts: {}, mandals: {}, villages: {} };

    const [st, ds, md, vg] = await Promise.all([
        params.stateIds.length
            ? (prisma as any).stateTranslation.findMany({ where: { language: lang, stateId: { in: params.stateIds } }, select: { stateId: true, name: true } })
            : Promise.resolve([]),
        params.districtIds.length
            ? (prisma as any).districtTranslation.findMany({ where: { language: lang, districtId: { in: params.districtIds } }, select: { districtId: true, name: true } })
            : Promise.resolve([]),
        params.mandalIds.length
            ? (prisma as any).mandalTranslation.findMany({ where: { language: lang, mandalId: { in: params.mandalIds } }, select: { mandalId: true, name: true } })
            : Promise.resolve([]),
        params.villageIds.length
            ? (prisma as any).villageTranslation.findMany({ where: { language: lang, villageId: { in: params.villageIds } }, select: { villageId: true, name: true } })
            : Promise.resolve([]),
    ]);

    const states: Record<string, string> = {};
    const districts: Record<string, string> = {};
    const mandals: Record<string, string> = {};
    const villages: Record<string, string> = {};
    for (const r of st || []) states[String(r.stateId)] = String(r.name);
    for (const r of ds || []) districts[String(r.districtId)] = String(r.name);
    for (const r of md || []) mandals[String(r.mandalId)] = String(r.name);
    for (const r of vg || []) villages[String(r.villageId)] = String(r.name);

    return { states, districts, mandals, villages };
}

/**
 * @swagger
 * tags:
 *   name: Locations
 *   description: Location management
 */

/**
 * @swagger
 * /locations:
 *   post:
 *     summary: Create a new location
 *     tags: [Locations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateLocationDto'
 *     responses:
 *       201:
 *         description: The created location.
 */
router.post('/', async (req, res) => {
    try {
        const location = await locationService.createLocation(req.body as CreateLocationDto);
        res.status(201).json(location);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});


/**
 * @swagger
 * /locations:
 *   get:
 *     summary: Get all locations
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: The page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: The number of items to return
 *     responses:
 *       200:
 *         description: A list of locations.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Location'
 */
router.get('/', async (req, res) => {
    const { page, limit } = req.query;
    const options = {
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
    };
    const locations = await locationService.findAllLocations(options);
    res.json(locations);
});

/**
 * @swagger
 * /locations/search:
 *   get:
 *     summary: Search geo locations (village/mandal/district/state)
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search term (e.g., "ఆదిలాబాద్" or "Adilabad")
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *       - in: query
 *         name: types
 *         schema: { type: string }
 *         description: "Optional comma-separated types: STATE,DISTRICT,MANDAL"
 *       - in: query
 *         name: includeVillage
 *         schema: { type: boolean, default: false }
 *         description: If true, returns a VILLAGE suggestion using the raw query.
 *     responses:
 *       200:
 *         description: Matching geo entities
 */
router.get('/search', async (req, res) => {
    try {
        const q = String((req.query.q as any) || '').trim();
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const typesRaw = String((req.query.types as any) || '').trim();
        const includeVillage = String((req.query.includeVillage as any) || '').toLowerCase() === 'true';
        const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
        const types = typesRaw ? typesRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

        if (!q) return res.status(400).json({ error: 'q is required' });

        const items = await locationService.searchGeoLocations({ q, limit, types, includeVillage, tenantId });
        return res.json({ q, count: items.length, items });
    } catch (e: any) {
        console.error('GET /locations/search error', e);
        return res.status(500).json({ error: 'Failed to search locations' });
    }
});

/**
 * @swagger
 * /locations/search-combined:
 *   get:
 *     summary: Combined location search (village/mandal/district/state with hierarchy)
 *     description: |
 *       Searches by name across State, District, Mandal and Village.
 *
 *       Each result includes the full hierarchy (state → district → mandal → village) with both `id` and `name`.
 *       If the caller is authenticated and their profile language is Telugu/Hindi, responses also include a `names` object
 *       for each hierarchy node: `{ en: string, te?: string|null, hi?: string|null }`.
 *       This is intended for UI selection in public reporter join flows.
 *
 *       Notes:
 *       - Villages are tenant-scoped; pass `tenantId` to search villages for a specific tenant.
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search term (e.g., "adil" or "ఆదిల")
 *       - in: query
 *         name: tenantId
 *         required: false
 *         schema: { type: string }
 *         description: Optional; when provided, village search is restricted to that tenant.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Matching locations with hierarchy
 *         content:
 *           application/json:
 *             examples:
 *               villageMatch:
 *                 value:
 *                   q: "Bodhan"
 *                   lang: "en"
 *                   tenant: null
 *                   count: 1
 *                   items:
 *                     - type: "VILLAGE"
 *                       match: { id: "vlg_1", name: "Bodhan" }
 *                       state: { id: "st_1", name: "Telangana", names: { en: "Telangana", te: null } }
 *                       district: { id: "dst_1", name: "Nizamabad", names: { en: "Nizamabad", te: null } }
 *                       mandal: { id: "mdl_1", name: "Bodhan", names: { en: "Bodhan", te: null } }
 *                       village: { id: "vlg_1", name: "Bodhan", names: { en: "Bodhan", te: null } }
 *               teluguAuth:
 *                 value:
 *                   q: "ఆదిల"
 *                   lang: "te"
 *                   tenant: { id: "t_1", name: "DAXIN TIMES", nativeName: "డాక్సిన్ టైమ్స్", languageCode: "te" }
 *                   count: 1
 *                   items:
 *                     - type: "DISTRICT"
 *                       match: { id: "dst_1", name: "Adilabad", names: { en: "Adilabad", te: "ఆదిలాబాద్" } }
 *                       state: { id: "st_1", name: "Telangana", names: { en: "Telangana", te: "తెలంగాణ" } }
 *                       district: { id: "dst_1", name: "Adilabad", names: { en: "Adilabad", te: "ఆదిలాబాద్" } }
 *                       mandal: null
 *                       village: null
 *       404:
 *         description: No matching area found
 *         content:
 *           application/json:
 *             examples:
 *               notFound:
 *                 value:
 *                   error: "Area Not adding contact admin"
 */
router.get('/search-combined', async (req, res) => {
    try {
        const q = String((req.query.q as any) || '').trim();
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;

        if (!q) return res.status(400).json({ error: 'q is required' });

        const rawItems: any[] = await locationService.searchGeoLocations({
            q,
            limit,
            tenantId,
            types: ['STATE', 'DISTRICT', 'MANDAL', 'VILLAGE'],
            includeVillage: false,
        });

        // Get tenant context first to use its language as fallback
        const tenantCtxId = tenantId || (res.locals as any)?.tenant?.id || '';
        const tenantCtx = tenantCtxId
            ? await (prisma as any).tenant.findUnique({
                where: { id: tenantCtxId },
                include: { entity: { include: { language: true } } },
            }).catch(() => null)
            : null;
        
        const tenantLangCode = tenantCtx?.entity?.language?.code || '';

        // Try to get user language from auth, fallback to tenant language
        const userLang = await getUserLanguageCodeFromAuth(req);
        const lang = userLang && (userLang === 'te' || userLang === 'hi') 
            ? userLang 
            : (tenantLangCode && (tenantLangCode === 'te' || tenantLangCode === 'hi'))
                ? tenantLangCode
                : '';

        // Collect ids for translation lookup (only when lang is te/hi)
        const stateIds = new Set<string>();
        const districtIds = new Set<string>();
        const mandalIds = new Set<string>();
        const villageIds = new Set<string>();
        for (const it of rawItems) {
            if (it.stateId) stateIds.add(String(it.stateId));
            if (it.districtId) districtIds.add(String(it.districtId));
            if (it.mandalId) mandalIds.add(String(it.mandalId));
            if (it.villageId) villageIds.add(String(it.villageId));
        }

        const translations = await loadTranslationsByIds({
            lang,
            stateIds: Array.from(stateIds),
            districtIds: Array.from(districtIds),
            mandalIds: Array.from(mandalIds),
            villageIds: Array.from(villageIds),
        });

        const tenantOut = tenantCtx
            ? {
                id: tenantCtx.id,
                name: tenantCtx.name,
                nativeName: tenantCtx?.entity?.nativeName || null,
                languageCode: tenantCtx?.entity?.language?.code || null,
            }
            : null;

        const items = rawItems.map((it: any) => {
            const type = String(it.type || '').toUpperCase();
            const state = it.stateId
                ? {
                    id: it.stateId,
                    name: it.stateName,
                    names: {
                        en: it.stateName,
                        ...(lang ? { [lang]: translations.states[String(it.stateId)] || null } : {}),
                    },
                }
                : null;
            const district = it.districtId
                ? {
                    id: it.districtId,
                    name: it.districtName,
                    names: {
                        en: it.districtName,
                        ...(lang ? { [lang]: translations.districts[String(it.districtId)] || null } : {}),
                    },
                }
                : null;
            const mandal = it.mandalId
                ? {
                    id: it.mandalId,
                    name: it.mandalName,
                    names: {
                        en: it.mandalName,
                        ...(lang ? { [lang]: translations.mandals[String(it.mandalId)] || null } : {}),
                    },
                }
                : null;
            const village = it.villageId
                ? {
                    id: it.villageId,
                    name: it.villageName,
                    names: {
                        en: it.villageName,
                        ...(lang ? { [lang]: translations.villages[String(it.villageId)] || null } : {}),
                    },
                }
                : null;

            // "match" points to the entity that matched (state/district/mandal/village)
            let match: any = { id: it.id ?? null, name: it.name ?? null };
            if (type === 'STATE') match = state;
            if (type === 'DISTRICT') match = district;
            if (type === 'MANDAL') match = mandal;
            if (type === 'VILLAGE') match = village;

            return {
                type,
                match,
                state,
                district,
                mandal,
                village,
            };
        });

        if (items.length === 0) {
            return res.status(404).json({ error: 'Area Not adding contact admin' });
        }

        return res.json({ q, count: items.length, lang: lang || 'en', tenant: tenantOut, items });
    } catch (e: any) {
        console.error('GET /locations/search-combined error', e);
        return res.status(500).json({ error: 'Failed to search locations' });
    }
});

/**
 * @swagger
 * /locations/villages:
 *   post:
 *     summary: Create village (tenant-scoped)
 *     tags: [Locations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [tenantId, mandalId, name]
 *             properties:
 *               tenantId: { type: string }
 *               mandalId: { type: string }
 *               name: { type: string }
 *     responses:
 *       201: { description: Created }
 */
router.post('/villages', async (req, res) => {
    try {
        const { tenantId, mandalId, name } = req.body || {};
        if (!tenantId || !mandalId || !name) return res.status(400).json({ error: 'tenantId, mandalId, name required' });
        const created = await (locationService as any).createVillage({ tenantId: String(tenantId), mandalId: String(mandalId), name: String(name).trim() });
        return res.status(201).json(created);
    } catch (e: any) {
        return res.status(400).json({ error: e?.message || 'Failed' });
    }
});

/**
 * @swagger
 * /locations/villages:
 *   get:
 *     summary: List villages
 *     tags: [Locations]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *       - in: query
 *         name: mandalId
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: offset
 *         schema: { type: integer, default: 0 }
 *     responses:
 *       200: { description: List }
 */
router.get('/villages', async (req, res) => {
    try {
        const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
        const mandalId = req.query.mandalId ? String(req.query.mandalId) : undefined;
        const q = req.query.q ? String(req.query.q) : undefined;
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const offset = req.query.offset ? Number(req.query.offset) : undefined;
        const out = await (locationService as any).listVillages({ tenantId, mandalId, q, limit, offset });
        return res.json(out);
    } catch (e: any) {
        return res.status(500).json({ error: e?.message || 'Failed' });
    }
});

/**
 * @swagger
 * /locations/villages/{id}:
 *   get:
 *     summary: Get village by id
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Village }
 *       404: { description: Not found }
 */
router.get('/villages/:id', async (req, res) => {
    const id = String(req.params.id);
    const item = await (locationService as any).getVillageById(id);
    if (!item) return res.status(404).json({ error: 'Not found' });
    return res.json(item);
});

/**
 * @swagger
 * /locations/translations:
 *   patch:
 *     summary: Update a location translation (manual correction)
 *     description: |
 *       SUPER_ADMIN or TENANT_ADMIN. Upserts a single translation entry for State/District/Mandal/Village.
 *
 *       Use this when AI/backfill generated the wrong spelling (e.g., "కమరెడ్డి" should be "కామారెడ్డి").
 *     tags: [Locations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, id, language, name]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [STATE, DISTRICT, MANDAL, VILLAGE]
 *                 example: DISTRICT
 *               id:
 *                 type: string
 *                 description: The location entity id (stateId/districtId/mandalId/villageId)
 *                 example: "cmit61g3f000wugtw5tjfzgzn"
 *               language:
 *                 type: string
 *                 description: Language code stored in translation tables (e.g., te, hi)
 *                 example: te
 *               name:
 *                 type: string
 *                 description: Correct localized name
 *                 example: "కామారెడ్డి"
 *           examples:
 *             fixDistrictTe:
 *               summary: Fix a district Telugu name
 *               value:
 *                 type: DISTRICT
 *                 id: "cmit61g3f000wugtw5tjfzgzn"
 *                 language: te
 *                 name: "కామారెడ్డి"
 *     responses:
 *       200:
 *         description: Updated translation row
 *         content:
 *           application/json:
 *             examples:
 *               ok:
 *                 value:
 *                   ok: true
 *                   type: DISTRICT
 *                   id: "cmit61g3f000wugtw5tjfzgzn"
 *                   language: "te"
 *                   name: "కామారెడ్డి"
 *                   translation:
 *                     id: "cmtr_1"
 *                     districtId: "cmit61g3f000wugtw5tjfzgzn"
 *                     language: "te"
 *                     name: "కామారెడ్డి"
 *                     createdAt: "2026-01-04T10:00:00.000Z"
 *                     updatedAt: "2026-01-04T10:05:00.000Z"
 *       400:
 *         description: Invalid input
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.patch(
    '/translations',
    passport.authenticate('jwt', { session: false }),
    requireSuperOrTenantAdmin,
    async (req, res) => {
        try {
            const rawType = String((req.body as any)?.type || '').trim().toUpperCase();
            const id = String((req.body as any)?.id || '').trim();
            const language = String((req.body as any)?.language || '').trim().toLowerCase();
            const name = String((req.body as any)?.name || '').trim();

            if (!rawType || !['STATE', 'DISTRICT', 'MANDAL', 'VILLAGE'].includes(rawType)) {
                return res.status(400).json({ error: 'type must be one of STATE, DISTRICT, MANDAL, VILLAGE' });
            }
            if (!id) return res.status(400).json({ error: 'id is required' });
            if (!language) return res.status(400).json({ error: 'language is required (e.g., te, hi)' });
            if (!name) return res.status(400).json({ error: 'name is required' });
            if (name.length > 200) return res.status(400).json({ error: 'name too long (max 200 chars)' });

            let translation: any = null;
            if (rawType === 'STATE') {
                translation = await (prisma as any).stateTranslation.upsert({
                    where: { stateId_language: { stateId: id, language } },
                    update: { name },
                    create: { stateId: id, language, name },
                });
            } else if (rawType === 'DISTRICT') {
                translation = await (prisma as any).districtTranslation.upsert({
                    where: { districtId_language: { districtId: id, language } },
                    update: { name },
                    create: { districtId: id, language, name },
                });
            } else if (rawType === 'MANDAL') {
                translation = await (prisma as any).mandalTranslation.upsert({
                    where: { mandalId_language: { mandalId: id, language } },
                    update: { name },
                    create: { mandalId: id, language, name },
                });
            } else if (rawType === 'VILLAGE') {
                translation = await (prisma as any).villageTranslation.upsert({
                    where: { villageId_language: { villageId: id, language } },
                    update: { name },
                    create: { villageId: id, language, name },
                });
            }

            return res.json({ ok: true, type: rawType, id, language, name, translation });
        } catch (e: any) {
            console.error('PATCH /locations/translations error', e);
            return res.status(500).json({ error: 'Failed to update location translation' });
        }
    }
);

/**
 * @swagger
 * /locations/{id}:
 *   get:
 *     summary: Get a location by ID
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The location ID
 *     responses:
 *       200:
 *         description: The location data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       404:
 *         description: Location not found
 */
router.get('/:id', async (req, res) => {
    const location = await locationService.findLocationById(req.params.id);
    if (location) {
        res.json(location);
    } else {
        res.status(404).send('Location not found');
    }
})

/**
 *   patch:
 *     summary: Update a location by ID
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The location ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLocationDto'
 *     responses:
 *       200:
 *         description: The updated location.
 *       404:
 *         description: Location not found
 */
router.patch('/:id', async (req, res) => {
    try {
        const location = await locationService.updateLocation(req.params.id, req.body as UpdateLocationDto);
        res.json(location);
    } catch (error) {
        res.status(404).send('Location not found');
    }
})

/**
 *   delete:
 *     summary: Delete a location by ID
 *     tags: [Locations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The location ID
 *     responses:
 *       204:
 *         description: No content
 *       404:
 *         description: Location not found
 */
router.delete('/:id', async (req, res) => {
    try {
        await locationService.deleteLocation(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(404).send('Location not found');
    }
});
/**
 *   post:
 *     summary: Bulk upload locations via CSV file
 *     tags: [Locations]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: The CSV file to upload.
 *     responses:
 *       200:
 *         description: Locations uploaded successfully.
 *       400:
 *         description: Bad request, please check the file format.
 *     x-csv-example:
 *       name,code,type,level,stateId,parentId
 *       Adilabad,ADL,district,1,clxys930c0000vc11h2g5g4g3,
 *       Boath,BTH,assembly,2,clxys930c0000vc11h2g5g4g3,clxyz12340001vc11abcd_ADL
 *       Nirmal,NRL,district,1,clxys930c0000vc11h2g5g4g3,
 *       Mudhole,MDH,assembly,2,clxys930c0000vc11h2g5g4g3,clxyz56780002vc11efgh_NRL
 *     x-field-explanations:
 *       - name: The name of the location (e.g., "Adilabad").
 *       - code: A unique code for the location (e.g., "ADL").
 *       - type: The type of location. Must be one of: country, state, district, assembly, mandal, village.
 *       - level: The hierarchical level of the location (e.g., 1 for district, 2 for assembly).
 *       - stateId: The ID of the state this location belongs to.
 *       - parentId: The ID of the parent location (optional).
 */
router.post('/bulk-upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const result = await locationService.bulkUploadLocations(req.file.path);
        res.status(200).json({ message: 'Locations uploaded successfully', result });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
