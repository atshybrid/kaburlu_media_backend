import { IsOptional, IsString } from 'class-validator';

export class CreateCasteDto {
  @IsString()
  name!: string;
}

export class UpdateCasteDto {
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateSubCasteDto {
  @IsString()
  casteId!: string;

  @IsString()
  name!: string;
}

export class UpdateSubCasteDto {
  @IsOptional()
  @IsString()
  name?: string;
}
