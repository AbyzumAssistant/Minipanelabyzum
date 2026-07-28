import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_LOGIN_PATH } from '@/lib/auth-routes';

const AUTH_QUERY_KEYS = ['inviteToken', 'resetToken', 'ssoError'] as const;
const DEFAULT_LANDING_SERVER_ID = 'mcabyzum';

function resolveDefaultLandingServer(): string {
  const fromEnv = process.env.DEFAULT_LANDING_SERVER?.trim();
  if (fromEnv) return fromEnv;

  const fromCompose = process.env.COMPOSE_PROJECT?.trim();
  if (fromCompose) return fromCompose;

  return DEFAULT_LANDING_SERVER_ID;
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const authQuery = new URLSearchParams();

  for (const key of AUTH_QUERY_KEYS) {
    const value = params[key];
    if (typeof value === 'string' && value) {
      authQuery.set(key, value);
    }
  }

  if (authQuery.size > 0) {
    redirect(`${AUTH_LOGIN_PATH}?${authQuery.toString()}`);
  }

  const host = (await headers()).get('host')?.toLowerCase() ?? '';
  const landingServer = resolveDefaultLandingServer();

  if (host.startsWith('mc.abyzum.com') || landingServer) {
    redirect(`/landing/?server=${encodeURIComponent(landingServer)}`);
  }

  redirect(AUTH_LOGIN_PATH);
}
