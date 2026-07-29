export interface ModrinthModpackRef {
  modpack: string;
  version?: string;
}

/** Split slug:version refs for Docker MODRINTH_MODPACK + MODRINTH_VERSION. */
export function parseModrinthModpackRef(ref: string | undefined): ModrinthModpackRef {
  const trimmed = (ref ?? '').trim();
  if (!trimmed) {
    return { modpack: '' };
  }

  if (
    trimmed.includes('://') ||
    trimmed.startsWith('/') ||
    trimmed.toLowerCase().endsWith('.mrpack')
  ) {
    return { modpack: trimmed };
  }

  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0 && colonIdx < trimmed.length - 1) {
    return {
      modpack: trimmed.slice(0, colonIdx),
      version: trimmed.slice(colonIdx + 1),
    };
  }

  return { modpack: trimmed };
}

export function resolveModrinthModpackEnv(config: {
  modrinthModpack?: string;
  modrinthModpackVersion?: string;
}): ModrinthModpackRef {
  const parsed = parseModrinthModpackRef(config.modrinthModpack);
  const version = (config.modrinthModpackVersion ?? '').trim() || parsed.version;
  return {
    modpack: parsed.modpack,
    version: version || undefined,
  };
}
