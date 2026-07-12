import { useMemo, useState } from "react";
import { runQualityChecks } from "../../lib/quality/checks";
import { applyCleaning, buildQualityReport, DEFAULT_CLEANING_OPTIONS } from "../../lib/quality/score";
import type { CleaningOptions } from "../../lib/quality/score";
import type { IssueSeverity, MappedRow } from "../../types/domain";
import { COLUMN_ROLE_LABELS } from "../../types/domain";
import { downloadCsv } from "../../lib/csv/security";
import { useDatasetStore } from "../../store/datasetStore";
import { Button } from "../common/Button";
import { Table } from "../common/Table";
import type { TableColumn } from "../common/Table";
import type { NavSectionId } from "../layout/navSections";

export interface QualityLabProps {
  onNavigate: (section: NavSectionId) => void;
}

const SEVERITY_ORDER: IssueSeverity[] = ["critical", "high", "medium", "low"];
const SEVERITY_LABELS: Record<IssueSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const SEVERITY_CLASSES: Record<IssueSeverity, string> = {
  critical: "border-danger text-danger",
  high: "border-danger text-danger",
  medium: "border-warning text-warning",
  low: "border-border text-text-muted",
};

const CLEANING_DESCRIPTIONS: Record<keyof CleaningOptions, string> = {
  trimWhitespace: "Trims leading/trailing/repeated spaces in text fields (product, category, customer name, channel, region, country, review text). Never changes the meaning of a value.",
  removeExactDuplicates: "Removes rows that are exact duplicates of another row across every mapped field — likely re-exports or double-counted orders.",
  dropMissingDates: "Removes rows with a missing or unparseable date. Only enable this if date-based charts should exclude undated rows entirely rather than just noting them as missing.",
  dropMissingRevenue: "Removes rows with no revenue figure. Only enable this if you want totals to exclude rows that can't contribute a dollar amount.",
  dropNegativeRevenue: "Removes rows with negative revenue (often refunds). Enable this to see gross sales without refund offsets.",
  dropNegativeQuantity: "Removes rows with negative quantity (often returns). Enable this to see units sold without return offsets.",
};

function toCsvValue(row: MappedRow, field: keyof MappedRow): string | number | null {
  const value = row[field];
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

/** Data Quality Lab: surfaces every automated check, explains cleaning options in plain language, never mutates the original rows. */
export function QualityLab({ onNavigate }: QualityLabProps) {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [cleaningOptions, setCleaningOptions] = useState<CleaningOptions>(DEFAULT_CLEANING_OPTIONS);

  const issues = useMemo(() => runQualityChecks(mappedRows, mapping), [mappedRows, mapping]);
  const report = useMemo(() => buildQualityReport(mappedRows, issues), [mappedRows, issues]);
  const cleaningResult = useMemo(() => applyCleaning(mappedRows, cleaningOptions), [mappedRows, cleaningOptions]);

  const mappedFields = (Object.keys(mapping) as (keyof MappedRow)[]).filter((role) => Boolean(mapping[role as never]));

  const handleDownload = () => {
    const headers = mappedFields.map((field) => COLUMN_ROLE_LABELS[field as never] ?? String(field));
    const rows = cleaningResult.cleanedRows.map((row) => mappedFields.map((field) => toCsvValue(row, field)));
    downloadCsv("insightforge-cleaned-data.csv", headers, rows);
  };

  const previewColumns: TableColumn<MappedRow>[] = mappedFields.slice(0, 6).map((field) => ({
    key: String(field),
    header: COLUMN_ROLE_LABELS[field as never] ?? String(field),
    render: (row) => {
      const value = toCsvValue(row, field);
      return value === null ? "—" : value;
    },
  }));

  return (
    <section aria-labelledby="quality-lab-heading" className="flex flex-col gap-6">
      <div>
        <h2 id="quality-lab-heading" className="text-xl font-semibold text-text">
          Data Quality Lab
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Automated checks run against your mapped data. Nothing here changes your original file — cleaning options
          below only affect what you choose to export or carry into the dashboard.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="text-3xl font-semibold text-text">{report.score}<span className="text-base text-text-muted">/100</span></div>
        <p className="text-sm text-text-muted">
          Quality score across {report.totalRows.toLocaleString()} row(s) and {report.issues.length} check(s) with findings.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold text-text">Issues found</h3>
        {report.issues.length === 0 && <p className="text-sm text-text-muted">No issues detected by the automated checks.</p>}
        {SEVERITY_ORDER.map((severity) => {
          const group = report.issues.filter((issue) => issue.severity === severity);
          if (group.length === 0) return null;
          return (
            <div key={severity}>
              <h4 className="text-sm font-semibold text-text">{SEVERITY_LABELS[severity]}</h4>
              <ul className="mt-1 flex flex-col gap-2">
                {group.map((issue) => (
                  <li key={issue.id} className={`rounded-md border-l-4 bg-surface px-3 py-2 text-sm ${SEVERITY_CLASSES[severity]}`}>
                    <p className="font-medium text-text">
                      {issue.title} — {issue.count.toLocaleString()} row(s)
                    </p>
                    <p className="mt-0.5 text-text-muted">{issue.suggestion}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div>
        <h3 className="text-base font-semibold text-text">Cleaning options</h3>
        <p className="mt-1 text-sm text-text-muted">Each option explains exactly what it will do before you apply it.</p>
        <ul className="mt-2 flex flex-col gap-2">
          {(Object.keys(cleaningOptions) as (keyof CleaningOptions)[]).map((key) => (
            <li key={key} className="flex items-start gap-2 rounded-md border border-border bg-surface p-3">
              <input
                id={`clean-${key}`}
                type="checkbox"
                checked={cleaningOptions[key]}
                onChange={(event) => setCleaningOptions((prev) => ({ ...prev, [key]: event.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
              />
              <label htmlFor={`clean-${key}`} className="text-sm text-text">
                {CLEANING_DESCRIPTIONS[key]}
              </label>
            </li>
          ))}
        </ul>
        {cleaningResult.appliedSteps.length > 0 && (
          <div className="mt-3 rounded-md border border-border bg-surface p-3 text-sm text-text-muted">
            <p className="font-medium text-text">What would happen if applied now:</p>
            <ul className="mt-1 list-disc pl-5">
              {cleaningResult.appliedSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
            <p className="mt-1">
              {cleaningResult.removedCount.toLocaleString()} of {mappedRows.length.toLocaleString()} row(s) would be removed;{" "}
              {cleaningResult.cleanedRows.length.toLocaleString()} would remain.
            </p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-text">Cleaned data preview</h3>
          <Button variant="secondary" onClick={handleDownload}>
            Download cleaned CSV
          </Button>
        </div>
        <div className="mt-2">
          <Table
            caption="Preview of cleaned data with current cleaning options applied"
            columns={previewColumns}
            rows={cleaningResult.cleanedRows.slice(0, 10)}
            getRowId={(row) => String(row.sourceIndex)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            useDatasetStore.getState().advanceToReady();
            onNavigate("dashboard");
          }}
        >
          Continue to dashboard
        </Button>
      </div>
    </section>
  );
}
