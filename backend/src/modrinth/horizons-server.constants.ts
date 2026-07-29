import { parseModrinthModpackRef } from '../server-management/utils/modrinth-modpack.util';

export const HORIZONS_MODPACK_SLUG = 'horizons1';

/** Fragmentos del nombre del jar (minúsculas; MODRINTH_EXCLUDE_FILES usa partial match). */
export const HORIZONS_SERVER_MOD_EXCLUDES = ['bettertrims'] as const;

export function isHorizonsModpack(modpack?: string): boolean {
  return parseModrinthModpackRef(modpack).modpack === HORIZONS_MODPACK_SLUG;
}

export function getHorizonsModrinthExcludeFiles(): string {
  return HORIZONS_SERVER_MOD_EXCLUDES.join('\n');
}

export function getHorizonsModrinthIgnoreMissingFiles(): string {
  return HORIZONS_SERVER_MOD_EXCLUDES.join(',');
}

export function matchesHorizonsServerModExclude(fileName: string): boolean {
  const normalized = fileName.toLowerCase();
  return HORIZONS_SERVER_MOD_EXCLUDES.some((pattern) => normalized.includes(pattern));
}
