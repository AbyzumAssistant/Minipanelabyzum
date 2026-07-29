import { parseModrinthModpackRef } from '../server-management/utils/modrinth-modpack.util';

export const HORIZONS_MODPACK_SLUG = 'horizons1';

/** Mods del mrpack Horizons que rompen el arranque del servidor Fabric. */
export const HORIZONS_SERVER_MOD_EXCLUDES = ['BetterTrims'] as const;

export function isHorizonsModpack(modpack?: string): boolean {
  return parseModrinthModpackRef(modpack).modpack === HORIZONS_MODPACK_SLUG;
}

export function getHorizonsModrinthExcludeFiles(): string {
  return HORIZONS_SERVER_MOD_EXCLUDES.join('\n');
}
