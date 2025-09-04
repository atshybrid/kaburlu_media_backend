
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  parentId?: string;
}

export class UpdateCategoryDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsString()
    @IsOptional()
    iconUrl?: string;

    @IsBoolean()
    @IsOptional()
    isActive?: boolean;

    @IsString()
    @IsOptional()
    parentId?: string;
}
