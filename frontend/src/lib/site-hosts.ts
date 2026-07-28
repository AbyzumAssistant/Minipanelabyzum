const DEFAULT_LANDING_HOST = 'mc.abyzum.com';
const DEFAULT_PANEL_HOST = 'mccubneuifbu23d.abyzum.com';

function normalizeHost(value?: string | null): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

export function getLandingHost(): string {
  return normalizeHost(process.env.LANDING_HOST) || DEFAULT_LANDING_HOST;
}

export function getPanelHost(): string {
  return normalizeHost(process.env.PANEL_HOST) || DEFAULT_PANEL_HOST;
}

export function getPanelPublicUrl(): string {
  const configured = process.env.PANEL_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `https://${getPanelHost()}`;
}

export function getLandingPublicUrl(): string {
  const configured = process.env.LANDING_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return `https://${getLandingHost()}`;
}

export function isLandingHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return normalized === getLandingHost() || normalized.startsWith(`${getLandingHost()}:`);
}

export function isPanelHost(host: string | null | undefined): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return normalized === getPanelHost() || normalized.startsWith(`${getPanelHost()}:`);
}

export function resolveDefaultLandingServerId(): string {
  return (
    process.env.DEFAULT_LANDING_SERVER?.trim() ||
    process.env.COMPOSE_PROJECT?.trim() ||
    'mcabyzum'
  );
}
