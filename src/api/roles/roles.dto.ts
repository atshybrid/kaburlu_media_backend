
import { IsNotEmpty, IsString, IsArray } from 'class-validator';

export class CreateRoleDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsArray()
  permissions: string[];

  constructor(name: string, permissions: string[]) {
    this.name = name;
    this.permissions = permissions;
  }
}
