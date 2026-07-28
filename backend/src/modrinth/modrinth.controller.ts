import { Body, Controller, Get, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ModrinthService } from './modrinth.service';
import { SearchModrinthModsQueryDto } from './dto/search-mods.query.dto';
import { ResolveModsDto, SaveDeployManifestDto, SyncLauncherManifestDto } from './dto/resolve-mods.dto';
import { BuildPluginPackDto, SavePluginManifestDto } from './dto/resolve-plugins.dto';

@Controller('modrinth')
@UseGuards(JwtAuthGuard)
export class ModrinthController {
  constructor(private readonly modrinthService: ModrinthService) {}

  @Get('mods/search')
  async searchMods(@Query() query: SearchModrinthModsQueryDto) {
    return this.modrinthService.searchMods({
      q: query.q,
      limit: query.limit,
      offset: query.offset,
      minecraftVersion: query.minecraftVersion,
      loader: query.loader,
    });
  }

  @Get('catalog/forge-119')
  async getForge119CatalogMeta() {
    return this.modrinthService.getForge119CatalogMeta();
  }

  @Get('catalog/forge-119/search')
  async searchForge119Mods(
    @Query('q') q: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.modrinthService.searchForge119Mods(
      q ?? '',
      offset ? Number(offset) : 0,
      limit ? Number(limit) : 9,
    );
  }

  @Get('catalog/forge-119/:categoryId')
  async getForge119CategoryMods(
    @Param('categoryId') categoryId: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.modrinthService.getForge119CategoryMods(
      categoryId,
      offset ? Number(offset) : 0,
      limit ? Number(limit) : 9,
    );
  }

  @Post('mods/check-compatibility')
  async checkCompatibility(@Body() body: ResolveModsDto) {
    return this.modrinthService.checkModsCompatibility(body.slugs);
  }

  @Post('mods/resolve')
  async resolveMods(@Body() body: ResolveModsDto) {
    return this.modrinthService.resolveModsWithDependencies(body);
  }

  @Public()
  @Get('deploy/:serverId/manifest')
  async getPublicManifest(@Param('serverId') serverId: string) {
    const manifest = await this.modrinthService.getDeployManifest(serverId);
    if (!manifest) {
      return { serverId, mods: [], modrinthProjects: '', lockClientResourcePacks: true };
    }
    return manifest;
  }

  @Get('deploy/:serverId/manifest/admin')
  async getAdminManifest(@Param('serverId') serverId: string) {
    return this.modrinthService.getDeployManifest(serverId);
  }

  @Put('deploy/:serverId/manifest')
  async saveManifest(@Param('serverId') serverId: string, @Body() body: SaveDeployManifestDto) {
    const resolved = await this.modrinthService.resolveModsWithDependencies({
      slugs: body.slugs,
    });

    const manifest = await this.modrinthService.saveDeployManifest({
      serverId,
      gameVersion: '1.19.2',
      loader: 'forge',
      updatedAt: new Date().toISOString(),
      mods: resolved.mods,
      modrinthProjects: resolved.modrinthProjects,
      lockClientResourcePacks: body.lockClientResourcePacks ?? true,
      resourcePack:
        body.resourcePackUrl
          ? {
              url: body.resourcePackUrl,
              sha1: body.resourcePackSha1,
              name: body.resourcePackName ?? 'Resource pack del servidor',
              required: body.requireResourcePack ?? true,
            }
          : undefined,
    });

    return manifest;
  }

  @Post('deploy/:serverId/launcher/sync')
  async syncLauncher(@Param('serverId') serverId: string, @Body() body: SyncLauncherManifestDto) {
    return this.modrinthService.publishLauncherSync({
      serverId,
      slugs: body.slugs,
      serverHost: body.serverHost,
      serverPort: body.serverPort,
      serverName: body.serverName,
      forgeBuild: body.forgeBuild,
      resourcePackUrl: body.resourcePackUrl,
      resourcePackSha1: body.resourcePackSha1,
      resourcePackName: body.resourcePackName,
      requireResourcePack: body.requireResourcePack,
      lockClientResourcePacks: body.lockClientResourcePacks,
    });
  }

  @Get('deploy/:serverId/launcher/status')
  async getLauncherBuildStatus(@Param('serverId') serverId: string) {
    return this.modrinthService.getLauncherBuildStatus(serverId);
  }

  @Post('deploy/:serverId/launcher/build')
  async buildLauncherPack(@Param('serverId') serverId: string) {
    const panelUrl = process.env.FRONTEND_URL;
    return this.modrinthService.buildLauncherPack(serverId, panelUrl);
  }

  @Public()
  @Get('deploy/:serverId/launcher/download')
  async downloadLauncherPack(@Param('serverId') serverId: string, @Res() res: Response): Promise<void> {
    const panelUrl = process.env.FRONTEND_URL;
    const { stream, name } = await this.modrinthService.openLauncherPackStream(serverId, panelUrl);

    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Type', 'application/zip');

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).send('Error building launcher pack');
      }
    });
    stream.pipe(res);
  }

  @Get('catalog/paper')
  async getPaperCatalogMeta() {
    return this.modrinthService.getPaperCatalogMeta();
  }

  @Get('catalog/paper/:categoryId')
  async getPaperCategoryPlugins(
    @Param('categoryId') categoryId: string,
    @Query('gameVersion') gameVersion: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.modrinthService.getPaperCategoryPlugins(
      categoryId,
      gameVersion || '1.21.1',
      offset ? Number(offset) : 0,
      limit ? Number(limit) : 9,
    );
  }

  @Post('plugins/resolve')
  async resolvePlugins(@Body() body: BuildPluginPackDto) {
    return this.modrinthService.resolvePluginsWithDependencies({
      slugs: body.slugs,
      gameVersion: body.gameVersion,
    });
  }

  @Post('plugins/build')
  async buildPluginPack(@Body() body: BuildPluginPackDto, @Res() res: Response): Promise<void> {
    const { stream, name } = await this.modrinthService.buildPluginPackZip(
      body.slugs,
      body.gameVersion,
    );

    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.setHeader('Content-Type', 'application/zip');

    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(500).send('Error building plugin pack');
      }
    });
    stream.pipe(res);
  }

  @Get('plugins/deploy/:serverId/manifest/admin')
  async getAdminPluginManifest(@Param('serverId') serverId: string) {
    return this.modrinthService.getPluginManifest(serverId);
  }

  @Put('plugins/deploy/:serverId/manifest')
  async savePluginManifest(
    @Param('serverId') serverId: string,
    @Body() body: SavePluginManifestDto,
  ) {
    const resolved = await this.modrinthService.resolvePluginsWithDependencies({
      slugs: body.slugs,
      gameVersion: body.gameVersion,
    });

    return this.modrinthService.savePluginManifest({
      serverId,
      gameVersion: body.gameVersion,
      updatedAt: new Date().toISOString(),
      plugins: resolved.plugins,
      modrinthProjects: resolved.modrinthProjects,
    });
  }
}
