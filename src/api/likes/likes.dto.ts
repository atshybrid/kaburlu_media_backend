
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateLikeDto {
  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  articleId!: string;
}
