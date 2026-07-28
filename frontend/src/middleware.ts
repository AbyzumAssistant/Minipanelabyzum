import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPanelPublicUrl, isLandingHost } from '@/lib/site-hosts';

export function middleware(request: NextRequest) {
  const host = request.headers.get('host');
  const { pathname } = request.nextUrl;

  if (pathname === '/landing/') {
    const url = request.nextUrl.clone();
    url.pathname = '/landing';
    return NextResponse.redirect(url, 308);
  }

  if (isLandingHost(host)) {
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      const panelUrl = new URL(pathname, getPanelPublicUrl());
      panelUrl.search = request.nextUrl.search;
      return NextResponse.redirect(panelUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/landing', '/landing/:path*'],
};
