
import { IsNotEmpty, IsString, Length, IsOptional } from 'class-validator';

export class MpinLoginDto {
  @IsNotEmpty()
  @IsString()
  mobileNumber: string;

  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'MPIN must be exactly 4 digits' })
  mpin: string;

  @IsOptional()
  @IsString()
  deviceInfo?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;

  constructor(mobileNumber: string, mpin: string, deviceInfo?: string, ipAddress?: string) {
    this.mobileNumber = mobileNumber;
    this.mpin = mpin;
    this.deviceInfo = deviceInfo;
    this.ipAddress = ipAddress;
  }
}
