
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
// Removed LocationType import; not present in Prisma schema

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  latitude!: number;

  @IsNotEmpty()
  longitude!: number;

  @IsOptional()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  provider?: string; // fused | gps | network

  @IsOptional()
  @IsString()
  timestampUtc?: string; // ISO string

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

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;

  @IsOptional()
  accuracyMeters?: number;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  timestampUtc?: string;

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
  source?: string;
}
