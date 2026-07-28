import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { AUTH_LOGIN_PATH } from '@/lib/auth-routes';
import {
  isLandingHost,
  isPanelHost,
  resolveDefaultLandingServerId,
} from '@/lib/site-hosts';

const AUTH_QUERY_KEYS = ['inviteToken', 'resetToken', 'ssoError'] as const;

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

  const host = (await headers()).get('host');

  if (isLandingHost(host)) {
    const landingServer = resolveDefaultLandingServerId();
    redirect(`/landing/?server=${encodeURIComponent(landingServer)}`);
  }

  if (isPanelHost(host)) {
    redirect(AUTH_LOGIN_PATH);
  }

  redirect(AUTH_LOGIN_PATH);
}
