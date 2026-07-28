'use client';

import { FC } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServerConfig } from '@/lib/types/types';
import { FORGE_119_PROFILE } from '@/lib/forge-defaults';

interface Forge119TypePanelProps {
  config: ServerConfig;
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void;
}

export const Forge119TypePanel: FC<Forge119TypePanelProps> = ({ config }) => {
  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950 shadow-none">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 pb-4">
        <CardTitle className="flex items-center gap-3 text-base font-semibold text-white">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-600">
            <Image src="/images/anvil.webp" alt="Forge" width={22} height={22} />
          </div>
          Forge 1.19 optimizado
        </CardTitle>
        <CardDescription className="text-zinc-400">
          Servidor Minecraft Forge 1.19 con flags JVM optimizadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5 text-sm">
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-sky-600 text-white hover:bg-sky-600 border-0">
            Forge {config.forgeBuild || FORGE_119_PROFILE.forgeBuild}
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-zinc-900">
            MC {config.minecraftVersion || FORGE_119_PROFILE.minecraftVersion}
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-zinc-900">
            Java 17
          </Badge>
          <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-zinc-900">
            Aikar flags
          </Badge>
          <Badge variant="outline" className="border-emerald-800 text-emerald-300 bg-emerald-950/40">
            Modo offline
          </Badge>
        </div>
        <div className="grid gap-2 text-zinc-400 sm:grid-cols-2">
          <p>
            <span className="text-zinc-500">RAM</span>{' '}
            <span className="text-white">
              {config.initMemory || FORGE_119_PROFILE.initMemory} – {config.maxMemory || FORGE_119_PROFILE.maxMemory}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">Render</span>{' '}
            <span className="text-white">
              {config.viewDistance || FORGE_119_PROFILE.viewDistance} · Sim {config.simulationDistance || FORGE_119_PROFILE.simulationDistance}
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
