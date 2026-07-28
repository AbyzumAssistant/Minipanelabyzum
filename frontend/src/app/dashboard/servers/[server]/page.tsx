"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { isAuthenticated } from "@/services/auth/auth.service";
import { AUTH_LOGIN_PATH } from "@/lib/auth-routes";
import { useServerStatus } from "@/lib/hooks/useServerStatus";
import { useServerConfig } from "@/lib/hooks/useServerConfig";
import { ServerPageHeader } from "@/components/organisms/ServerPageHeader";
import { ServerConfigTabs } from "@/components/organisms/ServerConfigTabs";
import { ServerLoadingSkeleton } from "@/components/organisms/ServerLoadingSkeleton";
import Image from "next/image";

import type { ServerConfig } from "@/lib/types/types";

function configFingerprint(value: ServerConfig): string {
  return JSON.stringify(value);
}

export default function ServerConfig() {
  const router = useRouter();
  const params = useParams();
  const serverId = params.server as string;
  const [refreshToken, setRefreshToken] = useState(0);
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(null);

  const { config, loading: configLoading, updateConfig, saveConfig, restartServer, clearServerData, isSaving } =
    useServerConfig(serverId);
  const { status, isProcessingAction, startServer, stopServer } = useServerStatus(serverId);

  const isServerRunning = status === "running" || status === "starting";

  useEffect(() => {
    isAuthenticated().then((authenticated) => {
      if (!authenticated) {
        router.push(AUTH_LOGIN_PATH);
      }
    });
  }, [router]);

  useEffect(() => {
    if (!configLoading && config.id && savedFingerprint === null) {
      setSavedFingerprint(configFingerprint(config));
    }
  }, [config, configLoading, savedFingerprint]);

  const hasUnsavedChanges = useMemo(() => {
    if (savedFingerprint === null) return false;
    return configFingerprint(config) !== savedFingerprint;
  }, [config, savedFingerprint]);

  const handleSaveConfig = useCallback(async () => {
    const success = await saveConfig();
    if (success) {
      setSavedFingerprint(configFingerprint(config));
    }
    return success;
  }, [config, saveConfig]);

  const handleClearServerData = useCallback(async () => {
    const success = await clearServerData();
    if (success) {
      setRefreshToken((current) => current + 1);
    }
    return success;
  }, [clearServerData]);

  if (configLoading) {
    return <ServerLoadingSkeleton />;
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in-up">
        <ServerPageHeader
          serverId={serverId}
          serverName={config.serverName}
          serverStatus={status}
          serverPort={config.port || "25565"}
          serverEdition={config.edition}
          isProcessing={isProcessingAction}
          onStartServer={startServer}
          onStopServer={stopServer}
          onRestartServer={restartServer}
          onClearData={handleClearServerData}
          onSaveConfig={handleSaveConfig}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          canEditConfig={!isServerRunning}
        />
      </div>

      <div className="animate-fade-in stagger-1">
        <ServerConfigTabs
          serverId={serverId}
          config={config}
          updateConfig={updateConfig}
          serverStatus={status}
          isSaving={isSaving}
          hasUnsavedChanges={hasUnsavedChanges}
          onSaveConfig={handleSaveConfig}
          refreshToken={refreshToken}
        />
      </div>

      <div className="flex justify-center gap-8 pt-8 animate-fade-in stagger-2">
        <div className="animate-float opacity-40 hover:opacity-70 transition-opacity">
          <Image src="/images/ender-pearl.webp" alt="Ender Pearl" width={32} height={32} className="drop-shadow-md" />
        </div>
        <div className="animate-float-delay-1 opacity-40 hover:opacity-70 transition-opacity">
          <Image src="/images/enchanted-book.webp" alt="Enchanted Book" width={32} height={32} className="drop-shadow-md" />
        </div>
        <div className="animate-float-delay-2 opacity-40 hover:opacity-70 transition-opacity">
          <Image src="/images/iron-pick.webp" alt="Iron Pickaxe" width={32} height={32} className="drop-shadow-md" />
        </div>
        <div className="animate-float opacity-40 hover:opacity-70 transition-opacity">
          <Image src="/images/diamond-pickaxe.webp" alt="Diamond Pickaxe" width={32} height={32} className="drop-shadow-md" />
        </div>
      </div>
    </div>
  );
}
