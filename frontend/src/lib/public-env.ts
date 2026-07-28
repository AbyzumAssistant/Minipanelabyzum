const defaultPublicEnv = {
  NEXT_PUBLIC_BACKEND_URL: '/api/backend',
  NEXT_PUBLIC_DEFAULT_LANGUAGE: 'en',
} as const;

export type PublicEnvKey = keyof typeof defaultPublicEnv;

declare global {
  interface Window {
    __MINEPANEL_PUBLIC_ENV__?: Partial<Record<PublicEnvKey, string>>;
  }
}

function resolveBackendUrl(configured: string): string {
  const trimmed = configured.trim();

  if (!trimmed || trimmed.startsWith('/')) {
    return trimmed || '/api/backend';
  }

  if (typeof window !== 'undefined') {
    if (
      trimmed === 'http://localhost:8091' ||
      trimmed === 'https://localhost:8091' ||
      /^https?:\/\/[^/]+:8091\/?$/.test(trimmed)
    ) {
      return '/api/backend';
    }
  }

  return trimmed;
}

export function getPublicEnv(key: PublicEnvKey) {
  if (typeof window !== 'undefined') {
    const value = window.__MINEPANEL_PUBLIC_ENV__?.[key] ?? defaultPublicEnv[key];
    if (key === 'NEXT_PUBLIC_BACKEND_URL') {
      return resolveBackendUrl(value);
    }
    return value;
  }

  return readPublicEnv()[key];
}

export function serializePublicEnv() {
  return JSON.stringify(readPublicEnv()).replace(/</g, '\\u003c');
}

function readPublicEnv() {
  const configured = process.env.NEXT_PUBLIC_BACKEND_URL ?? defaultPublicEnv.NEXT_PUBLIC_BACKEND_URL;
  return {
    NEXT_PUBLIC_BACKEND_URL: configured.startsWith('/') ? configured : resolveBackendUrl(configured),
    NEXT_PUBLIC_DEFAULT_LANGUAGE: process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE ?? defaultPublicEnv.NEXT_PUBLIC_DEFAULT_LANGUAGE,
  } as const;
}
