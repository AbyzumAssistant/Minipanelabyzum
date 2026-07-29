import {
  getHorizonsModrinthExcludeFiles,
  shouldPruneHorizonsServerMod,
} from './horizons-server.constants';

describe('horizons-server.constants', () => {
  it('excludes client-only mods from modpack install', () => {
    const excludes = getHorizonsModrinthExcludeFiles();
    expect(excludes).toContain('distanthorizons');
    expect(excludes).toContain('bettertrims');
  });

  it('prunes distant horizons and forge leftovers', () => {
    expect(shouldPruneHorizonsServerMod('DistantHorizons-2.2.1-a-1.20.1-fabric.jar')).toBe(true);
    expect(shouldPruneHorizonsServerMod('waystones-forge-1.19.2-11.4.2.jar')).toBe(true);
    expect(shouldPruneHorizonsServerMod('create-1.19.2-0.5.1.i.jar')).toBe(true);
    expect(shouldPruneHorizonsServerMod('PuzzlesLib-v8.0.15-1.20.1-Fabric.jar')).toBe(false);
    expect(shouldPruneHorizonsServerMod('forgeconfigapiport-8.0.0.jar')).toBe(false);
  });
});
