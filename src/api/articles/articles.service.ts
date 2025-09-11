
import prisma from '../../lib/prisma';
import { CreateArticleDto } from './articles.dto';

export const createArticle = async (dto: CreateArticleDto, authorId: string) => {
  const {
    title,
    content,
    categoryIds,
    type,
    shortNews,
    longNews,
    headlines,
    seoTitle,
    seoDescription,
    seoKeywords,
    slug,
    h1,
    h2,
    styles,
  } = dto;

  // Prepare contentJson for all dynamic/AI-generated fields and style settings
  const contentJson: Record<string, any> = {
    shortNews,
    longNews,
    headlines,
    seoTitle,
    seoDescription,
    seoKeywords,
    slug,
    h1,
    h2,
    styles,
  };

  // Create the article and connect it to categories in one transaction
  const article = await prisma.article.create({
    data: {
      title,
      content,
      type,
      authorId,
      categories: {
        connect: categoryIds.map((categoryId) => ({ id: categoryId })),
      },
      contentJson,
    },
  });

  return article;
};

import axios from 'axios';

// OpenAI integration
export async function aiGenerateSEO(article: { title: string }): Promise<{ seoTitle: string; seoDescription: string; seoKeywords: string[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const prompt = `Generate SEO metadata for the news article titled: "${article.title}". Return title, description, and keywords as JSON.`;
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 150,
  }, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  // Parse response (assume JSON in content)
  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}

// Gemini integration (Google)
async function geminiGenerateHeadlines(content: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');
  // Example endpoint and prompt (replace with actual Gemini API usage)
  const prompt = `Generate 3-5 headline points for the following news content: "${content}". Return as JSON array.`;
  const response = await axios.post('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=' + apiKey, {
    contents: [{ parts: [{ text: prompt }] }]
  });
  // Parse response (assume JSON array in text)
  const text = response.data.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

// Transliteration (use npm package or AI)
async function transliterateTeluguToEnglish(teluguTitle: string): Promise<string> {
  // For demo, use OpenAI for transliteration
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const prompt = `Transliterate the following Telugu title to an English slug (not translation, just phonetic): "${teluguTitle}". Return only the slug.`;
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 20,
  }, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return response.data.choices[0].message.content.trim();
}

async function aiGenerateShortNews(content: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const prompt = `Summarize the following news content in 60 words: "${content}"`;
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 100,
  }, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  return response.data.choices[0].message.content.trim();
}

async function aiSplitTitle(title: string): Promise<{ h1: string; h2: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const prompt = `If the following title is longer than 30 characters, split it into H1 (first part) and H2 (second part). Return as JSON: { h1: ..., h2: ... }. Title: "${title}"`;
  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 60,
  }, {
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const content = response.data.choices[0].message.content;
  return JSON.parse(content);
}

export async function triggerAIPostProcessing(
  article: { id: string; title: string; content: string; headlines?: string[] },
  originalBody: { type: string }
) {
  try {
    let updates: Record<string, any> = {};
    // Citizen reporter logic
    if (originalBody.type === 'citizen') {
      updates = await aiGenerateSEO(article);
      updates.slug = await transliterateTeluguToEnglish(article.title);
    }
    // Reporter logic
    else if (originalBody.type === 'reporter') {
      if (!article.headlines || article.headlines.length === 0) {
        updates.headlines = await geminiGenerateHeadlines(article.content);
      }
      updates.slug = await transliterateTeluguToEnglish(article.title);
      updates.shortNews = await aiGenerateShortNews(article.content);
      Object.assign(updates, await aiGenerateSEO(article));
      if (article.title.length > 30) {
        Object.assign(updates, await aiSplitTitle(article.title));
      }
    }
    // Update article in DB (contentJson)
    await prisma.article.update({ where: { id: article.id }, data: { contentJson: updates } });
    console.log('AI post-processing updates for article', article.id, updates);
  } catch (err) {
    console.error('AI post-processing failed:', err);
  }
}
