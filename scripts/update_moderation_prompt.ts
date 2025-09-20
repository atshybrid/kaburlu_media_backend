import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// New moderation prompt text tuned to only escalate when there is extremely high certainty of severe issues.
const NEW_MODERATION_PROMPT = `High precision news content moderation.
Goal: ONLY escalate to desk (decision = "REVIEW" or "BLOCK") for:
- Explicit hate speech targeting protected groups
- Direct incitement or credible threat of violence
- Graphic sexual / child exploitation content (BLOCK)
- Highly sensitive personal data (full Aadhaar, bank, passwords, exact home address) intentionally exposed
- Terrorism praise or recruitment
- Clear deepfake / synthetic media used to mislead (political figure, election manipulation) with 99% confidence
Everything else (mild profanity, political criticism, satire, reported allegations without slurs, partial IDs, ambiguous context) should be ALLOW.
Return STRICT JSON: {"plagiarismScore": number (0-1), "sensitiveFlags": string[], "decision": "ALLOW"|"REVIEW"|"BLOCK", "remark": string (short, in {{languageCode}})}.
Rules:
1. Use REVIEW only if severe but uncertainty or needs human judgment.
2. Use BLOCK only for unquestionably disallowed (child abuse, explicit terror praise, doxxing, direct threats, extreme hate slur + call to harm).
3. Do NOT add extra fields. No markdown. Pure JSON.
4. Keep remark concise (<120 chars) and in {{languageCode}}.
5. If no issues: decision = ALLOW, sensitiveFlags = [].
Text: {{content}}`;

async function main() {
  const existing = await prisma.prompt.findUnique({ where: { key: 'MODERATION' } });
  if (!existing) {
    await prisma.prompt.create({ data: { key: 'MODERATION', content: NEW_MODERATION_PROMPT, description: 'High precision moderation (low false positives)' } });
    console.log('Created MODERATION prompt.');
  } else {
    await prisma.prompt.update({ where: { key: 'MODERATION' }, data: { content: NEW_MODERATION_PROMPT, description: 'High precision moderation (low false positives)' } });
    console.log('Updated MODERATION prompt.');
  }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
