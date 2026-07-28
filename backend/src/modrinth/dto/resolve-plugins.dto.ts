import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BuildPluginPackDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  slugs: string[];

  @IsString()
  gameVersion: string;
}

export class SavePluginManifestDto {
  @IsArray()
  @IsString({ each: true })
  slugs: string[];

  @IsString()
  gameVersion: string;
}
