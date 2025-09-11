// src/api/shortnews/shortnews.service.js
const db = require('../../db');
const slugify = require('slugify');

async function createShortNews(payload) {
  const {
    title, content, category, author, tags = [], language = 'te', featuredImage, publishDate, seo = {}
  } = payload;
  const baseSlug = slugify(title || 'shortnews', { lower: true, strict: true });
  const uniqueSlug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
  const publish_at = publishDate ? new Date(publishDate) : new Date();
  const query = `
    INSERT INTO shortnews
      (title, slug, content, category, author, tags, language, featured_image, publish_date, seo, created_at, updated_at)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
    RETURNING *;
  `;
  const values = [
    title, uniqueSlug, content, category, author, tags, language, featuredImage, publish_at, seo
  ];
  const { rows } = await db.query(query, values);
  return rows[0];
}

async function getShortNewsByIdOrSlug(key) {
  let query, values;
  if (/^\d+$/.test(String(key))) {
    query = 'SELECT * FROM shortnews WHERE id = $1 LIMIT 1';
    values = [Number(key)];
  } else {
    query = 'SELECT * FROM shortnews WHERE slug = $1 LIMIT 1';
    values = [key];
  }
  const { rows } = await db.query(query, values);
  return rows[0] || null;
}

async function listShortNews({ page = 1, limit = 10 } = {}) {
  const offset = (page - 1) * limit;
  const totalRes = await db.query('SELECT COUNT(*) FROM shortnews', []);
  const total = parseInt(totalRes.rows[0].count, 10);
  const q = `
    SELECT id, title, slug, content, category, author, tags, featured_image AS "featuredImage", publish_date
    FROM shortnews
    ORDER BY publish_date DESC
    LIMIT $1 OFFSET $2
  `;
  const { rows } = await db.query(q, [limit, offset]);
  return {
    meta: { page, limit, total },
    data: rows
  };
}

module.exports = {
  createShortNews,
  getShortNewsByIdOrSlug,
  listShortNews
};
