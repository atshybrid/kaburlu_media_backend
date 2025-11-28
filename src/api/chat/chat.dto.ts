import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpsertInterestDto {
  @IsString()
  targetUserId!: string;

  @IsOptional()
  @IsBoolean()
  followed?: boolean; // default true

  @IsOptional()
  @IsBoolean()
  muted?: boolean; // default false

  @IsOptional()
  @IsString()
  notes?: string;
}

export class BulkUpsertInterestDto {
  @IsString({ each: true })
  targetUserIds!: string[];

  @IsOptional()
  @IsBoolean()
  followed?: boolean;

  @IsOptional()
  @IsBoolean()
  muted?: boolean;
}

export class InviteByMobileDto {
  @IsString()
  mobileNumber!: string;

  @IsString()
  relationType!: string; // PARENT | CHILD | SPOUSE | SIBLING

  @IsOptional()
  @IsString()
  fullName?: string;

  // If assigning a mobile to an existing skeleton user (without mobile yet)
  @IsOptional()
  @IsString()
  targetUserId?: string;
}
