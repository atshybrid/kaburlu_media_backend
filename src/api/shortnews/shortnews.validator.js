// src/api/shortnews/shortnews.validator.js
const { body, param, query } = require('express-validator');

const createShortNews = [
  body('title').trim().notEmpty().withMessage('title is required'),
  body('content').trim().notEmpty().withMessage('content is required').isLength({ max: 400 }).withMessage('content must be ≤60 words'),
  body('category').notEmpty().withMessage('category is required'),
  body('author').notEmpty().withMessage('author is required'),
  body('tags').optional().isArray(),
  body('language').optional().isString(),
  body('featuredImage').optional().isURL().withMessage('featuredImage must be a valid URL'),
  body('publishDate').optional().isISO8601().toDate(),
  body('seo').optional().isObject()
];

const pagination = [
  query('page').optional().toInt().isInt({ min: 1 }).withMessage('page must be >= 1'),
  query('limit').optional().toInt().isInt({ min: 1, max: 100 }).withMessage('limit must be 1-100')
];

module.exports = {
  createShortNews,
  pagination
};
