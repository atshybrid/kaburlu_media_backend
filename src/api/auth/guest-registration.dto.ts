import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     LocationDto:
 *       type: object
 *       properties:
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 */
class LocationDto {
  @IsNotEmpty()
  latitude!: number;

  @IsNotEmpty()
  longitude!: number;

  // Optional extended metadata
  @IsOptional()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  provider?: string; // fused | gps | network

  @IsOptional()
  @IsString()
  timestampUtc?: string; // ISO string; will be converted to Date

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsString()
  placeName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  source?: string; // foreground | background | manual
}

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceDetailsGuestDto:
 *       type: object
 *       properties:
 *         deviceId:
 *           type: string
 *         deviceModel:
 *           type: string
 *         pushToken:
 *           type: string
 *         location:
 *           $ref: '#/components/schemas/LocationDto'
 */
class DeviceDetailsDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  deviceModel!: string;

  @IsString()
  @IsOptional()
  pushToken?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;
}


/**
 * @swagger
 * components:
 *   schemas:
 *     GuestRegistrationDto:
 *       type: object
 *       required:
 *         - deviceDetails
 *       properties:
 *         languageId:
 *           type: string
 *           description: Language DB id (cuid). Optional if languageCode is provided.
 *         languageCode:
 *           type: string
 *           description: Language code (e.g., 'en', 'te'). Optional if languageId is provided.
 *         deviceDetails:
 *           $ref: '#/components/schemas/DeviceDetailsGuestDto'
 */
export class GuestRegistrationDto {
  @IsString()
  @IsOptional()
  languageId?: string;

  @IsString()
  @IsOptional()
  languageCode?: string;

  @ValidateNested()
  @Type(() => DeviceDetailsDto)
  deviceDetails!: DeviceDetailsDto;
}
