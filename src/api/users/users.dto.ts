
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsDateString,
  IsObject,
  ValidateNested,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UserStatus } from '@prisma/client';

// This DTO will handle the new, optional user profile fields.
export class UserProfileDto {
  @IsOptional()
  @IsDateString()
  dob?: Date;

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

// Updated DTO for creating a new user.
export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  mobileNumber!: string; // Added '!' for definite assignment assertion.

  @IsNotEmpty()
  @IsString()
  name!: string; // Added '!' for definite assignment assertion.

  @IsNotEmpty()
  @IsString()
  roleId!: string; // Added '!' for definite assignment assertion.

  @IsOptional()
  @IsString()
  mpin?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  // Nest the profile information.
  @IsOptional()
  @ValidateNested()
  @Type(() => UserProfileDto)
  profile?: UserProfileDto;
}

// Updated DTO for modifying an existing user.
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  roleId?: string; // Changed from 'role' to 'roleId'.

  @IsOptional()
  @IsString()
  languageId?: string;

  @IsOptional()
  @IsEnum(UserStatus) // Added Enum validation for status.
  status?: UserStatus; // Changed type from string to UserStatus enum.

  @IsOptional()
  @IsBoolean()
  isVerified?: boolean;

  // Nest the profile information.
  @IsOptional()
  @ValidateNested()
  @Type(() => UserProfileDto)
  profile?: UserProfileDto;
}

class LocationDto {
    @IsNumber()
    latitude: number;

    @IsNumber()
    longitude: number;
}

export class UpgradeGuestDto {
    @IsString()
    @IsNotEmpty()
    mobileNumber: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    languageId: string;

    @ValidateNested()
    @Type(() => LocationDto)
    location: LocationDto;
}
