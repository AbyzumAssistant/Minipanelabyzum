'use client';

import { FC, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Shield, Package, CheckCircle2 } from 'lucide-react';
import {
  fetchPublicDeployManifest,
  type ModDeployManifest,
  type ModrinthResolvedMod,
} from '@/services/mods/mod-deploy.service';

export default function JoinServerPage() {
  const params = useParams();
  const serverId = String(params.server ?? '');
  const [manifest, setManifest] = useState<ModDeployManifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serverId) return;
    fetchPublicDeployManifest(serverId)
      .then(setManifest)
      .catch(() => setError('No se encontró la lista de mods de este servidor.'))
      .finally(() => setLoading(false));
  }, [serverId]);

  const clientMods = manifest?.mods.filter((m) => m.fileName.endsWith('.jar')) ?? [];

  const downloadAll = async () => {
    if (!manifest) return;
    setDownloading(true);
    try {
      for (const mod of clientMods) {
        const a = document.createElement('a');
        a.href = mod.downloadUrl;
        a.download = mod.fileName;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        await new Promise((r) => setTimeout(r, 400));
      }
      if (manifest.resourcePack?.url) {
        const a = document.createElement('a');
        a.href = manifest.resourcePack.url;
        a.download = `${manifest.resourcePack.name || 'resourcepack'}.zip`;
        a.rel = 'noopener';
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      setAccepted(true);
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center mp-blueprint text-zinc-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2 text-sky-400" />
        Cargando mods del servidor…
      </div>
    );
  }

  if (error || !manifest) {
    return (
      <div className="min-h-screen flex items-center justify-center mp-blueprint p-6">
        <Card className="max-w-md w-full border-zinc-800 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-red-400">Error</CardTitle>
            <CardDescription className="text-zinc-400">{error ?? 'Servidor sin mods publicados.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen mp-blueprint text-zinc-200 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="text-center space-y-2">
          <h1 className="text-2xl font-semibold text-white tracking-tight">abyzumMC</h1>
          <p className="text-zinc-400">
            Mods requeridos para <span className="text-sky-400">{serverId}</span>
          </p>
          <Badge variant="outline" className="border-sky-500/50 text-sky-400 bg-sky-500/10">
            Forge {manifest.gameVersion}
          </Badge>
        </header>

        {manifest.lockClientResourcePacks && (
          <Card className="border-zinc-700 bg-zinc-900/80">
            <CardContent className="pt-4 flex gap-3">
              <Shield className="h-5 w-5 text-sky-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-white font-medium">Resource packs bloqueados</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Este servidor exige usar solo el pack oficial. No uses packs extra (evita x-ray). Debes aceptar el pack del servidor al conectar.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-zinc-800 bg-zinc-950/90">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Package className="h-5 w-5 text-sky-400" />
              {clientMods.length} mods + dependencias
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Instala Forge {manifest.gameVersion}, copia los mods a{' '}
              <code className="text-sky-400">.minecraft/mods</code> y conéctate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
            {manifest.mods.map((mod) => (
              <ModRow key={mod.projectId} mod={mod} />
            ))}
          </CardContent>
        </Card>

        {manifest.resourcePack && (
          <Card className="border-zinc-800 bg-zinc-950/90">
            <CardHeader>
              <CardTitle className="text-sm text-white">Resource pack del servidor</CardTitle>
              <CardDescription className="text-zinc-400">{manifest.resourcePack.name}</CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          <Button
            size="lg"
            disabled={downloading || accepted}
            onClick={downloadAll}
            className="w-full bg-sky-500 hover:bg-sky-400 text-white border-0"
          >
            {downloading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : accepted ? (
              <CheckCircle2 className="h-5 w-5 mr-2" />
            ) : (
              <Download className="h-5 w-5 mr-2" />
            )}
            {accepted ? 'Descarga iniciada' : 'Aceptar y descargar mods'}
          </Button>
          <p className="text-xs text-center text-zinc-500">
            Al pulsar aceptas descargar los mods y el resource pack obligatorio del servidor.
          </p>
        </div>
      </div>
    </div>
  );
}

function ModRow({ mod }: { mod: ModrinthResolvedMod }) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-zinc-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-white truncate">{mod.name}</p>
        <p className="text-xs text-zinc-500">
          v{mod.versionNumber}
          {mod.isDependency ? ' · dependencia' : ''}
        </p>
      </div>
      <Badge variant="outline" className="text-[10px] shrink-0 border-zinc-700 text-zinc-400">
        {(mod.fileSize / 1024 / 1024).toFixed(1)} MB
      </Badge>
    </div>
  );
}
