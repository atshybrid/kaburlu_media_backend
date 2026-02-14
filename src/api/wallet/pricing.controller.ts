/**
 * Tenant Pricing Management Controller
 * Super admin APIs to configure tenant-specific pricing
 */

import { Request, Response } from 'express';
import prisma from '../../lib/prisma';
import { TenantService } from '@prisma/client';

/**
 * Get tenant pricing
 * GET /api/v1/admin/tenants/:tenantId/pricing
 */
export async function getTenantPricing(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const pricing = await prisma.tenantPricing.findMany({
      where: { tenantId },
      orderBy: [{ service: 'asc' }, { effectiveFrom: 'desc' }],
    });

    return res.json({ pricing });
  } catch (error) {
    console.error('Error getting tenant pricing:', error);
    return res.status(500).json({ error: 'Failed to get pricing' });
  }
}

/**
 * Set tenant pricing
 * POST /api/v1/admin/tenants/:tenantId/pricing
 */
export async function setTenantPricing(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;
    const {
      service,
      minEpaperPages,
      pricePerPageMinor,
      monthlyFeeMinor,
      discount6MonthPercent,
      discount12MonthPercent,
      effectiveFrom,
    } = req.body;

    if (!service) {
      return res.status(400).json({ error: 'Service required' });
    }

    // Validate service-specific fields
    if (service === TenantService.EPAPER) {
      if (!pricePerPageMinor) {
        return res.status(400).json({ error: 'pricePerPageMinor required for ePaper service' });
      }
    } else {
      if (!monthlyFeeMinor) {
        return res.status(400).json({ error: 'monthlyFeeMinor required for this service' });
      }
    }

    // Deactivate previous pricing for this service
    await prisma.tenantPricing.updateMany({
      where: {
        tenantId,
        service,
        isActive: true,
      },
      data: {
        isActive: false,
        effectiveUntil: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      },
    });

    // Create new pricing
    const pricing = await prisma.tenantPricing.create({
      data: {
        tenantId,
        service,
        minEpaperPages: minEpaperPages || 8,
        pricePerPageMinor,
        monthlyFeeMinor,
        discount6MonthPercent: discount6MonthPercent || 5.0,
        discount12MonthPercent: discount12MonthPercent || 15.0,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      },
    });

    return res.json({
      message: 'Pricing set successfully',
      pricing,
    });
  } catch (error) {
    console.error('Error setting tenant pricing:', error);
    return res.status(500).json({ error: 'Failed to set pricing' });
  }
}

/**
 * Update tenant pricing
 * PUT /api/v1/admin/tenants/:tenantId/pricing/:pricingId
 */
export async function updateTenantPricing(req: Request, res: Response) {
  try {
    const { pricingId } = req.params;
    const {
      minEpaperPages,
      pricePerPageMinor,
      monthlyFeeMinor,
      discount6MonthPercent,
      discount12MonthPercent,
      isActive,
    } = req.body;

    const data: any = {};
    if (minEpaperPages !== undefined) data.minEpaperPages = minEpaperPages;
    if (pricePerPageMinor !== undefined) data.pricePerPageMinor = pricePerPageMinor;
    if (monthlyFeeMinor !== undefined) data.monthlyFeeMinor = monthlyFeeMinor;
    if (discount6MonthPercent !== undefined) data.discount6MonthPercent = discount6MonthPercent;
    if (discount12MonthPercent !== undefined) data.discount12MonthPercent = discount12MonthPercent;
    if (isActive !== undefined) data.isActive = isActive;

    const pricing = await prisma.tenantPricing.update({
      where: { id: pricingId },
      data,
    });

    return res.json({
      message: 'Pricing updated successfully',
      pricing,
    });
  } catch (error) {
    console.error('Error updating tenant pricing:', error);
    return res.status(500).json({ error: 'Failed to update pricing' });
  }
}

/**
 * Delete tenant pricing
 * DELETE /api/v1/admin/tenants/:tenantId/pricing/:pricingId
 */
export async function deleteTenantPricing(req: Request, res: Response) {
  try {
    const { pricingId } = req.params;

    await prisma.tenantPricing.delete({
      where: { id: pricingId },
    });

    return res.json({ message: 'Pricing deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant pricing:', error);
    return res.status(500).json({ error: 'Failed to delete pricing' });
  }
}

/**
 * Get tenant active services summary
 * GET /api/v1/admin/tenants/:tenantId/services
 */
export async function getTenantServices(req: Request, res: Response) {
  try {
    const { tenantId } = req.params;

    const pricing = await prisma.tenantPricing.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const services = pricing.map((p) => ({
      service: p.service,
      pricing: {
        minEpaperPages: p.minEpaperPages,
        pricePerPage: p.pricePerPageMinor ? `₹${p.pricePerPageMinor / 100}` : null,
        monthlyFee: p.monthlyFeeMinor ? `₹${p.monthlyFeeMinor / 100}` : null,
        discount6Month: `${p.discount6MonthPercent}%`,
        discount12Month: `${p.discount12MonthPercent}%`,
      },
      effectiveFrom: p.effectiveFrom,
      effectiveUntil: p.effectiveUntil,
    }));

    return res.json({ services });
  } catch (error) {
    console.error('Error getting tenant services:', error);
    return res.status(500).json({ error: 'Failed to get services' });
  }
}

/**
 * Activate/Deactivate tenant service
 * POST /api/v1/admin/tenants/:tenantId/services/:service/toggle
 */
export async function toggleTenantService(req: Request, res: Response) {
  try {
    const { tenantId, service } = req.params;
    const { activate } = req.body;

    if (activate === undefined) {
      return res.status(400).json({ error: 'activate field required (true/false)' });
    }

    const updated = await prisma.tenantPricing.updateMany({
      where: {
        tenantId,
        service: service as TenantService,
      },
      data: {
        isActive: activate,
      },
    });

    return res.json({
      message: `Service ${activate ? 'activated' : 'deactivated'} successfully`,
      updated: updated.count,
    });
  } catch (error) {
    console.error('Error toggling service:', error);
    return res.status(500).json({ error: 'Failed to toggle service' });
  }
}
