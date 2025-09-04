
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateStateDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  languageId: string;

  constructor(name: string, languageId: string) {
    this.name = name;
    this.languageId = languageId;
  }
}
