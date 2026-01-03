
import { Router } from 'express';
import { getLanguagesController, createLanguageController, backfillAllLocationTranslationsController, backfillCategoryTranslationsController, backfillLocationTranslationsForLanguageController } from './languages.controller';
import passport from 'passport';
import { requireSuperAdmin } from '../middlewares/authz';

const router = Router();

/**
 * @swagger
 * /languages:
 *   get:
 *     summary: List languages
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Array of languages
 */
router.get('/', getLanguagesController);

/**
 * @swagger
 * /languages:
 *   post:
 *     summary: Create language
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               code: { type: string }
 *     responses:
 *       "201":
 *         description: Language created
 */
router.post('/', passport.authenticate('jwt', { session: false }), createLanguageController);

/**
 * @swagger
 * /languages/{code}/backfill-category-translations:
 *   post:
 *     summary: Backfill category translations for a language
 *     description: SUPER_ADMIN only. Ensures CategoryTranslation rows exist for all existing categories for the given language code, then runs AI translation to populate names.
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         example: te
 *     responses:
 *       "202":
 *         description: Backfill started
 *         content:
 *           application/json:
 *             examples:
 *               ok:
 *                 value:
 *                   ok: true
 *                   message: Backfill started
 *                   code: te
 *       "404":
 *         description: Language not found
 */
router.post(
	'/:code/backfill-category-translations',
	passport.authenticate('jwt', { session: false }),
	requireSuperAdmin,
	backfillCategoryTranslationsController
);

/**
 * @swagger
 * /languages/{code}/backfill-location-translations:
 *   post:
 *     summary: Backfill location translations for a language
 *     description: SUPER_ADMIN only. Ensures translation rows exist for all State/District/Mandal/Village for the given language code, then runs AI transliteration/translation to populate names.
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         example: te
 *     responses:
 *       "202":
 *         description: Backfill started
 */
router.post(
	'/:code/backfill-location-translations',
	passport.authenticate('jwt', { session: false }),
	requireSuperAdmin,
	backfillLocationTranslationsForLanguageController
);

/**
 * @swagger
 * /languages/backfill-location-translations:
 *   post:
 *     summary: Backfill location translations for all languages
 *     description: SUPER_ADMIN only. Runs location translation backfill across all active languages.
 *     tags: [Languages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "202":
 *         description: Backfill started
 */
router.post(
	'/backfill-location-translations',
	passport.authenticate('jwt', { session: false }),
	requireSuperAdmin,
	backfillAllLocationTranslationsController
);

export default router;
