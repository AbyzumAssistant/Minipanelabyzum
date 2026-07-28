import { HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as archiver from 'archiver';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  FORGE_119_GAME_VERSION,
  FORGE_119_LOADER,
  FORGE_119_MOD_CATALOG,
  FORGE_119_CATEGORY_SEARCH,
  ForgeModCatalogCategory,
  normalizeForge119Slug,
} from './forge-mod-catalog';
import {
  PAPER_PLUGIN_CATALOG,
  PAPER_CATEGORY_SEARCH,
} from './paper-plugin-catalog';

export interface NormalizedModSearchResult {
  provider: 'curseforge' | 'modrinth';
  projectId: string;
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  downloads?: number;
  lastUpdated?: string;
  supportedVersions: string[];
  supportedLoaders: string[];
}

export interface NormalizedModSearchResponse {
  data: NormalizedModSearchResult[];
  pagination: {
    index: number;
    pageSize: number;
    resultCount: number;
    totalCount: number;
  };
}

export interface ModrinthProjectSummary {
  projectId: string;
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  downloads?: number;
  clientSide: string;
  serverSide: string;
}

export interface ModrinthResolvedMod {
  projectId: string;
  slug: string;
  name: string;
  versionId: string;
  versionNumber: string;
  fileName: string;
  downloadUrl: string;
  fileSize: number;
  sha1: string;
  isDependency: boolean;
  requiredBy?: string[];
}

export interface LauncherServerInfo {
  host: string;
  port: number;
  name: string;
}

export interface ModDeployManifest {
  serverId: string;
  gameVersion: string;
  loader: string;
  updatedAt: string;
  mods: ModrinthResolvedMod[];
  modrinthProjects: string;
  resourcePack?: {
    url: string;
    sha1?: string;
    name: string;
    required: boolean;
  };
  lockClientResourcePacks: boolean;
  launcherRevision?: number;
  forgeBuild?: string;
  server?: LauncherServerInfo;
}

export interface ForgeCatalogResponse {
  gameVersion: string;
  loader: string;
  categories: Array<
    ForgeModCatalogCategory & {
      mods: ModrinthProjectSummary[];
    }
  >;
}

export type CatalogIncompatReason = 'not_found' | 'no_forge_119' | 'no_mc_version' | 'client_only';

export interface PluginDeployManifest {
  serverId: string;
  gameVersion: string;
  updatedAt: string;
  plugins: ModrinthResolvedMod[];
  modrinthProjects: string;
}

export interface PaperCatalogMetaResponse {
  categories: Array<{
    id: string;
    label: string;
    description: string;
    slugCount: number;
  }>;
}

export interface PaperCatalogCategoryPage {
  categoryId: string;
  gameVersion: string;
  entries: CatalogModEntry[];
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  source: 'curated' | 'search';
}

export interface CatalogModEntry {
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  projectId?: string;
  compatible: boolean;
  reason?: CatalogIncompatReason;
  clientSide?: string;
  serverSide?: string;
  versionNumber?: string;
}

export interface ForgeCatalogMetaResponse {
  gameVersion: string;
  loader: string;
  categories: Array<{
    id: string;
    label: string;
    description: string;
    slugCount: number;
  }>;
}

export interface ForgeCatalogCategoryPage {
  categoryId: string;
  entries: CatalogModEntry[];
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  source: 'curated' | 'search';
}

export interface ForgeCatalogSearchPage {
  query: string;
  entries: CatalogModEntry[];
  offset: number;
  nextOffset: number;
  hasMore: boolean;
}

export interface CompatibilityWarning {
  type: 'incompatible' | 'no_version' | 'client_only' | 'not_found';
  modA: string;
  modB?: string;
  message: string;
}

export interface SkippedMod {
  slug: string;
  name?: string;
  reason: 'not_found' | 'no_version' | 'client_only' | 'incompatible';
  message: string;
}

export interface ModSelectionReport {
  compatibleSlugs: string[];
  skipped: SkippedMod[];
  warnings: CompatibilityWarning[];
}

