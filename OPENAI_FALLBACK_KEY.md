# OpenAI Fallback API Key Feature

## Overview
Automatic failover to a secondary OpenAI API key when the primary key encounters quota limits, rate limits, or authentication issues.

## How It Works

### 1. Environment Configuration
Add an optional fallback API key to your `.env` file:

```env
# Primary OpenAI API key
OPENAI_API_KEY=sk-proj-YOUR_PRIMARY_KEY

# Secondary/Fallback OpenAI API key (optional)
# Automatically used when primary key fails with quota/rate limits
OPENAI_API_KEY_FALLBACK=sk-proj-YOUR_SECONDARY_KEY
```

### 2. Automatic Failover Logic
When making OpenAI API calls, the system:

1. **First tries the primary key** (`OPENAI_API_KEY`)
2. **Detects failure conditions**:
   - HTTP 429 (Rate limit exceeded / Quota exceeded)
   - HTTP 401 (Unauthorized)
   - HTTP 403 (Forbidden)
   - Error messages containing: "quota", "rate limit", "insufficient"
3. **Automatically switches to fallback key** if available
4. **Logs the failover** for monitoring:
   ```
   [AI][openai] Primary key failed (429), trying fallback key...
   [AI][openai] ✓ Fallback key succeeded for newspaper
   ```

### 3. Usage Tracking
The `usage` object returned by AI calls includes a `usedFallback` boolean:

```typescript
{
  provider: 'openai',
  purpose: 'newspaper',
  model: 'gpt-4o-mini',
  usedFallback: true,  // true when fallback key was used
  prompt_tokens: 150,
  completion_tokens: 300,
  total_tokens: 450
}
```

## Use Cases

### 1. High Availability
Prevent AI feature outages when one API key hits limits:
```
Primary key: Production API key with high quota
Fallback key: Backup key from different OpenAI account
```

### 2. Load Distribution
Distribute load across multiple API keys:
```
Primary key: Free tier / low quota key
Fallback key: Paid tier key (only used when primary exhausted)
```

### 3. Multi-Environment Setup
Different keys for different purposes:
```
Primary key: Development/testing key
Fallback key: Production-grade key
```

## Implementation Details

### Files Modified

1. **`.env`** - Added `OPENAI_API_KEY_FALLBACK`
2. **`src/config/env.ts`** - Added `apiKeyFallback` to config
3. **`src/lib/aiConfig.ts`** - Exported `OPENAI_KEY_FALLBACK`
4. **`src/lib/aiProvider.ts`** - Implemented failover logic in `tryOpenAI()`

### Code Changes

**aiProvider.ts - Failover Logic:**
```typescript
const keysToTry = [OPENAI_KEY, OPENAI_KEY_FALLBACK].filter(Boolean);

try {
  // Try primary key
  const result = await callOpenAIChat(model, keysToTry[0]);
  // Success - return result
} catch (primaryError) {
  const shouldTryFallback = keysToTry.length > 1 && 
    (status === 429 || status === 401 || status === 403 || 
     /quota|rate.?limit|insufficient/i.test(errMsg));
  
  if (shouldTryFallback) {
    // Try fallback key
    const result = await callOpenAIChat(model, keysToTry[1]);
    // Success - mark usedFallback: true
  }
}
```

## Testing

### Test Failover Behavior
1. Set an **invalid primary key** to simulate failure:
   ```env
   OPENAI_API_KEY=sk-invalid-key-12345
   OPENAI_API_KEY_FALLBACK=sk-proj-VALID_KEY
   ```

2. Make an AI request:
   ```bash
   curl -X POST http://localhost:3001/api/v1/ai/newspaper \
     -H "Content-Type: application/json" \
     -d '{"title": "Test Article"}'
   ```

3. Check logs for failover:
   ```
   [AI][openai] Primary key failed (401), trying fallback key...
   [AI][openai] ✓ Fallback key succeeded for newspaper
   ```

### Monitor Failover Usage
Check database or logs for `usedFallback: true` to track how often failover occurs.

## Best Practices

### 1. Use Different OpenAI Accounts
Don't use two keys from the same account - they share quota limits.

### 2. Monitor Failover Frequency
If fallback is used frequently:
- Upgrade primary key quota
- Add more credits to primary account
- Consider load balancing strategy

### 3. Alert on Dual Failure
Both keys failing indicates a critical issue:
```javascript
if (!primaryResult && !fallbackResult) {
  // Send alert - both OpenAI keys exhausted
}
```

### 4. Rotate Keys
Periodically rotate both keys for security:
```
Week 1: Primary=KeyA, Fallback=KeyB
Week 2: Primary=KeyB, Fallback=KeyC (KeyA decommissioned)
```

## Troubleshooting

### Both Keys Failing
**Symptom:** `[AI][openai] Fallback key also failed (429)`

**Solutions:**
1. Check billing at https://platform.openai.com/account/billing
2. Verify quota limits for both accounts
3. Wait for quota reset (often 1 minute or 1 day depending on limit)
4. Add payment method to increase quota

### Fallback Not Being Used
**Symptom:** Primary fails but fallback never tries

**Checks:**
1. Verify `OPENAI_API_KEY_FALLBACK` is set in `.env`
2. Check if error is a failover condition (429/401/403)
3. Review logs for "trying fallback key..." message

### Wrong Key Being Used
**Symptom:** Fallback used when primary should work

**Checks:**
1. Verify primary key is valid
2. Check primary key quota status
3. Review error logs for actual failure reason

## Production Deployment

### DigitalOcean / Render / Vercel
1. Add both environment variables in platform settings
2. Redeploy application
3. Monitor logs for failover behavior

### Local Development
1. Update `.env` file
2. Restart dev server: `npm run dev`
3. Test AI endpoints

## Related Documentation
- [AI_REWRITE_FEATURE.md](./AI_REWRITE_FEATURE.md) - AI content generation
- [GEMINI.md](./GEMINI.md) - Gemini AI provider (removed)
- [README.md](./README.md) - Main project documentation

## Version History
- **2025-01-21**: Initial implementation of OpenAI fallback key feature
