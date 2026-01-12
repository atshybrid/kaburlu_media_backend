/**
 * ePaper Module Routes
 * Handles block templates, settings, editions, and layout generation
 */

import { Router } from 'express';
import passport from 'passport';
import multer from 'multer';
import { config } from '../../config/env';
import {
  listBlockTemplates,
  getBlockTemplate,
  createBlockTemplate,
  updateBlockTemplate,
  deleteBlockTemplate,
  cloneBlockTemplate,
  lockBlockTemplate,
} from './blockTemplate.controller';
import {
  getEpaperSettings,
  updateEpaperSettings,
  initializeEpaperSettings,
} from './settings.controller';
import { suggestBlockTemplate } from './suggestion.controller';
import {
  listPublicationEditions,
  getPublicationEdition,
  createPublicationEdition,
  updatePublicationEdition,
  deletePublicationEdition,
  listPublicationSubEditions,
  createPublicationSubEdition,
  getPublicationSubEdition,
  updatePublicationSubEdition,
  deletePublicationSubEdition,
} from './publicationEditions.controller';
import {
  uploadPdfIssue,
  uploadPdfIssueByUrl,
  getPdfIssue,
  findPdfIssue,
} from './pdfIssues.controller';
import {
  getEpaperPublicConfig,
  putEpaperPublicConfigType,
  putEpaperPublicConfigMultiEdition,
} from './publicConfig.controller';

const router = Router();
const auth = passport.authenticate('jwt', { session: false });
const epaperPdfMaxMb = Number((config as any)?.epaper?.pdfMaxMb || 30);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(1, Math.floor(epaperPdfMaxMb * 1024 * 1024)) },
});

// ============================================================================
// BLOCK TEMPLATES
// ============================================================================

/**
 * @swagger
 * /epaper/templates:
 *   get:
 *     summary: List block templates
 *     description: Returns all available block templates. Global templates + tenant-specific templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string, enum: [HEADER, CONTENT, FOOTER] }
 *         description: Filter by category
 *       - in: query
 *         name: subCategory
 *         schema: { type: string, enum: [MAIN_HEADER, INNER_HEADER, COL_2, COL_4, COL_6, COL_10, COL_12, STANDARD_FOOTER, LAST_PAGE_FOOTER] }
 *         description: Filter by sub-category
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
 *         description: Filter by status
 *       - in: query
 *         name: columns
 *         schema: { type: integer }
 *         description: Filter by column count
 *       - in: query
 *         name: includeGlobal
 *         schema: { type: boolean, default: true }
 *         description: Include global platform templates
 *     responses:
 *       200:
 *         description: List of block templates
 */
router.get('/templates', auth, listBlockTemplates);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   get:
 *     summary: Get a block template by ID
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Block template details
 *       404:
 *         description: Template not found
 */
router.get('/templates/:id', auth, getBlockTemplate);

/**
 * @swagger
 * /epaper/templates:
 *   post:
 *     summary: Create a new block template
 *     description: Creates a new block template in DRAFT status. Only tenant admins can create tenant-specific templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name, category, subCategory, columns, widthInches, maxHeightInches, components]
 *             properties:
 *               code: { type: string, example: "BT_CUSTOM_2COL" }
 *               name: { type: string, example: "Custom 2-Column Block" }
 *               description: { type: string }
 *               category: { type: string, enum: [HEADER, CONTENT, FOOTER] }
 *               subCategory: { type: string, enum: [MAIN_HEADER, INNER_HEADER, COL_2, COL_4, COL_6, COL_10, COL_12, STANDARD_FOOTER, LAST_PAGE_FOOTER] }
 *               columns: { type: integer, example: 2 }
 *               widthInches: { type: number, example: 2 }
 *               minHeightInches: { type: number, example: 2 }
 *               maxHeightInches: { type: number, example: 4 }
 *               components: { type: object }
 *     responses:
 *       201:
 *         description: Created template
 *       400:
 *         description: Validation error
 */
