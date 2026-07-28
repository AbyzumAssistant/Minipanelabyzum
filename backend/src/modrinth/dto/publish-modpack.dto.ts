import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class PublishModpackDto {
  @IsString()
  slug: string;

  @IsString()
  @IsOptional()
  versionId?: string;

  @IsString()
  serverHost: string;

  @Type(() => Number)
  @IsNumber()
  serverPort: number;

  @IsString()
  serverName: string;

  @IsOptional()
  @IsBoolean()
  lockClientResourcePacks?: boolean;

  @IsString()
  @IsOptional()
  profile?: 'horizons' | 'modpack' | 'forge119';
}
