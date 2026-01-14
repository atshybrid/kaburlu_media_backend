/**
 * Block Template Controller
 * Handles CRUD operations for ePaper block templates
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { EpaperBlockCategory, EpaperBlockSubCategory, EpaperBlockStatus } from '@prisma/client';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract tenant context from authenticated user
 */
async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isAdmin: boolean; isSuperAdmin: boolean; userId: string }> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();
  
  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR' || roleName === 'DESK_EDITOR';
  
  // Get tenant from reporter profile
  let tenantId: string | null = null;
  if (!isSuperAdmin && userId) {
    const reporter = await prisma.reporter.findFirst({
      where: { userId },
      select: { tenantId: true },
    });
    tenantId = reporter?.tenantId || null;
  }
  
  // Allow tenantId from query: SUPER_ADMIN always; admin roles if reporter mapping missing
  if ((req.query as any).tenantId) {
    const requestedTenantId = String((req.query as any).tenantId).trim();
    if (isSuperAdmin) {
      tenantId = requestedTenantId;
    } else if (isAdmin && !tenantId) {
      tenantId = requestedTenantId;
    }
  }
  
  return { tenantId, isAdmin, isSuperAdmin, userId };
}

// ============================================================================
// LIST TEMPLATES
// ============================================================================

export const listBlockTemplates = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    const { category, subCategory, status, columns, includeGlobal = 'true' } = req.query as any;
    
    const where: any = {
      OR: [],
    };
    
    // Include global templates
    if (includeGlobal !== 'false') {
      where.OR.push({ isGlobal: true, status: EpaperBlockStatus.ACTIVE });
    }
    
    // Include tenant-specific templates
    if (ctx.tenantId) {
      where.OR.push({ tenantId: ctx.tenantId });
    }
    
    // If no conditions, just get global active
    if (where.OR.length === 0) {
      where.OR.push({ isGlobal: true, status: EpaperBlockStatus.ACTIVE });
    }
    
    // Apply filters
    if (category) {
      where.category = category as EpaperBlockCategory;
    }
    if (subCategory) {
      where.subCategory = subCategory as EpaperBlockSubCategory;
    }
    if (status) {
      where.status = status as EpaperBlockStatus;
    }
    if (columns) {
      where.columns = parseInt(String(columns), 10);
    }
    
    const templates = await prisma.epaperBlockTemplate.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { columns: 'asc' },
        { name: 'asc' },
      ],
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        category: true,
        subCategory: true,
        columns: true,
        widthInches: true,
        minHeightInches: true,
        maxHeightInches: true,
        previewImageUrl: true,
        isLocked: true,
        status: true,
        isGlobal: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    
    res.json({
      total: templates.length,
      items: templates,
    });
  } catch (error) {
    console.error('listBlockTemplates error:', error);
    res.status(500).json({ error: 'Failed to list block templates' });
  }
};

// ============================================================================
// GET TEMPLATE BY ID
// ============================================================================

export const getBlockTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = await getTenantContext(req);
    
    const template = await prisma.epaperBlockTemplate.findUnique({
      where: { id },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Block template not found' });
    }
    
    // Check access: global templates are public, tenant templates need matching tenant
    if (!template.isGlobal && template.tenantId !== ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json(template);
  } catch (error) {
    console.error('getBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to get block template' });
  }
};

// ============================================================================
// CREATE TEMPLATE
// ============================================================================

export const createBlockTemplate = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can create block templates' });
    }
    
    const {
      code,
      name,
      description,
      category,
      subCategory,
      columns,
      widthInches,
      minHeightInches,
      maxHeightInches,
      components,
    } = req.body;
    
    // Validate required fields
    if (!code || !name || !category || !subCategory || !columns || !widthInches || !maxHeightInches || !components) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check for duplicate code
    const existing = await prisma.epaperBlockTemplate.findUnique({
      where: { code },
    });
    if (existing) {
      return res.status(400).json({ error: `Template code '${code}' already exists` });
    }
    
    // Create template (tenant-specific, not locked, draft status)
    const template = await prisma.epaperBlockTemplate.create({
      data: {
        code,
        name,
        description,
        category: category as EpaperBlockCategory,
        subCategory: subCategory as EpaperBlockSubCategory,
        columns: parseInt(String(columns), 10),
        widthInches: parseFloat(String(widthInches)),
        minHeightInches: minHeightInches ? parseFloat(String(minHeightInches)) : null,
        maxHeightInches: parseFloat(String(maxHeightInches)),
        components,
        isLocked: false,
        status: EpaperBlockStatus.DRAFT,
        isGlobal: ctx.isSuperAdmin && !ctx.tenantId, // Only super admin can create global templates
        tenantId: ctx.tenantId,
      },
    });
    
    res.status(201).json(template);
  } catch (error) {
    console.error('createBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to create block template' });
  }
};

