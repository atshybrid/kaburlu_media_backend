
import { IsString, IsNotEmpty, IsEnum, IsInt, IsOptional } from 'class-validator';
// Removed LocationType import; not present in Prisma schema

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsNotEmpty()
  latitude!: number;

  @IsNotEmpty()
  longitude!: number;
}

export class UpdateLocationDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}
