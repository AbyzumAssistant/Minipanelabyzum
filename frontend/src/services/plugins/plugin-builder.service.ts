import api from '../axios.service';

export type CatalogIncompatReason = 'not_found' | 'no_forge_119' | 'no_mc_version' | 'client_only';

export interface CatalogPluginEntry {
  slug: string;
  name: string;
  summary: string;
  iconUrl?: string;
  projectId?: string;
  compatible: boolean;
  reason?: CatalogIncompatReason;
  versionNumber?: string;
}

export interface PaperCatalogCategoryMeta {
  id: string;
  label: string;
  description: string;
  slugCount: number;
}

export interface PaperCatalogMetaResponse {
  categories: PaperCatalogCategoryMeta[];
}

export interface PaperCatalogCategoryPage {
  categoryId: string;
  gameVersion: string;
  entries: CatalogPluginEntry[];
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  source: 'curated' | 'search';
}

export interface ModrinthResolvedPlugin {
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

export interface PluginDeployManifest {
  serverId: string;
  gameVersion: string;
  updatedAt: string;
  plugins: ModrinthResolvedPlugin[];
  modrinthProjects: string;
}

const CATALOG_TIMEOUT = 90000;

export const fetchPaperCatalogMeta = async (): Promise<PaperCatalogMetaResponse> => {
  const { data } = await api.get<PaperCatalogMetaResponse>('/modrinth/catalog/paper', {
    timeout: 15000,
  });
  return data;
};

export const fetchPaperCategoryPlugins = async (
  categoryId: string,
  gameVersion: string,
  offset = 0,
  limit = 9,
): Promise<PaperCatalogCategoryPage> => {
  const { data } = await api.get<PaperCatalogCategoryPage>(
    `/modrinth/catalog/paper/${encodeURIComponent(categoryId)}`,
    { params: { gameVersion, offset, limit }, timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const resolvePluginsWithDependencies = async (slugs: string[], gameVersion: string) => {
  const { data } = await api.post<{ plugins: ModrinthResolvedPlugin[]; modrinthProjects: string }>(
    '/modrinth/plugins/resolve',
    { slugs, gameVersion },
    { timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const buildPluginPack = async (slugs: string[], gameVersion: string): Promise<Blob> => {
  const { data } = await api.post<Blob>(
    '/modrinth/plugins/build',
    { slugs, gameVersion },
    { timeout: 120000, responseType: 'blob' },
  );
  return data;
};

export const savePluginManifest = async (
  serverId: string,
  payload: { slugs: string[]; gameVersion: string },
): Promise<PluginDeployManifest> => {
  const { data } = await api.put<PluginDeployManifest>(
    `/modrinth/plugins/deploy/${serverId}/manifest`,
    payload,
    { timeout: CATALOG_TIMEOUT },
  );
  return data;
};

export const getPluginManifest = async (serverId: string): Promise<PluginDeployManifest | null> => {
  const { data } = await api.get<PluginDeployManifest | null>(
    `/modrinth/plugins/deploy/${serverId}/manifest/admin`,
  );
  return data;
};
