import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { subscribeToTopic, unsubscribeFromTopic } from '../../lib/fcm';
import { subscribeDeviceToLanguageTopics } from '../../lib/smartPush';
import { upsertDeviceForUser } from '../../lib/deviceUpsert';

function getJwtUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(
      auth.slice(7),
      process.env.JWT_SECRET || 'your-default-secret',
    ) as { sub?: string };
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Update user preferences (location, language, FCM token)
 * Supports both guest users (via deviceId) and registered users (via userId)
 * 
 * POST /preferences/update
 */
export const updateUserPreferencesController = async (req: Request, res: Response) => {
  try {
    const {
      deviceId,
      userId,
      location,
      languageId,
      pushToken,
      deviceModel,
      forceUpdate = false
    } = req.body as {
      deviceId?: string;
      userId?: string;
      location?: {
        latitude: number;
        longitude: number;
        accuracyMeters?: number;
        placeId?: string;
        placeName?: string;
        address?: string;
        source?: string;
      };
      languageId?: string;
      pushToken?: string;
      deviceModel?: string;
      forceUpdate?: boolean;
    };

    console.log('[Update Preferences] Request received:', {
      hasDeviceId: !!deviceId,
      hasUserId: !!userId,
      hasLocation: !!location,
      hasLanguageId: !!languageId,
      hasPushToken: !!pushToken,
      forceUpdate,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection.remoteAddress
    });

    // Validate required parameters
    const jwtUserId = getJwtUserId(req);
    const resolvedUserId = userId || jwtUserId || undefined;

    if (!deviceId && !resolvedUserId) {
      return res.status(400).json({
        success: false,
        message: 'Either deviceId or userId is required',
        code: 'MISSING_IDENTIFIER',
      });
    }

    if (userId && jwtUserId && userId !== jwtUserId) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden',
        code: 'USER_MISMATCH',
      });
    }

    if (pushToken && !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'deviceId is required when pushToken is provided',
        code: 'MISSING_DEVICE_ID',
      });
    }

    if (resolvedUserId && !userId) {
      // Allow JWT-only requests (mobile may send userId in body; tolerate omission)
      (req.body as any).userId = resolvedUserId;
    }

    // Validate language if provided
    let languageData = null;
    if (languageId) {
      languageData = await prisma.language.findUnique({ where: { id: languageId } });
      if (!languageData) {
        return res.status(400).json({
          success: false,
          message: 'Invalid languageId',
          code: 'INVALID_LANGUAGE'
        });
      }
    }

    let targetUser = null;
    let targetDevice = null;
    let isGuestUser = false;

    // Find user and device based on provided identifier
    const effectiveUserId = (req.body as any).userId as string | undefined;

    if (effectiveUserId) {
      // Registered user case
      targetUser = await prisma.user.findUnique({
        where: { id: effectiveUserId },
        include: {
          role: true,
          language: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      if (deviceId) {
        targetDevice = await upsertDeviceForUser({
          userId: targetUser.id,
          deviceId,
          deviceModel,
          pushToken: pushToken || undefined,
          location: location?.latitude && location?.longitude ? location : undefined,
        });
      }
    } else if (deviceId) {
      // Guest user case - find device first
      targetDevice = await prisma.device.findUnique({
        where: { deviceId },
        include: {
          user: {
            include: { role: true, language: true }
          }
        }
      });

      if (targetDevice?.user) {
        targetUser = targetDevice.user;
        isGuestUser = targetUser.role?.name === 'GUEST';
      } else {
        // Create guest user and device
        const guestRole = await prisma.role.findUnique({ where: { name: 'GUEST' } });
        if (!guestRole) {
          return res.status(500).json({
            success: false,
            message: 'Guest role not found',
            code: 'MISSING_GUEST_ROLE'
          });
        }

        // Use default language or provided language
        const defaultLanguage = languageData || await prisma.language.findFirst({ where: { code: 'en' } });
        if (!defaultLanguage) {
          return res.status(500).json({
            success: false,
            message: 'Default language not found',
            code: 'MISSING_DEFAULT_LANGUAGE'
          });
        }

        // Create guest user with device
        targetUser = await prisma.user.create({
          data: {
            roleId: guestRole.id,
            languageId: languageId || defaultLanguage.id,
            status: 'ACTIVE',
            devices: {
              create: {
                deviceId,
                deviceModel: deviceModel || 'unknown',
                pushToken
              }
            }
          },
          include: { role: true, language: true, devices: true }
        });

        targetDevice = targetUser.devices[0];
        isGuestUser = true;
      }
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
      });
    }

    // Registered user without deviceId: language-only / user-level updates (no push sync)
    if (!targetDevice && !isGuestUser) {
      if (pushToken) {
        return res.status(400).json({
          success: false,
          message: 'deviceId is required when pushToken is provided',
          code: 'MISSING_DEVICE_ID',
        });
      }
    } else if (!targetUser || (!targetDevice && isGuestUser)) {
      return res.status(500).json({
        success: false,
        message: 'Failed to resolve user and device',
        code: 'RESOLUTION_FAILED',
      });
    }

    const updates: any = {};
    const deviceUpdates: any = {};
    const locationUpdates: any = {};

    // Handle language update
    let oldLanguageCode = targetUser.language?.code;
    if (languageId && (forceUpdate || targetUser.languageId !== languageId)) {
      updates.languageId = languageId;
      console.log(`[Update Preferences] Language change: ${targetUser.languageId} -> ${languageId}`);
    }

    // Handle push token update
    if (targetDevice && pushToken && (forceUpdate || targetDevice.pushToken !== pushToken)) {
      deviceUpdates.pushToken = pushToken;
      console.log(`[Update Preferences] Push token updated for device ${deviceId}`);
    }

    // Handle device model update
    if (targetDevice && deviceModel && (forceUpdate || targetDevice.deviceModel !== deviceModel)) {
      deviceUpdates.deviceModel = deviceModel;
    }

    // Handle location update
    if (targetDevice && location && location.latitude && location.longitude) {
      const shouldUpdateLocation = forceUpdate || 
        !targetDevice.latitude || 
        !targetDevice.longitude ||
        Math.abs(targetDevice.latitude - location.latitude) > 0.0001 ||
        Math.abs(targetDevice.longitude - location.longitude) > 0.0001;

      if (shouldUpdateLocation) {
        // Update device location
        deviceUpdates.latitude = location.latitude;
        deviceUpdates.longitude = location.longitude;
        deviceUpdates.accuracyMeters = location.accuracyMeters;
        deviceUpdates.placeId = location.placeId;
        deviceUpdates.placeName = location.placeName;
        deviceUpdates.address = location.address;
        deviceUpdates.source = location.source;

        // For registered users, also update UserLocation table
        if (!isGuestUser) {
          locationUpdates.latitude = location.latitude;
          locationUpdates.longitude = location.longitude;
          locationUpdates.accuracyMeters = location.accuracyMeters;
          locationUpdates.placeId = location.placeId;
          locationUpdates.placeName = location.placeName;
          locationUpdates.address = location.address;
          locationUpdates.source = location.source;
        }

        console.log(`[Update Preferences] Location updated: ${location.latitude}, ${location.longitude}`);
      }
    }

    // Perform database updates
    const promises = [];

    // Update user if needed
    if (Object.keys(updates).length > 0) {
      promises.push(
        prisma.user.update({
          where: { id: targetUser.id },
          data: updates
        })
      );
    }

    // Update device if needed
    if (targetDevice && Object.keys(deviceUpdates).length > 0) {
      promises.push(
        prisma.device.update({
          where: { id: targetDevice.id },
          data: deviceUpdates,
        }),
      );
    }

    // Update user location for registered users
    if (!isGuestUser && Object.keys(locationUpdates).length > 0) {
      promises.push(
        prisma.userLocation.upsert({
          where: { userId: targetUser.id },
          update: locationUpdates,
          create: { userId: targetUser.id, ...locationUpdates }
        })
      );
    }

    // Execute all updates
    const results = await Promise.all(promises);
    
    // Get fresh data after updates
    const finalUser = await prisma.user.findUnique({
      where: { id: targetUser.id },
      include: { role: true, language: true }
    });
    
    const finalDevice = targetDevice
      ? await prisma.device.findUnique({ where: { id: targetDevice.id } })
      : null;

    // Handle FCM topic subscriptions for language changes + initial token registration
    const effectivePushToken = pushToken || finalDevice?.pushToken || targetDevice?.pushToken;
    const langForTopic = languageData?.code || finalUser?.language?.code || targetUser.language?.code;
    if (effectivePushToken && langForTopic) {
      try {
        await subscribeDeviceToLanguageTopics(effectivePushToken, langForTopic);
      } catch (topicErr) {
        console.warn('[Update Preferences] Language topic subscribe failed (non-fatal):', topicErr);
      }
    }

    if (effectivePushToken && languageId && oldLanguageCode !== languageData?.code) {
      try {
        // Unsubscribe from old language topic
        if (oldLanguageCode && effectivePushToken) {
          const oldTopic = `news-lang-${oldLanguageCode.toLowerCase()}`;
          await unsubscribeFromTopic([effectivePushToken], oldTopic);
          console.log(`[Update Preferences] Unsubscribed from topic: ${oldTopic}`);
        }

        // Subscribe to new language topic
        if (languageData?.code && effectivePushToken) {
          const newTopic = `news-lang-${languageData.code.toLowerCase()}`;
          await subscribeToTopic([effectivePushToken], newTopic);
          console.log(`[Update Preferences] Subscribed to topic: ${newTopic}`);
        }
      } catch (fcmError) {
        console.warn('[Update Preferences] FCM topic update failed (non-fatal):', fcmError);
      }
    }

    // Prepare response data
    const responseData = {
      user: {
        id: finalUser?.id || targetUser.id,
        languageId: finalUser?.languageId || targetUser.languageId,
        languageCode: finalUser?.language?.code || languageData?.code || targetUser.language?.code,
        languageName: finalUser?.language?.name || languageData?.name || targetUser.language?.name,
        role: finalUser?.role?.name || targetUser.role?.name,
        isGuest: isGuestUser
      },
      device: finalDevice || targetDevice
        ? {
            id: (finalDevice || targetDevice)!.id,
            deviceId: (finalDevice || targetDevice)!.deviceId,
            deviceModel: (finalDevice || targetDevice)!.deviceModel,
            hasPushToken: !!(finalDevice || targetDevice)!.pushToken,
            location:
              (finalDevice || targetDevice)!.latitude && (finalDevice || targetDevice)!.longitude
                ? {
                    latitude: (finalDevice || targetDevice)!.latitude,
                    longitude: (finalDevice || targetDevice)!.longitude,
                    accuracyMeters: (finalDevice || targetDevice)!.accuracyMeters,
                    placeId: (finalDevice || targetDevice)!.placeId,
                    placeName: (finalDevice || targetDevice)!.placeName,
                    address: (finalDevice || targetDevice)!.address,
                    source: (finalDevice || targetDevice)!.source,
                  }
                : null,
          }
        : null,
      updates: {
        languageChanged: !!updates.languageId,
        locationChanged: !!deviceUpdates.latitude,
        pushTokenChanged: !!deviceUpdates.pushToken,
        deviceModelChanged: !!deviceUpdates.deviceModel
      }
    };

    console.log('[Update Preferences] Successfully updated preferences:', responseData.updates);

    return res.status(200).json({
      success: true,
      message: 'Preferences updated successfully',
      data: responseData
    });

  } catch (error: any) {
    console.error('[Update Preferences] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update preferences',
      error: error.message
    });
  }
};

