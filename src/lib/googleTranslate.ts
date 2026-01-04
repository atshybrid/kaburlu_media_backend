import axios from 'axios';
import { config } from '../config/env';

function decodeBasicHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

export async function googleTranslateText(params: {
  text: string;
  target: string;
  source?: string;
}): Promise<string> {
  const apiKey = config.google.translateApiKey;
  if (!apiKey) return '';

  const text = String(params.text ?? '').trim();
  const target = String(params.target ?? '').trim();
  const source = params.source ? String(params.source).trim() : undefined;
  if (!text || !target) return '';

  try {
    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;
    const payload: any = { q: text, target, format: 'text' };
    if (source) payload.source = source;

    const resp = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15_000,
    });

    const translated = resp?.data?.data?.translations?.[0]?.translatedText;
    if (!translated || typeof translated !== 'string') return '';
    return decodeBasicHtmlEntities(translated).trim();
  } catch (e) {
    console.warn('[googleTranslateText] translate failed', e);
    return '';
  }
}