interface ModrinthSearchHit {
  project_id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  date_modified?: string;
  versions: string[];
  categories: string[];
}

interface ModrinthSearchResponse {
  hits: ModrinthSearchHit[];
  offset: number;
  limit: number;
  total_hits: number;
}

interface ModrinthProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon_url?: string;
  downloads: number;
  client_side: string;
  server_side: string;
}

interface ModrinthVersionFile {
  hashes: { sha1?: string; sha512?: string };
  url: string;
  filename: string;
  size: number;
  primary: boolean;
}

interface ModrinthVersionDependency {
  version_id?: string | null;
  project_id?: string | null;
  dependency_type: 'required' | 'optional' | 'embedded' | 'incompatible';
}

interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  files: ModrinthVersionFile[];
  dependencies: ModrinthVersionDependency[];
}

@Injectable()
export class ModrinthService {
  private readonly apiClient: AxiosInstance;
  private readonly MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
  private readonly KNOWN_LOADERS = ['forge', 'neoforge', 'fabric', 'quilt'];

  constructor(private readonly configService: ConfigService) {
    this.apiClient = axios.create({
      baseURL: this.MODRINTH_API_BASE,
      timeout: 15000,
      headers: {
        Accept: 'application/json',
      },
    });
  }

  async searchMods(query: {
    q?: string;
    limit?: number;
    offset?: number;
    minecraftVersion: string;
    loader?: 'forge' | 'neoforge' | 'fabric' | 'quilt';
  }): Promise<NormalizedModSearchResponse> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const offset = Math.max(query.offset ?? 0, 0);

    const facets: string[][] = [
      ['project_type:mod'],
      [`versions:${query.minecraftVersion}`],
    ];

    if (query.loader) {
      facets.push([`categories:${query.loader}`]);
    }