/**
 * Get user preferences (location, language, device info)
 * Supports both guest users (via deviceId) and registered users (via userId)
 * 
 * GET /preferences?deviceId=xxx or GET /preferences?userId=xxx
 */
export const getUserPreferencesController = async (req: Request, res: Response) => {
  try {
    const { deviceId, userId } = req.query as { deviceId?: string; userId?: string };

    if (!deviceId && !userId) {
      return res.status(400).json({
        success: false,
        message: 'Either deviceId or userId is required',
        code: 'MISSING_IDENTIFIER'
      });
    }

    let targetUser = null;
    let targetDevice = null;
    let userLocation = null;

    if (userId) {
      // Registered user case
      targetUser = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          role: true,
          language: true,
        },
      });

      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
      }

      if (deviceId) {
        targetDevice = await prisma.device.findFirst({
          where: { userId: targetUser.id, deviceId },
        });
      } else {
        targetDevice = await prisma.device.findFirst({
          where: { userId: targetUser.id },
          orderBy: { updatedAt: 'desc' },
        });
      }
    } else if (deviceId) {
      // Guest user case
      targetDevice = await prisma.device.findUnique({
        where: { deviceId },
        include: {
          user: {
            include: { role: true, language: true }
          }
        }
      });

      if (!targetDevice) {
        return res.status(404).json({
          success: false,
          message: 'Device not found',
          code: 'DEVICE_NOT_FOUND'
        });
      }

      targetUser = targetDevice.user;
    }

    if (targetUser && !userLocation) {
      userLocation = await prisma.userLocation.findUnique({
        where: { userId: targetUser.id },
      });
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const isGuestUser = targetUser.role?.name === 'GUEST';

    // Prepare response
    const responseData = {
      user: {
        id: targetUser.id,
        languageId: targetUser.languageId,
        languageCode: targetUser.language?.code,
        languageName: targetUser.language?.name,
        role: targetUser.role?.name,
        isGuest: isGuestUser,
        status: targetUser.status
      },
      device: targetDevice ? {
        id: targetDevice.id,
        deviceId: targetDevice.deviceId,
        deviceModel: targetDevice.deviceModel,
        hasPushToken: !!targetDevice.pushToken,
        location: targetDevice.latitude && targetDevice.longitude ? {
          latitude: targetDevice.latitude,
          longitude: targetDevice.longitude,
          accuracyMeters: targetDevice.accuracyMeters,
          placeId: targetDevice.placeId,
          placeName: targetDevice.placeName,
          address: targetDevice.address,
          source: targetDevice.source
        } : null
      } : null,
      userLocation: !isGuestUser && userLocation ? {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        accuracyMeters: userLocation.accuracyMeters,
        provider: userLocation.provider,
        timestampUtc: userLocation.timestampUtc,
        placeId: userLocation.placeId,
        placeName: userLocation.placeName,
        address: userLocation.address,
        source: userLocation.source,
        updatedAt: userLocation.updatedAt
      } : null
    };

    return res.status(200).json({
      success: true,
      data: responseData
    });

  } catch (error: any) {
    console.error('[Get Preferences] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get preferences',
      error: error.message
    });
  }
};