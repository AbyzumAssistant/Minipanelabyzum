'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Loader2, ExternalLink, Shield, Package, Copy, Rocket } from 'lucide-react';
import { useLanguage } from '@/lib/hooks/useLanguage';
import { mcToast } from '@/lib/utils/minecraft-toast';
import {
  getDeployManifest,
  saveDeployManifest,
  syncLauncherManifest,
  syncServerModsFromManifest,
  publishModpackDeploy,
  type ModDeployManifest,
  type ModrinthResolvedMod,
} from '@/services/mods/mod-deploy.service';
import { HORIZONS_MODPACK_SLUG } from '@/lib/horizons-defaults';
import { apiRestartServer, getServerStatus, updateServerConfig } from '@/services/docker/fetchs';
import { DEFAULT_MC_SERVER_PORT, resolveMcServerHost } from '@/lib/mc-server-host';
import { getPublicEnv } from '@/lib/public-env';
import type { ServerConfig } from '@/lib/types/types';

interface ModDeployTabProps {
  serverId: string;
  config: ServerConfig;
  updateConfig: <K extends keyof ServerConfig>(field: K, value: ServerConfig[K]) => void;
}

export const ModDeployTab: FC<ModDeployTabProps> = ({ serverId, config, updateConfig }) => {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingServer, setSyncingServer] = useState(false);
  const [publishingModpack, setPublishingModpack] = useState(false);
  const [syncingLauncher, setSyncingLauncher] = useState(false);
  const [manifest, setManifest] = useState<ModDeployManifest | null>(null);
  const [resourcePackUrl, setResourcePackUrl] = useState(config.resourcePackUrl ?? '');
  const [resourcePackSha1, setResourcePackSha1] = useState(config.resourcePackSha1 ?? '');
  const [requireResourcePack, setRequireResourcePack] = useState(config.requireResourcePack ?? true);
  const [lockClientResourcePacks, setLockClientResourcePacks] = useState(true);

  const landingBase = getPublicEnv('NEXT_PUBLIC_LANDING_URL').replace(/\/$/, '');
  const joinUrl = `${landingBase}/landing/?server=${encodeURIComponent(serverId)}`;
  const horizonsActive =
    manifest?.profile === 'horizons' ||
    config.serverType === 'MODRINTH' ||
    config.modrinthModpack === HORIZONS_MODPACK_SLUG;

  const loadManifest = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDeployManifest(serverId);
      if (data) {
        setManifest({ ...data, mods: data.mods ?? [] });
      } else {
        setManifest(null);
      }
      if (data?.lockClientResourcePacks !== undefined) {
        setLockClientResourcePacks(data.lockClientResourcePacks);
      }
      if (data?.resourcePack) {
        setResourcePackUrl(data.resourcePack.url);
        setResourcePackSha1(data.resourcePack.sha1 ?? '');
        setRequireResourcePack(data.resourcePack.required);
      }
    } catch {
      mcToast.error(t('modDeployLoadError'));
    } finally {
      setLoading(false);
    }
  }, [serverId, t]);

  useEffect(() => {
    loadManifest();
  }, [loadManifest]);

  const syncFromConfig = async () => {
    const slugs = (config.modrinthProjects ?? '')
      .split(',')
      .map((e) => e.split(':')[0]?.trim())
      .filter(Boolean);

    if (slugs.length === 0) {
      mcToast.error(t('modDeployNoMods'));
      return;
    }

    setSaving(true);
    try {
      const saved = await saveDeployManifest(serverId, {
        slugs,
        resourcePackUrl: resourcePackUrl || undefined,
        resourcePackSha1: resourcePackSha1 || undefined,
        requireResourcePack,
        lockClientResourcePacks,
      });

      updateConfig('modrinthProjects', saved.modrinthProjects);
      updateConfig('modrinthLoader', 'forge');
      updateConfig('modrinthDownloadDependencies', 'required');
      if (resourcePackUrl) {
        updateConfig('resourcePackUrl', resourcePackUrl);
        updateConfig('resourcePackSha1', resourcePackSha1);
        updateConfig('requireResourcePack', requireResourcePack);
      }

      setManifest(saved);
      mcToast.success(t('modDeploySaved'));
    } catch {
      mcToast.error(t('modDeploySaveError'));
    } finally {
      setSaving(false);
    }
  };

  const syncServerMods = async () => {
    if (!manifest?.mods?.length && !manifest?.modpackSlug) {
      mcToast.error(t('modDeployNoMods'));
      return;
    }

    setSyncingServer(true);
    try {
      const result = await syncServerModsFromManifest(serverId);
      updateConfig('modrinthProjects', result.modrinthProjects);
      updateConfig('modrinthLoader', manifest?.loader ?? 'forge');
      updateConfig('modrinthDownloadDependencies', 'required');
      if (manifest?.modpackSlug) {
        updateConfig('serverType', 'MODRINTH');
        updateConfig('modrinthModpack', manifest.modpackSlug);
        updateConfig('minecraftVersion', manifest.gameVersion);
      }

      const { status } = await getServerStatus(serverId);
      if (status === 'running' || status === 'starting') {
        await apiRestartServer(serverId);
      }

      const depHint =
        result.dependencies.length > 0
          ? ` (+${result.dependencies.length} ${t('dependencies')})`
          : '';
      mcToast.success(`${t('modDeployServerSynced')}${depHint}`);
    } catch {
      mcToast.error(t('modDeployServerSyncError'));
    } finally {
      setSyncingServer(false);
    }
  };

  const publishHorizonsModpack = async () => {
    setPublishingModpack(true);
    try {
      const saved = await publishModpackDeploy(serverId, {
        slug: HORIZONS_MODPACK_SLUG,
        serverHost: resolveServerHost(),
        serverPort: Number(config.port || DEFAULT_MC_SERVER_PORT),
        serverName: config.serverName || 'mcabyzum',
        lockClientResourcePacks,
        profile: 'horizons',
      });

      updateConfig('serverType', 'MODRINTH');
      updateConfig('modrinthModpack', HORIZONS_MODPACK_SLUG);
      updateConfig('modrinthLoader', 'fabric');
      updateConfig('minecraftVersion', saved.gameVersion);
      updateConfig('initMemory', '8G');
      updateConfig('maxMemory', '10G');
      updateConfig('motd', 'mcabyzum · Horizons');
      updateConfig('onlineMode', false);
      updateConfig('modrinthDownloadDependencies', 'required');

      const { status } = await getServerStatus(serverId);
      if (status === 'running' || status === 'starting') {
        await apiRestartServer(serverId);
      }

      setManifest(saved);
      mcToast.success(t('horizonsModpackPublished').replace('{count}', String(saved.mods.length)));
    } catch {
      mcToast.error(t('horizonsModpackPublishError'));
    } finally {
      setPublishingModpack(false);
    }
  };

  const copyJoinLink = () => {
    navigator.clipboard.writeText(joinUrl);
    mcToast.success(t('modDeployLinkCopied'));
  };

  const getModSlugs = () =>
    (config.modrinthProjects ?? '')
      .split(',')
      .map((e) => e.split(':')[0]?.trim())
      .filter(Boolean);

  const resolveServerHost = () =>
    resolveMcServerHost(config.proxyHostname || undefined);

  const serverAddress = `${resolveServerHost()}:${config.port || DEFAULT_MC_SERVER_PORT}`;

  const copyServerAddress = () => {
    navigator.clipboard.writeText(serverAddress);
    mcToast.success(t('modDeployServerAddressCopied'));
  };

  const syncLauncher = async () => {
    const slugs = getModSlugs();
    if (slugs.length === 0 && !manifest?.modpackSlug) {
      mcToast.error(t('modDeployNoMods'));
      return;
    }

    setSyncingLauncher(true);
    try {
      const saved = await syncLauncherManifest(serverId, {
        slugs: manifest?.modpackSlug ? [manifest.modpackSlug] : slugs,
        serverHost: resolveServerHost(),
        serverPort: Number(config.port || DEFAULT_MC_SERVER_PORT),
        serverName: config.serverName || serverId,
        forgeBuild: config.forgeBuild || '43.3.0',
        resourcePackUrl: resourcePackUrl || undefined,
        resourcePackSha1: resourcePackSha1 || undefined,
        requireResourcePack,
        lockClientResourcePacks,
      });

      await updateServerConfig(serverId, {
        onlineMode: false,
        minecraftVersion: horizonsActive ? config.minecraftVersion || '1.20.1' : '1.19.2',
        forgeBuild: horizonsActive ? undefined : config.forgeBuild || '43.3.0',
        serverType: horizonsActive ? 'MODRINTH' : 'FORGE',
        modrinthModpack: horizonsActive ? config.modrinthModpack : undefined,
        modrinthLoader: horizonsActive ? 'fabric' : 'forge',
      });

      const { status } = await getServerStatus(serverId);
      if (status === 'running' || status === 'starting') {
        await apiRestartServer(serverId);
      }

      updateConfig('onlineMode', false);
      if (horizonsActive) {
        updateConfig('serverType', 'MODRINTH');
        updateConfig('modrinthLoader', 'fabric');
        updateConfig('minecraftVersion', saved.gameVersion || config.minecraftVersion || '1.20.1');
        if (config.modrinthModpack) {
          updateConfig('modrinthModpack', config.modrinthModpack);
        }
      } else {
        updateConfig('minecraftVersion', '1.19.2');
        updateConfig('forgeBuild', config.forgeBuild || '43.3.0');
        updateConfig('modrinthLoader', 'forge');
      }
      updateConfig('modrinthProjects', saved.modrinthProjects);
      updateConfig('modrinthDownloadDependencies', 'required');
      if (resourcePackUrl) {
        updateConfig('resourcePackUrl', resourcePackUrl);
        updateConfig('resourcePackSha1', resourcePackSha1);
        updateConfig('requireResourcePack', requireResourcePack);
      }

      setManifest(saved);
      mcToast.success(t('launcherSyncSuccess'));
    } catch {
      mcToast.error(t('launcherSyncError'));
    } finally {
      setSyncingLauncher(false);
    }
  };

  const launcherManifestUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/api/backend/modrinth/deploy/${serverId}/manifest`
      : `/api/backend/modrinth/deploy/${serverId}/manifest`;

  const rootMods = manifest?.mods?.filter((m) => !m.isDependency) ?? [];
  const deps = manifest?.mods?.filter((m) => m.isDependency) ?? [];

  return (
    <Card className="overflow-hidden border-zinc-800 bg-zinc-950 shadow-none">
      <CardHeader className="border-b border-zinc-800 bg-zinc-900/50 pb-4">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600">
            <Package className="h-4 w-4 text-white" />
          </div>
          {t('modDeployTitle')}
        </CardTitle>
        <CardDescription className="text-zinc-400">{t('modDeployDesc')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        <div className="rounded-lg border border-violet-900/50 bg-violet-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-violet-400" />
            <Label className="text-sm font-medium text-white">{t('horizonsModpackTitle')}</Label>
          </div>
          <p className="text-xs text-zinc-400">{t('horizonsModpackDesc')}</p>
          {manifest?.profile === 'horizons' && manifest.modpackVersion && (
            <p className="text-xs text-violet-300">
              {t('horizonsModpackActive')}: v{manifest.modpackVersion} · {manifest.mods?.length ?? 0} mods
            </p>
          )}
          {manifest?.shaderPackNote && (
            <p className="text-xs text-amber-300/90">{manifest.shaderPackNote}</p>
          )}
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={publishingModpack || syncingServer}
              onClick={publishHorizonsModpack}
              className="bg-violet-600 text-white hover:bg-violet-500 border-0"
            >
              {publishingModpack ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              {t('horizonsModpackPublish')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
          <Label className="text-sm font-medium text-white">{t('modDeployPlayerLink')}</Label>
          <div className="flex flex-wrap gap-2">
            <Input readOnly value={joinUrl} className="bg-zinc-950 text-white border-zinc-700 flex-1 min-w-[200px] focus-visible:ring-sky-500" />
            <Button type="button" variant="outline" size="sm" onClick={copyJoinLink} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Copy className="h-4 w-4 mr-1" />
              {t('copy')}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white">
              <Link href={joinUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                {t('modDeployPreview')}
              </Link>
            </Button>
          </div>
          <p className="text-xs text-zinc-500">{t('modDeployPlayerLinkDesc')}</p>
        </div>

        <div className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-emerald-400" />
            <Label className="text-sm font-medium text-white">{t('launcherSyncTitle')}</Label>
          </div>
          <p className="text-xs text-zinc-400">{t('launcherSyncDesc')}</p>
          <div className="space-y-2">
            <Label className="text-xs text-zinc-500">{t('modDeployServerAddress')}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                readOnly
                value={serverAddress}
                className="bg-zinc-950 text-sky-300 border-zinc-700 font-mono flex-1 min-w-[200px] focus-visible:ring-emerald-500"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyServerAddress}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                <Copy className="h-4 w-4 mr-1" />
                {t('copy')}
              </Button>
            </div>
            <p className="text-xs text-zinc-500">{t('modDeployServerAddressDesc')}</p>
          </div>
          <Input
            readOnly
            value={launcherManifestUrl}
            className="bg-zinc-950 text-zinc-300 border-zinc-700 text-xs font-mono focus-visible:ring-emerald-500"
          />
          {manifest?.launcherRevision != null && (
            <p className="text-xs text-emerald-400/90">
              {t('launcherSyncRevision')}: v{manifest.launcherRevision}
              {manifest.updatedAt ? ` · ${new Date(manifest.updatedAt).toLocaleString()}` : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-2 justify-end">
            <Button
              type="button"
              disabled={syncingLauncher || saving}
              onClick={syncLauncher}
              className="bg-emerald-600 text-white hover:bg-emerald-500 border-0"
            >
              {syncingLauncher ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Rocket className="h-4 w-4 mr-2" />}
              {t('launcherSyncButton')}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-sky-400" />
            <Label className="text-sm font-medium text-white">{t('modDeployAntiXray')}</Label>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-300">{t('lockClientResourcePacks')}</p>
              <p className="text-xs text-zinc-500">{t('lockClientResourcePacksDesc')}</p>
            </div>
            <Switch checked={lockClientResourcePacks} onCheckedChange={setLockClientResourcePacks} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourcePackUrl" className="text-zinc-400 text-sm">{t('resourcePackUrl')}</Label>
            <Input
              id="resourcePackUrl"
              value={resourcePackUrl}
              onChange={(e) => setResourcePackUrl(e.target.value)}
              placeholder="https://..."
              className="bg-zinc-950 border-zinc-700 text-white focus-visible:ring-sky-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="resourcePackSha1" className="text-zinc-400 text-sm">{t('resourcePackSha1')}</Label>
            <Input
              id="resourcePackSha1"
              value={resourcePackSha1}
              onChange={(e) => setResourcePackSha1(e.target.value)}
              placeholder="SHA1 opcional"
              className="bg-zinc-950 border-zinc-700 text-white focus-visible:ring-sky-500"
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-zinc-300">{t('requireResourcePack')}</p>
              <p className="text-xs text-zinc-500">{t('requireResourcePackDesc')}</p>
            </div>
            <Switch checked={requireResourcePack} onCheckedChange={setRequireResourcePack} />
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={syncingServer || saving || (!manifest?.mods?.length && !manifest?.modpackSlug)}
            onClick={syncServerMods}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          >
            {syncingServer ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t('modDeploySyncServer')}
          </Button>
          <Button
            type="button"
            disabled={saving}
            onClick={syncFromConfig}
            className="bg-sky-600 text-white hover:bg-sky-500 border-0"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            {t('modDeployPublish')}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2 text-sky-500" />
            {t('loading')}
          </div>
        ) : (
          <>
            <ModList title={t('modDeployRootMods')} mods={rootMods} empty={t('modDeployNoMods')} />
            {deps.length > 0 && <ModList title={t('modDeployDependencies')} mods={deps} deps />}
          </>
        )}
      </CardContent>
    </Card>
  );
};

function ModList({
  title,
  mods,
  empty,
  deps,
}: {
  title: string;
  mods: ModrinthResolvedMod[];
  empty?: string;
  deps?: boolean;
}) {
  if (mods.length === 0 && empty) {
    return <p className="text-sm text-gray-500 text-center py-4">{empty}</p>;
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-white">{title}</h4>
      <div className="space-y-2">
        {mods.map((mod) => (
          <div key={mod.projectId} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{mod.name}</p>
              <p className="text-xs text-zinc-500">{mod.fileName} · v{mod.versionNumber}</p>
              {deps && mod.requiredBy && mod.requiredBy.length > 0 && (
                <p className="text-xs text-sky-400/80 mt-1">→ {mod.requiredBy.join(', ')}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-[10px] border-zinc-700 text-zinc-400 bg-zinc-950">
                {(mod.fileSize / 1024 / 1024).toFixed(1)} MB
              </Badge>
              <Button type="button" size="sm" variant="ghost" asChild className="text-sky-400 hover:text-sky-300 hover:bg-zinc-800">
                <a href={mod.downloadUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
