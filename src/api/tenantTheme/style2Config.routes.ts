import { Router } from 'express';
import passport from 'passport';
import { requireSuperOrTenantAdminScoped } from '../middlewares/authz';
import prisma from '../../lib/prisma';

const router = Router();

/**
 * Default Style2 theme configuration template
 */
const DEFAULT_STYLE2_THEME_CONFIG = {
  sections: [
    {
      id: 1,
      position: 1,
      section_type: "hero_sidebar",
      hero_category: "latest",
      sidebar_category: "trending",
      bottom_category: "latest"
    },
    {
      id: 2,
      position: 2,
      section_type: "category_boxes_3col",
      categories: ["politics", "sports", "entertainment"]
    },
    {
      id: 3,
      position: 3,
      section_type: "small_cards_3col",
      categories: ["national", "international", "technology"]
    },
    {
      id: 4,
      position: 4,
      section_type: "magazine_grid",
      category: "business",
      theme_color: "emerald"
    },
    {
      id: 5,
      position: 5,
      section_type: "horizontal_scroll",
      category: "cinema",
      theme_color: "rose"
    },
    {
      id: 6,
      position: 6,
      section_type: "spotlight",
      category: "breaking",
      theme_color: "amber"
    },
    {
      id: 7,
      position: 7,
      section_type: "newspaper_columns",
      categories: ["opinion", "education", "health"],
      theme_color: "blue"
    },
    {
      id: 8,
      position: 8,
      section_type: "magazine_grid",
      category: "science",
      theme_color: "violet"
    },
    {
      id: 9,
      position: 9,
      section_type: "horizontal_cards",
      category: "lifestyle",
      theme_color: "cyan"
    },
    {
      id: 10,
      position: 10,
      section_type: "photo_gallery",
      category: "photos"
    },
    {
      id: 11,
      position: 11,
      section_type: "timeline",
      category: "latest",
      theme_color: "indigo"
    },
    {
      id: 12,
      position: 12,
      section_type: "featured_banner",
      category: "special",
      theme_color: "red"
    },
    {
      id: 13,
      position: 13,
      section_type: "compact_lists_2col",
      categories: ["trending", "popular"]
    }
  ]
};

/**
 * Available section types for Style2 theme
 */
export const STYLE2_SECTION_TYPES = [
  "hero_sidebar",
  "category_boxes_3col", 
  "small_cards_3col",
  "magazine_grid",
  "horizontal_scroll",
  "spotlight",
  "newspaper_columns", 
  "horizontal_cards",
  "photo_gallery",
  "timeline",
  "featured_banner",
  "compact_lists_2col"
];

/**
 * Available theme colors for sections
 */
export const THEME_COLORS = [
  "emerald", "rose", "amber", "blue", "violet", 
  "cyan", "indigo", "red", "green", "purple",
  "pink", "yellow", "teal", "orange", "slate"
];

