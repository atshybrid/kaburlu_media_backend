
import { IsString, IsNotEmpty, IsMobilePhone } from 'class-validator';

export class RequestOtpDto {
    @IsMobilePhone('en-IN')
    @IsNotEmpty()
    mobileNumber!: string;
}

export class VerifyOtpDto {
    @IsString()
    @IsNotEmpty()
    id!: string;

    @IsString()
    @IsNotEmpty()
    otp!: string;
}

export class SetMpinDto {
    @IsString()
    @IsNotEmpty()
    id!: string;

    @IsString()
    @IsNotEmpty()
    mpin!: string;
}
