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
 *         - languageId
 *         - deviceDetails
 *       properties:
 *         languageId:
 *           type: string
 *           description: The unique identifier for the user's selected language (e.g., '1', '2').
 *         deviceDetails:
 *           $ref: '#/components/schemas/DeviceDetailsGuestDto'
 */
export class GuestRegistrationDto {
  @IsString()
  @IsNotEmpty()
  languageId!: string;

  @ValidateNested()
  @Type(() => DeviceDetailsDto)
  deviceDetails!: DeviceDetailsDto;
}
