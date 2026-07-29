"""
Install Fabric loader for MCABYZUM game dir.
"""
from __future__ import annotations

from pathlib import Path
from typing import Callable

import minecraft_launcher_lib

StatusFn = Callable[[str], None]


def ensure_fabric(
    mc_dir: Path,
    vanilla_version: str,
    fabric_loader_version: str | None = None,
    status: StatusFn | None = None,
    callback: dict | None = None,
    java: str | None = None,
) -> str:
    mc = str(mc_dir)
    loader_version = fabric_loader_version or minecraft_launcher_lib.fabric.get_latest_loader_version()
    if status:
        status(f"Instalando Fabric {loader_version}…")

    minecraft_launcher_lib.fabric.install_fabric(
        vanilla_version,
        mc,
        loader_version=loader_version,
        callback=callback,
        java=java,
    )

    launch_version = f"fabric-loader-{loader_version}-{vanilla_version}"
    if not (mc_dir / "versions" / launch_version).exists():
        matches = sorted(
            [
                entry.name
                for entry in (mc_dir / "versions").iterdir()
                if entry.is_dir() and entry.name.startswith(f"fabric-loader-") and vanilla_version in entry.name
            ],
            reverse=True,
        )
        if matches:
            return matches[0]

    return launch_version
