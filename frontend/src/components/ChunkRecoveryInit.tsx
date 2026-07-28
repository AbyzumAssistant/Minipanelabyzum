'use client';

import { useEffect } from 'react';
import { clearChunkReloadFlag, isChunkLoadError, reloadOnceForChunkError } from '@/lib/chunk-recovery';

export function ChunkRecoveryInit() {
  useEffect(() => {
    clearChunkReloadFlag();

    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        reloadOnceForChunkError();
      }
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        reloadOnceForChunkError();
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
