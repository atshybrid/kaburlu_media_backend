
import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateProfileDto {
  @IsOptional()
  @IsString()
  dob?: string;

  @IsOptional()
  @IsString()
  maritalStatus?: string;

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
}

export class UpdateProfileDto extends CreateProfileDto {}
