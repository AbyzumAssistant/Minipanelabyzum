import type { NextConfig } from 'next';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const backendProxyUrl = process.env.BACKEND_PROXY_URL || 'http://127.0.0.1:8091';

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  ...(basePath && { basePath }),

  async headers() {
    return [
      {
        source: '/((?!_next/static|_next/image|favicon.ico|images|landing).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/api/backend/:path*',
        destination: `${backendProxyUrl}/:path*`,
      },
    ];
  },

  // Turbopack is the default bundler in Next.js 16. Pin the workspace root so
  // the multi-lockfile warning is silenced and builds are deterministic.
  turbopack: {
    root: __dirname,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Optimize image formats
    formats: ['image/avif', 'image/webp'],
  },

  // Improve performance
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      '@radix-ui/react-switch',
      '@radix-ui/react-accordion',
      '@radix-ui/react-alert-dialog',
      '@radix-ui/react-avatar',
      '@radix-ui/react-label',
      '@radix-ui/react-radio-group',
      '@radix-ui/react-slider',
      '@radix-ui/react-tooltip',
    ],
  },

  // Compiler optimizations (SWC is default in Next.js 16)
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
