import type { ServerConfig, ServerEdition } from './types/types';

export const FORGE_119_PROFILE = {
  edition: 'JAVA' as ServerEdition,
  serverType: 'FORGE' as const,
  minecraftVersion: '1.19.2',
  forgeBuild: '43.3.0',
  dockerImage: 'java17',
  useAikarFlags: true,
  initMemory: '2G',
  maxMemory: '4G',
  memoryReservation: '2G',
  cpuLimit: '2',
  viewDistance: '8',
  simulationDistance: '6',
  motd: 'abyzumMC Forge 1.19',
  gameMode: 'survival' as const,
  difficulty: 'normal' as const,
  maxPlayers: '20',
  onlineMode: true,
  enableRcon: true,
  port: '25569',
  modrinthLoader: 'forge',
  modrinthDownloadDependencies: 'required' as const,
};

export function applyForge119Defaults(config: Partial<ServerConfig>): ServerConfig {
  return {
    ...FORGE_119_PROFILE,
    ...(config as ServerConfig),
    id: config.id ?? 'Server',
    serverName: config.serverName ?? 'Forge 1.19 Server',
    port: config.port ?? FORGE_119_PROFILE.port,
  };
}
