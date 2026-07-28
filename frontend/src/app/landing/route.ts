import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

let cachedHtml: string | null = null;
let cachedHtmlMtime = 0;

async function readLandingHtml(): Promise<string> {
  const filePath = path.join(process.cwd(), 'public', 'landing', 'index.html');
  const { mtimeMs } = await stat(filePath);
  if (cachedHtml && cachedHtmlMtime === mtimeMs) return cachedHtml;

  let html = await readFile(filePath, 'utf-8');
  if (!html.includes('<base ')) {
    html = html.replace('<head>', '<head>\n    <base href="/landing/" />');
  }

  cachedHtml = html;
  cachedHtmlMtime = mtimeMs;
  return html;
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
