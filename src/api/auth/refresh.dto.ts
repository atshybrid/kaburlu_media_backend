
import { IsJWT, IsNotEmpty } from 'class-validator';

export class RefreshDto {
  @IsNotEmpty()
  @IsJWT()
  refreshToken: string;

  constructor(refreshToken: string) {
    this.refreshToken = refreshToken;
  }
}
