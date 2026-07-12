import { hasMinimumViableMapping } from "../../lib/csv/mapping";
import { COLUMN_ROLE_LABELS } from "../../types/domain";
import { useDatasetStore } from "../../store/datasetStore";
import { Button } from "../common/Button";
import type { NavSectionId } from "../layout/navSections";

export interface ValidationStepProps {
  onNavigate: (section: NavSectionId) => void;
}

/**
 * Step 4: reports whether the mapping is minimally viable (Date + Revenue) and, if not,
 * explains exactly what is missing. Per the product brief this never blocks entry into
 * the dashboard — a partial mapping is allowed, it just means some KPIs are unavailable.
 */
export function ValidationStep({ onNavigate }: ValidationStepProps) {
  const mapping = useDatasetStore((state) => state.mapping);
  const mappedRows = useDatasetStore((state) => state.mappedRows);
  const isViable = hasMinimumViableMapping(mapping);
  const mappedRoleCount = Object.keys(mapping).length;

  const goToDashboard = () => {
    useDatasetStore.getState().advanceToReady();
    onNavigate("dashboard");
  };

  const goToQualityLab = () => {
    onNavigate("quality");
  };

  return (
    <section aria-labelledby="validation-step-heading" className="max-w-2xl">
      <h2 id="validation-step-heading" className="text-xl font-semibold text-text">
        Mapping check
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {mappedRows.length.toLocaleString()} row(s) mapped, {mappedRoleCount} column role(s) assigned.
      </p>

      {isViable ? (
        <p role="status" className="mt-4 rounded-md border border-success bg-success/10 px-3 py-3 text-sm text-success">
          Date and Revenue are both mapped, so the core dashboard, trends, and forecast are available. Map more columns
          any time from the Import section to unlock additional metrics (profit, segmentation, geography, sentiment).
        </p>
      ) : (
        <div role="status" className="mt-4 rounded-md border border-warning bg-warning/10 px-3 py-3 text-sm text-warning">
          <p className="font-medium">
            {COLUMN_ROLE_LABELS.date} and/or {COLUMN_ROLE_LABELS.revenue} were not mapped.
          </p>
          <p className="mt-1">
            You can still continue — the app works with a partial mapping. Metrics that need a missing column will say
            so explicitly instead of showing a misleading zero. Go back to mapping any time to add more columns.
          </p>
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={() => useDatasetStore.setState({ stage: "mapping" })}>
          Back to mapping
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={goToQualityLab}>
            Review data quality first
          </Button>
          <Button variant="primary" onClick={goToDashboard}>
            Continue to dashboard
          </Button>
        </div>
      </div>
    </section>
  );
}
