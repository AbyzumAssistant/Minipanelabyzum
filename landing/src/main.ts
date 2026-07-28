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
  if (window.location.pathname.includes('/landing')) {
    return `${window.location.origin}/api/backend`;
  }
  return '/api/backend';
}

function usernameKey(serverId: string): string {
  return `mcabyzum:${serverId}:username`;
}

function readUsername(serverId: string): string {
  try {
    return localStorage.getItem(usernameKey(serverId)) ?? '';
  } catch {
    return '';
  }
}

function saveUsername(serverId: string, value: string): void {
  try {
    localStorage.setItem(usernameKey(serverId), value.trim());
  } catch {
    /* ignore */
  }
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLoading(root: HTMLElement): void {
  root.innerHTML = '<div class="loading">Cargando launcher…</div>';
}

function renderError(root: HTMLElement, message: string): void {
  root.innerHTML = `
    <div class="error-shell">
      <div class="launcher-window">
        <div class="titlebar"><span>MCABYZUM</span><div class="titlebar-dots"><span></span><span></span><span></span></div></div>
        <div class="launcher-body">
          <p class="status-line error">${escapeHtml(message)}</p>
        </div>
      </div>
    </div>
  `;
}

function setStatus(message: string, isError = false): void {
  const el = document.getElementById('status-line');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderLauncher(root: HTMLElement, manifest: DeployManifest, serverId: string): void {
  const serverName = manifest.server?.name ?? serverId;
  const version = manifest.gameVersion ?? '1.19.2';
  const forge = manifest.forgeBuild ?? '43.3.0';
  const savedName = readUsername(serverId);
  const address = manifest.server ? `${manifest.server.host}:${manifest.server.port}` : '';

  root.innerHTML = `
    <div class="launcher-window">
      <div class="titlebar">
        <span>MCABYZUM</span>
        <div class="titlebar-dots"><span></span><span></span><span></span></div>
      </div>
      <div class="launcher-body">
        <div class="top-row">
          <div class="brand">
            <img src="/landing/icon.svg" alt="MCABYZUM" width="42" height="42" />
            <span class="brand-name">mcabyzum</span>
          </div>
          <div class="badges">
            <span class="badge">${escapeHtml(version)}</span>
            <span class="badge badge-server">SERVIDOR</span>
          </div>
        </div>

        <h1 class="hero-title">${escapeHtml(serverName)}</h1>
        <p class="hero-subtitle">Minecraft ${escapeHtml(version)}</p>
        <p class="hero-copy">
          Descarga el instalador MCABYZUM (Forge ${escapeHtml(version)} + mods + IP ${escapeHtml(address || 'del servidor')}).
          Extrae el ZIP, ejecuta MCABYZUM.exe y pulsa Entrar en el launcher.
        </p>

        <label class="field-label" for="player-name">NOMBRE EN EL SERVIDOR</label>
        <input
          id="player-name"
          class="field-input"
          type="text"
          maxlength="16"
          autocomplete="username"
          placeholder="Tu nick de Minecraft"
          value="${escapeHtml(savedName)}"
        />

        <div class="actions">
          <button class="btn btn-enter" id="enter-btn" type="button">DESCARGAR INSTALADOR</button>
          <button class="btn btn-repair" id="repair-btn" type="button">INSPECCIONAR / REPARAR</button>
        </div>

        <p class="status-line" id="status-line"></p>
      </div>
    </div>
  `;

  const playerInput = document.getElementById('player-name') as HTMLInputElement | null;
  const enterBtn = document.getElementById('enter-btn');
  const repairBtn = document.getElementById('repair-btn');

  playerInput?.addEventListener('change', () => {
    if (playerInput) saveUsername(serverId, playerInput.value);
  });

  enterBtn?.addEventListener('click', async () => {
    if (!(enterBtn instanceof HTMLButtonElement)) return;
    const nick = playerInput?.value.trim() ?? '';
    saveUsername(serverId, nick);
    enterBtn.disabled = true;
    enterBtn.textContent = 'DESCARGANDO…';
    setStatus('Descargando instalador MCABYZUM con mods incluidos…');

    if (address) {
      await copyText(address);
    }

    window.location.href = launcherDownloadUrl(serverId);

    window.setTimeout(() => {
      enterBtn.disabled = false;
      enterBtn.textContent = 'DESCARGAR INSTALADOR';
      setStatus(
        address
          ? `Extrae el ZIP → Instalar y jugar.bat → nick en el launcher. Servidor: ${address}`
          : 'Extrae el ZIP y ejecuta Instalar y jugar.bat',
      );
    }, 5000);
  });

  repairBtn?.addEventListener('click', async () => {
    if (!(repairBtn instanceof HTMLButtonElement)) return;
    repairBtn.disabled = true;
    repairBtn.textContent = 'COMPROBANDO…';
    setStatus('Comprobando manifest, mods y revisión del launcher…');

    try {
      const fresh = await fetchManifest(serverId);
      const modCount = fresh.mods?.length ?? 0;
      if (modCount === 0) {
        setStatus('Este servidor aún no tiene mods publicados en el panel.', true);
        return;
      }

      const revision = fresh.launcherRevision ?? manifest.launcherRevision ?? 0;
      const host = fresh.server?.host ?? manifest.server?.host ?? '—';
      const port = fresh.server?.port ?? manifest.server?.port ?? '—';
      setStatus(`OK · ${modCount} mods · Forge ${fresh.gameVersion ?? version} · rev. ${revision} · ${host}:${port}`);

      if (address) {
        await copyText(`${host}:${port}`);
      }
    } catch {
      setStatus('No se pudo comprobar el manifest. Revisa que el servidor esté publicado en el panel.', true);
    } finally {
      repairBtn.disabled = false;
      repairBtn.textContent = 'INSPECCIONAR / REPARAR';
    }
  });

  if (address) {
    setStatus(`Forge ${forge} · ${manifest.mods.length} mods · ${address}`);
  }
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
      renderError(root, 'Este servidor aún no tiene mods publicados. Pulsa Publicar despliegue en el panel.');
      return;
    }
    renderLauncher(root, manifest, serverId);
  } catch {
    renderError(root, 'No se pudo cargar la información del servidor. Comprueba el manifest en el panel.');
  }
}

void boot();
