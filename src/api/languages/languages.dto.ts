
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLanguageDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  @IsNotEmpty()
  @IsString()
  nativeName: string;

  constructor(name: string, code: string, nativeName?: string) {
    this.name = name;
    this.code = code;
    this.nativeName = nativeName || name;
  }
}
