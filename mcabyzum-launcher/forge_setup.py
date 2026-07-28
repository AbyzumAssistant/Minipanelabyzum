"""
Install Forge 1.19 + Abyzum login mod into the MCABYZUM game dir.
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Callable

import minecraft_launcher_lib

StatusFn = Callable[[str], None]

FORGE_VERSION = "1.19.2-43.3.0"
MOD_JAR_NAME = "mcabyzum-login.jar"


def find_bundled_mod(bundle_root: Path) -> Path | None:
    candidates = [
        bundle_root / "mods" / MOD_JAR_NAME,
        bundle_root / "mod" / "build" / "libs" / MOD_JAR_NAME,
        bundle_root.parent / "mod" / "build" / "libs" / MOD_JAR_NAME,
    ]
    libs = bundle_root.parent / "mod" / "build" / "libs"
    if libs.exists():
        for jar in sorted(libs.glob("mcabyzum-login*.jar"), reverse=True):
            if "sources" in jar.name or "slim" in jar.name:
                continue
            return jar
    for c in candidates:
        if c.exists():
            return c
    # Also accept versioned jars next to staged name
    staged_dir = bundle_root / "mods"
    if staged_dir.exists():
        for jar in sorted(staged_dir.glob("mcabyzum-login*.jar"), reverse=True):
            return jar
    return None


def write_mod_config(mc_dir: Path, server: dict, auto_join: bool = True) -> None:
    cfg_dir = mc_dir / "config"
    cfg_dir.mkdir(parents=True, exist_ok=True)
    data = {
        "host": server["host"],
        "port": int(server["port"]),
        "name": server.get("name", "Abyzum Server"),
        "autoJoin": auto_join,
    }
    (cfg_dir / "mcabyzum.json").write_text(json.dumps(data, indent=2), encoding="utf-8")


def ensure_forge_and_mod(
    mc_dir: Path,
    vanilla_version: str,
    bundle_root: Path,
    server: dict,
    status: StatusFn | None = None,
    callback: dict | None = None,
    java: str | None = None,
) -> str:
    """
    Install Forge, drop Abyzum mod, return launch version id (e.g. 1.19.2-forge-43.3.0).
    """
    mc = str(mc_dir)
    forge_id = minecraft_launcher_lib.forge.find_forge_version(vanilla_version) or FORGE_VERSION
    if status:
        status(f"Instalando Forge {forge_id}…")

    minecraft_launcher_lib.forge.install_forge_version(
        forge_id, mc, callback=callback, java=java
    )

    launch_version = minecraft_launcher_lib.forge.forge_to_installed_version(forge_id)

    mods_dir = mc_dir / "mods"
    mods_dir.mkdir(parents=True, exist_ok=True)

    # Solo quitar loaders ajenos (Fabric/Quilt). Los mods del panel se gestionan en manifest_sync.
    for jar in list(mods_dir.glob("*.jar")):
        name = jar.name.lower()
        if name.startswith("mcabyzum-login"):
            continue
        if "fabric" in name or "quilt" in name:
            try:
                jar.unlink()
                if status:
                    status(f"Quitando loader conflictivo: {jar.name}")
            except OSError:
                pass

    # Drop fabric-loader version folders later via inspector; here just ensure mod present
    mod_src = find_bundled_mod(bundle_root)
    dest_mod = mods_dir / MOD_JAR_NAME
    if mod_src and mod_src.exists():
        if status:
            status("Instalando interfaz Abyzum (Forge)…")
        shutil.copy2(mod_src, dest_mod)
    elif not dest_mod.exists():
        raise FileNotFoundError(
            "Falta mcabyzum-login.jar (Forge). Compila el mod en /mod (gradlew build)."
        )

    write_mod_config(mc_dir, server, auto_join=True)
    if status:
        status(f"Cliente Forge listo: {launch_version}")
    return launch_version
