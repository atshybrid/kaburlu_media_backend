
import { IsString, IsNotEmpty, IsEnum, IsInt, IsOptional } from 'class-validator';
import { LocationType } from '@prisma/client';

export class CreateLocationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(LocationType)
  @IsNotEmpty()
  type: LocationType;

  @IsInt()
  level: number;

  @IsString()
  @IsNotEmpty()
  stateId: string;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateLocationDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    code?: string;

    @IsEnum(LocationType)
    @IsOptional()
    type?: LocationType;

    @IsInt()
    @IsOptional()
    level?: number;

    @IsString()
    @IsOptional()
    stateId?: string;

    @IsString()
    @IsOptional()
    parentId?: string;
}