/**
 * @swagger
 * /tenant-theme/{tenantId}/style2-config:
 *   get:
 *     summary: Get Style2 theme configuration (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Returns the complete Style2 theme configuration including sections, section types,
 *       categories, and theme colors for homepage layout. This configuration drives
 *       the Style2 homepage appearance and data organization.
 *     tags: [Tenant Theme, Style2 Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: The tenant ID to get Style2 config for
 *     responses:
 *       200:
 *         description: Style2 theme configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sections:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: number }
 *                           position: { type: number }
 *                           section_type: { type: string }
 *                           category: { type: string }
 *                           categories: 
 *                             type: array
 *                             items: { type: string }
 *                           theme_color: { type: string }
 *                           hero_category: { type: string }
 *                           sidebar_category: { type: string }
 *                           bottom_category: { type: string }
 *             examples:
 *               style2Config:
 *                 summary: Complete Style2 theme configuration
 *                 value:
 *                   success: true
 *                   data:
 *                     sections:
 *                       - id: 1
 *                         position: 1
 *                         section_type: "hero_sidebar"
 *                         hero_category: "latest"
 *                         sidebar_category: "trending"
 *                         bottom_category: "latest"
 *                       - id: 2
 *                         position: 2
 *                         section_type: "category_boxes_3col"
 *                         categories: ["politics", "sports", "entertainment"]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.get(
  '/:tenantId/style2-config',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get existing tenant theme and style2 config
      const tenantTheme = await prisma.tenantTheme.findUnique({ 
        where: { tenantId } 
      }).catch(() => null);

      const homepageConfig = (tenantTheme as any)?.homepageConfig || {};
      const style2Config = homepageConfig.style2 || {};
      const style2ThemeConfig = style2Config.themeConfig || DEFAULT_STYLE2_THEME_CONFIG;

      // Validate and ensure all sections have required fields
      const validatedSections = style2ThemeConfig.sections.map((section: any, index: number) => ({
        id: section.id || (index + 1),
        position: section.position || (index + 1),
        section_type: section.section_type || "magazine_grid",
        ...(section.category && { category: section.category }),
        ...(section.categories && Array.isArray(section.categories) && { categories: section.categories }),
        ...(section.theme_color && { theme_color: section.theme_color }),
        ...(section.hero_category && { hero_category: section.hero_category }),
        ...(section.sidebar_category && { sidebar_category: section.sidebar_category }),
        ...(section.bottom_category && { bottom_category: section.bottom_category }),
      }));

      res.json({
        success: true,
        data: {
          sections: validatedSections
        }
      });
    } catch (error) {
      console.error('Error fetching Style2 theme config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch Style2 theme configuration'
      });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/style2-config:
 *   put:
 *     summary: Update Style2 theme configuration (TENANT_ADMIN scoped or SUPER_ADMIN)  
 *     description: |
 *       Updates the complete Style2 theme configuration. This replaces the entire
 *       configuration with the provided sections array. Each section defines how
 *       content is displayed and which categories are linked.
 *     tags: [Tenant Theme, Style2 Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: The tenant ID to update Style2 config for
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sections]
 *             properties:
 *               sections:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [position, section_type]
 *                   properties:
 *                     id: { type: number }
 *                     position: { type: number }
 *                     section_type: 
 *                       type: string
 *                       enum: ["hero_sidebar", "category_boxes_3col", "small_cards_3col", "magazine_grid", "horizontal_scroll", "spotlight", "newspaper_columns", "horizontal_cards", "photo_gallery", "timeline", "featured_banner", "compact_lists_2col"]
 *                     category: { type: string, description: "Single category slug for single-category sections" }
 *                     categories: 
 *                       type: array
 *                       items: { type: string }
 *                       description: "Array of category slugs for multi-category sections"
 *                     theme_color: 
 *                       type: string
 *                       enum: ["emerald", "rose", "amber", "blue", "violet", "cyan", "indigo", "red", "green", "purple", "pink", "yellow", "teal", "orange", "slate"]
 *                     hero_category: { type: string, description: "Category for hero section (hero_sidebar only)" }
 *                     sidebar_category: { type: string, description: "Category for sidebar (hero_sidebar only)" }
 *                     bottom_category: { type: string, description: "Category for bottom section (hero_sidebar only)" }
 *           examples:
 *             updateConfig:
 *               summary: Update Style2 configuration
 *               value:
 *                 sections:
 *                   - id: 1
 *                     position: 1
 *                     section_type: "hero_sidebar"
 *                     hero_category: "breaking"
 *                     sidebar_category: "politics"
 *                     bottom_category: "latest"
 *                   - id: 2
 *                     position: 2
 *                     section_type: "magazine_grid"
 *                     category: "sports"
 *                     theme_color: "blue"
 *     responses:
 *       200:
 *         description: Style2 configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sections: 
 *                       type: array
 *                       items: { type: object }
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.put(
  '/:tenantId/style2-config',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;
      const { sections } = req.body;

      // Validate request
      if (!Array.isArray(sections) || sections.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'sections array is required and must not be empty'
        });
      }

      // Validate sections
      const validatedSections = [];
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        
        if (!section.section_type || !STYLE2_SECTION_TYPES.includes(section.section_type)) {
          return res.status(400).json({
            success: false,
            error: `Invalid section_type "${section.section_type}" at index ${i}. Must be one of: ${STYLE2_SECTION_TYPES.join(', ')}`
          });
        }

        if (typeof section.position !== 'number') {
          return res.status(400).json({
            success: false,
            error: `Invalid position at index ${i}. Must be a number.`
          });
        }

        if (section.theme_color && !THEME_COLORS.includes(section.theme_color)) {
          return res.status(400).json({
            success: false,
            error: `Invalid theme_color "${section.theme_color}" at index ${i}. Must be one of: ${THEME_COLORS.join(', ')}`
          });
        }

        validatedSections.push({
          id: section.id || (i + 1),
          position: section.position,
          section_type: section.section_type,
          ...(section.category && { category: section.category }),
          ...(section.categories && Array.isArray(section.categories) && { categories: section.categories }),
          ...(section.theme_color && { theme_color: section.theme_color }),
          ...(section.hero_category && { hero_category: section.hero_category }),
          ...(section.sidebar_category && { sidebar_category: section.sidebar_category }),
          ...(section.bottom_category && { bottom_category: section.bottom_category }),
        });
      }

      // Sort sections by position
      validatedSections.sort((a, b) => a.position - b.position);

      // Get existing tenant theme or create new structure
      const existingTheme = await prisma.tenantTheme.findUnique({ 
        where: { tenantId } 
      }).catch(() => null);

      const existingHomepageConfig = (existingTheme as any)?.homepageConfig || {};
      const existingStyle2 = existingHomepageConfig.style2 || {};

      // Update the theme configuration
      const updatedHomepageConfig = {
        ...existingHomepageConfig,
        style2: {
          ...existingStyle2,
          themeConfig: {
            sections: validatedSections
          }
        }
      };

      // Save to database
      const savedTheme = existingTheme
        ? await prisma.tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: updatedHomepageConfig }
          })
        : await prisma.tenantTheme.create({
            data: { 
              tenantId, 
              homepageConfig: updatedHomepageConfig 
            }
          });

      res.json({
        success: true,
        message: 'Style2 theme configuration updated successfully',
        data: {
          sections: validatedSections
        }
      });
    } catch (error) {
      console.error('Error updating Style2 theme config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update Style2 theme configuration'
      });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/style2-config/apply-default:
 *   post:
 *     summary: Apply default Style2 theme configuration (TENANT_ADMIN scoped or SUPER_ADMIN)
 *     description: |
 *       Applies the default Style2 theme configuration with predefined sections,
 *       section types, categories, and theme colors. Use this to quickly set up
 *       a working Style2 theme configuration.
 *     tags: [Tenant Theme, Style2 Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: The tenant ID to apply default Style2 config for
 *     responses:
 *       200:
 *         description: Default Style2 configuration applied successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sections: 
 *                       type: array
 *                       items: { type: object }
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Server error
 */
