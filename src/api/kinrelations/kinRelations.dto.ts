import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateKinRelationDto {
  @IsString()
  @IsNotEmpty()
  code!: string;

  @IsString()
  @IsNotEmpty()
  category!: string; // PARENT, CHILD, SPOUSE, SIBLING, etc.

  @IsString()
  @IsOptional()
  gender?: string; // MALE, FEMALE, NEUTRAL

  @IsString()
  @IsOptional()
  side?: string; // PATERNAL, MATERNAL, BOTH, N/A

  @IsInt()
  @Min(0)
  @IsOptional()
  generationUp?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  generationDown?: number;

  @IsString()
  @IsNotEmpty()
  en!: string;

  @IsString()
  @IsNotEmpty()
  te!: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export class UpdateKinRelationDto {
  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  gender?: string;

  @IsString()
  @IsOptional()
  side?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  generationUp?: number;

  @IsInt()
  @Min(0)
  @IsOptional()
  generationDown?: number;

  @IsString()
  @IsOptional()
  en?: string;

  @IsString()
  @IsOptional()
  te?: string;

  @IsBoolean()
  @IsOptional()
  isCommon?: boolean;
}

export type BulkUpsertKinRelation = CreateKinRelationDto;

export class UpsertKinRelationNameDto {
  @IsString()
  @IsNotEmpty()
  code!: string; // KinRelation.code

  @IsString()
  @IsNotEmpty()
  languageCode!: string; // en, te, hi, ta, kn, ml, ...

  @IsString()
  @IsNotEmpty()
  displayName!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  altNames?: string[];
}

export type BulkUpsertKinRelationName = UpsertKinRelationNameDto;
