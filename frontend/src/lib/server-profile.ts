import { applyForge119Defaults } from './forge-defaults';
import { applyHorizonsDefaults, HORIZONS_MODPACK_SLUG } from './horizons-defaults';
import type { ServerConfig } from './types/types';

export function isHorizonsProfile(config: Partial<ServerConfig>): boolean {
  const modpackSlug = (config.modrinthModpack ?? '').split(':')[0];
  return (
    config.serverType === 'MODRINTH' &&
    (modpackSlug === HORIZONS_MODPACK_SLUG ||
      (config.minecraftVersion === '1.20.1' && config.modrinthLoader === 'fabric'))
  );
}

export function isLegacyForgeMcabyzum(serverId: string, config: Partial<ServerConfig>): boolean {
  return (
    serverId.toLowerCase() === 'mcabyzum' &&
    !isHorizonsProfile(config) &&
    (config.serverType === 'FORGE' ||
      config.minecraftVersion === '1.19.2' ||
      config.modrinthLoader === 'forge')
  );
}

export function applyServerProfileDefaults(config: Partial<ServerConfig>): ServerConfig {
  if (isHorizonsProfile(config)) {
    return applyHorizonsDefaults(config);
  }
  return applyForge119Defaults(config);
}

export function applyHorizonsProfile(config: Partial<ServerConfig>): ServerConfig {
  return applyHorizonsDefaults({
    ...config,
    serverName: config.serverName || 'mcabyzum',
  });
}

export function applyForgeProfile(config: Partial<ServerConfig>): ServerConfig {
  return applyForge119Defaults({
    ...config,
    serverName: config.serverName || 'mcabyzum',
  });
}

export function patchConfigFromProfile(
  current: ServerConfig,
  profile: ServerConfig,
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void,
): void {
  (Object.keys(profile) as (keyof ServerConfig)[]).forEach((key) => {
    if (profile[key] !== current[key]) {
      updateConfig(key, profile[key] as ServerConfig[typeof key]);
    }
  });
}
