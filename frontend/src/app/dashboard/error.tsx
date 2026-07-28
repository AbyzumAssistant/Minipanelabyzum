'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      reloadOnceForChunkError();
    }
  }, [chunkError]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg w-full mc-panel p-6 text-center space-y-4">
        <p className="font-minecraft text-white">Panel no cargó</p>
        <p className="text-sm text-gray-400">
          {chunkError
            ? 'Hubo una actualización del panel o la caché quedó antigua. Se intentará recargar solo; si no, pulsa Recargar.'
            : 'Conexión inestable o error al cargar una pestaña. Guarda el servidor antes de recargar si cambiaste algo.'}
        </p>
        {error.message ? (
          <p className="text-xs text-gray-500 font-mono break-all">{error.message}</p>
        ) : null}
        <div className="flex flex-wrap gap-3 justify-center">
          <button type="button" className="mc-btn mc-btn-emerald px-5 py-2" onClick={() => reset()}>
            Reintentar
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-lapis px-5 py-2"
            onClick={() => reloadOnceForChunkError(true)}
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}
