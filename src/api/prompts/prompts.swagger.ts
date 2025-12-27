/**
 * @swagger
 * tags:
 *   - name: Prompts
 *     description: |
 *       Admin endpoints to manage AI prompt templates used by the system.
 *
 *       Common keys used by article rewrite pipeline:
 *       - `ai_rewrite_prompt_true` (tenant AI enabled → FULL rewrite)
 *       - `ai_rewrite_prompt_false` (tenant AI disabled → LIMITED SEO + shortnews)
 *
 *       Tip: set env vars `AI_REWRITE_PROMPT_TRUE` / `AI_REWRITE_PROMPT_FALSE` to the DB key name (e.g. `ai_rewrite_prompt_true`) to load prompt content from the Prompt table.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     PromptItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Unique identifier (cuid)
 *         key:
 *           type: string
 *           description: Unique key for the prompt template
 *         content:
 *           type: string
 *           description: The prompt template text (may include {{placeholders}})
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional human-readable description
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *     UpsertPromptRequest:
 *       type: object
 *       required: [key, content]
 *       properties:
 *         key:
 *           type: string
 *           description: Unique key identifying the template (e.g., SEO_GENERATION)
 *         content:
 *           type: string
 *           description: New or updated template body
 *         description:
 *           type: string
 *           nullable: true
 *           description: Optional description
 *       example:
 *         key: "ai_rewrite_prompt_true"
 *         description: "FULL rewrite prompt (newspaper+web+shortnews)"
 *         content: "You are an editor..."
 */

/**
 * @swagger
 * /prompts:
 *   get:
 *     summary: List all AI prompt templates
 *     description: Requires roles SUPERADMIN, LANGUAGE_ADMIN, or NEWS_DESK_ADMIN.
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of prompts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PromptItem'
 *       403:
 *         description: Forbidden
 */

/**
 * @swagger
 * /prompts:
 *   put:
 *     summary: Create or update a prompt template
 *     description: Upserts a template by key. Requires roles SUPERADMIN, LANGUAGE_ADMIN, or NEWS_DESK_ADMIN.
 *     tags: [Prompts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpsertPromptRequest'
 *     responses:
 *       200:
 *         description: Upserted template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/PromptItem'
 *       400:
 *         description: Missing key or content
 *       403:
 *         description: Forbidden
 */
