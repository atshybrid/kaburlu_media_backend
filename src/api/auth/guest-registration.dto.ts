
import { IsString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceDetailsDto:
 *       type: object
 *       properties:
 *         deviceId:
 *           type: string
 *         deviceModel:
 *           type: string
 */
class DeviceDetailsDto {
  @IsString()
  @IsNotEmpty()
  deviceId!: string;

  @IsString()
  @IsNotEmpty()
  deviceModel!: string;
}

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
 *     GuestRegistrationDto:
 *       type: object
 *       required:
 *         - languageId
 *         - deviceDetails
 *       properties:
 *         languageId:
 *           type: string
 *         deviceDetails:
 *           $ref: '#/components/schemas/DeviceDetailsDto'
 *         pushToken:
 *           type: string
 *         location:
 *           $ref: '#/components/schemas/LocationDto'
 */
export class GuestRegistrationDto {
  @IsString()
  @IsNotEmpty()
  languageId!: string;

  @ValidateNested()
  @Type(() => DeviceDetailsDto)
  deviceDetails!: DeviceDetailsDto;

  @IsString()
  @IsOptional()
  pushToken?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;
}
