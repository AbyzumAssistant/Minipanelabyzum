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
  profile?: 'forge119' | 'horizons' | 'modpack';
  modpackTitle?: string;
  modpackVersion?: string;
  shaderPackNote?: string;
  shaderPackUrl?: string;
  resourcePacks?: Array<{ fileName: string; downloadUrl: string; sha1?: string; name: string }>;
}

interface LandingProfile {
  navSecondary: string;
  lede: string;
  subtitle: string;
  pageClass: string;
}

interface LandingState {
  serverId: string;
  manifest: DeployManifest | null;
  versionLabel: string;
  serverAddress: string;
  profile: LandingProfile;
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

  return 'mcabyzum';
}

function apiBase(): string {
  const configured = document.querySelector<HTMLMetaElement>('meta[name="api-base"]')?.content?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (window.location.pathname.includes('/landing')) {
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatVersionLabel(manifest: DeployManifest | null): string {
  const version = manifest?.gameVersion ?? '1.20.1';
  const majorMinor = version.match(/^(\d+\.\d+)/)?.[1];
  const base = majorMinor ? `Minecraft ${majorMinor}` : `Minecraft ${version}`;

  if (manifest?.profile === 'horizons') {
    const packVersion = manifest.modpackVersion ? ` · v${manifest.modpackVersion}` : '';
    return `${base} · Horizons${packVersion}`;
  }

  return base;
}

function resolveLandingProfile(manifest: DeployManifest | null): LandingProfile {
  if (manifest?.profile === 'horizons') {
    return {
      navSecondary: 'Horizons',
      subtitle: manifest.modpackTitle ? `${manifest.modpackTitle} en abyzumMC` : 'Horizons en abyzumMC',
      lede:
        'Modpack Horizons con Distant Horizons, Terralith, Iris y bosses épicos. Descarga el launcher abyzum con mods, resource packs y configs incluidos. Shaders Bliss aparte.',
      pageClass: 'horizons',
    };
  }

  return {
    navSecondary: 'The Wild',
    subtitle: 'Solo The Wild Update',
    lede: 'Solo The Wild Update. Sin otras versiones. Deep Dark, manglares y el silencio del Warden.',
    pageClass: 'wild',
  };
}

function buildState(manifest: DeployManifest | null, serverId: string): LandingState {
  const host = manifest?.server?.host ?? '';
  const port = manifest?.server?.port;
  const serverAddress = host && port ? `${host}:${port}` : '';

  return {
    serverId,
    manifest,
    versionLabel: formatVersionLabel(manifest),
    serverAddress,
    profile: resolveLandingProfile(manifest),
  };
}

function setStatus(message: string, isError = false): void {
  const el = document.getElementById('status-line');
  if (!el) return;
  el.textContent = message;
  el.classList.toggle('error', isError);
  el.classList.toggle('visible', Boolean(message));
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function renderLanding(root: HTMLElement, state: LandingState): void {
  root.innerHTML = `
    <div class="page ${escapeHtml(state.profile.pageClass)}">
      <div class="noise" aria-hidden="true"></div>

      <header class="topbar">
        <a class="brand" href="/landing/?server=${encodeURIComponent(state.serverId)}" aria-label="abyzum inicio">
          <span class="brand-mark" aria-hidden="true"></span>
          <span class="brand-name">abyzum</span>
        </a>
        <nav class="topnav" aria-label="Principal">
          <a href="#instancia" id="nav-instancia">Instancia</a>
          <a href="#wild" id="nav-wild">${escapeHtml(state.profile.navSecondary)}</a>
          <a href="#" id="nav-lanzar">Lanzar</a>
        </nav>
      </header>

      <main class="hero" id="instancia">
        <div class="hero-media" aria-hidden="true">
          <img src="/landing/hero.png" alt="" width="1920" height="1080" decoding="async" />
          <div class="hero-veil"></div>
        </div>

        <div class="hero-copy">
          <h1 class="brand-lockup anim-fade-up" style="--delay: 0.12s">abyzum</h1>
          <p class="hero-version anim-fade-up" style="--delay: 0.22s" id="hero-version">${escapeHtml(state.versionLabel)}</p>
          <p class="hero-subtitle anim-fade-up" style="--delay: 0.28s">${escapeHtml(state.profile.subtitle)}</p>
          <p class="lede anim-fade-up" style="--delay: 0.32s" id="wild">
            ${escapeHtml(state.profile.lede)}
          </p>
          <div class="cta-row anim-fade-up" style="--delay: 0.42s">
            <button class="btn btn-primary" id="download-btn" type="button">Descargar abyzumMC</button>
          </div>
          <p class="status-line" id="status-line" role="status" aria-live="polite"></p>
        </div>
      </main>
    </div>
  `;

  bindLandingActions(state);
}

function bindLandingActions(state: LandingState): void {
  const downloadBtn = document.getElementById('download-btn');
  const navLanzar = document.getElementById('nav-lanzar');
  const navInstancia = document.getElementById('nav-instancia');
  const navWild = document.getElementById('nav-wild');

  const triggerDownload = async () => {
    if (!(downloadBtn instanceof HTMLButtonElement)) return;

    downloadBtn.disabled = true;
    downloadBtn.textContent = 'Descargando…';
    setStatus('Preparando MCABYZUM.exe…');

    if (state.serverAddress) {
      await copyText(state.serverAddress);
    }

    window.location.href = launcherDownloadUrl(state.serverId);

    window.setTimeout(() => {
      downloadBtn.disabled = false;
      downloadBtn.textContent = 'Descargar abyzumMC';
      setStatus(
        state.serverAddress
          ? `Descarga iniciada. Servidor: ${state.serverAddress}`
          : 'Descarga iniciada. Ejecuta MCABYZUM.exe para entrar.',
      );
    }, 4500);
  };

  downloadBtn?.addEventListener('click', () => {
    void triggerDownload();
  });

  navLanzar?.addEventListener('click', (event) => {
    event.preventDefault();
    void triggerDownload();
  });

  navInstancia?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('instancia')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  navWild?.addEventListener('click', (event) => {
    event.preventDefault();
    document.getElementById('wild')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  if (state.manifest?.shaderPackNote) {
    setStatus(state.manifest.shaderPackNote);
  } else if (state.serverAddress) {
    setStatus(`Instancia abyzumMC lista · ${state.serverAddress}`);
  }
}

function renderLoading(root: HTMLElement): void {
  root.innerHTML = '<div class="loading-shell">Cargando abyzumMC</div>';
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;

  const serverId = resolveServerId();
  renderLoading(root);

  let manifest: DeployManifest | null = null;

  try {
    manifest = await fetchManifest(serverId);
  } catch {
    manifest = null;
  }

  document.title = manifest?.profile === 'horizons' ? 'abyzumMC · Horizons' : 'abyzumMC · Minecraft 1.20.1';

  const state = buildState(manifest, serverId);
  renderLanding(root, state);
}

void boot();
