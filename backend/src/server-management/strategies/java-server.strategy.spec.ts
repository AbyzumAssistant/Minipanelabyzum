import { ServerConfig } from '../dto/server-config.model';
import { JavaServerStrategy } from './java-server.strategy';

describe('JavaServerStrategy', () => {
  const strategy = new JavaServerStrategy();

  const baseConfig = (): ServerConfig =>
    ({
      id: 'test-server',
      edition: 'JAVA',
      serverType: 'NEOFORGE',
      serverName: 'Test Server',
      motd: 'Test MOTD',
      difficulty: 'easy',
      maxPlayers: '10',
      ops: '',
      tz: 'UTC',
      onlineMode: true,
      pvp: true,
      commandBlock: true,
      allowFlight: false,
      viewDistance: '10',
      simulationDistance: '10',
      stopDelay: '60',
      enableRollingLogs: false,
      execDirectly: false,
      playerIdleTimeout: '0',
      entityBroadcastRange: '100',
      levelType: 'minecraft:default',
      gameMode: 'survival',
      hardcore: false,
      spawnAnimals: true,
      spawnMonsters: true,
      spawnNpcs: true,
      generateStructures: true,
      allowNether: true,
      uid: '1000',
      gid: '1000',
      initMemory: '2G',
      maxMemory: '4G',
      enableAutoStop: false,
      enableAutoPause: false,
      enableRcon: true,
      rconPort: '25575',
      preventProxyConnections: false,
      minecraftVersion: '1.21.1',
      neoforgeBuild: '21.1.64',
    }) as ServerConfig;

  it('should include VERSION for NEOFORGE servers', () => {
    const config = baseConfig();
    const env = strategy.buildEnvironment(config);

    expect(env.TYPE).toBe('NEOFORGE');
    expect(env.NEOFORGE_VERSION).toBe('21.1.64');
    expect(env.VERSION).toBe('1.21.1');
  });

  it('should include VERSION for FORGE servers', () => {
    const config = {
      ...baseConfig(),
      serverType: 'FORGE',
      forgeBuild: '47.3.0',
      neoforgeBuild: '',
    } as ServerConfig;

    const env = strategy.buildEnvironment(config);

    expect(env.TYPE).toBe('FORGE');
    expect(env.FORGE_VERSION).toBe('47.3.0');
    expect(env.VERSION).toBe('1.21.1');
  });

  it('should include Modrinth exclude env vars for Horizons servers', () => {
    const config = {
      ...baseConfig(),
      serverType: 'MODRINTH',
      minecraftVersion: '1.20.1',
      modrinthModpack: 'horizons1',
      modrinthModpackVersion: '1.5',
      modrinthLoader: 'fabric',
      fabricLoaderVersion: '0.16.10',
      neoforgeBuild: '',
    } as ServerConfig;

    const env = strategy.buildEnvironment(config);

    expect(env.TYPE).toBe('MODRINTH');
    expect(env.MODRINTH_MODPACK).toBe('horizons1');
    expect(env.MODRINTH_VERSION).toBe('1.5');
    expect(env.MODRINTH_LOADER).toBe('fabric');
    expect(env.FABRIC_LOADER_VERSION).toBe('0.16.10');
    expect(env.MODRINTH_EXCLUDE_FILES).toBe('bettertrims');
    expect(env.MODRINTH_FORCE_SYNCHRONIZE).toBe('true');
    expect(env.MODRINTH_IGNORE_MISSING_FILES).toBe('bettertrims');
  });

  it('should allow custom VERSION in envVars to override generated VERSION', () => {
    const config = {
      ...baseConfig(),
      envVars: 'VERSION=1.20.6',
    } as ServerConfig;

    const env = strategy.buildEnvironment(config);

    expect(env.VERSION).toBe('1.20.6');
  });
});
