
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateLanguageDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  code: string;

  constructor(name: string, code: string) {
    this.name = name;
    this.code = code;
  }
}
