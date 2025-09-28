/**
 * @swagger
 * tags:
 *   - name: ShortNews Options
 *     description: One-line options/opinions on ShortNews (max 50 chars, one per user per shortnews)
 */

/**
 * @swagger
 * /shortnews-options:
 *   post:
 *     tags: [ShortNews Options]
 *     summary: Create an option for a ShortNews (one per user)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shortNewsId, content]
 *             properties:
 *               shortNewsId:
 *                 type: string
 *               content:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: ShortNews not found
 *       409:
 *         description: Already exists for this user
 */

/**
 * @swagger
 * /shortnews-options/by-user/{userId}:
 *   get:
 *     tags: [ShortNews Options]
 *     summary: List a user's options
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 */

/**
 * @swagger
 * /shortnews-options/by-shortnews/{shortNewsId}:
 *   get:
 *     tags: [ShortNews Options]
 *     summary: List options for a ShortNews with user profile name and photo
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 */

/**
 * @swagger
 * /shortnews-options/by-user/{userId}/shortnews/{shortNewsId}:
 *   get:
 *     tags: [ShortNews Options]
 *     summary: Get a specific user's option for a ShortNews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /shortnews-options/by-shortnews/{shortNewsId}/me:
 *   get:
 *     tags: [ShortNews Options]
 *     summary: Get the current user's option for a ShortNews
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shortNewsId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * /shortnews-options/{id}:
 *   put:
 *     tags: [ShortNews Options]
 *     summary: Update own option
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 maxLength: 50
 *     responses:
 *       200:
 *         description: Updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *   delete:
 *     tags: [ShortNews Options]
 *     summary: Delete own option
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Deleted
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */
