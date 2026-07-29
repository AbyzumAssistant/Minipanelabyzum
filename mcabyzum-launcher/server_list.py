"""
Write Minecraft servers.dat (gzip NBT) so the client joins the panel server, not a stale entry.
"""
from __future__ import annotations

import gzip
import struct
from io import BytesIO
from pathlib import Path


def _write_string(buf: BytesIO, value: str) -> None:
    encoded = value.encode("utf-8")
    buf.write(struct.pack(">H", len(encoded)))
    buf.write(encoded)


def _write_named_string(buf: BytesIO, tag_name: str, value: str) -> None:
    buf.write(b"\x08")
    _write_string(buf, tag_name)
    _write_string(buf, value)


def _write_named_byte(buf: BytesIO, tag_name: str, value: int) -> None:
    buf.write(b"\x01")
    _write_string(buf, tag_name)
    buf.write(struct.pack("b", value))


def _server_address(server: dict) -> str:
    host = str(server.get("host") or "").strip()
    port = int(server.get("port") or 25565)
    return f"{host}:{port}"


def servers_dat_matches(mc_dir: Path, server: dict) -> bool:
    """Return True when servers.dat already points at the configured server."""
    path = mc_dir / "servers.dat"
    if not path.is_file():
        return False
    try:
        with gzip.open(path, "rb") as handle:
            payload = handle.read()
    except OSError:
        return False
    target = _server_address(server).encode("utf-8")
    return target in payload


def write_servers_dat(mc_dir: Path, server: dict) -> None:
    """Replace servers.dat with a single server entry for MCABYZUM."""
    name = str(server.get("name") or "mcabyzum")
    ip = _server_address(server)

    buf = BytesIO()
    buf.write(b"\x0a")  # TAG_Compound (root)
    buf.write(b"\x00\x00")  # empty root name

    buf.write(b"\x09")  # TAG_List
    _write_string(buf, "servers")
    buf.write(b"\x0a")  # list of compounds
    buf.write(struct.pack(">i", 1))

    _write_named_string(buf, "name", name)
    _write_named_string(buf, "ip", ip)
    _write_named_byte(buf, "acceptTextures", 1)
    _write_named_byte(buf, "hidden", 0)
    buf.write(b"\x00")  # end list entry

    buf.write(b"\x00")  # end root compound

    path = mc_dir / "servers.dat"
    path.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(path, "wb") as handle:
        handle.write(buf.getvalue())


def write_server_lock(mc_dir: Path, server: dict) -> None:
    import json

    lock = {
        "forced": True,
        "servers": [
            {
                "name": server.get("name", "mcabyzum"),
                "ip": _server_address(server),
            }
        ],
    }
    (mc_dir / "mcabyzum-server.json").write_text(
        json.dumps(lock, indent=2), encoding="utf-8"
    )
