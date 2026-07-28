"""
MCABYZUM — launcher Minecraft 1.19 locked to Abyzum server.
Does not redistribute Minecraft binaries; downloads from Mojang on first launch.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import threading
import uuid
from pathlib import Path

import minecraft_launcher_lib
import webview

from inspector import GameInspector
from forge_setup import ensure_forge_and_mod, write_mod_config
from manifest_sync import sync_from_panel


def bundle_root() -> Path:
    """Project folder in dev; PyInstaller extract dir when frozen."""
    if getattr(sys, "frozen", False) and hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS)
    return Path(__file__).resolve().parent


ROOT = bundle_root()
CONFIG_PATH = ROOT / "config.json"
UI_DIR = ROOT / "ui"

# Instalador / panel — no deben quedar pisados por AppData antigua.
DEPLOY_CONFIG_KEYS = frozenset(
    {
        "app_name",
        "brand",
        "minecraft_version",
        "mod_loader",
        "forge_version",
        "panel_server_id",
        "backend_url",
        "server",
        "java",
        "offline_default_name",
        "launcherRevision",
        "builtAt",
        "forge_build_hint",
    }
)
PLACEHOLDER_HOSTS = frozenset({"", "play.mcabyzum.com", "mcabyzum.com", "localhost"})
DEFAULT_SERVER_PORT = 25569


def appdata_dir() -> Path:
    base = os.environ.get("APPDATA") or str(Path.home() / "AppData" / "Roaming")
    path = Path(base) / ".mcabyzum"
    path.mkdir(parents=True, exist_ok=True)
    return path


def _read_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        with path.open(encoding="utf-8") as handle:
            data = json.load(handle)
        return data if isinstance(data, dict) else None
    except (json.JSONDecodeError, OSError):
        return None


def _is_placeholder_host(host: str | None) -> bool:
    return (host or "").strip().lower() in PLACEHOLDER_HOSTS


def _deploy_config_candidates() -> list[Path]:
    candidates: list[Path] = []
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        candidates.extend(
            [
                exe_dir / "config.json",
                exe_dir.parent / "config.json",
                CONFIG_PATH,
            ]
        )
    else:
        candidates.append(CONFIG_PATH)
    return candidates


def normalize_server(server: dict | None, fallback: dict | None = None) -> dict:
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


def _load_bundled_deploy() -> dict:
    for candidate in _deploy_config_candidates():
        data = _read_json(candidate)
        if data:
            return data
    return {}


def merge_deploy_config(deploy: dict, overlay: dict | None = None) -> dict:
    bundled = _load_bundled_deploy()
    authority = bundled or deploy
    merged = dict(deploy)
    for key in DEPLOY_CONFIG_KEYS:
        if key in authority:
            merged[key] = authority[key]
    for key, value in (overlay or {}).items():
        if key not in DEPLOY_CONFIG_KEYS:
            merged[key] = value
    merged["server"] = normalize_server(
        merged.get("server"),
        authority.get("server"),
    )
    return merged


def load_config() -> dict:
    deploy: dict | None = None
    for candidate in _deploy_config_candidates():
        deploy = _read_json(candidate)
        if deploy:
            break

    overlay = _read_json(appdata_dir() / "config.json")
    if deploy:
        return merge_deploy_config(deploy, overlay)

    if overlay:
        overlay["server"] = normalize_server(overlay.get("server"))
        return overlay

    raise FileNotFoundError("No se encontró config.json para MCABYZUM")


def refresh_game_server_config(config: dict) -> None:
    from forge_setup import write_mod_config

    server = normalize_server(config.get("server"))
    write_mod_config(minecraft_dir(), server, auto_join=True)


def user_settings_path() -> Path:
    return appdata_dir() / "settings.json"


def load_settings() -> dict:
    path = user_settings_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_settings(data: dict) -> None:
    user_settings_path().write_text(json.dumps(data, indent=2), encoding="utf-8")


def save_runtime_config(config: dict) -> None:
    normalized = merge_deploy_config(config)
    appdata_dir().joinpath("config.json").write_text(
        json.dumps(normalized, indent=2), encoding="utf-8"
    )
    refresh_game_server_config(normalized)


def minecraft_dir() -> Path:
    path = appdata_dir() / "game"
    path.mkdir(parents=True, exist_ok=True)
    return path


def offline_uuid(username: str) -> str:
    return str(uuid.uuid3(uuid.NAMESPACE_DNS, f"OfflinePlayer:{username}"))


class Api:
    def __init__(self, window: webview.Window | None = None):
        self.window = window
        self.config = load_config()
        save_runtime_config(self.config)
        self._busy = False
        self._last_report: dict | None = None

    def _inspector(self) -> GameInspector:
        return GameInspector(minecraft_dir(), self.config["minecraft_version"])

    def get_bootstrap(self) -> dict:
        settings = load_settings()
        server = self.config["server"]
        username = (settings.get("username") or "").strip()
        installed = self._is_installed()
        ready = installed and self._inspector().is_ready()
        remembered = bool(username) and username.lower() != "player"
        auto_enter = bool(settings.get("auto_enter", True)) and remembered and ready
        return {
            "appName": self.config["app_name"],
            "brand": self.config["brand"],
            "version": self.config["minecraft_version"],
            "serverName": server["name"],
            "serverHost": server["host"],
            "serverPort": server["port"],
            "username": username or self.config.get("offline_default_name", "Player"),
            "installed": installed,
            "ready": ready,
            "remembered": remembered,
            "autoEnter": auto_enter,
            "launchCount": int(settings.get("launch_count", 0)),
        }

    def _is_installed(self) -> bool:
        version = self.config["minecraft_version"]
        jar = minecraft_dir() / "versions" / version / f"{version}.jar"
        return jar.exists() and jar.stat().st_size > 1_000_000

    def _emit(self, event: str, payload: dict) -> None:
        if not self.window:
            return
        script = (
            f"window.dispatchEvent(new CustomEvent({json.dumps(event)}, "
            f"{{ detail: {json.dumps(payload)} }}));"
        )
        self.window.evaluate_js(script)

    def save_username(self, username: str) -> dict:
        name = (username or "").strip()[:16] or "Player"
        settings = load_settings()
        prev = settings.get("username")
        settings["username"] = name
        if prev != name or "uuid" not in settings:
            settings["uuid"] = offline_uuid(name)
        settings["auto_enter"] = True
        save_settings(settings)
        return {"ok": True, "username": name}

    def inspect_and_fix(self) -> dict:
        if self._busy:
            return {"ok": False, "error": "Busy"}
        self._busy = True
        try:
            report = self._run_repair()
            self._last_report = report.to_dict()
            return self._last_report
        except Exception as exc:  # noqa: BLE001
            return {"ok": False, "error": str(exc)}
        finally:
            self._busy = False

    def get_last_report(self) -> dict:
        return self._last_report or {"ok": True, "issues": [], "removed": [], "fixed": []}

    def enter_server(self, username: str) -> dict:
        if self._busy:
            return {"ok": False, "error": "Ya se está preparando el juego."}
        self._busy = True
        self.save_username(username)
        thread = threading.Thread(target=self._prepare_and_launch, daemon=True)
        thread.start()
        return {"ok": True}

    def _callback(self) -> dict:
        return {
            "setStatus": lambda s: self._emit("mcabyzum:status", {"text": str(s)}),
            "setProgress": lambda p: self._emit(
                "mcabyzum:progress", {"value": int(p) if p is not None else 0}
            ),
            "setMax": lambda m: self._emit(
                "mcabyzum:progress", {"max": int(m) if m is not None else 100}
            ),
        }

    def _reinstall_version(self) -> None:
        version = self.config["minecraft_version"]
        mc_dir = str(minecraft_dir())
        minecraft_launcher_lib.install.install_minecraft_version(
            version, mc_dir, callback=self._callback()
        )

    def _reinstall_java(self) -> None:
        version = self.config["minecraft_version"]
        mc_dir = str(minecraft_dir())
        runtime_info = minecraft_launcher_lib.runtime.get_version_runtime_information(
            version, mc_dir
        )
        if runtime_info is None:
            return
        runtime_name = runtime_info["name"]
        # wipe broken runtime folder for this name if present
        runtime_path = minecraft_dir() / "runtime" / runtime_name
        if runtime_path.exists():
            shutil.rmtree(runtime_path, ignore_errors=True)
        minecraft_launcher_lib.runtime.install_jvm_runtime(
            runtime_name, mc_dir, callback=self._callback()
        )

    def _run_repair(self):
        inspector = self._inspector()

        def status(text: str) -> None:
            self._emit("mcabyzum:status", {"text": text})

        return inspector.repair(
            status=status,
            reinstall_version=self._reinstall_version,
            reinstall_java=self._reinstall_java,
        )

    def _prepare_and_launch(self) -> None:
        try:
            version = self.config["minecraft_version"]
            mc_dir = str(minecraft_dir())
            settings = load_settings()
            username = settings.get("username", "Player")
            player_uuid = settings.get("uuid") or offline_uuid(username)
            settings["uuid"] = player_uuid
            save_settings(settings)

            self._emit("mcabyzum:status", {"text": "Inspeccionando y reparando…"})
            report = self._run_repair()
            self._last_report = report.to_dict()
            self._emit("mcabyzum:inspect", report.to_dict())

            if not report.ok and any(
                i.get("severity") == "error" and not i.get("fixable", True)
                for i in self._last_report.get("issues", [])
            ):
                # e.g. low disk — abort
                msgs = [
                    i["message"]
                    for i in self._last_report["issues"]
                    if i.get("severity") == "error"
                ]
                raise RuntimeError(" | ".join(msgs) or "No se pudo reparar la instalación.")

            # Ensure version present even if inspect said ok but jar missing race
            if not self._is_installed():
                self._emit("mcabyzum:status", {"text": f"Descargando Minecraft {version}…"})
                self._reinstall_version()

            # Always ensure Mojang Java runtime for 1.19
            runtime_info = minecraft_launcher_lib.runtime.get_version_runtime_information(
                version, mc_dir
            )
            java_path = None
            if runtime_info is not None:
                runtime_name = runtime_info["name"]
                java_path = minecraft_launcher_lib.runtime.get_executable_path(
                    runtime_name, mc_dir
                )
                if not java_path or not Path(java_path).exists():
                    self._emit(
                        "mcabyzum:status",
                        {"text": f"Descargando Java {runtime_name}…"},
                    )
                    minecraft_launcher_lib.runtime.install_jvm_runtime(
                        runtime_name, mc_dir, callback=self._callback()
                    )
                    java_path = minecraft_launcher_lib.runtime.get_executable_path(
                        runtime_name, mc_dir
                    )

            server = self.config["server"]
            forge_version = self.config.get("forge_version")
            self._emit("mcabyzum:status", {"text": "Instalando Forge + login Abyzum…"})
            launch_version = ensure_forge_and_mod(
                minecraft_dir(),
                version,
                ROOT,
                server,
                status=lambda t: self._emit("mcabyzum:status", {"text": t}),
                callback=self._callback(),
                java=java_path,
                forge_version=forge_version,
            )

            self.config = sync_from_panel(
                minecraft_dir(),
                appdata_dir(),
                self.config,
                status=lambda t: self._emit("mcabyzum:status", {"text": t}),
            )
            self.config = merge_deploy_config(self.config)
            save_runtime_config(self.config)
            server = self.config["server"]
            version = self.config["minecraft_version"]
            forge_version = self.config.get("forge_version")
            expected_forge_prefix = f"{version}-forge-"
            if expected_forge_prefix not in launch_version:
                self._emit(
                    "mcabyzum:status",
                    {"text": f"Reinstalando Forge {forge_version}…"},
                )
                launch_version = ensure_forge_and_mod(
                    minecraft_dir(),
                    version,
                    ROOT,
                    server,
                    status=lambda t: self._emit("mcabyzum:status", {"text": t}),
                    callback=self._callback(),
                    java=java_path,
                    forge_version=forge_version,
                )
            if "1.19.2" in launch_version:
                raise RuntimeError(
                    "Se detectó Minecraft 1.19.2. Pulsa Inspeccionar / reparar para instalar 1.19 Forge."
                )
            write_mod_config(minecraft_dir(), server, auto_join=True)
            refresh_game_server_config(self.config)

            ram = self.config.get("java", {})
            min_ram = int(ram.get("min_ram_mb", 2048))
            max_ram = int(ram.get("max_ram_mb", 4096))

            options: minecraft_launcher_lib.types.MinecraftOptions = {
                "username": username,
                "uuid": player_uuid,
                "token": "0",
                "launcherName": self.config["app_name"],
                "launcherVersion": "1.3.0",
                "gameDirectory": mc_dir,
                "jvmArguments": [f"-Xms{min_ram}M", f"-Xmx{max_ram}M"],
            }
            if java_path:
                options["executablePath"] = java_path

            command = minecraft_launcher_lib.command.get_minecraft_command(
                launch_version, mc_dir, options
            )
            self._write_server_lock(mc_dir, server)

            self._emit("mcabyzum:status", {"text": f"Abriendo Forge Abyzum ({username})…"})
            self._emit("mcabyzum:progress", {"value": 100, "max": 100})

            creationflags = 0
            if sys.platform == "win32":
                creationflags = (
                    subprocess.CREATE_NEW_PROCESS_GROUP | subprocess.DETACHED_PROCESS
                )

            subprocess.Popen(
                command,
                cwd=mc_dir,
                creationflags=creationflags,
                close_fds=True,
            )

            settings = load_settings()
            settings["launch_count"] = int(settings.get("launch_count", 0)) + 1
            settings["last_launch_ok"] = True
            settings["auto_enter"] = True
            save_settings(settings)

            self._emit("mcabyzum:launched", {"ok": True, "username": username})
        except Exception as exc:  # noqa: BLE001
            settings = load_settings()
            settings["last_launch_ok"] = False
            settings["last_error"] = str(exc)
            save_settings(settings)
            self._emit("mcabyzum:error", {"error": str(exc)})
        finally:
            self._busy = False

    def _write_server_lock(self, mc_dir: str, server: dict) -> None:
        lock = {
            "forced": True,
            "servers": [
                {
                    "name": server["name"],
                    "ip": f"{server['host']}:{server['port']}",
                }
            ],
        }
        Path(mc_dir, "mcabyzum-server.json").write_text(
            json.dumps(lock, indent=2), encoding="utf-8"
        )

        options_path = Path(mc_dir, "options.txt")
        lines = []
        if options_path.exists():
            lines = options_path.read_text(encoding="utf-8", errors="ignore").splitlines()
        kv = {}
        for line in lines:
            if ":" in line:
                k, _, v = line.partition(":")
                kv[k] = v
        kv.setdefault("lang", "es_es")
        options_path.write_text(
            "\n".join(f"{k}:{v}" for k, v in kv.items()) + "\n", encoding="utf-8"
        )


def main() -> None:
    # Allow `python launcher/main.py` and frozen exe imports
    launcher_dir = Path(__file__).resolve().parent
    if str(launcher_dir) not in sys.path:
        sys.path.insert(0, str(launcher_dir))

    config = load_config()
    api = Api()
    index = (UI_DIR / "index.html").as_uri()
    window = webview.create_window(
        config["app_name"],
        index,
        js_api=api,
        width=1100,
        height=720,
        background_color="#071012",
        resizable=True,
        min_size=(900, 600),
    )
    api.window = window
    webview.start(debug=False)


if __name__ == "__main__":
    main()
