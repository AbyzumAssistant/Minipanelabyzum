import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  getLandingPublicUrl,
  getPanelPublicUrl,
  isLandingHost,
  isPanelHost,
} from '@/lib/site-hosts';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const { pathname } = request.nextUrl;

  if (isLandingHost(host)) {
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      const panelUrl = new URL(pathname, getPanelPublicUrl());
      panelUrl.search = request.nextUrl.search;
      return NextResponse.redirect(panelUrl);
    }
  }

  if (isPanelHost(host) && pathname.startsWith('/landing')) {
    const landingUrl = new URL(pathname, getLandingPublicUrl());
    landingUrl.search = request.nextUrl.search;
    return NextResponse.redirect(landingUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/landing/:path*'],
};
