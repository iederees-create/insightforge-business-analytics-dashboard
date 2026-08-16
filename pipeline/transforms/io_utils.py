"""Path and atomic-write helpers shared by every pipeline stage.

Idempotency depends on two rules enforced here: every output path is
deterministic (keyed only by logical date, never by wall-clock time or a
random run id), and every write is atomic (write to a temp file, then
os.replace into place) so a rerun for the same logical date always fully
replaces the same file rather than partially overwriting or appending to it.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

PIPELINE_ROOT = Path(__file__).resolve().parent.parent


def output_dir_for(logical_date: str, base_dir: Path | str | None = None) -> Path:
    base = Path(base_dir) if base_dir else PIPELINE_ROOT / "output"
    out = base / logical_date
    out.mkdir(parents=True, exist_ok=True)
    return out


def atomic_write_text(path: Path | str, content: str) -> None:
    path = Path(path)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def atomic_write_json(path: Path | str, data: Any) -> None:
    atomic_write_text(path, json.dumps(data, indent=2, default=str))


def sha256_of_file(path: Path | str) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()
