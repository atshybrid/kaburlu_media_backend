/**
 * ePaper Settings Controller
 * Handles tenant-specific ePaper configuration
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { EpaperBlockStatus } from '@prisma/client';

// ============================================================================
// HELPERS
// ============================================================================

async function getTenantContext(req: Request): Promise<{ tenantId: string | null; isAdmin: boolean; isSuperAdmin: boolean; userId: string }> {
  const user = (req as any).user;
  const userId = String(user?.id || '');
  const roleName = String(user?.role?.name || '').toUpperCase();
  
  const isSuperAdmin = roleName === 'SUPER_ADMIN';
  const isAdmin = isSuperAdmin || roleName === 'TENANT_ADMIN' || roleName === 'ADMIN_EDITOR';
  
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
  
  return { tenantId, isAdmin, isSuperAdmin, userId };
}

// Default page settings for broadsheet newspaper
const DEFAULT_PAGE_SETTINGS = {
  pageWidthInches: 13,
  pageHeightInches: 22,
  gridColumns: 12,
  paddingTop: 0.5,
  paddingRight: 0.5,
  paddingBottom: 0.5,
  paddingLeft: 0.5,
  defaultPageCount: 8,
};

// ============================================================================
// GET SETTINGS
// ============================================================================

export const getEpaperSettings = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.tenantId && !ctx.isSuperAdmin) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const settings = await prisma.epaperSettings.findUnique({
      where: { tenantId: ctx.tenantId! },
      include: {
        mainHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        innerHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        footerTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
      },
    });
    
    if (!settings) {
      // Return defaults with indication that settings need to be initialized
      return res.json({
        initialized: false,
        defaults: DEFAULT_PAGE_SETTINGS,
        message: 'ePaper settings not initialized. Call POST /initialize to create settings.',
      });
    }
    
    res.json({
      initialized: true,
      ...settings,
    });
  } catch (error) {
    console.error('getEpaperSettings error:', error);
    res.status(500).json({ error: 'Failed to get ePaper settings' });
  }
};

// ============================================================================
// INITIALIZE SETTINGS
// ============================================================================

export const initializeEpaperSettings = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can initialize ePaper settings' });
    }
    
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    // Check if already exists
    const existing = await prisma.epaperSettings.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    
    if (existing) {
      return res.status(400).json({ error: 'ePaper settings already initialized. Use PUT to update.' });
    }
    
    // Find default header and footer templates
    const mainHeaderTemplate = await prisma.epaperBlockTemplate.findFirst({
      where: {
        code: 'BT_MAIN_HEADER',
        isGlobal: true,
        status: EpaperBlockStatus.ACTIVE,
      },
    });
    
    const innerHeaderTemplate = await prisma.epaperBlockTemplate.findFirst({
      where: {
        code: 'BT_INNER_HEADER',
        isGlobal: true,
        status: EpaperBlockStatus.ACTIVE,
      },
    });
    
    const footerTemplate = await prisma.epaperBlockTemplate.findFirst({
      where: {
        code: 'BT_LAST_PAGE_FOOTER',
        isGlobal: true,
        status: EpaperBlockStatus.ACTIVE,
      },
    });
    
    // Get tenant details for printer info
    const tenant = await prisma.tenant.findUnique({
      where: { id: ctx.tenantId },
      select: { name: true },
    });
    
    // Create settings with defaults
    const settings = await prisma.epaperSettings.create({
      data: {
        tenantId: ctx.tenantId,
        pageWidthInches: DEFAULT_PAGE_SETTINGS.pageWidthInches,
        pageHeightInches: DEFAULT_PAGE_SETTINGS.pageHeightInches,
        gridColumns: DEFAULT_PAGE_SETTINGS.gridColumns,
        paddingTop: DEFAULT_PAGE_SETTINGS.paddingTop,
        paddingRight: DEFAULT_PAGE_SETTINGS.paddingRight,
        paddingBottom: DEFAULT_PAGE_SETTINGS.paddingBottom,
        paddingLeft: DEFAULT_PAGE_SETTINGS.paddingLeft,
        defaultPageCount: DEFAULT_PAGE_SETTINGS.defaultPageCount,
        // Header templates
        mainHeaderTemplateId: mainHeaderTemplate?.id,
        mainHeaderHeightInches: 3,
        innerHeaderTemplateId: innerHeaderTemplate?.id,
        innerHeaderHeightInches: 1,
        // Footer template
        footerTemplateId: footerTemplate?.id,
        footerHeightInches: 0.5,
        footerStyle: 'dots',
        // Last page printer info (default placeholders)
        showPrinterInfoOnLastPage: true,
        printerName: tenant?.name || 'Publication Name',
        publisherName: 'Publisher Name',
        editorName: 'Editor Name',
      },
      include: {
        mainHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        innerHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        footerTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
      },
    });
    
    res.status(201).json({
      initialized: true,
      ...settings,
    });
  } catch (error) {
    console.error('initializeEpaperSettings error:', error);
    res.status(500).json({ error: 'Failed to initialize ePaper settings' });
  }
};

// ============================================================================
// UPDATE SETTINGS
// ============================================================================

export const updateEpaperSettings = async (req: Request, res: Response) => {
  try {
    const ctx = await getTenantContext(req);
    
    if (!ctx.isAdmin) {
      return res.status(403).json({ error: 'Only admins can update ePaper settings' });
    }
    
    if (!ctx.tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }
    
    const existing = await prisma.epaperSettings.findUnique({
      where: { tenantId: ctx.tenantId },
    });
    
    if (!existing) {
      return res.status(404).json({ error: 'ePaper settings not found. Call POST /initialize first.' });
    }
    
    const {
      // Page dimensions
      pageWidthInches,
      pageHeightInches,
      gridColumns,
      paddingTop,
      paddingRight,
      paddingBottom,
      paddingLeft,
      defaultPageCount,
      // Header templates
      mainHeaderTemplateId,
      mainHeaderHeightInches,
      innerHeaderTemplateId,
      innerHeaderHeightInches,
      // Footer
      footerTemplateId,
      footerHeightInches,
      footerStyle,
      // Last page printer info
      showPrinterInfoOnLastPage,
      printerName,
      printerAddress,
      printerCity,
      publisherName,
      editorName,
      ownerName,
      rniNumber,
      lastPageFooterTemplate,
      // Generation config
      generationConfig,
    } = req.body;
    
    const updateData: any = {};
    
    // Page dimensions
    if (pageWidthInches !== undefined) updateData.pageWidthInches = parseFloat(String(pageWidthInches));
    if (pageHeightInches !== undefined) updateData.pageHeightInches = parseFloat(String(pageHeightInches));
    if (gridColumns !== undefined) updateData.gridColumns = parseInt(String(gridColumns), 10);
    if (paddingTop !== undefined) updateData.paddingTop = parseFloat(String(paddingTop));
    if (paddingRight !== undefined) updateData.paddingRight = parseFloat(String(paddingRight));
    if (paddingBottom !== undefined) updateData.paddingBottom = parseFloat(String(paddingBottom));
    if (paddingLeft !== undefined) updateData.paddingLeft = parseFloat(String(paddingLeft));
    if (defaultPageCount !== undefined) updateData.defaultPageCount = parseInt(String(defaultPageCount), 10);
    
    // Header templates
    if (mainHeaderTemplateId !== undefined) {
      if (mainHeaderTemplateId) {
        const template = await prisma.epaperBlockTemplate.findUnique({
          where: { id: mainHeaderTemplateId },
        });
        if (!template || template.category !== 'HEADER') {
          return res.status(400).json({ error: 'Invalid main header template' });
        }
      }
      updateData.mainHeaderTemplateId = mainHeaderTemplateId || null;
    }
    if (mainHeaderHeightInches !== undefined) updateData.mainHeaderHeightInches = parseFloat(String(mainHeaderHeightInches));
    
    if (innerHeaderTemplateId !== undefined) {
      if (innerHeaderTemplateId) {
        const template = await prisma.epaperBlockTemplate.findUnique({
          where: { id: innerHeaderTemplateId },
        });
        if (!template || template.category !== 'HEADER') {
          return res.status(400).json({ error: 'Invalid inner header template' });
        }
      }
      updateData.innerHeaderTemplateId = innerHeaderTemplateId || null;
    }
    if (innerHeaderHeightInches !== undefined) updateData.innerHeaderHeightInches = parseFloat(String(innerHeaderHeightInches));
    
    // Footer
    if (footerTemplateId !== undefined) {
      if (footerTemplateId) {
        const template = await prisma.epaperBlockTemplate.findUnique({
          where: { id: footerTemplateId },
        });
        if (!template || template.category !== 'FOOTER') {
          return res.status(400).json({ error: 'Invalid footer template' });
        }
      }
      updateData.footerTemplateId = footerTemplateId || null;
    }
    if (footerHeightInches !== undefined) updateData.footerHeightInches = parseFloat(String(footerHeightInches));
    if (footerStyle !== undefined) updateData.footerStyle = footerStyle;
    
    // Last page printer info
    if (showPrinterInfoOnLastPage !== undefined) updateData.showPrinterInfoOnLastPage = Boolean(showPrinterInfoOnLastPage);
    if (printerName !== undefined) updateData.printerName = printerName;
    if (printerAddress !== undefined) updateData.printerAddress = printerAddress;
    if (printerCity !== undefined) updateData.printerCity = printerCity;
    if (publisherName !== undefined) updateData.publisherName = publisherName;
    if (editorName !== undefined) updateData.editorName = editorName;
    if (ownerName !== undefined) updateData.ownerName = ownerName;
    if (rniNumber !== undefined) updateData.rniNumber = rniNumber;
    if (lastPageFooterTemplate !== undefined) updateData.lastPageFooterTemplate = lastPageFooterTemplate;
    
    // Generation config
    if (generationConfig !== undefined) updateData.generationConfig = generationConfig;
    
    const settings = await prisma.epaperSettings.update({
      where: { tenantId: ctx.tenantId },
      data: updateData,
      include: {
        mainHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        innerHeaderTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
        footerTemplate: {
          select: { id: true, code: true, name: true, previewImageUrl: true },
        },
      },
    });
    
    res.json({
      initialized: true,
      ...settings,
    });
  } catch (error) {
    console.error('updateEpaperSettings error:', error);
    res.status(500).json({ error: 'Failed to update ePaper settings' });
  }
};
