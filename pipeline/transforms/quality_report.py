"""Task 7: generate_quality_report - the data-quality summary + success marker.

Mirrors the shape of QualityIssue/QualityReport in src/types/domain.ts
(severity vocabulary: critical/high/medium/low) so the report is a genuine
Python-side counterpart to the dashboard's own Data Quality Lab, not an
arbitrary new format. Fans in from every upstream task so it can summarise
the whole run. Writes both a machine-readable JSON and a human-readable
Markdown rendering, plus the `_SUCCESS` marker used to signal a complete,
trustworthy run for this logical date.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from transforms.io_utils import atomic_write_json, atomic_write_text
from transforms.logging_utils import get_logger

logger = get_logger("quality_report")

SEVERITY_WEIGHT = {"critical": 25, "high": 12, "medium": 5, "low": 1}


def _issue(issue_id: str, title: str, severity: str, count: int, suggestion: str) -> dict | None:
    if count <= 0:
        return None
    return {"id": issue_id, "title": title, "severity": severity, "count": count, "suggestion": suggestion}


def _build_issues(validation: dict, clean_result: dict, join_result: dict) -> list[dict]:
    issues: list[dict] = []
    for dataset, file_validation in validation["perFile"].items():
        for column, count in file_validation["missingValueCounts"].items():
            issues.append(
                _issue(
                    f"missing-{dataset}-{column}",
                    f"Missing values in {dataset}.{column}",
                    "high" if column in ("revenue", "orderId", "date", "rating") else "medium",
                    count,
                    f"Rows with a blank {column} in {dataset}.csv are excluded from calculations that depend on it.",
                )
            )
        for column, count in file_validation["typeViolations"].items():
            issues.append(
                _issue(
                    f"type-violation-{dataset}-{column}",
                    f"Unparseable {column} values in {dataset}.{column}",
                    "medium",
                    count,
                    f"These {column} values in {dataset}.csv could not be parsed and are treated as missing, not zero.",
                )
            )

    for dataset, removed in clean_result["rowsRemoved"].items():
        issues.append(
            _issue(
                f"dedup-{dataset}",
                f"Exact duplicate rows removed from {dataset}.csv",
                "medium",
                removed,
                "Exact duplicate rows were detected and removed automatically during cleaning.",
            )
        )

    dedupe_report = json.loads(Path(clean_result["dedupeReportPath"]).read_text(encoding="utf-8"))
    for dataset, order_ids in dedupe_report.get("duplicateOrderIds", {}).items():
        issues.append(
            _issue(
                f"duplicate-order-ids-{dataset}",
                f"Duplicate order IDs with differing row content in {dataset}.csv",
                "high",
                len(order_ids),
                "Flagged for manual review, not auto-removed - may be legitimate multi-line orders. See 02_dedupe_report.json for the affected order IDs.",
            )
        )

    issues.append(
        _issue(
            "unmatched-customers",
            "Sales rows referencing a customer not present in customers.csv",
            "medium",
            join_result["unmatchedCustomerRows"],
            "These sales rows still appear in the joined dataset but have no matching customer profile - verify customers.csv is complete.",
        )
    )

    return [i for i in issues if i is not None]


def _score(total_rows: int, issues: list[dict]) -> int:
    if total_rows == 0:
        return 100
    penalty = 0.0
    for issue in issues:
        weight = SEVERITY_WEIGHT[issue["severity"]]
        share_of_rows = issue["count"] / total_rows
        weighted = weight * share_of_rows * 10
        penalty += min(weighted, weight)
    return max(0, round(100 - penalty))


@dataclass(frozen=True)
class QualityReportResult:
    logical_date: str
    output_dir: str
    report_json_path: str
    report_markdown_path: str
    overall_score: int
    success_marker_path: str

    def to_xcom_dict(self) -> dict:
        return {
            "logicalDate": self.logical_date,
            "outputDir": self.output_dir,
            "reportJsonPath": self.report_json_path,
            "reportMarkdownPath": self.report_markdown_path,
            "overallScore": self.overall_score,
            "successMarkerPath": self.success_marker_path,
        }


def generate_quality_report_impl(
    validation: dict,
    clean_result: dict,
    join_result: dict,
    metrics_result: dict,
    export_result: dict,
) -> QualityReportResult:
    out_dir = Path(validation["outputDir"])
    total_rows = sum(f["rowCount"] for f in validation["perFile"].values())

    issues = _build_issues(validation, clean_result, join_result)
    score = _score(total_rows, issues)
    issues_sorted = sorted(issues, key=lambda i: (SEVERITY_WEIGHT[i["severity"]], i["count"]), reverse=True)

    report = {
        "logicalDate": validation["logicalDate"],
        "score": score,
        "totalRowsAcrossInputs": total_rows,
        "rowsAfterCleaning": {ds: v["rowCount"] for ds, v in validation["perFile"].items()},
        "joinedRowCount": join_result["rowCount"],
        "dashboardExportRowCount": export_result["rowCount"],
        "kpiSummary": metrics_result["kpiSummary"],
        "issues": issues_sorted,
    }

    report_json_path = out_dir / "06_quality_report.json"
    atomic_write_json(report_json_path, report)

    lines = [
        f"# InsightForge Pipeline - Data Quality Report",
        f"",
        f"**Logical date:** {validation['logicalDate']}  ",
        f"**Overall quality score:** {score}/100  ",
        f"**Total input rows:** {total_rows}  ",
        f"**Joined dataset rows:** {join_result['rowCount']}  ",
        f"**Dashboard export rows:** {export_result['rowCount']}  ",
        f"",
        f"## KPI summary",
        f"",
        f"- Revenue: {metrics_result['kpiSummary']['revenue']}",
        f"- Orders: {metrics_result['kpiSummary']['orders']}",
        f"- Profit margin: {metrics_result['kpiSummary']['profitMargin']}",
        f"- Unique customers: {metrics_result['kpiSummary']['uniqueCustomers']}",
        f"- Top product: {metrics_result['kpiSummary']['topProduct']}",
        f"",
        f"## Data quality issues ({len(issues_sorted)})",
        f"",
    ]
    if issues_sorted:
        lines.append("| Severity | Issue | Count | Suggestion |")
        lines.append("|---|---|---|---|")
        for issue in issues_sorted:
            lines.append(f"| {issue['severity']} | {issue['title']} | {issue['count']} | {issue['suggestion']} |")
    else:
        lines.append("No issues detected.")
    report_markdown_path = out_dir / "06_quality_report.md"
    atomic_write_text(report_markdown_path, "\n".join(lines) + "\n")

    success_marker_path = out_dir / "_SUCCESS"
    atomic_write_text(success_marker_path, f"insightforge_etl completed successfully for logical date {validation['logicalDate']}\n")

    result = QualityReportResult(
        logical_date=validation["logicalDate"],
        output_dir=str(out_dir),
        report_json_path=str(report_json_path),
        report_markdown_path=str(report_markdown_path),
        overall_score=score,
        success_marker_path=str(success_marker_path),
    )
    logger.info("Quality report generated: score=%d, %d issue(s)", score, len(issues_sorted))
    return result
