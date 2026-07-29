import type { ServerConfig, ServerEdition } from './types/types';

export const HORIZONS_MODPACK_SLUG = 'horizons1';

export const HORIZONS_PROFILE = {
  edition: 'JAVA' as ServerEdition,
  serverType: 'MODRINTH' as const,
  minecraftVersion: '1.20.1',
  modrinthModpack: HORIZONS_MODPACK_SLUG,
  modrinthLoader: 'fabric',
  dockerImage: 'java17',
  useAikarFlags: true,
  initMemory: '8G',
  maxMemory: '10G',
  memoryReservation: '8G',
  cpuLimit: '4',
  viewDistance: '10',
  simulationDistance: '8',
  motd: 'mcabyzum · Horizons',
  gameMode: 'survival' as const,
  difficulty: 'normal' as const,
  maxPlayers: '20',
  onlineMode: false,
  enableRcon: true,
  port: '25569',
  modrinthExcludeFiles: 'BetterTrims',
  modrinthForceSynchronize: true,
};

export function applyHorizonsDefaults(config: Partial<ServerConfig>): ServerConfig {
  const merged = {
    ...HORIZONS_PROFILE,
    ...(config as ServerConfig),
    id: config.id ?? 'Server',
    serverName: config.serverName ?? 'mcabyzum',
    port: config.port ?? HORIZONS_PROFILE.port,
  };
  merged.onlineMode = false;
  merged.minecraftVersion = HORIZONS_PROFILE.minecraftVersion;
  merged.modrinthModpack = merged.modrinthModpack || HORIZONS_MODPACK_SLUG;
  merged.modrinthLoader = 'fabric';
  merged.serverType = 'MODRINTH';
  return merged;
}
