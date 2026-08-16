"""Task 1: discover_inputs - locates and fingerprints the raw input CSVs.

Kept deliberately dumb: it only checks presence, counts data rows (skipping
the '#'-prefixed synthetic-data disclaimer lines), and records a checksum.
Real schema/content validation happens in validate.py.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from transforms.io_utils import atomic_write_json, sha256_of_file
from transforms.logging_utils import InputDiscoveryError, get_logger
from transforms.schema import REQUIRED_INPUT_FILES

logger = get_logger("discover")


@dataclass(frozen=True)
class FileManifestEntry:
    path: str
    rows: int
    sha256: str


@dataclass(frozen=True)
class DiscoverResult:
    logical_date: str
    output_dir: str
    files: dict[str, FileManifestEntry]

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "files": {
                name: {"path": e.path, "rows": e.rows, "sha256": e.sha256}
                for name, e in self.files.items()
            },
        }


def _count_data_rows(path: Path) -> int:
    count = 0
    header_seen = False
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                continue
            if not header_seen:
                header_seen = True
                continue
            if line.strip():
                count += 1
    return count


def discover_inputs_impl(input_dir: str | Path, output_dir: str | Path, logical_date: str) -> DiscoverResult:
    input_path = Path(input_dir)
    out_dir = Path(output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    files: dict[str, FileManifestEntry] = {}
    missing: list[str] = []
    for filename in REQUIRED_INPUT_FILES:
        file_path = input_path / filename
        if not file_path.exists():
            missing.append(filename)
            continue
        dataset = filename.removesuffix(".csv")
        files[dataset] = FileManifestEntry(
            path=str(file_path),
            rows=_count_data_rows(file_path),
            sha256=sha256_of_file(file_path),
        )

    if missing:
        raise InputDiscoveryError(
            f"discover_inputs failed: missing required input file(s) {missing} under "
            f"{input_path}. Expected sales.csv, customers.csv and reviews.csv - see "
            f"docs/TROUBLESHOOTING.md#missing-input-files."
        )

    result = DiscoverResult(logical_date=logical_date, output_dir=str(out_dir), files=files)
    atomic_write_json(out_dir / "00_manifest.json", result.to_xcom_dict())
    logger.info("Discovered %d input file(s) under %s", len(files), input_path)
    return result
