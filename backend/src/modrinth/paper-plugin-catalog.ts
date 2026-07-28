export interface PaperPluginCatalogCategory {
  id: string;
  label: string;
  description: string;
  slugs: string[];
}

/** Modrinth search terms used by "Ver más" per category. */
export const PAPER_CATEGORY_SEARCH: Record<string, string> = {
  esenciales: 'essentials permissions admin',
  proteccion: 'protection grief anticheat',
  mundo: 'world edit map terrain',
  utilidad: 'performance analytics tab hud',
  crossplay: 'bedrock geyser viaversion crossplay',
  economia: 'economy shop trade',
  diversion: 'minigames jobs npc fun',
};

/** Curated Paper/Bukkit plugins grouped by use case (Modrinth slugs). */
export const PAPER_PLUGIN_CATALOG: PaperPluginCatalogCategory[] = [
  {
    id: 'esenciales',
    label: 'Esenciales',
    description: 'Permisos, comandos básicos y utilidades de administración',
    slugs: [
      'luckperms',
      'essentialsx',
      'placeholderapi',
      'vault-unlocked',
      'protocol-lib',
      'commandapi',
    ],
  },
  {
    id: 'proteccion',
    label: 'Protección',
    description: 'Anti-grief, logs y seguridad del servidor',
    slugs: [
      'coreprotect',
      'grief-prevention',
      'worldguard',
      'openinv',
      'invseeplusplus',
    ],
  },
  {
    id: 'mundo',
    label: 'Mundo',
    description: 'Edición de mapas, pregeneración y mapas web',
    slugs: [
      'worldedit',
      'chunky',
      'squaremap',
      'multiverse-core',
      'betterrtp',
      'fastasyncworldedit',
    ],
  },
  {
    id: 'utilidad',
    label: 'Utilidad',
    description: 'Rendimiento, TAB, skins y calidad de vida',
    slugs: [
      'spark',
      'plan',
      'tab',
      'skinsrestorer',
      'sleep-most',
      'clearlag',
      'veinminer',
    ],
  },
  {
    id: 'crossplay',
    label: 'Crossplay',
    description: 'Bedrock, versiones antiguas y compatibilidad',
    slugs: [
      'geyser',
      'floodgate',
      'viaversion',
      'viabackwards',
      'viarewind',
    ],
  },
  {
    id: 'economia',
    label: 'Economía',
    description: 'Tiendas, comercio y sistemas económicos',
    slugs: [
      'economyshopgui',
      'chestshop',
      'quickshop',
      'playerpoints',
    ],
  },
  {
    id: 'diversion',
    label: 'Diversión',
    description: 'Minijuegos, NPCs y contenido extra',
    slugs: [
      'mcmmo',
      'citizens',
      'jobs-reborn',
      'simple-voice-chat',
      'dynmap',
    ],
  },
];
