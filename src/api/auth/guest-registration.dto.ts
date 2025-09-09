
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
 *         - languageCode
 *         - deviceDetails
 *       properties:
 *         languageCode:
 *           type: string
 *           description: The BCP-47 language code for the user's preferred language (e.g., 'en', 'te').
 *         deviceDetails:
 *           $ref: '#/components/schemas/DeviceDetailsGuestDto'
 */
export class GuestRegistrationDto {
  @IsString()
  @IsNotEmpty()
  languageCode!: string;

  @ValidateNested()
  @Type(() => DeviceDetailsDto)
  deviceDetails!: DeviceDetailsDto;
}
