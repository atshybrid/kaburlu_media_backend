
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateCommentDto {
  @IsNotEmpty()
  @IsString()
  content!: string;

  @IsNotEmpty()
  @IsString()
  userId!: string;

  @IsNotEmpty()
  @IsString()
  articleId!: string;

  @IsOptional()
  @IsString()
  parentId?: string; // For nested comments/replies
}

export class UpdateCommentDto {
  @IsOptional()
  @IsString()
  content?: string;
}
