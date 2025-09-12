import { Router } from 'express';
import * as countryController from './country.controller';

const router = Router();

/**
 * @swagger
 * /api/v1/countries:
 *   get:
 *     summary: Get all countries
 *     tags: [Countries]
 *     responses:
 *       200:
 *         description: List of countries
 *   post:
 *     summary: Create a new country
 *     tags: [Countries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "India"
 *               code:
 *                 type: string
 *                 example: "IN"
 *     responses:
 *       201:
 *         description: Country created
 *
 * /api/v1/countries/{id}:
 *   get:
 *     summary: Get a country by ID
 *     tags: [Countries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Country details
 *       404:
 *         description: Country not found
 *   put:
 *     summary: Update a country
 *     tags: [Countries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "India"
 *               code:
 *                 type: string
 *                 example: "IN"
 *     responses:
 *       200:
 *         description: Country updated
 *       404:
 *         description: Country not found
 *   delete:
 *     summary: Delete a country
 *     tags: [Countries]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Country deleted
 *       404:
 *         description: Country not found
 */
router.get('/', countryController.getAllCountries);
router.post('/', countryController.createCountry);
router.get('/:id', countryController.getCountryById);
router.put('/:id', countryController.updateCountry);
router.delete('/:id', countryController.deleteCountry);

export default router;
