/**
 * GDPR Compliance APIs
 *
 * - GET /users/me/data-export - Export all user data (Article 20)
 * - POST /users/me/delete-request - Request account deletion (Article 17)
 * - GET /users/me/delete-request - Check deletion request status
 */

import { Router, Request, Response } from 'express';
import passport from 'passport';
import prisma from '../../lib/prisma';

const router = Router();

// -----------------------------------------------------------------------------
// Helper: Get authenticated user ID from JWT
// -----------------------------------------------------------------------------
function getAuthUserId(req: Request): string | null {
  const user = req.user as { id?: string; sub?: string; kind?: string } | undefined;
  if (!user) return null;
  // Support both `id` and `sub` from JWT payload
  return user.id || user.sub || null;
}

// -----------------------------------------------------------------------------
// GET /users/me/data-export
// GDPR Article 20 - Right to Data Portability
// -----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/users/me/data-export:
 *   get:
 *     summary: Export all user data (GDPR Article 20)
 *     description: |
 *       Returns all personal data associated with the authenticated user.
 *       This includes profile information, preferences, articles, reactions,
 *       comments, and devices. The response can be saved as JSON for portability.
 *     tags:
 *       - GDPR
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data export successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profile:
 *                   type: object
 *                   properties:
 *                     fullName:
 *                       type: string
 *                     email:
 *                       type: string
 *                     mobileNumber:
 *                       type: string
 *                     dateOfBirth:
 *                       type: string
 *                       format: date
 *                     gender:
 *                       type: string
 *                     occupation:
 *                       type: string
 *                     education:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                 preferences:
 *                   type: object
 *                   properties:
 *                     languageId:
 *                       type: string
 *                     locationPlaceId:
 *                       type: string
 *                     locationName:
 *                       type: string
 *                 articles:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       title:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 reactions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       contentId:
 *                         type: string
 *                       contentType:
 *                         type: string
 *                       reaction:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 comments:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       articleId:
 *                         type: string
 *                       content:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                 devices:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       deviceId:
 *                         type: string
 *                       deviceModel:
 *                         type: string
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 exportedAt:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - JWT token required
 *       500:
 *         description: Failed to export data
 */
