/**
 * ePaper Module Routes
 * Handles block templates, settings, editions, and layout generation
 */

import { Router } from 'express';
import passport from 'passport';
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

const router = Router();
const auth = passport.authenticate('jwt', { session: false });

// ============================================================================
// BLOCK TEMPLATES
// ============================================================================

/**
 * @swagger
 * /epaper/templates:
 *   get:
 *     summary: List block templates
 *     description: Returns all available block templates. Global templates + tenant-specific templates.
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
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
 *     tags: [ePaper]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       201:
 *         description: Settings initialized
 *       200:
 *         description: Settings already exist
 */
router.post('/settings/initialize', auth, initializeEpaperSettings);

// ============================================================================
// BLOCK SUGGESTION
// ============================================================================

/**
 * @swagger
 * /epaper/suggest-block:
 *   post:
 *     summary: Suggest a block template for article
 *     description: Based on character count, image presence, and highlights, suggests the best block template.
 *     tags: [ePaper]
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
