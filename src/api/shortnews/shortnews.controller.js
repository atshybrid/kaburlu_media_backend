// src/api/shortnews/shortnews.controller.js
const { validationResult } = require('express-validator');
const ShortNewsService = require('./shortnews.service');

function formatValidationErrors(req) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return null;
  return errors.array().map(e => ({ field: e.param, msg: e.msg }));
}

async function createShortNews(req, res) {
  const valErr = formatValidationErrors(req);
  if (valErr) return res.status(400).json({ success: false, errors: valErr });
  try {
    const created = await ShortNewsService.createShortNews(req.body);
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('createShortNews error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function getShortNews(req, res) {
  try {
    const key = req.params.idOrSlug;
    const article = await ShortNewsService.getShortNewsByIdOrSlug(key);
    if (!article) return res.status(404).json({ success: false, error: 'Short news not found' });
    return res.json({ success: true, data: article });
  } catch (err) {
    console.error('getShortNews error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function listShortNews(req, res) {
  const valErr = validationResult(req);
  if (!valErr.isEmpty()) return res.status(400).json({ success: false, errors: valErr.array() });
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 100);
    const result = await ShortNewsService.listShortNews({ page, limit });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('listShortNews error', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = {
  createShortNews,
  getShortNews,
  listShortNews
};
