import { IsString, IsOptional, IsObject, IsUrl } from 'class-validator';

export class CreateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

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
}

export class UpdateProfileDto extends CreateProfileDto {}
