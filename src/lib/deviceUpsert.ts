import prisma from './prisma';

export type DeviceLocationInput = {
  latitude?: number;
  longitude?: number;
  accuracyMeters?: number;
  placeId?: string;
  placeName?: string;
  address?: string;
  source?: string;
};

export type UpsertDeviceForUserInput = {
  userId: string;
  deviceId: string;
  deviceModel?: string | null;
  pushToken?: string | null;
  location?: DeviceLocationInput;
};

/** Upsert device by stable client deviceId (not FCM token). Re-binds device to userId on login. */
export async function upsertDeviceForUser(input: UpsertDeviceForUserInput) {
  const { userId, deviceId, deviceModel, pushToken, location } = input;
  const existing = await prisma.device.findUnique({ where: { deviceId } });

  const locData = location
    ? {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracyMeters: location.accuracyMeters,
        placeId: location.placeId,
        placeName: location.placeName,
        address: location.address,
        source: location.source,
      }
    : {};

  if (existing) {
    return prisma.device.update({
      where: { deviceId },
      data: {
        userId,
        ...(deviceModel ? { deviceModel } : {}),
        ...(pushToken ? { pushToken } : {}),
        ...locData,
      },
    });
  }

  return prisma.device.create({
    data: {
      userId,
      deviceId,
      deviceModel: deviceModel || 'unknown',
      pushToken: pushToken ?? null,
      ...locData,
    },
  });
}