router.post('/templates', auth, createBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   put:
 *     summary: Update a block template
 *     description: Update template properties. Cannot update locked templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               minHeightInches: { type: number }
 *               maxHeightInches: { type: number }
 *               components: { type: object }
 *               status: { type: string, enum: [DRAFT, ACTIVE, ARCHIVED] }
 *     responses:
 *       200:
 *         description: Updated template
 *       400:
 *         description: Template is locked
 *       404:
 *         description: Template not found
 */
router.put('/templates/:id', auth, updateBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}:
 *   delete:
 *     summary: Archive a block template
 *     description: Soft delete (archive) a template. Cannot delete global templates.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template archived
 *       400:
 *         description: Cannot delete global template
 *       404:
 *         description: Template not found
 */
router.delete('/templates/:id', auth, deleteBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}/clone:
 *   post:
 *     summary: Clone a block template
 *     description: Create a copy of a template for customization. Global templates can be cloned to tenant-specific.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newCode: { type: string, example: "BT_MY_CUSTOM_2COL" }
 *               newName: { type: string, example: "My Custom 2-Column" }
 *     responses:
 *       201:
 *         description: Cloned template
 *       404:
 *         description: Source template not found
 */
router.post('/templates/:id/clone', auth, cloneBlockTemplate);

/**
 * @swagger
 * /epaper/templates/{id}/lock:
 *   post:
 *     summary: Lock a block template
 *     description: Lock template to prevent further edits. Generates preview image. Required before using in articles.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template locked
 *       400:
 *         description: Template already locked or invalid
 *       404:
 *         description: Template not found
 */
router.post('/templates/:id/lock', auth, lockBlockTemplate);

// ============================================================================
// EPAPER SETTINGS
// ============================================================================

/**
 * @swagger
 * /epaper/settings:
 *   get:
 *     summary: Get ePaper settings for current tenant
 *     description: Returns page dimensions, headers, footers, printer info, and generation config.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: ePaper settings
 *       404:
 *         description: Settings not initialized
 */
router.get('/settings', auth, getEpaperSettings);

/**
 * @swagger
 * /epaper/settings:
 *   put:
 *     summary: Update ePaper settings
 *     description: Update page dimensions, headers, footers, printer info, etc.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pageWidthInches: { type: number, example: 13 }
 *               pageHeightInches: { type: number, example: 22 }
 *               gridColumns: { type: integer, example: 12 }
 *               paddingTop: { type: number, example: 0.5 }
 *               paddingRight: { type: number, example: 0.5 }
 *               paddingBottom: { type: number, example: 0.5 }
 *               paddingLeft: { type: number, example: 0.5 }
 *               defaultPageCount: { type: integer, example: 8 }
 *               mainHeaderTemplateId: { type: string }
 *               innerHeaderTemplateId: { type: string }
 *               footerTemplateId: { type: string }
 *               footerStyle: { type: string, enum: [dots, line, none] }
 *               showPrinterInfoOnLastPage: { type: boolean }
 *               printerName: { type: string, example: "Sri Lakshmi Offset Printers" }
 *               printerAddress: { type: string, example: "Industrial Area, Adilabad" }
 *               printerCity: { type: string }
 *               publisherName: { type: string }
 *               editorName: { type: string }
 *               ownerName: { type: string }
 *               rniNumber: { type: string }
 *               lastPageFooterTemplate: { type: string }
 *               generationConfig: { type: object }
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.put('/settings', auth, updateEpaperSettings);

/**
 * @swagger
 * /epaper/settings/initialize:
 *   post:
 *     summary: Initialize ePaper settings for tenant
 *     description: Creates default ePaper settings for a tenant. Called automatically on first access.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Settings initialized
 *       200:
 *         description: Settings already exist
 */
router.post('/settings/initialize', auth, initializeEpaperSettings);

// ============================================================================
// EPAPER PUBLIC CONFIG (mode + multi-edition)
// Stored in EpaperSettings.generationConfig.publicEpaper
// ============================================================================

/**
 * @swagger
 * /epaper/public-config:
 *   get:
 *     summary: Get public ePaper configuration (type + multi-edition)
 *     description: Admin-only. Reads from EpaperSettings.generationConfig.publicEpaper.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Config
 */
router.get('/public-config', auth, getEpaperPublicConfig);

/**
 * @swagger
 * /epaper/public-config/type:
 *   put:
 *     summary: Update public ePaper type (PDF or BLOCK)
 *     description: Admin-only. Updates EpaperSettings.generationConfig.publicEpaper.type.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type]
 *             properties:
 *               type: { type: string, enum: [PDF, BLOCK], example: PDF }
 *     responses:
 *       200:
 *         description: Updated config
 */
router.put('/public-config/type', auth, putEpaperPublicConfigType);

/**
 * @swagger
 * /epaper/public-config/multi-edition:
 *   put:
 *     summary: Update multi-edition flag (on/off)
 *     description: Admin-only. Updates EpaperSettings.generationConfig.publicEpaper.multiEditionEnabled.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [multiEditionEnabled]
 *             properties:
 *               multiEditionEnabled: { type: boolean, example: true }
 *     responses:
 *       200:
 *         description: Updated config
 */
router.put('/public-config/multi-edition', auth, putEpaperPublicConfigMultiEdition);

// ============================================================================
// PUBLICATION EDITIONS + SUB-EDITIONS (Tenant ePaper catalog)
// ============================================================================

/**
 * @swagger
 * /epaper/publication-editions:
 *   get:
 *     summary: List ePaper publication editions (state-level)
 *     description: Admin-only. Returns tenant-scoped edition catalog (not daily generated editions).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: includeSubEditions
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (manage any tenant)
 *     responses:
 *       200:
 *         description: List of editions
 */
router.get('/publication-editions', auth, listPublicationEditions);

/**
 * @swagger
 * /epaper/publication-editions:
 *   post:
 *     summary: Create ePaper publication edition
 *     description: Admin-only. Creates a tenant-scoped edition (state-level).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (create for any tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Telangana Edition" }
 *               slug: { type: string, example: "telangana" }
 *               stateId: { type: string, description: "Optional. Link edition to an existing State." }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean, default: true }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       201:
 *         description: Created edition
 */
router.post('/publication-editions', auth, createPublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   get:
 *     summary: Get a publication edition by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Edition details
 *       404:
 *         description: Not found
 */
router.get('/publication-editions/:id', auth, getPublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   put:
 *     summary: Update a publication edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               stateId: { type: string }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       200:
 *         description: Updated edition
 */
router.put('/publication-editions/:id', auth, updatePublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{id}:
 *   delete:
 *     summary: Delete (soft) a publication edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/publication-editions/:id', auth, deletePublicationEdition);

/**
 * @swagger
 * /epaper/publication-editions/{editionId}/sub-editions:
 *   get:
 *     summary: List sub-editions for a publication edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: editionId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: includeDeleted
 *         schema: { type: boolean, default: false }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: List of sub-editions
 */
router.get('/publication-editions/:editionId/sub-editions', auth, listPublicationSubEditions);

/**
 * @swagger
 * /epaper/publication-editions/{editionId}/sub-editions:
 *   post:
 *     summary: Create a sub-edition (district-level)
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: editionId
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Adilabad" }
 *               slug: { type: string, example: "adilabad" }
 *               districtId: { type: string, description: "Optional. Link sub-edition to an existing District." }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean, default: true }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       201:
 *         description: Created sub-edition
 */
router.post('/publication-editions/:editionId/sub-editions', auth, createPublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   get:
 *     summary: Get a sub-edition by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Sub-edition details
 */
router.get('/publication-sub-editions/:id', auth, getPublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   put:
 *     summary: Update a sub-edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               districtId: { type: string }
 *               coverImageUrl: { type: string }
 *               isActive: { type: boolean }
 *               seoTitle: { type: string }
 *               seoDescription: { type: string }
 *               seoKeywords: { type: string }
 *     responses:
 *       200:
 *         description: Updated sub-edition
 */
router.put('/publication-sub-editions/:id', auth, updatePublicationSubEdition);

/**
 * @swagger
 * /epaper/publication-sub-editions/{id}:
 *   delete:
 *     summary: Delete (soft) a sub-edition
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only
 *     responses:
 *       200:
 *         description: Success
 */
router.delete('/publication-sub-editions/:id', auth, deletePublicationSubEdition);

// ============================================================================
// PDF-BASED ISSUES (one PDF per date per edition/sub-edition)
// ============================================================================

/**
 * @swagger
 * /epaper/pdf-issues/upload:
 *   post:
 *     summary: Upload/replace a PDF-based ePaper issue
 *     description: |
 *       Admin-only.
 *
 *       Rules:
 *       - Provide exactly one: editionId OR subEditionId
 *       - One PDF per (tenant + date + target). Re-upload replaces existing and regenerates PNG pages.
 *       - Page 1 becomes coverImageUrl.
 *
 *       Validation:
 *       - `issueDate` must be YYYY-MM-DD
 *       - Uploaded file must be a PDF
 *
 *       Requires Poppler `pdftoppm` available on the server (or set PDFTOPPM_PATH).
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (upload for any tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [pdf, issueDate]
 *             properties:
 *               pdf:
 *                 type: string
 *                 format: binary
 *               issueDate:
 *                 type: string
 *                 example: "2026-01-12"
 *               editionId:
 *                 type: string
 *               subEditionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Uploaded/replaced
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_1"
 *                     tenantId: "t_abc"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: "ed_1"
 *                     subEditionId: null
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *                     pages: []
 *       400:
 *         description: Validation error (missing target / invalid date / not a PDF)
 *       403:
 *         description: Tenant override not allowed (non-superadmin)
 */
router.post('/pdf-issues/upload', auth, upload.single('pdf'), uploadPdfIssue);

/**
 * @swagger
 * /epaper/pdf-issues/upload-by-url:
 *   post:
 *     summary: Upload/replace a PDF-based ePaper issue by URL
 *     description: |
 *       Admin-only.
 *
 *       Use this when your frontend already uploaded the PDF to Bunny (or any public URL)
 *       and you want the backend to fetch it, convert to PNG pages, and upsert the daily issue.
 *
 *       Rules:
 *       - Provide exactly one: editionId OR subEditionId
 *       - One PDF per (tenant + date + target). Re-run replaces existing and regenerates PNG pages.
 *       - Page 1 becomes coverImageUrl.
 *
 *       Validation:
 *       - `issueDate` must be YYYY-MM-DD
 *       - `pdfUrl` must be a public http/https URL that returns a real PDF
 *
 *       Security:
 *       - Only http/https URLs allowed
 *       - Local/private hosts are rejected
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (upload for any tenant)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pdfUrl, issueDate]
 *             properties:
 *               tenantId:
 *                 type: string
 *                 description: SUPER_ADMIN only (alternative to query tenantId)
 *               pdfUrl:
 *                 type: string
 *                 example: "https://kaburlu-news.b-cdn.net/epaper/pdfs/2026/01/12/telangana.pdf"
 *               issueDate:
 *                 type: string
 *                 example: "2026-01-12"
 *               editionId:
 *                 type: string
 *               subEditionId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Uploaded/replaced
 *         content:
 *           application/json:
 *             examples:
 *               editionTarget:
 *                 summary: Create/replace an edition-level issue
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_1"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: "ed_1"
 *                     subEditionId: null
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *               subEditionTarget:
 *                 summary: Create/replace a sub-edition issue
 *                 value:
 *                   ok: true
 *                   issue:
 *                     id: "iss_2"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: null
 *                     subEditionId: "sub_1"
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/adilabad.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/adilabad/p1.png"
 *                     pageCount: 8
 *       400:
 *         description: Validation error (missing target / invalid URL / invalid date)
 *       403:
 *         description: Tenant override not allowed (non-superadmin)
 */
router.post('/pdf-issues/upload-by-url', auth, uploadPdfIssueByUrl);

/**
 * @swagger
 * /epaper/pdf-issues:
 *   get:
 *     summary: Find a PDF issue by date + target
 *     description: |
 *       Admin-only.
 *       - Provide `issueDate` and exactly one of `editionId`/`subEditionId`.
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: tenantId
 *         schema: { type: string }
 *         description: SUPER_ADMIN only (find issue for any tenant)
 *       - in: query
 *         name: issueDate
 *         required: true
 *         schema: { type: string, example: "2026-01-12" }
 *       - in: query
 *         name: editionId
 *         schema: { type: string }
 *       - in: query
 *         name: subEditionId
 *     responses:
 *       200:
 *         description: Issue with pages
 *         content:
 *           application/json:
 *             examples:
 *               sample:
 *                 value:
 *                   issue:
 *                     id: "iss_1"
 *                     issueDate: "2026-01-12T00:00:00.000Z"
 *                     editionId: "ed_1"
 *                     subEditionId: null
 *                     pdfUrl: "https://cdn.example.com/epaper/pdfs/2026/01/12/telangana.pdf"
 *                     coverImageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *                     pageCount: 12
 *                     pages:
 *                       - pageNumber: 1
 *                         imageUrl: "https://cdn.example.com/epaper/pages/2026/01/12/telangana/p1.png"
 *       400:
 *         description: Validation error (missing/invalid query params)
 */
router.get('/pdf-issues', auth, findPdfIssue);

/**
 * @swagger
 * /epaper/pdf-issues/{id}:
 *   get:
 *     summary: Get a PDF issue by ID
 *     tags: [EPF ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Issue with pages
 */
router.get('/pdf-issues/:id', auth, getPdfIssue);

// ============================================================================
// BLOCK SUGGESTION
// ============================================================================

/**
 * @swagger
 * /epaper/suggest-block:
 *   post:
 *     summary: Suggest a block template for article
 *     description: Based on character count, image presence, and highlights, suggests the best block template.
 *     tags: [Block ePaper - Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [charCount]
 *             properties:
 *               charCount: { type: integer, example: 1200 }
 *               wordCount: { type: integer, example: 200 }
 *               hasImage: { type: boolean, example: true }
 *               hasHighlights: { type: boolean, example: true }
 *               highlightCount: { type: integer, example: 3 }
 *               isBreaking: { type: boolean, example: false }
 *     responses:
 *       200:
 *         description: Suggested block template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suggestedTemplateId: { type: string }
 *                 suggestedTemplateCode: { type: string }
 *                 suggestedTemplateName: { type: string }
 *                 confidence: { type: number, example: 0.85 }
 *                 alternatives: { type: array, items: { type: object } }
 */
router.post('/suggest-block', auth, suggestBlockTemplate);

export default router;
