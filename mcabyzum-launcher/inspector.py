"""
MCABYZUM error inspector + auto-repair for the locked Horizons 1.20.1 client.
"""
from __future__ import annotations

import hashlib
import json
import os
import shutil
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable


StatusFn = Callable[[str], None]


@dataclass
class Issue:
    code: str
    severity: str  # info | warn | error
    message: str
    fixable: bool = True
    path: str | None = None


@dataclass
class InspectReport:
    ok: bool
    issues: list[Issue] = field(default_factory=list)
    removed: list[str] = field(default_factory=list)
    fixed: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "issues": [issue.__dict__ for issue in self.issues],
            "removed": self.removed,
            "fixed": self.fixed,
        }


LOCKED_CLIENT_VERSION = "1.20.1"


def _major_minor(version: str) -> str:
    parts = version.strip().split(".")
    if len(parts) >= 2:
        return f"{parts[0]}.{parts[1]}"
    return version.strip()


def _dir_size_mb(path: Path) -> float:
    total = 0
    if not path.exists():
        return 0.0
    for root, _, files in os.walk(path):
        for name in files:
            try:
                total += (Path(root) / name).stat().st_size
            except OSError:
                continue
    return total / (1024 * 1024)


def _free_disk_mb(path: Path) -> float:
    usage = shutil.disk_usage(path if path.exists() else path.parent)
    return usage.free / (1024 * 1024)


def _safe_rmtree(path: Path) -> bool:
    if not path.exists():
        return False
    for attempt in range(3):
        try:
            if path.is_file():
                path.unlink(missing_ok=True)
            else:
                shutil.rmtree(path, ignore_errors=False)
            return True
        except OSError:
            time.sleep(0.35 * (attempt + 1))
            try:
                shutil.rmtree(path, ignore_errors=True)
                return not path.exists()
            except OSError:
                continue
    return not path.exists()


def _sha1_file(path: Path) -> str | None:
    try:
        h = hashlib.sha1()
        with path.open("rb") as f:
            while True:
                chunk = f.read(1024 * 1024)
                if not chunk:
                    break
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


