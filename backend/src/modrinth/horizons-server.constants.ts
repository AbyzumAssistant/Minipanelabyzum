import { parseModrinthModpackRef } from '../server-management/utils/modrinth-modpack.util';

export const HORIZONS_MODPACK_SLUG = 'horizons1';
export const HORIZONS_SERVER_PORT = 25569;

/**
 * Fragmentos del nombre del jar (minúsculas; MODRINTH_EXCLUDE_FILES usa partial match).
 * Incluye mods solo-cliente que rompen el servidor dedicado Fabric.
 */
export const HORIZONS_SERVER_MOD_EXCLUDES = [
  'bettertrims',
  'distanthorizons',
  'distant-horizons',
  'do_a_barrel_roll',
  'notenoughcrashes',
  'entityculling',
  'showmeyourskin',
  'waveycapes',
  'iris',
  'sodium',
  'indium',
  'continuity',
  'lambdynlights',
  'zoomify',
  'blur',
  'replaymod',
] as const;

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

/** Quita mods cliente, Forge 1.19.x u otros jars ajenos al servidor Fabric Horizons. */
export function shouldPruneHorizonsServerMod(fileName: string, gameVersion = '1.20.1'): boolean {
  if (matchesHorizonsServerModExclude(fileName)) {
    return true;
  }

  const lower = fileName.toLowerCase();
  if (!lower.endsWith('.jar')) {
    return false;
  }

  if (lower.includes('-forge-') || lower.includes('-neoforge-')) {
    return true;
  }

  if (gameVersion.startsWith('1.20') && lower.includes('1.19.2')) {
    return true;
  }

  return false;
}