    try {
      const response = await this.apiClient.get<ModrinthSearchResponse>('/search', {
        params: {
          query: query.q,
          limit,
          offset,
          index: 'relevance',
          facets: JSON.stringify(facets),
        },
      });

      const normalized = response.data.hits
        .map((hit) => this.normalizeHit(hit))
        .filter((mod) => this.isCompatibleResult(mod, query.minecraftVersion, query.loader));

      return {
        data: normalized,
        pagination: {
          index: offset,
          pageSize: limit,
          resultCount: normalized.length,
          totalCount: response.data.total_hits,
        },
      };
    } catch (error) {
      console.error('Error searching Modrinth mods:', error);

      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data?.description || 'Error searching mods',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException('Error searching mods', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getForge119CatalogMeta(): Promise<ForgeCatalogMetaResponse> {
    return {
      gameVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
      categories: FORGE_119_MOD_CATALOG.map(({ id, label, description, slugs }) => ({
        id,
        label,
        description,
        slugCount: slugs.length,
      })),
    };
  }

  async getForge119CategoryMods(
    categoryId: string,
    offset = 0,
    limit = 9,
  ): Promise<ForgeCatalogCategoryPage> {
    const category = FORGE_119_MOD_CATALOG.find((c) => c.id === categoryId);
    if (!category) {
      throw new NotFoundException(`Categoría desconocida: ${categoryId}`);
    }

    const curated = category.slugs;
    const safeLimit = Math.min(Math.max(limit, 1), 24);

    if (offset < curated.length) {
      const slice = curated.slice(offset, offset + safeLimit);
      const entries = await this.mapPool(slice, (slug) => this.resolveCatalogEntry(slug), 4);
      const nextOffset = offset + slice.length;
      return {
        categoryId,
        entries,
        offset,
        nextOffset,
        hasMore: nextOffset < curated.length || curated.length > 0,
        source: 'curated',
      };
    }

    const searchOffset = offset - curated.length;
    const search = await this.searchMods({
      q: FORGE_119_CATEGORY_SEARCH[categoryId] ?? category.label,
      limit: safeLimit,
      offset: searchOffset,
      minecraftVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
    });

    const curatedSet = new Set(curated);
    const slugs = search.data.map((mod) => mod.slug).filter((slug) => !curatedSet.has(slug));
    const entries = await this.mapPool(slugs, (slug) => this.resolveCatalogEntry(slug), 4);
    const nextOffset = offset + entries.length;

    return {
      categoryId,
      entries,
      offset,
      nextOffset,
      hasMore: searchOffset + safeLimit < search.pagination.totalCount,
      source: 'search',
    };
  }

  async searchForge119Mods(q: string, offset = 0, limit = 9): Promise<ForgeCatalogSearchPage> {
    const trimmed = q.trim();
    if (!trimmed) {
      return { query: '', entries: [], offset: 0, nextOffset: 0, hasMore: false };
    }

    const safeLimit = Math.min(Math.max(limit, 1), 24);
    const search = await this.searchMods({
      q: trimmed,
      limit: safeLimit,
      offset,
      minecraftVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
    });

    const entries = await this.mapPool(
      search.data.map((mod) => mod.slug),
      (slug) => this.resolveCatalogEntry(slug),
      4,
    );

    return {
      query: trimmed,
      entries: entries.filter((entry) => entry.compatible),
      offset,
      nextOffset: offset + search.data.length,
      hasMore: offset + safeLimit < search.pagination.totalCount,
    };
  }

  async checkModsCompatibility(slugs: string[]): Promise<ModSelectionReport> {
    const unique = [
      ...new Set(slugs.map((s) => normalizeForge119Slug(s)).filter(Boolean)),
    ];
    const skipped: SkippedMod[] = [];
    const resolved = new Map<
      string,
      { name: string; projectId: string; version: ModrinthVersion }
    >();

    const checks = await this.mapPool(
      unique,
      async (slug) => {
        const project = await this.fetchProject(slug);
        if (!project) {
          return {
            slug,
            skipped: {
              slug,
              reason: 'not_found' as const,
              message: `${slug} no existe en Modrinth`,
            },
          };
        }

        const version = await this.fetchBestVersion(
          project.id,
          FORGE_119_GAME_VERSION,
          FORGE_119_LOADER,
        );
        if (!version) {
          return {
            slug: project.slug,
            skipped: {
              slug: project.slug,
              name: project.title,
              reason: 'no_version' as const,
              message: `${project.title} no tiene versión Forge ${FORGE_119_GAME_VERSION}`,
            },
          };
        }

        if (project.server_side === 'unsupported' && project.client_side === 'required') {
          return {
            slug: project.slug,
            skipped: {
              slug: project.slug,
              name: project.title,
              reason: 'client_only' as const,
              message: `${project.title} es solo cliente y no conviene en el servidor`,
            },
          };
        }

        return {
          slug: project.slug,
          resolved: {
            name: project.title,
            projectId: project.id,
            version,
          },
        };
      },
      2,
    );

    for (const result of checks) {
      if ('skipped' in result && result.skipped) {
        skipped.push(result.skipped);
        continue;
      }
      if ('resolved' in result && result.resolved) {
        resolved.set(result.slug, result.resolved);
      }
    }

    const slugByProjectId = new Map<string, string>();
    for (const [slug, data] of resolved) {
      slugByProjectId.set(data.projectId, slug);
    }

    let compatibleSlugs = [...resolved.keys()];

    for (const [slug, data] of resolved) {
      for (const dep of data.version.dependencies) {
        if (dep.dependency_type !== 'incompatible') continue;

        let otherSlug: string | undefined;
        if (dep.project_id) {
          otherSlug = slugByProjectId.get(dep.project_id);
          if (!otherSlug) {
            const depProject = await this.fetchProjectById(dep.project_id);
            otherSlug = depProject?.slug;
          }
        }

        if (!otherSlug || !compatibleSlugs.includes(otherSlug)) continue;

        compatibleSlugs = compatibleSlugs.filter((s) => s !== otherSlug);
        const otherName = resolved.get(otherSlug)?.name ?? otherSlug;
        skipped.push({
          slug: otherSlug,
          name: otherName,
          reason: 'incompatible',
          message: `${data.name} declara incompatible a ${otherName}`,
        });
      }
    }

    const warnings: CompatibilityWarning[] = skipped.map((entry) => ({
      type: entry.reason,
      modA: entry.slug,
      message: entry.message,
    }));

    return { compatibleSlugs, skipped, warnings };
  }

  /** @deprecated Use getForge119CatalogMeta + getForge119CategoryMods */
  async getForge119Catalog(): Promise<ForgeCatalogResponse> {
    const categories = await Promise.all(
      FORGE_119_MOD_CATALOG.map(async (category) => {
        const mods = (
          await Promise.all(
            category.slugs.map((slug) =>
              this.fetchProjectSummary(slug, FORGE_119_GAME_VERSION, FORGE_119_LOADER),
            ),
          )
        ).filter((mod): mod is ModrinthProjectSummary => mod !== null);

        return { ...category, mods };
      }),
    );

    return {
      gameVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
      categories,
    };
  }

  async resolveModsWithDependencies(input: {
    slugs: string[];
    gameVersion?: string;
    loader?: string;
  }): Promise<{ mods: ModrinthResolvedMod[]; modrinthProjects: string }> {
    const gameVersion = input.gameVersion ?? FORGE_119_GAME_VERSION;
    const loader = input.loader ?? FORGE_119_LOADER;
    const resolved = new Map<string, ModrinthResolvedMod>();
    const requiredByMap = new Map<string, Set<string>>();
    const queue = [
      ...new Set(input.slugs.map((s) => normalizeForge119Slug(s)).filter(Boolean)),
    ];
    const visitedSlugs = new Set<string>();

    while (queue.length > 0) {
      const slug = queue.shift()!;
      if (visitedSlugs.has(slug)) continue;
      visitedSlugs.add(slug);

      const project = await this.fetchProject(slug);
      if (!project) continue;

      const version = await this.fetchBestVersion(project.id, gameVersion, loader);
      if (!version) continue;

      const primaryFile =
        version.files.find((f) => f.primary) ?? version.files[0];
      if (!primaryFile) continue;

      const isRoot = input.slugs.some((s) => s.toLowerCase() === slug);
      const existing = resolved.get(project.id);

      if (existing) {
        if (isRoot) existing.isDependency = false;
        continue;
      }

      resolved.set(project.id, {
        projectId: project.id,
        slug: project.slug,
        name: project.title,
        versionId: version.id,
        versionNumber: version.version_number,
        fileName: primaryFile.filename,
        downloadUrl: primaryFile.url,
        fileSize: primaryFile.size,
        sha1: primaryFile.hashes.sha1 ?? '',
        isDependency: !isRoot,
        requiredBy: [],
      });

      for (const dep of version.dependencies) {
        if (dep.dependency_type !== 'required') continue;

        let depProjectId = dep.project_id;
        if (!depProjectId && dep.version_id) {
          const depVersion = await this.fetchVersion(dep.version_id);
          depProjectId = depVersion?.project_id;
        }
        if (!depProjectId) continue;

        const depProject = await this.fetchProjectById(depProjectId);
        if (!depProject) continue;

        if (!requiredByMap.has(depProject.id)) {
          requiredByMap.set(depProject.id, new Set());
        }
        requiredByMap.get(depProject.id)!.add(project.slug);

        if (!visitedSlugs.has(depProject.slug)) {
          queue.push(depProject.slug);
        }
      }
    }

    const mods = Array.from(resolved.values()).map((mod) => ({
      ...mod,
      requiredBy: Array.from(requiredByMap.get(mod.projectId) ?? []),
    }));

    const modrinthProjects = mods.map((m) => `${m.slug}:${m.versionNumber}`).join(',');

    return { mods, modrinthProjects };
  }

  async getDeployManifest(serverId: string): Promise<ModDeployManifest | null> {
    try {
      const raw = await fs.readFile(this.manifestPath(serverId), 'utf-8');
      return JSON.parse(raw) as ModDeployManifest;
    } catch {
      return null;
    }
  }

  async saveDeployManifest(manifest: ModDeployManifest): Promise<ModDeployManifest> {
    const dir = path.dirname(this.manifestPath(manifest.serverId));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.manifestPath(manifest.serverId), JSON.stringify(manifest, null, 2), 'utf-8');
    return manifest;
  }

  async publishLauncherSync(input: {
    serverId: string;
    slugs: string[];
    serverHost: string;
    serverPort: number;
    serverName: string;
    forgeBuild?: string;
    resourcePackUrl?: string;
    resourcePackSha1?: string;
    resourcePackName?: string;
    requireResourcePack?: boolean;
    lockClientResourcePacks?: boolean;
  }): Promise<ModDeployManifest> {
    const slugs = [...new Set(input.slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
    if (slugs.length === 0) {
      throw new HttpException('Se requiere al menos un mod para sincronizar el launcher', HttpStatus.BAD_REQUEST);
    }

    const existing = await this.getDeployManifest(input.serverId);
    const nextRevision = (existing?.launcherRevision ?? 0) + 1;

    const resolved = await this.resolveModsWithDependencies({ slugs });

    return this.saveDeployManifest({
      serverId: input.serverId,
      gameVersion: FORGE_119_GAME_VERSION,
      loader: FORGE_119_LOADER,
      updatedAt: new Date().toISOString(),
      mods: resolved.mods,
      modrinthProjects: resolved.modrinthProjects,
      lockClientResourcePacks: input.lockClientResourcePacks ?? true,
      launcherRevision: nextRevision,
      forgeBuild: input.forgeBuild ?? '43.3.0',
      server: {
        host: input.serverHost,
        port: input.serverPort,
        name: input.serverName,
      },
      resourcePack: input.resourcePackUrl
        ? {
            url: input.resourcePackUrl,
            sha1: input.resourcePackSha1,
            name: input.resourcePackName ?? 'Resource pack del servidor',
            required: input.requireResourcePack ?? true,
          }
        : undefined,
    });
  }

  async searchPlugins(query: {
    q?: string;
    limit?: number;
    offset?: number;
    minecraftVersion: string;
  }): Promise<NormalizedModSearchResponse> {
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const offset = Math.max(query.offset ?? 0, 0);

    const facets: string[][] = [
      ['project_type:plugin'],
      [`versions:${query.minecraftVersion}`],
    ];

    try {
      const response = await this.apiClient.get<ModrinthSearchResponse>('/search', {
        params: {
          query: query.q,
          limit,
          offset,
          index: 'relevance',
          facets: JSON.stringify(facets),
        },
      });

      const normalized = response.data.hits
        .map((hit) => this.normalizeHit(hit))
        .filter((mod) => mod.supportedVersions.some((v) => v === query.minecraftVersion));

      return {
        data: normalized,
        pagination: {
          index: offset,
          pageSize: limit,
          resultCount: normalized.length,
          totalCount: response.data.total_hits,
        },
      };
    } catch (error) {
      console.error('Error searching Modrinth plugins:', error);

      if (axios.isAxiosError(error)) {
        throw new HttpException(
          error.response?.data?.description || 'Error searching plugins',
          error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      throw new HttpException('Error searching plugins', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  async getPaperCatalogMeta(): Promise<PaperCatalogMetaResponse> {
    return {
      categories: PAPER_PLUGIN_CATALOG.map(({ id, label, description, slugs }) => ({
        id,
        label,
        description,
        slugCount: slugs.length,
      })),
    };
  }

  async getPaperCategoryPlugins(
    categoryId: string,
    gameVersion: string,
    offset = 0,
    limit = 9,
  ): Promise<PaperCatalogCategoryPage> {
    const category = PAPER_PLUGIN_CATALOG.find((c) => c.id === categoryId);
    if (!category) {
      throw new NotFoundException(`Categoría desconocida: ${categoryId}`);
    }

    const curated = category.slugs;
    const safeLimit = Math.min(Math.max(limit, 1), 24);

    if (offset < curated.length) {
      const slice = curated.slice(offset, offset + safeLimit);
      const entries = await this.mapPool(
        slice,
        (slug) => this.resolvePluginCatalogEntry(slug, gameVersion),
        4,
      );
      const nextOffset = offset + slice.length;
      return {
        categoryId,
        gameVersion,
        entries,
        offset,
        nextOffset,
        hasMore: nextOffset < curated.length || curated.length > 0,
        source: 'curated',
      };
    }

    const searchOffset = offset - curated.length;
    const search = await this.searchPlugins({
      q: PAPER_CATEGORY_SEARCH[categoryId] ?? category.label,
      limit: safeLimit,
      offset: searchOffset,
      minecraftVersion: gameVersion,
    });

    const curatedSet = new Set(curated);
    const slugs = search.data.map((mod) => mod.slug).filter((slug) => !curatedSet.has(slug));
    const entries = await this.mapPool(
      slugs,
      (slug) => this.resolvePluginCatalogEntry(slug, gameVersion),
      4,
    );
    const nextOffset = offset + entries.length;

    return {
      categoryId,
      gameVersion,
      entries,
      offset,
      nextOffset,
      hasMore: searchOffset + safeLimit < search.pagination.totalCount,
      source: 'search',
    };
  }

  async resolvePluginsWithDependencies(input: {
    slugs: string[];
    gameVersion: string;
  }): Promise<{ plugins: ModrinthResolvedMod[]; modrinthProjects: string }> {
    const gameVersion = input.gameVersion;
    const resolved = new Map<string, ModrinthResolvedMod>();
    const requiredByMap = new Map<string, Set<string>>();
    const queue = [...new Set(input.slugs.map((s) => s.trim().toLowerCase()).filter(Boolean))];
    const visitedSlugs = new Set<string>();

    while (queue.length > 0) {
      const slug = queue.shift()!;
      if (visitedSlugs.has(slug)) continue;
      visitedSlugs.add(slug);

      const project = await this.fetchProject(slug);
      if (!project) continue;

      const version = await this.fetchBestPluginVersion(project.id, gameVersion);
      if (!version) continue;

      const primaryFile = version.files.find((f) => f.primary) ?? version.files[0];
      if (!primaryFile) continue;

      const isRoot = input.slugs.some((s) => s.toLowerCase() === slug);
      const existing = resolved.get(project.id);

      if (existing) {
        if (isRoot) existing.isDependency = false;
        continue;
      }

      resolved.set(project.id, {
        projectId: project.id,
        slug: project.slug,
        name: project.title,
        versionId: version.id,
        versionNumber: version.version_number,
        fileName: primaryFile.filename,
        downloadUrl: primaryFile.url,
        fileSize: primaryFile.size,
        sha1: primaryFile.hashes.sha1 ?? '',
        isDependency: !isRoot,
        requiredBy: [],
      });

      for (const dep of version.dependencies) {
        if (dep.dependency_type !== 'required') continue;

        let depProjectId = dep.project_id;
        if (!depProjectId && dep.version_id) {
          const depVersion = await this.fetchVersion(dep.version_id);
          depProjectId = depVersion?.project_id;
        }
        if (!depProjectId) continue;

        const depProject = await this.fetchProjectById(depProjectId);
        if (!depProject) continue;

        if (!requiredByMap.has(depProject.id)) {
          requiredByMap.set(depProject.id, new Set());
        }
        requiredByMap.get(depProject.id)!.add(project.slug);

        if (!visitedSlugs.has(depProject.slug)) {
          queue.push(depProject.slug);
        }
      }
    }

    const plugins = Array.from(resolved.values()).map((plugin) => ({
      ...plugin,
      requiredBy: Array.from(requiredByMap.get(plugin.projectId) ?? []),
    }));

    const modrinthProjects = plugins.map((p) => `${p.slug}:${p.versionNumber}`).join(',');

    return { plugins, modrinthProjects };
  }

  async buildPluginPackZip(
    slugs: string[],
    gameVersion: string,
  ): Promise<{ stream: archiver.Archiver; name: string }> {
    const { plugins } = await this.resolvePluginsWithDependencies({ slugs, gameVersion });

    if (plugins.length === 0) {
      throw new HttpException('No se encontraron plugins compatibles', HttpStatus.BAD_REQUEST);
    }

    const archive = archiver('zip', { zlib: { level: 6 } });

    for (const plugin of plugins) {
      try {
        const response = await axios.get<ArrayBuffer>(plugin.downloadUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
        });
        archive.append(Buffer.from(response.data), { name: plugin.fileName });
      } catch (error) {
        console.error(`Error downloading plugin ${plugin.slug}:`, error);
      }
    }

    archive.finalize();

    return {
      stream: archive,
      name: `paper-plugins-${gameVersion}.zip`,
    };
  }

  async getPluginManifest(serverId: string): Promise<PluginDeployManifest | null> {
    try {
      const raw = await fs.readFile(this.pluginManifestPath(serverId), 'utf-8');
      return JSON.parse(raw) as PluginDeployManifest;
    } catch {
      return null;
    }
  }

  async savePluginManifest(manifest: PluginDeployManifest): Promise<PluginDeployManifest> {
    const dir = path.dirname(this.pluginManifestPath(manifest.serverId));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      this.pluginManifestPath(manifest.serverId),
      JSON.stringify(manifest, null, 2),
      'utf-8',
    );
    return manifest;
  }

  private pluginManifestPath(serverId: string): string {
    const baseDir = this.configService.get<string>('baseDir') ?? process.env.BASE_DIR ?? '.';
    return path.join(baseDir, 'servers', serverId, 'plugin-deploy', 'manifest.json');
  }

  private async resolvePluginCatalogEntry(
    slug: string,
    gameVersion: string,
  ): Promise<CatalogModEntry> {
    const project = await this.fetchProject(slug);
    if (!project) {
      return {
        slug,
        name: slug.replace(/-/g, ' '),
        summary: '',
        compatible: false,
        reason: 'not_found',
      };
    }

    const version = await this.fetchBestPluginVersion(project.id, gameVersion);
    if (!version) {
      return {
        slug: project.slug,
        name: project.title,
        summary: project.description ?? '',
        iconUrl: project.icon_url,
        projectId: project.id,
        compatible: false,
        reason: 'no_mc_version',
        clientSide: project.client_side,
        serverSide: project.server_side,
      };
    }

    return {
      slug: project.slug,
      name: project.title,
      summary: project.description ?? '',
      iconUrl: project.icon_url,
      projectId: project.id,
      compatible: true,
      clientSide: project.client_side,
      serverSide: project.server_side,
      versionNumber: version.version_number,
    };
  }

  private async fetchBestPluginVersion(
    projectId: string,
    gameVersion: string,
  ): Promise<ModrinthVersion | null> {
    try {
      const { data } = await this.apiClient.get<ModrinthVersion[]>(`/project/${projectId}/version`, {
        params: {
          game_versions: JSON.stringify([gameVersion]),
        },
      });

      const release = data.find(
        (v) => v.version_number && !v.version_number.toLowerCase().includes('alpha'),
      );
      return release ?? data[0] ?? null;
    } catch {
      return null;
    }
  }

  private manifestPath(serverId: string): string {
    const baseDir = this.configService.get<string>('baseDir') ?? process.env.BASE_DIR ?? '.';
    return path.join(baseDir, 'servers', serverId, 'mod-deploy', 'manifest.json');
  }

  private async resolveCatalogEntry(slug: string): Promise<CatalogModEntry> {
    const normalizedSlug = normalizeForge119Slug(slug);
    const project = await this.fetchProject(normalizedSlug);
    if (!project) {
      return {
        slug,
        name: slug.replace(/-/g, ' '),
        summary: '',
        compatible: false,
        reason: 'not_found',
      };
    }

    const version = await this.fetchBestVersion(
      project.id,
      FORGE_119_GAME_VERSION,
      FORGE_119_LOADER,
    );
    if (!version) {
      return {
        slug: project.slug,
        name: project.title,
        summary: project.description ?? '',
        iconUrl: project.icon_url,
        projectId: project.id,
        compatible: false,
        reason: 'no_forge_119',
        clientSide: project.client_side,
        serverSide: project.server_side,
      };
    }

    const clientOnly =
      project.server_side === 'unsupported' && project.client_side === 'required';

    return {
      slug: project.slug,
      name: project.title,
      summary: project.description ?? '',
      iconUrl: project.icon_url,
      projectId: project.id,
      compatible: !clientOnly,
      reason: clientOnly ? 'client_only' : undefined,
      clientSide: project.client_side,
      serverSide: project.server_side,
      versionNumber: version.version_number,
    };
  }

  private async mapPool<T, R>(
    items: T[],
    fn: (item: T) => Promise<R>,
    concurrency = 4,
  ): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let index = 0;

    const worker = async () => {
      while (index < items.length) {
        const current = index++;
        results[current] = await fn(items[current]);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
    return results;
  }

  private async fetchProjectSummary(
    slug: string,
    gameVersion: string,
    loader: string,
  ): Promise<ModrinthProjectSummary | null> {
    const project = await this.fetchProject(slug);
    if (!project) return null;

    const version = await this.fetchBestVersion(project.id, gameVersion, loader);
    if (!version) return null;

    return {
      projectId: project.id,
      slug: project.slug,
      name: project.title,
      summary: project.description ?? '',
      iconUrl: project.icon_url,
      downloads: project.downloads,
      clientSide: project.client_side,
      serverSide: project.server_side,
    };
  }

  private async fetchProject(slug: string, attempt = 0): Promise<ModrinthProject | null> {
    const normalizedSlug = normalizeForge119Slug(slug);
    try {
      const { data } = await this.apiClient.get<ModrinthProject>(
        `/project/${encodeURIComponent(normalizedSlug)}`,
      );
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        if (status === 404) return null;
        if ((status === 429 || status === 503) && attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
          return this.fetchProject(slug, attempt + 1);
        }
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
        return this.fetchProject(slug, attempt + 1);
      }
      return null;
    }
  }

  private async fetchProjectById(id: string): Promise<ModrinthProject | null> {
    try {
      const { data } = await this.apiClient.get<ModrinthProject>(`/project/${id}`);
      return data;
    } catch {
      return null;
    }
  }

  private async fetchVersion(versionId: string): Promise<ModrinthVersion | null> {
    try {
      const { data } = await this.apiClient.get<ModrinthVersion>(`/version/${versionId}`);
      return data;
    } catch {
      return null;
    }
  }

  private async fetchBestVersion(
    projectId: string,
    gameVersion: string,
    loader: string,
  ): Promise<ModrinthVersion | null> {
    try {
      const { data } = await this.apiClient.get<ModrinthVersion[]>(`/project/${projectId}/version`, {
        params: {
          game_versions: JSON.stringify([gameVersion]),
          loaders: JSON.stringify([loader]),
        },
      });

      const release = data.find((v) => v.version_number && !v.version_number.toLowerCase().includes('alpha'));
      return release ?? data[0] ?? null;
    } catch {
      return null;
    }
  }

  private normalizeHit(hit: ModrinthSearchHit): NormalizedModSearchResult {
    const supportedLoaders = (hit.categories ?? []).filter((category) =>
      this.KNOWN_LOADERS.includes(category.toLowerCase()),
    );

    return {
      provider: 'modrinth',
      projectId: hit.project_id,
      slug: hit.slug,
      name: hit.title,
      summary: hit.description ?? '',
      iconUrl: hit.icon_url,
      downloads: hit.downloads,
      lastUpdated: hit.date_modified,
      supportedVersions: hit.versions ?? [],
      supportedLoaders,
    };
  }

  private isCompatibleResult(
    mod: NormalizedModSearchResult,
    minecraftVersion: string,
    loader?: 'forge' | 'neoforge' | 'fabric' | 'quilt',
  ): boolean {
    const hasVersion = mod.supportedVersions.some((version) => version === minecraftVersion);
    if (!hasVersion) return false;

    if (!loader) return true;
    if (mod.supportedLoaders.length === 0) return true;
    return mod.supportedLoaders.includes(loader);
  }
}
