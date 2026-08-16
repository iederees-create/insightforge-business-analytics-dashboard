"""Renders a DAG-structure diagram from the ACTUAL parsed DAG object.

This machine is missing graphviz/`dot` and has no passwordless sudo, so
`airflow dags show --save dag.png` can't rasterize here (see
docs/TROUBLESHOOTING.md#graph-diagram-not-rendering). This script is the
documented fallback: it loads the real DAG via Airflow's DagBag, reads its
actual task_dict/downstream_task_ids, and lays the nodes out itself - so the
resulting image is generated from the live DAG's real structure, not
hand-drawn, even though it isn't a screenshot of the Airflow Graph UI.

Writes both a DOT file (openable with any Graphviz tool later) and a plain
inline-SVG rendering (openable directly in a browser, no dependencies).
"""

from __future__ import annotations

import sys
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PIPELINE_ROOT))

import os  # noqa: E402

os.environ.setdefault("AIRFLOW_HOME", str(PIPELINE_ROOT / ".airflow-home"))
os.environ.setdefault("AIRFLOW__CORE__DAGS_FOLDER", str(PIPELINE_ROOT / "dags"))
os.environ.setdefault("AIRFLOW__CORE__LOAD_EXAMPLES", "false")

from airflow.models import DagBag  # noqa: E402

OUT_DIR = PIPELINE_ROOT / "docs" / "media"


def load_edges() -> list[tuple[str, str]]:
    dagbag = DagBag(dag_folder=str(PIPELINE_ROOT / "dags"), include_examples=False)
    dag = dagbag.dags["insightforge_etl"]
    edges: list[tuple[str, str]] = []
    for task_id, task in dag.task_dict.items():
        for downstream_id in sorted(task.downstream_task_ids):
            edges.append((task_id, downstream_id))
    return edges


def write_dot(edges: list[tuple[str, str]]) -> Path:
    lines = ["digraph insightforge_etl {", '  rankdir="LR";', '  node [shape=box, style="rounded,filled", fillcolor="#eef2ff"];']
    for src, dst in edges:
        lines.append(f'  "{src}" -> "{dst}";')
    lines.append("}")
    dot_path = OUT_DIR / "dag_graph.dot"
    dot_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return dot_path


# Manual layout: main chain left-to-right, final fan-in task placed to the
# right at a distinct row so its five incoming edges are legible.
LAYOUT = {
    "discover_inputs": (0, 1),
    "validate_schema": (1, 1),
    "clean_and_deduplicate": (2, 1),
    "join_datasets": (3, 1),
    "calculate_metrics": (4, 1),
    "export_dashboard_data": (5, 1),
    "generate_quality_report": (6, 1),
}

NODE_W, NODE_H = 168, 56
COL_GAP, ROW_GAP = 210, 140


def write_svg(edges: list[tuple[str, str]]) -> Path:
    max_col = max(c for c, _r in LAYOUT.values())
    width = (max_col + 1) * COL_GAP + 40
    height = 2 * ROW_GAP

    def center(node: str) -> tuple[int, int]:
        col, row = LAYOUT[node]
        x = 40 + col * COL_GAP + NODE_W / 2
        y = row * ROW_GAP
        return int(x), int(y)

    parts: list[str] = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'font-family="system-ui, sans-serif" font-size="12">',
        '<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">'
        '<path d="M0,0 L8,4 L0,8 Z" fill="#4338ca"/></marker></defs>',
        '<rect width="100%" height="100%" fill="#ffffff"/>',
    ]

    for src, dst in edges:
        x1, y1 = center(src)
        x2, y2 = center(dst)
        # Route from the right edge of src box to the left edge of dst box.
        x1_edge = x1 + NODE_W / 2
        x2_edge = x2 - NODE_W / 2
        parts.append(
            f'<line x1="{x1_edge}" y1="{y1}" x2="{x2_edge}" y2="{y2}" '
            f'stroke="#4338ca" stroke-width="1.5" marker-end="url(#arrow)"/>'
        )

    for node, (col, row) in LAYOUT.items():
        x, y = center(node)
        rx, ry = x - NODE_W / 2, y - NODE_H / 2
        parts.append(f'<rect x="{rx}" y="{ry}" width="{NODE_W}" height="{NODE_H}" rx="8" ' f'fill="#eef2ff" stroke="#4338ca" stroke-width="1.5"/>')
        label = node.replace("_", " ")
        parts.append(f'<text x="{x}" y="{y}" text-anchor="middle" dominant-baseline="middle" fill="#1e1b4b">{label}</text>')

    parts.append(
        f'<text x="20" y="{height - 15}" fill="#6b7280" font-size="10">'
        f"Generated from the live DAG's actual task_dict/downstream_task_ids via Airflow's DagBag - "
        f"not a hand-drawn mockup, not an Airflow Graph-view UI screenshot.</text>"
    )
    parts.append("</svg>")

    svg_path = OUT_DIR / "dag_graph.svg"
    svg_path.write_text("\n".join(parts), encoding="utf-8")
    return svg_path


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    edges = load_edges()
    dot_path = write_dot(edges)
    svg_path = write_svg(edges)
    print(f"Wrote {dot_path}")
    print(f"Wrote {svg_path}")


if __name__ == "__main__":
    main()
