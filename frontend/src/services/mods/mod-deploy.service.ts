import api from '../axios.service';

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

export type CatalogIncompatReason = 'not_found' | 'no_forge_119' | 'client_only';

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

export interface ForgeCatalogCategoryMeta {
  id: string;
  label: string;
  description: string;
  slugCount: number;
}

export interface ForgeCatalogMetaResponse {
  gameVersion: string;
  loader: string;
  categories: ForgeCatalogCategoryMeta[];
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
  resourcePacks?: Array<{
    fileName: string;
    downloadUrl: string;
    sha1?: string;
    name: string;
  }>;
  configFiles?: Array<{
    path: string;
    fileName: string;
    downloadUrl: string;
    sha1?: string;
    kind: string;
  }>;
  shaderPackNote?: string;
  shaderPackUrl?: string;
  profile?: 'forge119' | 'horizons' | 'modpack';
  modpackSlug?: string;
  modpackTitle?: string;
  modpackVersion?: string;
  fabricLoaderVersion?: string;
  lockClientResourcePacks: boolean;
  launcherRevision?: number;
  forgeBuild?: string;
  server?: {
    host: string;
    port: number;
    name: string;
  };
}

const CATALOG_TIMEOUT = 90000;

export const fetchForge119CatalogMeta = async (): Promise<ForgeCatalogMetaResponse> => {
  const { data } = await api.get<ForgeCatalogMetaResponse>('/modrinth/catalog/forge-119', {
    timeout: 15000,
  });
  return data;
};

export const fetchForge119CategoryMods = async (
  categoryId: string,
  offset = 0,
  limit = 9,
): Promise<ForgeCatalogCategoryPage> => {
  const { data } = await api.get<ForgeCatalogCategoryPage>(
    `/modrinth/catalog/forge-119/${encodeURIComponent(categoryId)}`,
    { params: { offset, limit }, timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const searchForge119Mods = async (
  query: string,
  offset = 0,
  limit = 9,
): Promise<ForgeCatalogSearchPage> => {
  const { data } = await api.get<ForgeCatalogSearchPage>('/modrinth/catalog/forge-119/search', {
    params: { q: query, offset, limit },
    timeout: CATALOG_TIMEOUT,
  });
  return data;
};

export const checkModsCompatibility = async (slugs: string[]) => {
  const { data } = await api.post<ModSelectionReport>(
    '/modrinth/mods/check-compatibility',
    { slugs },
    { timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const resolveModsWithDependencies = async (slugs: string[]) => {
  const { data } = await api.post<{ mods: ModrinthResolvedMod[]; modrinthProjects: string }>(
    '/modrinth/mods/resolve',
    { slugs },
    { timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const getDeployManifest = async (serverId: string): Promise<ModDeployManifest | null> => {
  const { data } = await api.get<ModDeployManifest | null>(`/modrinth/deploy/${serverId}/manifest/admin`);
  return data;
};

export const saveDeployManifest = async (
  serverId: string,
  payload: {
    slugs: string[];
    resourcePackUrl?: string;
    resourcePackSha1?: string;
    resourcePackName?: string;
    requireResourcePack?: boolean;
    lockClientResourcePacks?: boolean;
  },
): Promise<ModDeployManifest> => {
  const { data } = await api.put<ModDeployManifest>(`/modrinth/deploy/${serverId}/manifest`, payload, {
    timeout: CATALOG_TIMEOUT,
  });
  return data;
};

export interface ServerModSyncResult {
  synced: boolean;
  modCount: number;
  modrinthProjects: string;
  dependencies: string[];
}

export const syncServerModsFromManifest = async (serverId: string): Promise<ServerModSyncResult> => {
  const { data } = await api.post<ServerModSyncResult>(`/modrinth/deploy/${serverId}/server/sync`, {}, {
    timeout: CATALOG_TIMEOUT,
  });
  return data;
};

export const getModpackInfo = async (slug: string) => {
  const { data } = await api.get(`/modrinth/modpack/${encodeURIComponent(slug)}/info`, {
    timeout: CATALOG_TIMEOUT,
  });
  return data;
};

export const publishModpackDeploy = async (
  serverId: string,
  payload: {
    slug: string;
    versionId?: string;
    serverHost: string;
    serverPort: number;
    serverName: string;
    lockClientResourcePacks?: boolean;
    profile?: 'horizons' | 'modpack' | 'forge119';
  },
): Promise<ModDeployManifest> => {
  const { data } = await api.post<ModDeployManifest>(
    `/modrinth/deploy/${serverId}/modpack/publish`,
    payload,
    { timeout: 300000 },
  );
  return data;
};

export const syncLauncherManifest = async (
  serverId: string,
  payload: {
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
  },
): Promise<ModDeployManifest> => {
  const { data } = await api.post<ModDeployManifest>(
    `/modrinth/deploy/${serverId}/launcher/sync`,
    payload,
    { timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const fetchPublicDeployManifest = async (serverId: string): Promise<ModDeployManifest> => {
  const base = process.env.NEXT_PUBLIC_BACKEND_URL ?? '/api/backend';
  const res = await fetch(`${base}/modrinth/deploy/${encodeURIComponent(serverId)}/manifest`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('No se pudo cargar el manifiesto');
  return res.json();
};

export interface LauncherBuildStatus {
  serverId: string;
  built: boolean;
  builtAt?: string;
  fileName?: string;
  modCount?: number;
  launcherRevision?: number;
  fileSize?: number;
}

export const getLauncherBuildStatus = async (serverId: string): Promise<LauncherBuildStatus> => {
  const { data } = await api.get<LauncherBuildStatus>(`/modrinth/deploy/${serverId}/launcher/status`);
  return data;
};

export const buildLauncherPack = async (serverId: string): Promise<LauncherBuildStatus> => {
  const { data } = await api.post<LauncherBuildStatus>(
    `/modrinth/deploy/${serverId}/launcher/build`,
    {},
    { timeout: 300000 },
  );
  return data;
};

export const downloadLauncherPack = async (serverId: string): Promise<Blob> => {
  const { data } = await api.get<Blob>(`/modrinth/deploy/${serverId}/launcher/download`, {
    timeout: 300000,
    responseType: 'blob',
  });
  return data;
};
