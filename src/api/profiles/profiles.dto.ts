import { IsString, IsOptional, IsObject, IsUrl } from 'class-validator';

export class CreateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  surname?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsUrl()
  profilePhotoUrl?: string;

  @IsOptional()
  @IsString()
  profilePhotoMediaId?: string;

  @IsOptional()
  @IsString()
  emergencyContactNumber?: string;

  @IsOptional()
  @IsObject()
  address?: any;

  @IsOptional()
  @IsString()
  stateId?: string;

  @IsOptional()
  @IsString()
  districtId?: string;

  @IsOptional()
  @IsString()
  assemblyId?: string;

  @IsOptional()
  @IsString()
  mandalId?: string;

  @IsOptional()
  @IsString()
  villageId?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsObject()
  socialLinks?: any;

  // Caste fields (both freeform and reference IDs are allowed)
  @IsOptional()
  @IsString()
  caste?: string;

  @IsOptional()
  @IsString()
  subCaste?: string;

  @IsOptional()
  @IsString()
  casteId?: string;

  @IsOptional()
  @IsString()
  subCasteId?: string;
}

export class UpdateProfileDto extends CreateProfileDto {}
