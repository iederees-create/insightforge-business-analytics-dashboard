from __future__ import annotations

from pathlib import Path

import pytest

PIPELINE_ROOT = Path(__file__).resolve().parent.parent


@pytest.fixture
def write_csv(tmp_path):
    """Writes a small CSV fixture file and returns its path. Usage:
    write_csv("sales.csv", "date,orderId,revenue\\n2026-01-01,ORD-1,10\\n")
    """

    def _write(filename: str, content: str) -> Path:
        path = tmp_path / filename
        path.write_text(content, encoding="utf-8")
        return path

    return _write


@pytest.fixture
def sample_data_dir() -> Path:
    return PIPELINE_ROOT / "sample_data"
