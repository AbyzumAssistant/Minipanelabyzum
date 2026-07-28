'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Hammer, Download, ExternalLink, Copy, Globe, Package } from 'lucide-react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { mcToast } from '@/lib/utils/minecraft-toast';
import { DEFAULT_MC_SERVER_PORT, resolveMcServerHost } from '@/lib/mc-server-host';
import { getPublicEnv } from '@/lib/public-env';
import {
  buildLauncherPack,
  downloadLauncherPack,
  getDeployManifest,
  getLauncherBuildStatus,
  syncLauncherManifest,
  type LauncherBuildStatus,
  type ModDeployManifest,
} from '@/services/mods/mod-deploy.service';
import type { ServerConfig } from '@/lib/types/types';

interface LandingTabProps {
  serverId: string;
  config: ServerConfig;
}

export const LandingTab: FC<LandingTabProps> = ({ serverId, config }) => {
  const { t } = useLanguage();
  const [manifest, setManifest] = useState<ModDeployManifest | null>(null);
  const [buildStatus, setBuildStatus] = useState<LauncherBuildStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const landingBase = getPublicEnv('NEXT_PUBLIC_LANDING_URL').replace(/\/$/, '');
  const landingUrl = `${landingBase}/landing?server=${encodeURIComponent(serverId)}`;

  const serverAddress = `${resolveMcServerHost(config.proxyHostname || undefined)}:${config.port || DEFAULT_MC_SERVER_PORT}`;

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const [manifestData, status] = await Promise.all([
        getDeployManifest(serverId),
        getLauncherBuildStatus(serverId),
      ]);
      setManifest(manifestData);
      setBuildStatus(status);
    } catch {
      mcToast.error(t('landingLoadError'));
    } finally {
      setLoading(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  const getModSlugs = () =>
    (config.modrinthProjects ?? '')
      .split(',')
      .map((entry) => entry.split(':')[0]?.trim())
      .filter(Boolean);

  const ensureLauncherReady = async () => {
    const slugs = getModSlugs();
    if (slugs.length === 0) {
      throw new Error(t('landingNoMods'));
    }
    if (!manifest?.server?.host) {
      return syncLauncherManifest(serverId, {
        slugs,
        serverHost: resolveMcServerHost(config.proxyHostname || undefined),
        serverPort: Number(config.port || DEFAULT_MC_SERVER_PORT),
        serverName: config.serverName || serverId,
        forgeBuild: config.forgeBuild || '43.3.0',
        resourcePackUrl: config.resourcePackUrl || undefined,
        resourcePackSha1: config.resourcePackSha1 || undefined,
        requireResourcePack: config.requireResourcePack,
        lockClientResourcePacks: true,
      });
    }
    return manifest;
  };

  const handleBuild = async () => {
    setBuilding(true);
    try {
      await ensureLauncherReady();
      const status = await buildLauncherPack(serverId);
      setBuildStatus(status);
      mcToast.success(t('landingBuildSuccess'));
      await loadState();
    } catch (error) {
      const message = error instanceof Error ? error.message : t('landingBuildError');
      mcToast.error(message || t('landingBuildError'));
    } finally {
      setBuilding(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await ensureLauncherReady();
      const blob = await downloadLauncherPack(serverId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = buildStatus?.fileName ?? `MCABYZUM-${serverId}-Launcher.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      mcToast.success(t('landingDownloadStarted'));
      await loadState();
    } catch {
      mcToast.error(t('landingBuildError'));
    } finally {
      setDownloading(false);
    }
  };

  const copyLandingUrl = () => {
    navigator.clipboard.writeText(landingUrl);
    mcToast.success(t('modDeployLinkCopied'));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        {t('landingLoading')}
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950 shadow-none">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 pb-4">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
            <Globe className="h-4 w-4 text-white" />
          </div>
          {t('landingTabTitle')}
        </CardTitle>
        <CardDescription className="text-zinc-400">{t('landingTabDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="rounded-lg border border-violet-900/40 bg-violet-950/20 p-4 flex flex-wrap items-center gap-4">
          <Image src="/landing/icon.svg" alt="MCABYZUM" width={72} height={72} className="rounded-xl" unoptimized />
          <div className="flex-1 min-w-[220px]">
            <p className="text-sm font-medium text-white">{config.serverName || serverId}</p>
            <p className="text-xs text-zinc-400 mt-1 font-mono">{serverAddress}</p>
            <p className="text-xs text-violet-300/90 mt-2">{t('landingBuildHint')}</p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <Label className="text-sm font-medium text-white">{t('landingPageUrl')}</Label>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={landingUrl} className="bg-zinc-950 text-white border-zinc-700 flex-1 min-w-[220px]" />
            <Button type="button" variant="outline" size="sm" onClick={copyLandingUrl} className="border-zinc-700 text-zinc-300">
              <Copy className="h-4 w-4 mr-1" />
              {t('copy')}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild className="border-zinc-700 text-zinc-300">
              <Link href={landingUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                {t('modDeployPreview')}
              </Link>
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-400" />
            <Label className="text-sm font-medium text-white">{t('landingPackTitle')}</Label>
          </div>

          {buildStatus?.built ? (
            <div className="text-xs text-emerald-300/90 space-y-1">
              <p>{t('landingLastBuilt')}: {buildStatus.builtAt ? new Date(buildStatus.builtAt).toLocaleString() : '—'}</p>
              <p>{t('landingPackMods')}: {buildStatus.modCount ?? manifest?.mods.length ?? 0}</p>
              {buildStatus.fileSize ? <p>{t('landingPackSize')}: {(buildStatus.fileSize / 1024 / 1024).toFixed(1)} MB</p> : null}
            </div>
          ) : (
            <p className="text-xs text-zinc-400">{t('landingNoBuildYet')}</p>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              disabled={building || downloading}
              onClick={handleBuild}
              className="bg-violet-600 text-white hover:bg-violet-500 border-0"
            >
              {building ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Hammer className="h-4 w-4 mr-2" />}
              {t('landingBuildButton')}
            </Button>
            <Button
              type="button"
              disabled={building || downloading}
              onClick={handleDownload}
              className="bg-emerald-600 text-white hover:bg-emerald-500 border-0"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              {t('landingDownloadButton')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