router.get(
  '/me/data-export',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please login again.'
        });
      }

      // Fetch all user data in parallel
      const [user, profile, location, articles, shortNews, reactions, comments, devices] = await Promise.all([
        // Core user record
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            mobileNumber: true,
            languageId: true,
            createdAt: true,
            updatedAt: true,
            status: true
          }
        }),
        // User profile
        prisma.userProfile.findUnique({
          where: { userId },
          select: {
            fullName: true,
            lastName: true,
            gender: true,
            dob: true,
            maritalStatus: true,
            bio: true,
            profilePhotoUrl: true,
            occupation: true,
            education: true,
            address: true,
            caste: true,
            subCaste: true,
            surname: true,
            emergencyContactNumber: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        // User location
        prisma.userLocation.findUnique({
          where: { userId },
          select: {
            latitude: true,
            longitude: true,
            placeId: true,
            placeName: true,
            address: true,
            createdAt: true,
            updatedAt: true
          }
        }),
        // Articles authored by user
        prisma.article.findMany({
          where: { authorId: userId },
          select: {
            id: true,
            title: true,
            status: true,
            type: true,
            createdAt: true,
            scheduledAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        // ShortNews authored by user
        prisma.shortNews.findMany({
          where: { authorId: userId },
          select: {
            id: true,
            title: true,
            status: true,
            placeName: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        // Content reactions (likes/dislikes)
        prisma.contentReaction.findMany({
          where: { userId },
          select: {
            contentId: true,
            contentType: true,
            reaction: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        // Comments
        prisma.comment.findMany({
          where: { userId },
          select: {
            id: true,
            articleId: true,
            shortNewsId: true,
            content: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        }),
        // Devices
        prisma.device.findMany({
          where: { userId },
          select: {
            deviceId: true,
            deviceModel: true,
            placeName: true,
            updatedAt: true
          }
        })
      ]);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Build the export response
      const exportData = {
        profile: {
          fullName: profile?.fullName || null,
          lastName: profile?.lastName || null,
          email: user.email || null,
          mobileNumber: user.mobileNumber || null,
          dateOfBirth: profile?.dob || null,
          gender: profile?.gender || null,
          maritalStatus: profile?.maritalStatus || null,
          occupation: profile?.occupation || null,
          education: profile?.education || null,
          bio: profile?.bio || null,
          profilePhotoUrl: profile?.profilePhotoUrl || null,
          address: profile?.address || null,
          caste: profile?.caste || null,
          subCaste: profile?.subCaste || null,
          surname: profile?.surname || null,
          emergencyContactNumber: profile?.emergencyContactNumber || null,
          accountCreatedAt: user.createdAt
        },
        preferences: {
          languageId: user.languageId,
          locationPlaceId: location?.placeId || null,
          locationName: location?.placeName || null,
          locationAddress: location?.address || null,
          latitude: location?.latitude || null,
          longitude: location?.longitude || null
        },
        articles: articles.map(a => ({
          id: a.id,
          title: a.title,
          status: a.status,
          type: a.type,
          createdAt: a.createdAt
        })),
        shortNews: shortNews.map(sn => ({
          id: sn.id,
          title: sn.title,
          status: sn.status,
          placeName: sn.placeName,
          createdAt: sn.createdAt
        })),
        reactions: reactions.map(r => ({
          contentId: r.contentId,
          contentType: r.contentType,
          reaction: r.reaction,
          createdAt: r.createdAt
        })),
        comments: comments.map(c => ({
          id: c.id,
          articleId: c.articleId,
          shortNewsId: c.shortNewsId,
          content: c.content,
          createdAt: c.createdAt
        })),
        devices: devices.map(d => ({
          deviceId: d.deviceId,
          deviceModel: d.deviceModel,
          lastLocationName: d.placeName,
          lastActiveAt: d.updatedAt
        })),
        exportedAt: new Date().toISOString()
      };

      return res.json(exportData);
    } catch (error) {
      console.error('[GDPR] Data export failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to export data'
      });
    }
  }
);

// -----------------------------------------------------------------------------
// POST /users/me/delete-request
// GDPR Article 17 - Right to Erasure (Right to be Forgotten)
// -----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/users/me/delete-request:
 *   post:
 *     summary: Request account deletion (GDPR Article 17)
 *     description: |
 *       Submit a request to delete your account and all associated data.
 *       As per GDPR regulations, the request will be processed within 30 days.
 *       You will receive a ticket ID to track the status of your request.
 *     tags:
 *       - GDPR
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for deletion (optional)
 *                 example: user_requested
 *                 enum:
 *                   - user_requested
 *                   - privacy_concerns
 *                   - not_using_anymore
 *                   - other
 *     responses:
 *       200:
 *         description: Deletion request submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Your deletion request has been submitted. We will process it within 30 days as required by law.
 *                 ticketId:
 *                   type: string
 *                   example: DEL-1706612400000
 *                 dueDate:
 *                   type: string
 *                   format: date-time
 *                   description: The date by which the request will be processed
 *       400:
 *         description: Existing pending request
 *       401:
 *         description: Unauthorized - JWT token required
 *       500:
 *         description: Failed to submit deletion request
 */
router.post(
  '/me/delete-request',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please login again.'
        });
      }

      const { reason } = req.body;

      // Check for existing pending request
      const existingRequest = await prisma.deletionRequest.findFirst({
        where: {
          userId,
          status: { in: ['PENDING', 'PROCESSING'] }
        }
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending deletion request.',
          ticketId: `DEL-${existingRequest.id}`,
          status: existingRequest.status,
          dueDate: existingRequest.dueDate.toISOString()
        });
      }

      // Calculate due date (30 days from now as per GDPR)
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      // Create deletion request
      const deletionRequest = await prisma.deletionRequest.create({
        data: {
          userId,
          reason: reason || 'user_requested',
          status: 'PENDING',
          requestedAt: new Date(),
          dueDate
        }
      });

      // TODO: Send email notification to admin
      // await sendAdminNotification('DELETION_REQUEST', { userId, ticketId: deletionRequest.id });

      // TODO: Send confirmation email/SMS to user
      // await sendUserNotification(userId, 'DELETION_CONFIRMATION', { ticketId: deletionRequest.id });

      return res.json({
        success: true,
        message: 'Your deletion request has been submitted. We will process it within 30 days as required by law.',
        ticketId: `DEL-${deletionRequest.id}`,
        dueDate: dueDate.toISOString()
      });
    } catch (error) {
      console.error('[GDPR] Delete request failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to submit deletion request'
      });
    }
  }
);

