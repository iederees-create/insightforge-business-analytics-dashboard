import { useEffect, useRef, useState } from "react";
import type { NavSectionId } from "../layout/navSections";

export interface TourStep {
  title: string;
  description: string;
  section: NavSectionId;
}

const TOUR_STEPS: TourStep[] = [
  { title: "1. Upload", description: "Start by dragging in a CSV, TSV, or JSON file, or choosing one from disk. Everything is parsed in this browser tab — nothing is uploaded to a server.", section: "import" },
  { title: "2. Mapping", description: "Tell InsightForge which of your columns are the date, revenue, product, and so on. A template can pre-fill common export formats.", section: "import" },
  { title: "3. Data Quality", description: "Review automated data-quality checks and optionally clean the data before analyzing it — nothing is changed without your say-so.", section: "quality" },
  { title: "4. Dashboard", description: "See KPIs, filters, and top performers. Metrics your mapping can't compute say so explicitly instead of showing a misleading zero.", section: "dashboard" },
  { title: "5. Segmentation", description: "Explore RFM-style customer segments with adjustable thresholds — a heuristic lens, not an objective classification.", section: "segmentation" },
  { title: "6. Sentiment", description: "See estimated review sentiment over time and by rating. This is an automated estimate, not a scientific measurement.", section: "sentiment" },
  { title: "7. Forecast", description: "View a transparent trend forecast with an honest, widening uncertainty band and anomaly detection on the historical trend.", section: "trends" },
  { title: "8. Scenario Planner", description: "Run what-if math on your own assumptions — this is calculated arithmetic, not a prediction model.", section: "scenario" },
  { title: "9. Report", description: "Assemble a print-friendly report with only the sections you choose, with no raw customer rows included by default.", section: "report" },
];

export interface GuidedTourProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (section: NavSectionId) => void;
}

/** Lightweight, dependency-free step-by-step tour. Keyboard: arrow keys advance/retreat, Escape closes. */
export function GuidedTour({ open, onClose, onNavigate }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  useEffect(() => {
    if (open) onNavigate(TOUR_STEPS[stepIndex].section);
  }, [open, stepIndex, onNavigate]);

  useEffect(() => {
    if (!open) return undefined;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowRight") {
        setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1));
      } else if (event.key === "ArrowLeft") {
        setStepIndex((i) => Math.max(i - 1, 0));
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        className="w-full max-w-md rounded-lg border border-accent bg-surface p-4 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-text-muted">
              Guided tour — step {stepIndex + 1} of {TOUR_STEPS.length}
            </p>
            <h2 id="tour-title" className="text-base font-semibold text-text">
              {step.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close guided tour" className="rounded-md p-1 text-text-muted hover:bg-bg">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-text-muted">{step.description}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setStepIndex((i) => Math.max(i - 1, 0))}
            disabled={stepIndex === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (isLast ? onClose() : setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1)))}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white"
          >
            {isLast ? "Done" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