router.post(
  '/:tenantId/style2-config/apply-default',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    try {
      const { tenantId } = req.params;

      // Get existing tenant theme or create new structure
      const existingTheme = await prisma.tenantTheme.findUnique({ 
        where: { tenantId } 
      }).catch(() => null);

      const existingHomepageConfig = (existingTheme as any)?.homepageConfig || {};
      const existingStyle2 = existingHomepageConfig.style2 || {};

      // Apply default configuration
      const updatedHomepageConfig = {
        ...existingHomepageConfig,
        style2: {
          ...existingStyle2,
          themeConfig: DEFAULT_STYLE2_THEME_CONFIG
        }
      };

      // Save to database
      const savedTheme = existingTheme
        ? await prisma.tenantTheme.update({
            where: { tenantId },
            data: { homepageConfig: updatedHomepageConfig }
          })
        : await prisma.tenantTheme.create({
            data: { 
              tenantId, 
              homepageConfig: updatedHomepageConfig 
            }
          });

      res.json({
        success: true,
        message: 'Default Style2 theme configuration applied successfully',
        data: DEFAULT_STYLE2_THEME_CONFIG
      });
    } catch (error) {
      console.error('Error applying default Style2 theme config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply default Style2 theme configuration'
      });
    }
  }
);

/**
 * @swagger
 * /tenant-theme/{tenantId}/style2-config/section-types:
 *   get:
 *     summary: Get available Style2 section types and theme colors
 *     description: |
 *       Returns the list of available section types and theme colors that can be
 *       used in Style2 theme configuration. This is useful for building admin UI
 *       dropdown menus and validation.
 *     tags: [Tenant Theme, Style2 Config]
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: tenantId
 *         required: true
 *         schema: { type: string }
 *         description: The tenant ID (required for authorization scope)
 *     responses:
 *       200:
 *         description: Available section types and theme colors
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     sectionTypes:
 *                       type: array
 *                       items: { type: string }
 *                     themeColors:
 *                       type: array  
 *                       items: { type: string }
 *             example:
 *               success: true
 *               data:
 *                 sectionTypes: ["hero_sidebar", "category_boxes_3col", "magazine_grid"]
 *                 themeColors: ["emerald", "rose", "amber", "blue"]
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.get(
  '/:tenantId/style2-config/section-types',
  passport.authenticate('jwt', { session: false }),
  requireSuperOrTenantAdminScoped,
  async (req, res) => {
    res.json({
      success: true,
      data: {
        sectionTypes: STYLE2_SECTION_TYPES,
        themeColors: THEME_COLORS
      }
    });
  }
);

export { router as style2ConfigRoutes };