const RELOAD_SESSION_KEY = 'mc-panel-chunk-reload';

export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    if (typeof error === 'string') {
      const msg = error.toLowerCase();
      return msg.includes('chunk') || msg.includes('dynamically imported module');
    }
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === 'ChunkLoadError' ||
    message.includes('loading chunk') ||
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('importing a module script failed') ||
    message.includes('failed to load') ||
    message.includes('load failed')
  );
}

export function isRecoverableNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; response?: { status?: number } };
  if (err.response?.status) return false;
  return err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.code === 'ETIMEDOUT';
}

export function reloadOnceForChunkError(): boolean {
  if (typeof window === 'undefined') return false;
  if (sessionStorage.getItem(RELOAD_SESSION_KEY)) return false;
  sessionStorage.setItem(RELOAD_SESSION_KEY, String(Date.now()));
  window.location.reload();
  return true;
}

export function clearChunkReloadFlag(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(RELOAD_SESSION_KEY);
}

export async function importWithRetry<T>(loader: () => Promise<T>, retries = 2): Promise<T> {
  try {
    return await loader();
  } catch (error) {
    if (retries > 0 && isChunkLoadError(error)) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      return importWithRetry(loader, retries - 1);
    }
    throw error;
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}
