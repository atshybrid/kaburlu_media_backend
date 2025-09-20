// Simple smoke test for AI short news generation helper (no external AI call).
// Run with: npm run ai:smoke
import { generateAiShortNewsFromPrompt } from '../src/api/shortnews/shortnews.ai';

async function main() {
  const rawText = `today early morning heavy rain caused localized flooding near the old market road vendors moved stock police diverted two wheelers water receding slowly municipal staff arrived with pumps residents watching cautiously awaiting further updates authorities warning commuters to avoid low lying lanes for few more hours while shop owners cleaned entrances and children stayed indoors local officials monitoring drains`; // ~70 words now
  let call = 0;
  const aiFn = async () => {
    call++;
    if (call === 1) {
      // Under-length draft triggers retry
      return JSON.stringify({ title: 'Rain causes flooding', content: 'Rain caused flooding near market.' });
    }
    return JSON.stringify({ title: 'Rain floods market road', content: rawText.split(/\s+/).slice(0, 60).join(' '), suggestedCategoryName: 'Weather' });
  };
  const prompt = 'TEST PROMPT';
  const out = await generateAiShortNewsFromPrompt(rawText, prompt, aiFn, { minWords: 58, maxWords: 60, maxAttempts: 3 });
  console.log('Smoke Output:', out);
  if (out.content.split(/\s+/).length < 58) {
    throw new Error('Content under minimum words after retries');
  }
  console.log('AI draft helper smoke test passed.');
}

main().catch(e => { console.error(e); process.exit(1); });
