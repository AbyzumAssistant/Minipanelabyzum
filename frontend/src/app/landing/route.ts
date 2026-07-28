import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedHtml: string | null = null;

async function readLandingHtml(): Promise<string> {
  if (cachedHtml) return cachedHtml;
  const filePath = path.join(process.cwd(), 'public', 'landing', 'index.html');
  cachedHtml = await readFile(filePath, 'utf-8');
  return cachedHtml;
}

export async function GET() {
  try {
    const html = await readLandingHtml();
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return new NextResponse('Landing no disponible. Reconstruye el frontend (npm run build).', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
