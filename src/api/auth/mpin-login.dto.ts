
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class MpinLoginDto {
  @IsNotEmpty()
  @IsString()
  mobileNumber: string;

  @IsNotEmpty()
  @IsString()
  @Length(4, 4, { message: 'MPIN must be exactly 4 digits' })
  mpin: string;

  constructor(mobileNumber: string, mpin: string) {
    this.mobileNumber = mobileNumber;
    this.mpin = mpin;
  }
}
