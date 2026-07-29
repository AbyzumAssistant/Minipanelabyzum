import { parseModrinthModpackRef, resolveModrinthModpackEnv } from './modrinth-modpack.util';

describe('modrinth-modpack.util', () => {
  it('splits slug:version refs', () => {
    expect(parseModrinthModpackRef('horizons1:1.5')).toEqual({
      modpack: 'horizons1',
      version: '1.5',
    });
  });

  it('keeps URLs intact', () => {
    const url = 'https://modrinth.com/modpack/horizons1/version/1.5';
    expect(parseModrinthModpackRef(url)).toEqual({ modpack: url });
  });

  it('prefers explicit version field over embedded slug:version', () => {
    expect(
      resolveModrinthModpackEnv({
        modrinthModpack: 'horizons1:1.4.8',
        modrinthModpackVersion: '1.5',
      }),
    ).toEqual({
      modpack: 'horizons1',
      version: '1.5',
    });
  });
});
