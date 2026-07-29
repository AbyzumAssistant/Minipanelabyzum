import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { DockerComposeService } from '../docker-compose/docker-compose.service';
import { ServerManagementService } from '../server-management/server-management.service';
import { ModrinthService, ModDeployManifest } from './modrinth.service';
import { SearchModrinthModsQueryDto } from './dto/search-mods.query.dto';
import { ResolveModsDto, SaveDeployManifestDto, SyncLauncherManifestDto } from './dto/resolve-mods.dto';
import { PublishModpackDto } from './dto/publish-modpack.dto';
import { BuildPluginPackDto, SavePluginManifestDto } from './dto/resolve-plugins.dto';
import { FORGE_119_GAME_VERSION, FORGE_119_LOADER } from './forge-mod-catalog';

@Controller('modrinth')
@UseGuards(JwtAuthGuard)
export class ModrinthController {
  constructor(
    private readonly modrinthService: ModrinthService,
    private readonly dockerComposeService: DockerComposeService,
    private readonly serverManagementService: ServerManagementService,
  ) {}

  private async syncManifestToServer(serverId: string, source: ModDeployManifest | string) {
    if (typeof source === 'string') {
      if (!source.trim()) return;
      await this.dockerComposeService.updateServerConfig(serverId, {
        modrinthProjects: source,
        modrinthLoader: 'forge',
        modrinthDownloadDependencies: 'required',
      });
      return;
    }

    if (source.modpackSlug) {
      const isHorizons = source.profile === 'horizons' || source.modpackSlug === 'horizons1';
      const horizonsDocker = isHorizons ? this.modrinthService.getHorizonsServerDockerModrinthConfig() : null;
      await this.dockerComposeService.updateServerConfig(serverId, {
        serverType: 'MODRINTH',
        modrinthModpack: source.modpackSlug,
        modrinthModpackVersion: source.modpackVersion || '',
        modrinthLoader: source.loader || 'fabric',
        fabricLoaderVersion: source.fabricLoaderVersion || '',
        minecraftVersion: source.gameVersion,
        onlineMode: false,
        initMemory: isHorizons ? '8G' : '6G',
        maxMemory: isHorizons ? '10G' : '8G',
        memoryReservation: isHorizons ? '8G' : '6G',
        motd: isHorizons ? 'mcabyzum · Horizons' : `abyzumMC ${source.modpackTitle ?? source.modpackSlug}`,
        modrinthProjects: source.modrinthProjects || '',
        modrinthDownloadDependencies: 'required',
        ...(horizonsDocker ?? {}),
      });

      if (isHorizons) {
        await this.dockerComposeService.ensureHorizonsServerReadiness(serverId);
      }
      return;
    }

    if (!source.modrinthProjects?.trim()) return;
    await this.dockerComposeService.updateServerConfig(serverId, {
      modrinthProjects: source.modrinthProjects,
      modrinthLoader: source.loader || 'forge',
      modrinthDownloadDependencies: 'required',
    });
  }

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
      gameVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
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

    await this.syncManifestToServer(serverId, manifest.modrinthProjects);

    return manifest;
  }

  @Post('deploy/:serverId/server/sync')
  async syncServerFromManifest(@Param('serverId') serverId: string) {
    const manifest = await this.modrinthService.getDeployManifest(serverId);
    if (!manifest || (!manifest.modpackSlug && !manifest.modrinthProjects?.trim() && !manifest.mods?.length)) {
      throw new HttpException('No hay manifiesto de mods publicado para este servidor', HttpStatus.BAD_REQUEST);
    }

    await this.syncManifestToServer(serverId, manifest);

    return {
      synced: true,
      modCount: manifest.mods.length,
      modrinthProjects: manifest.modrinthProjects,
      dependencies: manifest.mods.filter((m) => m.isDependency).map((m) => m.slug),
    };
  }

  @Get('modpack/:slug/info')
  async getModpackInfo(@Param('slug') slug: string) {
    return this.modrinthService.getModpackInfo(slug);
  }

  @Post('deploy/:serverId/modpack/publish')
  async publishModpack(
    @Param('serverId') serverId: string,
    @Body() body: PublishModpackDto,
  ) {
    let manifest: ModDeployManifest;
    try {
      manifest = await this.modrinthService.publishModpackDeploy({
        serverId,
        slug: body.slug,
        versionId: body.versionId,
        serverHost: body.serverHost,
        serverPort: body.serverPort,
        serverName: body.serverName,
        lockClientResourcePacks: body.lockClientResourcePacks,
        profile: body.profile,
      });
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Error desconocido publicando modpack';
      throw new HttpException(message, HttpStatus.BAD_GATEWAY);
    }

    if (!manifest.mods?.length) {
      throw new HttpException(
        'El modpack se resolvió sin mods en el manifiesto. Revisa la conexión con Modrinth.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    try {
      const isHorizons = manifest.profile === 'horizons' || manifest.modpackSlug === 'horizons1';
      if (isHorizons) {
        await this.serverManagementService.stopServer(serverId);
      }

      await this.syncManifestToServer(serverId, manifest);
      await this.dockerComposeService.updateServerConfig(serverId, {
        serverName: body.serverName,
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new HttpException(
        `Modpack guardado pero falló aplicar la config del servidor: ${detail}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

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
    res.setHeader('Content-Type', 'application/octet-stream');

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
