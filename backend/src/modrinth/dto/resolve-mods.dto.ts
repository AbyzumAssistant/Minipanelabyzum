import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class ResolveModsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  slugs: string[];

  @IsString()
  @IsOptional()
  gameVersion?: string;

  @IsString()
  @IsOptional()
  loader?: string;
}

export class SaveDeployManifestDto {
  @IsArray()
  @IsString({ each: true })
  slugs: string[];

  @IsString()
  @IsOptional()
  resourcePackUrl?: string;

  @IsString()
  @IsOptional()
  resourcePackSha1?: string;

  @IsString()
  @IsOptional()
  resourcePackName?: string;

  @IsOptional()
  requireResourcePack?: boolean;

  @IsOptional()
  lockClientResourcePacks?: boolean;
}

export class SyncLauncherManifestDto extends SaveDeployManifestDto {
  @IsString()
  serverHost: string;

  @Type(() => Number)
  @IsNumber()
  serverPort: number;

  @IsString()
  serverName: string;

  @IsString()
  @IsOptional()
  forgeBuild?: string;
}
