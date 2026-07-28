'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

type DashboardErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-lg w-full mc-panel p-6 text-center space-y-4">
        <p className="font-minecraft text-white">Panel no cargó</p>
        <p className="text-sm text-gray-400">
          Conexión inestable o actualización reciente del panel. Pulsa reintentar; normalmente se arregla solo.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <button type="button" className="mc-btn mc-btn-emerald px-5 py-2" onClick={() => reset()}>
            Reintentar
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-lapis px-5 py-2"
            onClick={() => window.location.reload()}
          >
            Recargar
          </button>
        </div>
      </div>
    </div>
  );
}
