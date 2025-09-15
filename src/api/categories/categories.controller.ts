
import { Request, Response } from 'express';
import { validate } from 'class-validator';
import { CreateCategoryDto, UpdateCategoryDto } from './categories.dto';
import {
  createCategory,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  getCategories as getCategoriesService,
  translateAndSaveCategoryInBackground, // Import the background function
} from './categories.service';

export const createCategoryController = async (req: Request, res: Response) => {
  const createCategoryDto = new CreateCategoryDto();
  createCategoryDto.name = req.body.name;
  createCategoryDto.parentId = req.body.parentId;
  // ...existing code...

  const errors = await validate(createCategoryDto);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    // 1. Create the category instantly and get the result.
    const category = await createCategory(createCategoryDto);

    // 2. Respond to the user immediately.
    res.status(201).json(category);

    // 3. Start the background job. The API does NOT wait for this to finish.
    // We add a `void` prefix to explicitly state we are not awaiting the promise.
    void translateAndSaveCategoryInBackground(category.id, category.name);

  } catch (error: any) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Error creating category:", error);
    res.status(500).json({ error: 'Failed to create category.' });
  }
};

export const updateCategoryController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const updateCategoryDto = new UpdateCategoryDto();
  updateCategoryDto.name = req.body.name;
  updateCategoryDto.parentId = req.body.parentId;
  // ...existing code...

  const errors = await validate(updateCategoryDto);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const updatedCategory = await updateCategoryService(id, updateCategoryDto);
    res.status(200).json(updatedCategory);
  } catch (error) {
    console.error(`Error updating category ${id}:`, error);
    res.status(500).json({ error: 'Failed to update category.' });
  }
};

export const deleteCategoryController = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await deleteCategoryService(id);
    res.status(204).send(); // No content
  } catch (error: any) {
    if (error.message.includes('has children')) {
      return res.status(400).json({ error: error.message });
    }
    console.error(`Error deleting category ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete category.' });
  }
};

export const getCategoriesController = async (req: Request, res: Response) => {
  const languageId = req.query.languageId as string | undefined;
  try {
    if (!languageId) {
      return res.status(400).json({ error: 'languageId is required' });
    }
    const categories = await getCategoriesService(languageId);
    res.status(200).json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
};
