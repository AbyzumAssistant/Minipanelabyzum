import { getPublicEnv } from '@/lib/public-env';

/** IP o hostname público donde los jugadores conectan al Minecraft (no el dominio del panel). */
export function resolveMcServerHost(fallback?: string): string {
  const configured = getPublicEnv('NEXT_PUBLIC_MC_SERVER_HOST')?.trim();
  if (configured) return configured;
  if (fallback?.trim()) return fallback.trim();
  if (typeof window !== 'undefined' && window.location.hostname) {
    return window.location.hostname;
  }
  return 'localhost';
}

export const DEFAULT_MC_SERVER_PORT = 25569;
