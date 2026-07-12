import { useMemo, useState } from "react";
import { computeKpis } from "../../lib/metrics/kpis";
import { runQualityChecks } from "../../lib/quality/checks";
import { buildQualityReport } from "../../lib/quality/score";
import { computeSegmentation } from "../../lib/metrics/segmentation";
import { buildTimeSeries } from "../../lib/metrics/trends";
import { forecastSeries } from "../../lib/metrics/forecast";
import { buildDataStory } from "../../lib/metrics/story";
import { analyzeSentiment } from "../../lib/metrics/sentiment";
import { computeGeoInsights } from "../../lib/metrics/geo";
import { useDatasetStore } from "../../store/datasetStore";
import { Button } from "../common/Button";
import { buildReportHtml } from "./buildReportHtml";
import type { ReportSections } from "./buildReportHtml";

const SECTION_LABELS: { key: keyof ReportSections; label: string }[] = [
  { key: "kpis", label: "KPI summary" },
  { key: "charts", label: "Charts (top categories/products)" },
  { key: "tables", label: "Ranking tables" },
  { key: "qualityFindings", label: "Data quality findings" },
  { key: "insights", label: "Data story insights" },
  { key: "segments", label: "Customer segments (aggregate only)" },
  { key: "forecast", label: "Forecast" },
  { key: "scenario", label: "Scenario planning note" },
  { key: "notes", label: "Your notes" },
];

const DEFAULT_SECTIONS: ReportSections = {
  kpis: true,
  charts: true,
  tables: true,
  qualityFindings: true,
  insights: true,
  segments: true,
  forecast: true,
  scenario: false,
  notes: false,
};

/** Report Builder: assembles a print-friendly, self-contained HTML report in a new tab. No raw customer rows are ever included. */
export function ReportBuilderView() {
  const fileName = useDatasetStore((state) => state.fileName);
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const [sections, setSections] = useState<ReportSections>(DEFAULT_SECTIONS);
  const [notesText, setNotesText] = useState("");

  const reportData = useMemo(() => {
    const kpis = computeKpis(mappedRows, mapping);
    const quality = buildQualityReport(mappedRows, runQualityChecks(mappedRows, mapping));
    const segmentation = computeSegmentation(mappedRows);
    const revenueSeries = buildTimeSeries(mappedRows, "month", "revenue");
    const forecast = forecastSeries(revenueSeries, 6);
    const sentiment = analyzeSentiment(mappedRows);
    const geo = computeGeoInsights(mappedRows);
    const insights = buildDataStory({ kpis, revenueSeries, quality, segmentation, sentiment, geo });
    return { kpis, quality, segmentation, forecast, insights };
  }, [mappedRows, mapping]);

  const toggleSection = (key: keyof ReportSections) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleGenerate = () => {
    const html = buildReportHtml({
      fileName,
      mapping,
      mappedRows,
      sections,
      notesText,
      ...reportData,
    });
    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      window.alert("Your browser blocked the report window. Allow pop-ups for this site and try again.");
      return;
    }
    reportWindow.document.open();
    reportWindow.document.write(html);
    reportWindow.document.close();
  };

  return (
    <section aria-labelledby="report-heading" className="flex flex-col gap-5">
      <div>
        <h2 id="report-heading" className="text-xl font-semibold text-text">
          Report Builder
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose what to include, then generate a self-contained, print-friendly report in a new tab. Individual
          customer rows are never included — segments are shown as aggregate summaries only.
        </p>
      </div>

      <fieldset className="grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold text-text">Sections to include</legend>
        {SECTION_LABELS.map(({ key, label }) => (
          <label key={key} className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={sections[key]} onChange={() => toggleSection(key)} className="h-4 w-4 accent-[var(--color-accent)]" />
            {label}
          </label>
        ))}
      </fieldset>

      {sections.notes && (
        <div>
          <label htmlFor="report-notes" className="text-sm font-medium text-text">
            Your notes
          </label>
          <textarea
            id="report-notes"
            value={notesText}
            onChange={(event) => setNotesText(event.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
            placeholder="Add commentary to include in the generated report…"
          />
        </div>
      )}

      <div>
        <Button variant="primary" onClick={handleGenerate}>
          Generate report
        </Button>
        <p className="mt-2 text-xs text-text-muted">
          Opens in a new tab with a "Print / Save as PDF" button. The report includes the generation date, your data's
          date range, and a methodology/limitations/privacy note.
        </p>
      </div>
    </section>
  );
}
