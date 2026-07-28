import { redirect } from 'next/navigation';
import { AUTH_LOGIN_PATH } from '@/lib/auth-routes';

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

  const defaultLandingServer = process.env.DEFAULT_LANDING_SERVER?.trim();
  if (defaultLandingServer) {
    redirect(`/landing/?server=${encodeURIComponent(defaultLandingServer)}`);
  }

  redirect(AUTH_LOGIN_PATH);
}
