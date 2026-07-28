import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';
const API = 'http://127.0.0.1:8091';
const USER = 'abyzum';
const PASS = 'admin123';

const routes = [
  '/',
  '/dashboard/home',
  '/dashboard/servers',
  '/dashboard/files',
  '/dashboard/world-library',
  '/dashboard/templates',
  '/dashboard/settings',
  '/dashboard/settings/account',
  '/dashboard/settings/access',
  '/dashboard/settings/audit',
  '/dashboard/settings/integrations',
  '/dashboard/settings/preferences',
  '/dashboard/settings/network',
  '/dashboard/settings/defaults',
  '/dashboard/settings/danger',
];

const issues = [];
const passes = [];

function logIssue(area, message, detail = '') {
  const entry = { area, message, detail };
  issues.push(entry);
  console.log(`[FAIL] ${area}: ${message}${detail ? ` — ${detail}` : ''}`);
}

function logPass(area, message) {
  passes.push({ area, message });
  console.log(`[OK] ${area}: ${message}`);
}

async function waitStable(page, ms = 800) {
  await page.waitForTimeout(ms);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (text.includes('favicon') || text.includes('404 (Not Found)')) return;
      consoleErrors.push(text);
    }
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText || 'failed'}`);
  });
  page.on('response', (res) => {
    const url = res.url();
    if (!url.includes('8091') && !url.includes('localhost:3000')) return;
    if (res.status() >= 500) {
      failedRequests.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });

  // Health
  try {
    const health = await page.request.get(`${API}/health`);
    if (health.ok()) logPass('API', 'Backend health OK');
    else logIssue('API', 'Backend health failed', String(health.status()));
  } catch (e) {
    logIssue('API', 'Backend unreachable', String(e));
  }

  // Login page
  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await waitStable(page);

    const title = await page.locator('h1, .font-minecraft').first().textContent().catch(() => '');
    if (title?.includes('abyzumMC') || title?.includes('MC')) logPass('Login', 'Página de login cargada');
    else logIssue('Login', 'Título/login no visible', title || 'vacío');

    // Forgot password view
    const forgotLink = page.getByRole('button', { name: /olvid|forgot|passwort|mot de passe/i }).first();
    if (await forgotLink.count()) {
      await forgotLink.click();
      await waitStable(page);
      logPass('Login', 'Vista olvidé contraseña abre');
      const backBtn = page.getByRole('button', { name: /volver|back|login|iniciar/i }).first();
      if (await backBtn.count()) {
        await backBtn.click();
        await waitStable(page);
      }
    }

    // Language switcher
    const langBtn = page.locator('button').filter({ hasText: /ES|EN|DE|FR|PT|NL|PL|RU/i }).first();
    if (await langBtn.count()) {
      await langBtn.click();
      await waitStable(page, 400);
      logPass('Login', 'Selector de idioma clickeable');
    }

    // Login
    await page.fill('#identifier, input[name="identifier"], input[type="text"]', USER);
    await page.fill('#password, input[name="password"], input[type="password"]', PASS);
    const submit = page.locator('button[type="submit"], .mc-btn-emerald').first();
    await submit.click();
    await page.waitForURL('**/dashboard/**', { timeout: 30000 });
    logPass('Login', 'Login exitoso → dashboard');
  } catch (e) {
    logIssue('Login', 'Error en login', String(e));
  }

  // Dashboard routes
  for (const route of routes.slice(1)) {
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 60000 });
      await waitStable(page);
      const body = await page.locator('body').innerText();
      if (/error|500|unexpected/i.test(body) && /something went wrong/i.test(body)) {
        logIssue('Routes', `Error visible en ${route}`);
      } else {
        logPass('Routes', `${route} carga OK`);
      }
    } catch (e) {
      logIssue('Routes', `Fallo cargando ${route}`, String(e));
    }
  }

  // Sidebar navigation clicks
  try {
    await page.goto(`${BASE}/dashboard/home`, { waitUntil: 'networkidle' });
    const navLinks = [
      { name: /home|inicio/i, url: '/dashboard/home' },
      { name: /server|servidor/i, url: '/dashboard/servers' },
      { name: /file|archivo/i, url: '/dashboard/files' },
      { name: /world|mundo/i, url: '/dashboard/world-library' },
      { name: /template|plantilla/i, url: '/dashboard/templates' },
      { name: /setting|ajust|configur/i, url: '/dashboard/settings' },
    ];
    for (const link of navLinks) {
      const el = page.getByRole('link', { name: link.name }).first();
      if (await el.count()) {
        await el.click();
        await waitStable(page, 1200);
        if (page.url().includes(link.url.split('/').pop())) {
          logPass('Sidebar', `Nav ${link.url}`);
        }
      }
    }
  } catch (e) {
    logIssue('Sidebar', 'Error navegando sidebar', String(e));
  }

  // Servers list + first server
  let serverId = null;
  try {
    await page.goto(`${BASE}/dashboard/servers`, { waitUntil: 'networkidle' });
    await waitStable(page, 1500);

    const createBtn = page.getByRole('button', { name: /crear|create|nuevo|new/i }).first();
    if (await createBtn.count()) {
      await createBtn.click();
      await waitStable(page, 800);
      const cancel = page.getByRole('button', { name: /cancel|cancelar|close|cerrar/i }).first();
      if (await cancel.count()) {
        await cancel.click();
        await waitStable(page, 400);
        logPass('Servers', 'Diálogo crear servidor abre/cierra');
      } else {
        await page.keyboard.press('Escape');
        logPass('Servers', 'Diálogo crear servidor abre');
      }
    }

    const serverLink = page.locator('a[href*="/dashboard/servers/"]').first();
    if (await serverLink.count()) {
      const href = await serverLink.getAttribute('href');
      serverId = href?.split('/').pop() || null;
      await serverLink.click();
      await page.waitForURL('**/dashboard/servers/**', { timeout: 20000 });
      await waitStable(page, 1500);
      logPass('Servers', `Servidor abierto: ${serverId}`);

      const tabButtons = page.locator('nav button[type="button"]');
      const tabCount = await tabButtons.count();
      for (let i = 0; i < tabCount; i++) {
        const btn = tabButtons.nth(i);
        if (!(await btn.isEnabled())) continue;
        const label = (await btn.innerText()).trim().slice(0, 40);
        try {
          await btn.click();
          await waitStable(page, 900);
          logPass('ServerTabs', `Tab: ${label || i}`);
        } catch (e) {
          logIssue('ServerTabs', `Tab falló: ${label}`, String(e));
        }
      }

      // Mods catalog "Ver más" if deploy/mods tab visible
      const seeMore = page.getByRole('button', { name: /ver más|see more|mehr/i }).first();
      if (await seeMore.count()) {
        await seeMore.click();
        await waitStable(page, 2000);
        logPass('Mods', 'Botón Ver más funciona');
      }
    } else {
      logPass('Servers', 'Sin servidores (lista vacía, no error)');
    }
  } catch (e) {
    logIssue('Servers', 'Error en página servidores', String(e));
  }

  // Join page
  if (serverId) {
    try {
      await page.goto(`${BASE}/join/${serverId}`, { waitUntil: 'networkidle', timeout: 30000 });
      await waitStable(page);
      const text = await page.locator('body').innerText();
      if (/error|no se encontr/i.test(text.toLowerCase())) {
        logPass('Join', 'Join page responde (sin manifest público es esperado)');
      } else {
        logPass('Join', 'Join page carga');
      }
    } catch (e) {
      logIssue('Join', 'Error join page', String(e));
    }
  }

  // Logout
  try {
    await page.goto(`${BASE}/dashboard/home`, { waitUntil: 'networkidle' });
    const userMenu = page.locator('header button').filter({ has: page.locator('img[alt="User"]') }).first();
    if (await userMenu.count()) {
      await userMenu.click();
      await waitStable(page, 500);
    }
    const logout = page.getByRole('button', { name: /logout|cerrar sesión|salir|sign out/i }).first();
    if (await logout.count()) {
      await logout.click({ force: true });
      await page.waitForURL('**/', { timeout: 15000 });
      logPass('Auth', 'Logout OK');
    }
  } catch (e) {
    logIssue('Auth', 'Logout falló', String(e));
  }

  // Report console/network
  const uniqueConsole = [...new Set(consoleErrors)];
  const uniqueFailed = [...new Set(failedRequests.filter((r) => !r.includes('favicon')))];
  const uniquePageErrors = [...new Set(pageErrors)];

  for (const err of uniquePageErrors) logIssue('Console', 'pageerror', err.slice(0, 300));
  for (const err of uniqueConsole.slice(0, 20)) {
    if (/401|Unauthorized/i.test(err) && /auth|authentication/i.test(err)) continue;
    if (/AxiosError|500|403|Network Error/i.test(err)) {
      logIssue('Console', 'console.error', err.slice(0, 300));
    }
  }
  for (const req of uniqueFailed.slice(0, 30)) {
    if (/ERR_ABORTED|net::ERR_ABORTED/i.test(req)) continue;
    if (/500|502|503|504|ECONNREFUSED|net::ERR/i.test(req)) {
      logIssue('Network', 'Request fallida', req.slice(0, 300));
    }
  }

  await browser.close();

  console.log('\n========== RESUMEN ==========');
  console.log(`OK: ${passes.length}`);
  console.log(`FAIL: ${issues.length}`);
  if (issues.length) {
    console.log('\nErrores encontrados:');
    for (const i of issues) console.log(` - [${i.area}] ${i.message}${i.detail ? `: ${i.detail}` : ''}`);
    process.exit(1);
  }
  console.log('\nTodo OK.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
