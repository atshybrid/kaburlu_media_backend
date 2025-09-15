
import { Router } from 'express';
import passport from 'passport';
import { createCategory, getCategories, updateCategory, deleteCategory, translateAndSaveCategoryInBackground, retranslateCategory } from './categories.service';
import { getCategoriesController } from './categories.controller';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import { validationMiddleware } from '../middlewares/validation.middleware';

const router = Router();

// Role guard: only SUPER_ADMIN can create/update categories
function requireSuperAdmin(req: any, res: any, next: any) {
  const roleName = (req.user?.role?.name || '').toUpperCase();
  if (roleName === 'SUPER_ADMIN' || roleName === 'SUPERADMIN') return next();
  return res.status(403).json({ error: 'Forbidden: SUPER_ADMIN only' });
}

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: The unique identifier for the category.
 *         name:
 *           type: string
 *           description: The name of the category (potentially translated).
 *         slug:
 *           type: string
 *           description: A URL-friendly version of the category name.
 *         iconUrl:
 *           type: string
 *           nullable: true
 *           description: URL for the category's icon.
 *         isActive:
 *           type: boolean
 *           description: Whether the category is active and visible.
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The ID of the parent category, if it's a sub-category.
 *         order:
 *           type: integer
 *           description: The display order of the category.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The date and time the category was last updated.
 *         children:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Category'
 *           description: A list of nested child categories.
 *
 *     CreateCategoryDto:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           description: The name of the category.
 *           example: "Technology"
 *         iconUrl:
 *           type: string
 *           description: URL for the category's icon.
 *           example: "https://example.com/icons/tech.png"
 *         isActive:
 *           type: boolean
 *           description: Whether the category is active and visible.
 *           default: true
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The ID of the parent category, for creating a sub-category.
 *           example: "clq1z2x3y4..."
 *
 *     UpdateCategoryDto:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: The new name of the category.
 *         iconUrl:
 *           type: string
 *           description: New URL for the category's icon.
 *         isActive:
 *           type: boolean
 *           description: New status for whether the category is active.
 *         parentId:
 *           type: string
 *           nullable: true
 *           description: The new ID of the parent category.
 */

/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Category management
 */

/**
 * @swagger
 * /categories:
 *   post:
 *     summary: Create a new category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCategoryDto'
 *     responses:
 *       201:
 *         description: Category created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       400:
 *         description: Invalid input or category already exists.
 */
router.post('/', passport.authenticate('jwt', { session: false }), requireSuperAdmin, validationMiddleware(CreateCategoryDto), async (req, res) => {
  try {
    const newCategory = await createCategory(req.body);
    void translateAndSaveCategoryInBackground(newCategory.id, newCategory.name);
    res.status(201).json(newCategory);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Retrieve categories (public)
 *     description: Requires languageId and returns a nested list of categories with names translated to that language (from CategoryTranslation).
 *     tags: [Categories]
 *     parameters:
 *       - in: query
 *         name: languageId
 *         required: true
 *         schema:
 *           type: string
 *         description: Language ID to translate category names.
 *     responses:
 *       200:
 *         description: A nested list of categories.
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 */
router.get('/', getCategoriesController);

/**
 * @swagger
 * /categories/{id}:
 *   patch:
 *     summary: Update a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category to update.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCategoryDto'
 *     responses:
 *       200:
 *         description: Category updated successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Category'
 *       404:
 *         description: Category not found.
 */
router.patch('/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, validationMiddleware(UpdateCategoryDto), async (req, res) => {
  try {
    const updatedCategory = await updateCategory(req.params.id, req.body);
    res.status(200).json(updatedCategory);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});


/**
 * @swagger
 * /categories/{id}:
 *   delete:
 *     summary: Delete a category
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the category to delete.
 *     responses:
 *       204:
 *         description: Category deleted successfully.
 *       400:
 *         description: Deletion failed because the category has child relationships.
 *       404:
 *         description: Category not found.
 */
router.delete('/:id', passport.authenticate('jwt', { session: false }), requireSuperAdmin, async (req, res) => {
  try {
    await deleteCategory(req.params.id);
    res.status(204).send();
  } catch (error: any) {
    if (error.message.includes('child relationships')) {
      res.status(400).json({ error: error.message });
    } else {
      res.status(404).json({ error: 'Category not found.' });
    }
  }
});

export default router;

/**
 * @swagger
 * /categories/{id}/retranslate:
 *   post:
 *     summary: Retranslate category into all active languages
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Retranslation triggered
 *       404:
 *         description: Category not found
 */
router.post('/:id/retranslate', passport.authenticate('jwt', { session: false }), async (req, res) => {
  try {
    await retranslateCategory(req.params.id);
    res.status(200).json({ success: true });
  } catch (error: any) {
    if ((error?.message || '').includes('not found')) {
      return res.status(404).json({ error: 'Category not found' });
    }
    res.status(500).json({ error: 'Failed to retranslate category' });
  }
});
