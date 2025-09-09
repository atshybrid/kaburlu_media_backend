
import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}

export class DeviceDetailsDto {
  @IsString()
  @IsOptional()
  pushToken?: string;

  @ValidateNested()
  @Type(() => LocationDto)
  @IsOptional()
  location?: LocationDto;
}