// -----------------------------------------------------------------------------
// GET /users/me/delete-request
// Check the status of a deletion request
// -----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/users/me/delete-request:
 *   get:
 *     summary: Check deletion request status
 *     description: |
 *       Get the status of your account deletion request.
 *       Returns the most recent deletion request if one exists.
 *     tags:
 *       - GDPR
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 hasRequest:
 *                   type: boolean
 *                 request:
 *                   type: object
 *                   properties:
 *                     ticketId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [PENDING, PROCESSING, COMPLETED, CANCELLED]
 *                     reason:
 *                       type: string
 *                     requestedAt:
 *                       type: string
 *                       format: date-time
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - JWT token required
 *       500:
 *         description: Failed to fetch deletion request status
 */
router.get(
  '/me/delete-request',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please login again.'
        });
      }

      // Get the most recent deletion request
      const deletionRequest = await prisma.deletionRequest.findFirst({
        where: { userId },
        orderBy: { requestedAt: 'desc' }
      });

      if (!deletionRequest) {
        return res.json({
          hasRequest: false,
          request: null
        });
      }

      return res.json({
        hasRequest: true,
        request: {
          ticketId: `DEL-${deletionRequest.id}`,
          status: deletionRequest.status,
          reason: deletionRequest.reason,
          requestedAt: deletionRequest.requestedAt.toISOString(),
          dueDate: deletionRequest.dueDate.toISOString(),
          completedAt: deletionRequest.completedAt?.toISOString() || null
        }
      });
    } catch (error) {
      console.error('[GDPR] Get delete request status failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch deletion request status'
      });
    }
  }
);

// -----------------------------------------------------------------------------
// DELETE /users/me/delete-request
// Cancel a pending deletion request
// -----------------------------------------------------------------------------
/**
 * @swagger
 * /api/v1/users/me/delete-request:
 *   delete:
 *     summary: Cancel deletion request
 *     description: |
 *       Cancel a pending account deletion request.
 *       Only requests with PENDING status can be cancelled.
 *     tags:
 *       - GDPR
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Deletion request cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Your deletion request has been cancelled.
 *       400:
 *         description: No pending request to cancel or request already processing
 *       401:
 *         description: Unauthorized - JWT token required
 *       500:
 *         description: Failed to cancel deletion request
 */
router.delete(
  '/me/delete-request',
  passport.authenticate('jwt', { session: false }),
  async (req: Request, res: Response) => {
    try {
      const userId = getAuthUserId(req);
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized. Please login again.'
        });
      }

      // Find pending deletion request
      const pendingRequest = await prisma.deletionRequest.findFirst({
        where: {
          userId,
          status: 'PENDING'
        }
      });

      if (!pendingRequest) {
        // Check if there's a processing request
        const processingRequest = await prisma.deletionRequest.findFirst({
          where: {
            userId,
            status: 'PROCESSING'
          }
        });

        if (processingRequest) {
          return res.status(400).json({
            success: false,
            message: 'Your deletion request is already being processed and cannot be cancelled. Please contact support.',
            ticketId: `DEL-${processingRequest.id}`
          });
        }

        return res.status(400).json({
          success: false,
          message: 'No pending deletion request found to cancel.'
        });
      }

      // Cancel the request
      await prisma.deletionRequest.update({
        where: { id: pendingRequest.id },
        data: {
          status: 'CANCELLED',
          completedAt: new Date()
        }
      });

      return res.json({
        success: true,
        message: 'Your deletion request has been cancelled.',
        ticketId: `DEL-${pendingRequest.id}`
      });
    } catch (error) {
      console.error('[GDPR] Cancel delete request failed:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to cancel deletion request'
      });
    }
  }
);

export default router;
