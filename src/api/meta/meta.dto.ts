import { IsOptional, IsString } from 'class-validator';

export class CreateSurnameDto {
  @IsString()
  surnameEn!: string;

  @IsOptional()
  @IsString()
  surnameNative?: string;

  @IsString()
  stateId!: string;
}
