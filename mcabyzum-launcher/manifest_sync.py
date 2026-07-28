"""
Sync server mods + resource pack from Minipanelabyzum deploy manifest.
Downloads go to %TEMP%\\.mcabyzum; installed mods live under userdata.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Callable

StatusFn = Callable[[str], None]

LOGIN_MOD_PREFIX = "mcabyzum-login"
STATE_FILE = "launcher-sync.json"
DEFAULT_SERVER_PORT = 25569
PLACEHOLDER_HOSTS = frozenset({"", "play.mcabyzum.com", "mcabyzum.com", "localhost"})


def _is_placeholder_host(host: str | None) -> bool:
    return (host or "").strip().lower() in PLACEHOLDER_HOSTS


def _normalize_server(server: dict, fallback: dict | None = None) -> dict:
    current = dict(server or {})
    backup = dict(fallback or {})
    host = (current.get("host") or backup.get("host") or "").strip()
    if _is_placeholder_host(host):
        host = (backup.get("host") or "").strip()
    if _is_placeholder_host(host):
        host = "65.75.202.124"

    port_raw = current.get("port", backup.get("port", DEFAULT_SERVER_PORT))
    try:
        port = int(port_raw)
    except (TypeError, ValueError):
        port = DEFAULT_SERVER_PORT

    name = (current.get("name") or backup.get("name") or "Abyzum Server").strip()
    return {"host": host, "port": port, "name": name or "Abyzum Server"}


def manifest_url(backend_url: str, server_id: str) -> str:
    base = backend_url.rstrip("/")
    return f"{base}/modrinth/deploy/{server_id}/manifest"


def fetch_manifest(backend_url: str, server_id: str) -> dict:
    url = manifest_url(backend_url, server_id)
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response)


def load_local_state(app_dir: Path) -> dict:
    path = app_dir / STATE_FILE
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_local_state(app_dir: Path, manifest: dict) -> None:
    data = {
        "launcherRevision": manifest.get("launcherRevision"),
        "updatedAt": manifest.get("updatedAt"),
        "modCount": len(manifest.get("mods") or []),
    }
    (app_dir / STATE_FILE).write_text(json.dumps(data, indent=2), encoding="utf-8")


def needs_sync(app_dir: Path, manifest: dict) -> bool:
    local = load_local_state(app_dir)
    remote_rev = manifest.get("launcherRevision")
    if remote_rev is None:
        return bool(manifest.get("mods"))
    return local.get("launcherRevision") != remote_rev


def _sha1_file(path: Path) -> str:
    digest = hashlib.sha1()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^\w.\- ]+", "_", name).strip() or "resourcepack"
    if not cleaned.lower().endswith(".zip"):
        cleaned += ".zip"
    return cleaned


def temp_download_dir() -> Path:
    base = os.environ.get("TEMP") or os.environ.get("TMP") or str(Path.home())
    path = Path(base) / ".mcabyzum" / "downloads"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = temp_download_dir() / f"{dest.name}.{hashlib.sha1(url.encode()).hexdigest()[:12]}.part"
    with urllib.request.urlopen(url, timeout=120) as response, tmp.open("wb") as handle:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            handle.write(chunk)
    tmp.replace(dest)


def check_mods_current(app_dir: Path, config: dict) -> tuple[bool, dict | None]:
    """Return (up_to_date, manifest_or_none)."""
    backend_url = (config.get("backend_url") or "").strip()
    server_id = (config.get("panel_server_id") or "").strip()
    if not backend_url or not server_id:
        return True, None

    try:
        manifest = fetch_manifest(backend_url, server_id)
    except urllib.error.URLError:
        return bool(load_local_state(app_dir)), None

    return not needs_sync(app_dir, manifest), manifest


def sync_mods(mc_dir: Path, manifest: dict, status: StatusFn | None = None) -> None:
    mods_dir = mc_dir / "mods"
    mods_dir.mkdir(parents=True, exist_ok=True)

    keep_names: set[str] = set()
    for mod in manifest.get("mods") or []:
        file_name = mod.get("fileName")
        download_url = mod.get("downloadUrl")
        if not file_name or not download_url:
            continue

        keep_names.add(file_name)
        dest = mods_dir / file_name
        expected_sha1 = (mod.get("sha1") or "").lower()

        if dest.exists() and expected_sha1:
            if _sha1_file(dest).lower() == expected_sha1:
                continue

        if status:
            status(f"Descargando {mod.get('name', file_name)}…")
        _download(download_url, dest)

    for jar in mods_dir.glob("*.jar"):
        lower = jar.name.lower()
        if lower.startswith(LOGIN_MOD_PREFIX):
            continue
        if jar.name not in keep_names:
            try:
                jar.unlink()
            except OSError:
                pass


def sync_resource_pack(mc_dir: Path, manifest: dict, status: StatusFn | None = None) -> None:
    pack = manifest.get("resourcePack") or {}
    url = pack.get("url")
    if not url:
        return

    packs_dir = mc_dir / "resourcepacks"
    packs_dir.mkdir(parents=True, exist_ok=True)
    file_name = _safe_filename(pack.get("name") or "server-pack")
    dest = packs_dir / file_name

    expected_sha1 = (pack.get("sha1") or "").lower()
    if dest.exists() and expected_sha1 and _sha1_file(dest).lower() == expected_sha1:
        return

    if status:
        status("Descargando resource pack del servidor…")
    _download(url, dest)


def apply_server_from_manifest(
    config: dict,
    manifest: dict,
    mc_dir: Path | None = None,
    auto_join: bool = True,
) -> dict:
    server = manifest.get("server")
    if not server:
        return config

    merged = dict(config)
    fallback_server = dict(config.get("server") or {})
    merged_server = dict(fallback_server)
    merged_server["host"] = server.get("host") or merged_server.get("host")
    merged_server["port"] = server.get("port") or merged_server.get("port") or DEFAULT_SERVER_PORT
    merged_server["name"] = server.get("name") or merged_server.get("name")
    merged["server"] = _normalize_server(merged_server, fallback_server)

    # La versión del cliente la fija config.json del launcher, no el manifest remoto.
    if manifest.get("gameVersion"):
        merged["minecraft_version"] = manifest["gameVersion"]
    if manifest.get("forgeBuild"):
        merged["forge_build_hint"] = manifest["forgeBuild"]
        game_version = merged.get("minecraft_version") or manifest.get("gameVersion") or "1.19.2"
        merged["forge_version"] = f"{game_version}-{manifest['forgeBuild']}"

    if mc_dir is not None:
        from forge_setup import write_mod_config

        write_mod_config(mc_dir, merged["server"], auto_join=auto_join)

    return merged


def sync_from_panel(
    mc_dir: Path,
    app_dir: Path,
    config: dict,
    status: StatusFn | None = None,
) -> dict:
    backend_url = (config.get("backend_url") or "").strip()
    server_id = (config.get("panel_server_id") or "").strip()
    if not backend_url or not server_id:
        return config

    if status:
        status("Consultando mods del servidor…")

    try:
        manifest = fetch_manifest(backend_url, server_id)
    except urllib.error.URLError as exc:
        if load_local_state(app_dir):
            if status:
                status("Sin conexión al panel — usando mods locales.")
            return config
        raise RuntimeError(f"No se pudo conectar al panel ({backend_url}): {exc}") from exc

    if not manifest.get("mods"):
        if status:
            status("El servidor aún no publicó mods en el panel.")
        return apply_server_from_manifest(config, manifest, mc_dir=mc_dir)

    if not needs_sync(app_dir, manifest):
        if status:
            status("Mods del launcher ya están al día.")
        return apply_server_from_manifest(config, manifest, mc_dir=mc_dir)

    sync_mods(mc_dir, manifest, status=status)
    sync_resource_pack(mc_dir, manifest, status=status)
    save_local_state(app_dir, manifest)

    if status:
        count = len(manifest.get("mods") or [])
        status(f"Launcher sincronizado ({count} mods).")

    return apply_server_from_manifest(config, manifest, mc_dir=mc_dir)
