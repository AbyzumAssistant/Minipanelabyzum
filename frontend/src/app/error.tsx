'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

type ErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }, [error]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-950 p-6 text-center space-y-4">
        <p className="text-base font-semibold text-white">Algo falló al cargar</p>
        <p className="text-sm text-zinc-400">Recarga la página. Si acabas de desplegar, espera unos segundos e inténtalo otra vez.</p>
        <button
          type="button"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          onClick={() => {
            if (isChunkLoadError(error)) {
              window.location.reload();
              return;
            }
            reset();
          }}
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
