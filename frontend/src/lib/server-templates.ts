import { ServerConfig, ServerEdition } from "./types/types.d";
import { FORGE_119_PROFILE } from "./forge-defaults";
import { HORIZONS_PROFILE } from "./horizons-defaults";

export interface ServerTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  edition?: ServerEdition;
  config: Partial<ServerConfig>;
}

export const serverTemplates: ServerTemplate[] = [
  {
    id: "horizons-abyzum",
    name: "horizonsAbyzum",
    description: "horizonsAbyzumDesc",
    icon: "globe",
    color: "violet",
    config: { ...HORIZONS_PROFILE },
  },
  {
    id: "forge-119-optimized",
    name: "forge119Optimized",
    description: "forge119OptimizedDesc",
    icon: "anvil",
    color: "emerald",
    config: { ...FORGE_119_PROFILE },
  },
];

export const bedrockTemplates: ServerTemplate[] = [];

export const allTemplates: ServerTemplate[] = [...serverTemplates];

export const getTemplateById = (id: string): ServerTemplate | undefined => {
  return allTemplates.find((t) => t.id === id);
};

export const getTemplatesByEdition = (_edition: ServerEdition): ServerTemplate[] => {
  return serverTemplates;
};
