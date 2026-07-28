interface LauncherServer {
  host: string;
  port: number;
  name: string;
}

interface DeployManifest {
  serverId: string;
  gameVersion: string;
  loader: string;
  mods: { fileName: string }[];
  forgeBuild?: string;
  server?: LauncherServer;
  launcherRevision?: number;
}

function resolveServerId(): string {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('server')?.trim();
  if (fromQuery) return fromQuery;
  const parts = window.location.pathname.split('/').filter(Boolean);
  const landingIdx = parts.indexOf('landing');
  if (landingIdx >= 0 && parts[landingIdx + 1]) {
    return decodeURIComponent(parts[landingIdx + 1]);
  }
  return '';
}

function apiBase(): string {
  const configured = document.querySelector<HTMLMetaElement>('meta[name="api-base"]')?.content?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (window.location.pathname.includes('/landing/')) {
    return `${window.location.origin}/api/backend`;
  }
  return '/api/backend';
}

async function fetchManifest(serverId: string): Promise<DeployManifest> {
  const res = await fetch(`${apiBase()}/modrinth/deploy/${encodeURIComponent(serverId)}/manifest`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error('manifest');
  return res.json();
}

function launcherDownloadUrl(serverId: string): string {
  return `${apiBase()}/modrinth/deploy/${encodeURIComponent(serverId)}/launcher/download`;
}

function renderLoading(root: HTMLElement): void {
  root.innerHTML = '<div class="loading">Cargando servidor…</div>';
}

function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = `<div class="shell"><div class="card"><p class="error">${message}</p></div></div>`;
}

function renderPage(root: HTMLElement, manifest: DeployManifest, serverId: string): void {
  const serverName = manifest.server?.name ?? serverId;
  const address = manifest.server
    ? `${manifest.server.host}:${manifest.server.port}`
    : '—';
  const modCount = manifest.mods?.length ?? 0;
  const forge = manifest.forgeBuild ?? '43.3.0';
  const version = manifest.gameVersion ?? '1.19.2';

  root.innerHTML = `
    <div class="shell">
      <div class="hero">
        <img class="logo" src="./icon.svg" alt="MCABYZUM" width="88" height="88" />
        <div>
          <h1 class="title">${escapeHtml(serverName)}</h1>
          <p class="subtitle">Descarga el launcher con mods, resource pack y conexión lista para entrar al servidor.</p>
        </div>
      </div>

      <div class="card">
        <p class="note">Forge ${escapeHtml(version)} · Build ${escapeHtml(forge)} · Revisión launcher v${manifest.launcherRevision ?? 0}</p>
        <div class="stats">
          <div class="stat"><strong>${modCount}</strong><span>Mods incluidos</span></div>
          <div class="stat"><strong>${escapeHtml(version)}</strong><span>Minecraft</span></div>
          <div class="stat"><strong>Forge</strong><span>Mod loader</span></div>
        </div>
        <p class="note">Dirección del servidor</p>
        <p class="address">${escapeHtml(address)}</p>
        <div class="actions">
          <button class="btn btn-primary" id="download-btn">Descargar MCABYZUM Launcher (.zip)</button>
          <button class="btn btn-secondary" id="copy-btn">Copiar IP</button>
        </div>
        <p class="note" style="margin-top:16px">
          1. Descarga y extrae el ZIP.<br/>
          2. Ejecuta <strong>MCABYZUM-Launcher.exe</strong>.<br/>
          3. Se instalan los mods y se copia la IP al portapapeles.<br/>
          4. Abre Minecraft → Multijugador → Directo y conecta.
        </p>
      </div>
    </div>
  `;

  const downloadBtn = document.getElementById('download-btn');
  downloadBtn?.addEventListener('click', () => {
    if (!(downloadBtn instanceof HTMLButtonElement)) return;
    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Preparando descarga…';
    window.location.href = launcherDownloadUrl(serverId);
    window.setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Descargar MCABYZUM Launcher (.zip)';
    }, 4000);
  });

  document.getElementById('copy-btn')?.addEventListener('click', async () => {
    if (!manifest.server) return;
    const text = `${manifest.server.host}:${manifest.server.port}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt('Copia la IP:', text);
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const serverId = resolveServerId();
  if (!serverId) {
    renderError(root, 'Falta el parámetro ?server=ID en la URL.');
    return;
  }

  renderLoading(root);
  try {
    const manifest = await fetchManifest(serverId);
    if (!manifest.mods?.length) {
      renderError(root, 'Este servidor aún no tiene mods publicados en el panel.');
      return;
    }
    renderPage(root, manifest, serverId);
  } catch {
    renderError(root, 'No se pudo cargar la información del servidor.');
  }
}

void boot();
