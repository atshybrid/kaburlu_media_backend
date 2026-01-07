import { Router } from 'express';
import passport from 'passport';
import { listKinRelationsController, getKinRelationController, createKinRelationController, updateKinRelationController, deleteKinRelationController, bulkUpsertKinRelationsController, listKinRelationNamesController, bulkUpsertKinRelationNamesController } from './kinRelations.controller';
import { requireSuperAdmin } from '../middlewares/authz';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: KinRelations
 *     description: Kinship dictionary CRUD
 */

/**
 * @swagger
 * /kin-relations:
 *   get:
 *     summary: List kin relations
 *     tags: [KinRelations]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: side
 *         schema: { type: string }
 *       - in: query
 *         name: gender
 *         schema: { type: string }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 */
router.get('/', listKinRelationsController);

/**
 * @swagger
 * /kin-relations/{code}:
 *   get:
 *     summary: Get kin relation by code
 *     tags: [KinRelations]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get('/:code', getKinRelationController);

/**
 * @swagger
 * /kin-relations/{code}/names:
 *   get:
 *     summary: List language-specific names for a kin relation code
 *     tags: [KinRelations]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: OK }
 *       404: { description: Not found }
 */
router.get('/:code/names', listKinRelationNamesController);

/**
 * @swagger
 * /kin-relations:
 *   post:
 *     summary: Create kin relation
 *     tags: [KinRelations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201: { description: Created }
 */
router.post('/', passport.authenticate('jwt', { session: false }), createKinRelationController);

/**
 * @swagger
 * /kin-relations/{code}:
 *   put:
 *     summary: Update kin relation by code
 *     tags: [KinRelations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200: { description: Updated }
 *       404: { description: Not found }
 */
router.put('/:code', passport.authenticate('jwt', { session: false }), updateKinRelationController);

/**
 * @swagger
 * /kin-relations/{code}:
 *   delete:
 *     summary: Delete kin relation by code
 *     tags: [KinRelations]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204: { description: Deleted }
 *       404: { description: Not found }
 */
router.delete('/:code', passport.authenticate('jwt', { session: false }), deleteKinRelationController);

/**
 * @swagger
 * /kin-relations/bulk-upsert:
 *   post:
 *     summary: Bulk upsert kin relations (fix Telugu labels)
 *     tags: [KinRelations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items: { type: object }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/bulk-upsert', passport.authenticate('jwt', { session: false }), bulkUpsertKinRelationsController);

/**
 * @swagger
 * /kin-relations/names/bulk-upsert:
 *   post:
 *     summary: Bulk upsert language-specific kin relation names
 *     tags: [KinRelations]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: array
 *             items:
 *               type: object
 *               required: [code, languageCode, displayName]
 *               properties:
 *                 code: { type: string }
 *                 languageCode: { type: string, example: "hi" }
 *                 displayName: { type: string }
 *                 altNames: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Upserted }
 */
router.post('/names/bulk-upsert', passport.authenticate('jwt', { session: false }), requireSuperAdmin, bulkUpsertKinRelationNamesController);

export default router;
