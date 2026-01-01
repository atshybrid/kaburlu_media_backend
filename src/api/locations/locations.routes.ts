
import { Router } from 'express';
import multer from 'multer';
import * as locationService from './locations.service';
import { CreateLocationDto, UpdateLocationDto } from './locations.dto';

const router = Router();
const upload = multer({ dest: 'uploads/' });

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
 *                   count: 1
 *                   items:
 *                     - type: "VILLAGE"
 *                       match: { id: "vlg_1", name: "Bodhan" }
 *                       state: { id: "st_1", name: "Telangana" }
 *                       district: { id: "dst_1", name: "Nizamabad" }
 *                       mandal: { id: "mdl_1", name: "Bodhan" }
 *                       village: { id: "vlg_1", name: "Bodhan" }
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

        const items = rawItems.map((it: any) => {
            const type = String(it.type || '').toUpperCase();
            const state = it.stateId ? { id: it.stateId, name: it.stateName } : null;
            const district = it.districtId ? { id: it.districtId, name: it.districtName } : null;
            const mandal = it.mandalId ? { id: it.mandalId, name: it.mandalName } : null;
            const village = it.villageId ? { id: it.villageId, name: it.villageName } : null;

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

        return res.json({ q, count: items.length, items });
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