class GameInspector:
    def __init__(self, mc_dir: Path, target_version: str = LOCKED_CLIENT_VERSION):
        self.mc_dir = Path(mc_dir)
        self.target_version = target_version.strip()
        self.major_minor = _major_minor(self.target_version)
        self.versions_dir = self.mc_dir / "versions"
        self.libraries_dir = self.mc_dir / "libraries"
        self.assets_dir = self.mc_dir / "assets"
        self.runtime_dir = self.mc_dir / "runtime"

    def _is_allowed_version(self, name: str) -> bool:
        if name == self.target_version:
            return True
        lower = name.lower()
        forge_prefix = f"{self.target_version.lower()}-forge-"
        if lower.startswith(forge_prefix):
            return True
        if lower.startswith("fabric-loader-") and name.endswith(f"-{self.target_version}"):
            return True
        return False

    def _is_wrong_version(self, name: str) -> bool:
        if self._is_allowed_version(name):
            return False
        lower = name.lower()
        if lower.startswith("1.19") or "forge" in lower:
            return True
        if lower.startswith("fabric-loader-") and not name.endswith(f"-{self.target_version}"):
            return True
        if lower and lower[0].isdigit() and not lower.startswith(self.major_minor):
            return True
        return False

    def inspect(self) -> InspectReport:
        report = InspectReport(ok=True)
        self.mc_dir.mkdir(parents=True, exist_ok=True)

        free = _free_disk_mb(self.mc_dir)
        if free < 1500:
            report.ok = False
            report.issues.append(
                Issue(
                    "low_disk",
                    "error",
                    f"Poco espacio libre ({free:.0f} MB). Se necesitan ~1.5 GB.",
                    fixable=False,
                )
            )

        # Conflicting / extra versions
        if self.versions_dir.exists():
            for entry in sorted(self.versions_dir.iterdir()):
                if not entry.is_dir():
                    continue
                name = entry.name
                if self._is_allowed_version(name):
                    continue
                severity = "error" if self._is_wrong_version(name) else "warn"
                message = (
                    f"Versión incorrecta detectada ({name}) — se quitará e instalará {self.target_version}."
                    if self._is_wrong_version(name)
                    else f"Versión conflictiva detectada: {name}"
                )
                report.ok = False
                report.issues.append(
                    Issue(
                        "foreign_version",
                        severity,
                        message,
                        fixable=True,
                        path=str(entry),
                    )
                )

        target_dir = self.versions_dir / self.target_version
        jar = target_dir / f"{self.target_version}.jar"
        meta = target_dir / f"{self.target_version}.json"

        if not target_dir.exists():
            report.ok = False
            report.issues.append(
                Issue("missing_version", "error", f"Falta Minecraft {self.target_version}.", True)
            )
        else:
            if not jar.exists() or jar.stat().st_size < 1_000_000:
                report.ok = False
                report.issues.append(
                    Issue(
                        "corrupt_jar",
                        "error",
                        f"JAR de {self.target_version} incompleto o corrupto.",
                        True,
                        str(jar),
                    )
                )
            if not meta.exists():
                report.ok = False
                report.issues.append(
                    Issue(
                        "missing_json",
                        "error",
                        f"Falta el JSON de versión {self.target_version}.",
                        True,
                        str(meta),
                    )
                )
            else:
                try:
                    data = json.loads(meta.read_text(encoding="utf-8"))
                    if data.get("id") != self.target_version:
                        report.ok = False
                        report.issues.append(
                            Issue(
                                "bad_json_id",
                                "error",
                                f"El JSON de versión no coincide con {self.target_version}.",
                                True,
                                str(meta),
                            )
                        )
                    # Optional sha1 if present in downloads.client
                    client = (data.get("downloads") or {}).get("client") or {}
                    expected = client.get("sha1")
                    if expected and jar.exists():
                        actual = _sha1_file(jar)
                        if actual and actual.lower() != str(expected).lower():
                            report.ok = False
                            report.issues.append(
                                Issue(
                                    "jar_hash_mismatch",
                                    "error",
                                    "Hash SHA1 del cliente no coincide (archivo dañado).",
                                    True,
                                    str(jar),
                                )
                            )
                except (json.JSONDecodeError, OSError):
                    report.ok = False
                    report.issues.append(
                        Issue(
                            "corrupt_json",
                            "error",
                            "JSON de versión ilegible.",
                            True,
                            str(meta),
                        )
                    )

        # Lock / temp junk that blocks installs
        for junk_name in ("launcher_profiles.json.lock", ".install_lock", "tmp"):
            junk = self.mc_dir / junk_name
            if junk_name == "tmp" and junk.exists() and junk.is_dir():
                report.issues.append(
                    Issue("tmp_dir", "info", "Carpeta temporal residual.", True, str(junk))
                )
            elif junk.exists() and junk.is_file():
                report.issues.append(
                    Issue("lock_file", "warn", f"Lock residual: {junk_name}", True, str(junk))
                )

        # Crash leftovers
        for pattern in ("hs_err_pid*.log", "replay_pid*.log"):
            for crash in self.mc_dir.glob(pattern):
                report.issues.append(
                    Issue("crash_log", "info", f"Log de crash: {crash.name}", True, str(crash))
                )

        crash_reports = self.mc_dir / "crash-reports"
        if crash_reports.exists():
            recent = sorted(crash_reports.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True)[:5]
            for crash in recent:
                report.issues.append(
                    Issue("crash_report", "warn", f"Crash report: {crash.name}", True, str(crash))
                )

        # Empty / broken libraries folder after partial install
        if self.libraries_dir.exists():
            lib_count = sum(1 for _ in self.libraries_dir.rglob("*.jar"))
            if jar.exists() and lib_count < 20:
                report.ok = False
                report.issues.append(
                    Issue(
                        "incomplete_libs",
                        "error",
                        "Librerías incompletas (instalación a medias).",
                        True,
                        str(self.libraries_dir),
                    )
                )

        # natives folder under version
        natives = target_dir / "natives"
        if jar.exists() and natives.exists():
            dlls = list(natives.glob("*"))
            if not dlls:
                report.ok = False
                report.issues.append(
                    Issue("empty_natives", "error", "Natives vacíos.", True, str(natives))
                )

        if any(i.severity == "error" for i in report.issues):
            report.ok = False
        return report

    def purge_foreign_versions(self, status: StatusFn | None = None) -> list[str]:
        removed: list[str] = []
        if not self.versions_dir.exists():
            return removed
        for entry in list(self.versions_dir.iterdir()):
            if not entry.is_dir():
                continue
            if self._is_allowed_version(entry.name):
                continue
            if status:
                status(f"Eliminando versión conflictiva: {entry.name}")
            if _safe_rmtree(entry):
                removed.append(entry.name)
        return removed

    def purge_broken_target(self, status: StatusFn | None = None) -> bool:
        target = self.versions_dir / self.target_version
        if not target.exists():
            return False
        if status:
            status(f"Reinstalando {self.target_version} (borrando copia dañada)…")
        return _safe_rmtree(target)

    def clean_locks_and_junk(self, status: StatusFn | None = None) -> list[str]:
        cleaned: list[str] = []
        for junk_name in ("launcher_profiles.json.lock", ".install_lock"):
            junk = self.mc_dir / junk_name
            if junk.exists() and junk.is_file():
                try:
                    junk.unlink()
                    cleaned.append(junk_name)
                except OSError:
                    pass
        tmp = self.mc_dir / "tmp"
        if tmp.exists():
            if status:
                status("Limpiando temporales…")
            if _safe_rmtree(tmp):
                cleaned.append("tmp")
        for crash in self.mc_dir.glob("hs_err_pid*.log"):
            try:
                crash.unlink()
                cleaned.append(crash.name)
            except OSError:
                pass
        return cleaned

    def repair(
        self,
        status: StatusFn | None = None,
        reinstall_version: Callable[[], None] | None = None,
        reinstall_java: Callable[[], None] | None = None,
    ) -> InspectReport:
        """Inspect, purge conflicts/corruption, then optionally reinstall via callbacks."""
        if status:
            status("Inspeccionando instalación…")
        before = self.inspect()
        report = InspectReport(ok=True, issues=list(before.issues))

        report.removed.extend(self.purge_foreign_versions(status))
        report.fixed.extend(self.clean_locks_and_junk(status))

        removed_wrong = any(
            self._is_wrong_version(name) for name in report.removed
        )

        needs_reinstall = removed_wrong or any(
            i.code
            in {
                "missing_version",
                "corrupt_jar",
                "missing_json",
                "bad_json_id",
                "jar_hash_mismatch",
                "corrupt_json",
                "incomplete_libs",
                "empty_natives",
            }
            for i in before.issues
        )

        if needs_reinstall:
            self.purge_broken_target(status)
            # incomplete libs: wipe libraries to force clean fetch
            if any(i.code == "incomplete_libs" for i in before.issues):
                if status:
                    status("Limpiando librerías incompletas…")
                if _safe_rmtree(self.libraries_dir):
                    report.fixed.append("libraries")
            if reinstall_version:
                if status:
                    status(f"Reparando descarga de Minecraft {self.target_version}…")
                reinstall_version()
                report.fixed.append(f"reinstall:{self.target_version}")
            if reinstall_java:
                if status:
                    status("Reparando Java del launcher…")
                reinstall_java()
                report.fixed.append("reinstall:java")

        after = self.inspect()
        # Keep only unresolved issues
        report.issues = after.issues
        report.ok = after.ok and not any(i.severity == "error" for i in after.issues)
        if status:
            if report.ok:
                status("Inspección OK — listo para entrar.")
            else:
                status("Quedan problemas: " + "; ".join(i.message for i in report.issues if i.severity == "error"))
        return report

    def is_ready(self) -> bool:
        report = self.inspect()
        # Ready if target exists and no hard errors (foreign versions are cleaned on repair)
        hard = [i for i in report.issues if i.severity == "error"]
        jar = self.versions_dir / self.target_version / f"{self.target_version}.jar"
        return jar.exists() and not hard
