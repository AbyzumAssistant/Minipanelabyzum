'use client';

import { FC } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServerConfig } from '@/lib/types/types';
import { FORGE_119_PROFILE } from '@/lib/forge-defaults';
import { HORIZONS_PROFILE } from '@/lib/horizons-defaults';
import {
  applyForgeProfile,
  applyHorizonsProfile,
  isHorizonsProfile,
  patchConfigFromProfile,
} from '@/lib/server-profile';
import { useLanguage } from '@/lib/hooks/useLanguage';

interface AbyzumServerTypePanelProps {
  config: ServerConfig;
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void;
}

export const AbyzumServerTypePanel: FC<AbyzumServerTypePanelProps> = ({ config, updateConfig }) => {
  const { t } = useLanguage();
  const horizons = isHorizonsProfile(config);
  const profile = horizons ? HORIZONS_PROFILE : FORGE_119_PROFILE;

  const applyHorizons = () => {
    patchConfigFromProfile(config, applyHorizonsProfile(config), updateConfig);
  };

  const applyForge = () => {
    patchConfigFromProfile(config, applyForgeProfile(config), updateConfig);
  };

  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950 shadow-none">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 pb-4">
        <CardTitle className="flex items-center gap-3 text-base font-semibold text-white">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${horizons ? 'bg-violet-600' : 'bg-sky-600'}`}
          >
            <Image
              src={horizons ? '/images/modrinth.svg' : '/images/anvil.webp'}
              alt={horizons ? 'Horizons' : 'Forge'}
              width={22}
              height={22}
            />
          </div>
          {horizons ? t('horizonsAbyzum') : t('forge119Optimized')}
        </CardTitle>
        <CardDescription className="text-zinc-400">
          {horizons ? t('horizonsAbyzumDesc') : t('forge119OptimizedDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5 text-sm">
        <div className="flex flex-wrap gap-2">
          {horizons ? (
            <>
              <Badge className="bg-violet-600 text-white hover:bg-violet-600 border-0">Fabric 1.20.1</Badge>
              <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-zinc-900">
                Modrinth · Horizons
              </Badge>
            </>
          ) : (
            <>
              <Badge className="bg-sky-600 text-white hover:bg-sky-600 border-0">
                Forge {config.forgeBuild || FORGE_119_PROFILE.forgeBuild}
              </Badge>
              <Badge variant="outline" className="border-zinc-700 text-zinc-300 bg-zinc-900">
                MC {config.minecraftVersion || FORGE_119_PROFILE.minecraftVersion}
              </Badge>
            </>
          )}
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
              {config.initMemory || profile.initMemory} – {config.maxMemory || profile.maxMemory}
            </span>
          </p>
          <p>
            <span className="text-zinc-500">Render</span>{' '}
            <span className="text-white">
              {config.viewDistance || profile.viewDistance} · Sim{' '}
              {config.simulationDistance || profile.simulationDistance}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
          <Button
            type="button"
            size="sm"
            onClick={applyHorizons}
            className={horizons ? 'bg-violet-600 hover:bg-violet-500' : 'bg-zinc-800 hover:bg-zinc-700'}
          >
            {t('applyHorizonsProfile')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={applyForge}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {t('applyForgeProfile')}
          </Button>
        </div>
        <p className="text-xs text-zinc-500">{t('serverProfileSaveHint')}</p>
      </CardContent>
    </Card>
  );
};

/** @deprecated Use AbyzumServerTypePanel */
export const Forge119TypePanel = AbyzumServerTypePanel;