// ============================================================================
// UPDATE TEMPLATE
// ============================================================================

export const updateBlockTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can update block templates' });
    }
    
    const template = await prisma.epaperBlockTemplate.findUnique({
      where: { id },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Block template not found' });
    }
    
    // Check ownership
    if (!template.isGlobal && template.tenantId !== ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Cannot edit locked templates (except status to ARCHIVED)
    if (template.isLocked && req.body.status !== 'ARCHIVED') {
      return res.status(400).json({ error: 'Cannot edit locked template. Clone it instead.' });
    }
    
    // Cannot edit global templates unless super admin
    if (template.isGlobal && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'Cannot edit global templates' });
    }
    
    const {
      name,
      description,
      minHeightInches,
      maxHeightInches,
      components,
      status,
    } = req.body;
    
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (minHeightInches !== undefined) updateData.minHeightInches = parseFloat(String(minHeightInches));
    if (maxHeightInches !== undefined) updateData.maxHeightInches = parseFloat(String(maxHeightInches));
    if (components !== undefined) updateData.components = components;
    if (status !== undefined) updateData.status = status as EpaperBlockStatus;
    
    const updated = await prisma.epaperBlockTemplate.update({
      where: { id },
      data: updateData,
    });
    
    res.json(updated);
  } catch (error) {
    console.error('updateBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to update block template' });
  }
};

// ============================================================================
// DELETE (ARCHIVE) TEMPLATE
// ============================================================================

export const deleteBlockTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can delete block templates' });
    }
    
    const template = await prisma.epaperBlockTemplate.findUnique({
      where: { id },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Block template not found' });
    }
    
    // Cannot delete global templates
    if (template.isGlobal && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'Cannot delete global templates' });
    }
    
    // Check ownership
    if (!template.isGlobal && template.tenantId !== ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Soft delete (archive)
    await prisma.epaperBlockTemplate.update({
      where: { id },
      data: { status: EpaperBlockStatus.ARCHIVED },
    });
    
    res.json({ success: true, message: 'Template archived' });
  } catch (error) {
    console.error('deleteBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to delete block template' });
  }
};

// ============================================================================
// CLONE TEMPLATE
// ============================================================================

export const cloneBlockTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can clone block templates' });
    }
    
    if (!ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const source = await prisma.epaperBlockTemplate.findUnique({
      where: { id },
    });
    
    if (!source) {
      return res.status(404).json({ error: 'Source template not found' });
    }
    
    const { newCode, newName } = req.body;
    const code = newCode || `${source.code}_CLONE_${Date.now()}`;
    const name = newName || `${source.name} (Copy)`;
    
    // Check for duplicate code
    const existing = await prisma.epaperBlockTemplate.findUnique({
      where: { code },
    });
    if (existing) {
      return res.status(400).json({ error: `Template code '${code}' already exists` });
    }
    
    // Create clone (tenant-specific, not locked, draft status)
    const clone = await prisma.epaperBlockTemplate.create({
      data: {
        code,
        name,
        description: source.description,
        category: source.category,
        subCategory: source.subCategory,
        columns: source.columns,
        widthInches: source.widthInches,
        minHeightInches: source.minHeightInches,
        maxHeightInches: source.maxHeightInches,
        components: source.components as any,
        previewImageUrl: null, // Reset preview
        isLocked: false,
        status: EpaperBlockStatus.DRAFT,
        isGlobal: false, // Clones are always tenant-specific
        tenantId: ctx.tenantId,
      },
    });
    
    res.status(201).json(clone);
  } catch (error) {
    console.error('cloneBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to clone block template' });
  }
};

// ============================================================================
// LOCK TEMPLATE
// ============================================================================

export const lockBlockTemplate = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can lock block templates' });
    }
    
    const template = await prisma.epaperBlockTemplate.findUnique({
      where: { id },
    });
    
    if (!template) {
      return res.status(404).json({ error: 'Block template not found' });
    }
    
    // Check ownership
    if (!template.isGlobal && template.tenantId !== ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (template.isLocked) {
      return res.status(400).json({ error: 'Template is already locked' });
    }
    
    // Validate template has required components
    const components = template.components as any;
    if (!components || typeof components !== 'object') {
      return res.status(400).json({ error: 'Template must have valid components before locking' });
    }
    
    // Lock the template and set to ACTIVE
    const locked = await prisma.epaperBlockTemplate.update({
      where: { id },
      data: {
        isLocked: true,
        status: EpaperBlockStatus.ACTIVE,
        // TODO: Generate preview image and store URL
        // previewImageUrl: await generatePreviewImage(template),
      },
    });
    
    res.json({
      success: true,
      message: 'Template locked and activated',
      template: locked,
    });
  } catch (error) {
    console.error('lockBlockTemplate error:', error);
    res.status(500).json({ error: 'Failed to lock block template' });
  }
};
