/**
 * Block Suggestion Controller
 * Suggests best-fit block template based on article content
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { EpaperBlockStatus, EpaperBlockCategory } from '@prisma/client';

// Character count thresholds for block column suggestions
const CHAR_THRESHOLDS = {
  COL_2: 500,    // Very short articles
  COL_4: 1500,   // Short articles
  COL_6: 3000,   // Medium articles
  COL_10: 5000,  // Long articles
  // Anything above 5000 chars → 12 columns
};

// ============================================================================
// HELPERS
// ============================================================================

async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isSuperAdmin: boolean }> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();
  
  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  
  let tenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    tenantId = reporter?.tenantId || null;
  }
  
  if (isSuperAdmin && (req.query as any).tenantId) {
    tenantId = String((req.query as any).tenantId).trim();
  }
  
  return { tenantId, isSuperAdmin };
}

/**
 * Calculate character count from content
 */
function calculateCharCount(content: string): number {
  // Remove HTML tags if present
  const plainText = content.replace(/<[^>]*>/g, '').trim();
  return plainText.length;
}

/**
 * Determine suggested column size based on character count
 */
function suggestColumnSize(charCount: number, hasImage: boolean): number {
  // If very short, suggest 2-column
  if (charCount <= CHAR_THRESHOLDS.COL_2) {
    return 2;
  }
  
  // Short content - 4 columns
  if (charCount <= CHAR_THRESHOLDS.COL_4) {
    return 4;
  }
  
  // Medium content - 6 columns (standard)
  if (charCount <= CHAR_THRESHOLDS.COL_6) {
    return 6;
  }
  
  // Long content - 10 columns
  if (charCount <= CHAR_THRESHOLDS.COL_10) {
    return 10;
  }
  
  // Very long content - full width banner
  return 12;
}

// ============================================================================
// SUGGEST BLOCK TEMPLATE
// ============================================================================

export const suggestBlockTemplate = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    const { 
      content, 
      charCount: providedCharCount, 
      hasImage = false,
      imageAspectRatio,
      preferCompact = false,
      articleId,
    } = req.body;
    
    // Calculate or use provided char count
    let charCount = providedCharCount;
    if (!charCount && content) {
      charCount = calculateCharCount(content);
    }
    
    // If articleId provided, get content from database
    if (!charCount && articleId) {
      const article = await prisma.newspaperArticle.findUnique({
        where: { id: articleId },
        include: {
          baseArticle: {
            select: { contentJson: true },
          },
        },
      });
      
      if (article) {
        // Try to get content from baseArticle.contentJson
        const contentJson = article.baseArticle?.contentJson as any;
        if (contentJson?.raw?.body) {
          charCount = calculateCharCount(contentJson.raw.body);
        } else if (contentJson?.body) {
          charCount = calculateCharCount(contentJson.body);
        }
      }
    }
    
    if (!charCount) {
      return res.status(400).json({ 
        error: 'Either content, charCount, or articleId is required' 
      });
    }
    
    // Determine suggested column size
    const suggestedColumns = suggestColumnSize(charCount, hasImage);
    
    // Adjust for user preferences
    const targetColumns = preferCompact 
      ? Math.max(2, suggestedColumns - 2) 
      : suggestedColumns;
    
    // Build query for matching templates
    const where: any = {
      category: EpaperBlockCategory.CONTENT,
      status: EpaperBlockStatus.ACTIVE,
      OR: [
        { isGlobal: true },
      ],
    };
    
    // Include tenant-specific templates
    if (ctx.tenantId) {
      where.OR.push({ tenantId: ctx.tenantId });
    }
    
    // Find templates matching the column count
    const templates = await prisma.epaperBlockTemplate.findMany({
      where: {
        ...where,
        columns: targetColumns,
      },
      orderBy: [
        { isGlobal: 'desc' }, // Prefer global templates first
        { name: 'asc' },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        columns: true,
        widthInches: true,
        minHeightInches: true,
        maxHeightInches: true,
        previewImageUrl: true,
        components: true,
        isGlobal: true,
        tenantId: true,
      },
    });
    
    // If no exact match, find alternatives
    let alternatives: typeof templates = [];
    if (templates.length === 0) {
      // Find templates with nearby column counts
      alternatives = await prisma.epaperBlockTemplate.findMany({
        where: {
          ...where,
          columns: {
            in: [
              Math.max(2, targetColumns - 2),
              Math.min(12, targetColumns + 2),
            ],
          },
        },
        orderBy: [
          { columns: 'asc' },
          { isGlobal: 'desc' },
        ],
        select: {
          id: true,
          code: true,
          name: true,
          description: true,
          columns: true,
          widthInches: true,
          minHeightInches: true,
          maxHeightInches: true,
          previewImageUrl: true,
          components: true,
          isGlobal: true,
          tenantId: true,
        },
      });
    }
    
    // Calculate fit score for each template
    type TemplateWithScore = typeof templates[0] & { fitScore: number };
    
    const scoredTemplates: TemplateWithScore[] = templates.map((template): TemplateWithScore => {
      const components = template.components as any;
      let score = 100;
      
      // Penalize if template has image component but article has no image
      if (components?.image && !hasImage) {
        score -= 20;
      }
      
      // Bonus if template matches image aspect ratio
      if (hasImage && components?.image && imageAspectRatio) {
        const templateRatio = components.image.aspectRatio;
        if (templateRatio && Math.abs(templateRatio - imageAspectRatio) < 0.1) {
          score += 15;
        }
      }
      
      // Bonus for tenant-specific over global
      if (!template.isGlobal && template.tenantId === ctx.tenantId) {
        score += 5;
      }
      
      return {
        ...template,
        fitScore: score,
      };
    }).sort((a: TemplateWithScore, b: TemplateWithScore) => b.fitScore - a.fitScore);
    
    const primary = scoredTemplates[0] || alternatives[0];
    
    res.json({
      analysis: {
        charCount,
        suggestedColumns: targetColumns,
        hasImage,
        imageAspectRatio,
      },
      suggestion: primary ? {
        template: primary,
        confidence: primary.fitScore >= 80 ? 'high' : primary.fitScore >= 60 ? 'medium' : 'low',
      } : null,
      alternatives: scoredTemplates.length > 1 
        ? scoredTemplates.slice(1, 4) 
        : alternatives.slice(0, 3),
      message: primary 
        ? `Recommended ${primary.columns}-column template for ${charCount} characters`
        : 'No matching templates found. Consider creating custom templates.',
    });
  } catch (error) {
    console.error('suggestBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to suggest block template' });
  }
};
