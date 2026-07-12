import { useMemo, useState } from "react";
import { buildDataStory } from "../../lib/metrics/story";
import { computeKpis } from "../../lib/metrics/kpis";
import { buildTimeSeries } from "../../lib/metrics/trends";
import { runQualityChecks } from "../../lib/quality/checks";
import { buildQualityReport } from "../../lib/quality/score";
import { computeSegmentation } from "../../lib/metrics/segmentation";
import { analyzeSentiment } from "../../lib/metrics/sentiment";
import { computeGeoInsights } from "../../lib/metrics/geo";
import { useDatasetStore } from "../../store/datasetStore";
import { EmptyState } from "../common/EmptyState";

function EvidenceList({ evidence }: { evidence: string[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="text-xs font-medium text-accent underline decoration-dotted underline-offset-2 hover:no-underline"
      >
        {expanded ? "Hide evidence" : "Show evidence"}
      </button>
      {expanded && (
        <ul className="mt-2 list-disc pl-5 text-xs text-text-muted">
          {evidence.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Deterministic Data Story Engine view: every card here is derived directly from already-computed metrics, with verifiable evidence. */
export function DataStoryView() {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);

  const insights = useMemo(() => {
    const kpis = computeKpis(mappedRows, mapping);
    const revenueSeries = buildTimeSeries(mappedRows, "month", "revenue");
    const quality = buildQualityReport(mappedRows, runQualityChecks(mappedRows, mapping));
    const segmentation = computeSegmentation(mappedRows);
    const sentiment = analyzeSentiment(mappedRows);
    const geo = computeGeoInsights(mappedRows);
    return buildDataStory({ kpis, revenueSeries, quality, segmentation, sentiment, geo });
  }, [mappedRows, mapping]);

  if (insights.length === 0) {
    return <EmptyState title="No story insights yet" description="Map more columns or import more data — the Data Story Engine generates insights once there is enough signal to say something concrete." />;
  }

  return (
    <section aria-labelledby="story-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="story-heading" className="text-xl font-semibold text-text">
          Data Story
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          Every sentence below is generated directly from the same metrics shown elsewhere in the dashboard — nothing
          is inferred or invented. Expand "Show evidence" on any card to see the exact figures behind it.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {insights.map((insight) => (
          <li key={insight.id} className="rounded-lg border border-border bg-surface p-4">
            <h3 className="text-base font-semibold text-text">{insight.headline}</h3>
            <p className="mt-1 text-sm text-text-muted">{insight.detail}</p>
            <EvidenceList evidence={insight.evidence} />
          </li>
        ))}
      </ul>
    </section>
  );
}
