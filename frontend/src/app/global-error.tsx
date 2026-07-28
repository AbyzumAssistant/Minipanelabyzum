'use client';

import { useEffect } from 'react';
import { isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    if (isChunkLoadError(error)) {
      reloadOnceForChunkError();
    }
  }, [error]);

  const isServerError = Boolean(error.digest);

  return (
    <html lang="es">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border border-zinc-800 bg-zinc-900/90 p-8 text-center space-y-4">
          <p className="text-lg font-semibold">No se pudo cargar la página</p>
          <p className="text-sm text-zinc-400">
            {isServerError
              ? 'Error del servidor. Recarga para intentarlo de nuevo.'
              : 'Suele pasar tras un redeploy o con conexión lenta. Recarga para continuar.'}
          </p>
          <div className="flex flex-wrap gap-3 justify-center pt-2">
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
              Recargar
            </button>
            <button
              type="button"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              onClick={() => {
                if (window.history.length > 1) {
                  window.history.back();
                } else {
                  window.location.href = '/admin';
                }
              }}
            >
              Volver
            </button>
          </div>
          {error.digest ? <p className="text-xs text-zinc-600">ERROR {error.digest}</p> : null}
        </div>
      </body>
    </html>
  );
}
