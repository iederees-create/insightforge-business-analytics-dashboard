import { useState } from "react";
import { Shell } from "./components/layout/Shell";
import { GuidedTour } from "./components/tour/GuidedTour";
import { UploadStep } from "./components/import/UploadStep";
import { PreviewStep } from "./components/import/PreviewStep";
import { MappingStep } from "./components/import/MappingStep";
import { ValidationStep } from "./components/import/ValidationStep";
import { QualityLab } from "./components/quality/QualityLab";
import { DashboardView } from "./components/dashboard/DashboardView";
import { SegmentationView } from "./components/segmentation/SegmentationView";
import { ProductAnalysisView } from "./components/products/ProductAnalysisView";
import { GeoView } from "./components/geo/GeoView";
import { SentimentView } from "./components/sentiment/SentimentView";
import { TrendsForecastView } from "./components/trends/TrendsForecastView";
import { DataStoryView } from "./components/story/DataStoryView";
import { ScenarioPlannerView } from "./components/scenario/ScenarioPlannerView";
import { ReportBuilderView } from "./components/report/ReportBuilderView";
import { Button } from "./components/common/Button";
import { useDatasetStore } from "./store/datasetStore";
import type { NavSectionId } from "./components/layout/navSections";

interface ImportSectionProps {
  onNavigate: (section: NavSectionId) => void;
}

function ImportSection({ onNavigate }: ImportSectionProps) {
  const stage = useDatasetStore((state) => state.stage);
  const fileName = useDatasetStore((state) => state.fileName);
  const mappedRows = useDatasetStore((state) => state.mappedRows);

  if (stage === "idle") return <UploadStep />;
  if (stage === "preview") return <PreviewStep />;
  if (stage === "mapping") return <MappingStep />;
  if (stage === "quality") return <ValidationStep onNavigate={onNavigate} />;

  return (
    <section className="max-w-xl">
      <h2 className="text-xl font-semibold text-text">Data ready</h2>
      <p className="mt-1 text-sm text-text-muted">
        {fileName} is imported and mapped ({mappedRows.length.toLocaleString()} row(s)). Use the navigation to explore
        the dashboard, or re-map columns if you'd like to change what's included.
      </p>
      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => useDatasetStore.setState({ stage: "mapping" })}>
          Re-map columns
        </Button>
        <Button variant="primary" onClick={() => onNavigate("dashboard")}>
          Go to dashboard
        </Button>
      </div>
    </section>
  );
}

/** Top-level router: switches between the import wizard and feature views based on dataset stage and the selected nav section. No external router — this is a single-page tool. */
function App() {
  const [activeSection, setActiveSection] = useState<NavSectionId>("import");
  const [tourOpen, setTourOpen] = useState(false);

  const renderSection = () => {
    switch (activeSection) {
      case "import":
        return <ImportSection onNavigate={setActiveSection} />;
      case "quality":
        return <QualityLab onNavigate={setActiveSection} />;
      case "dashboard":
        return <DashboardView />;
      case "segmentation":
        return <SegmentationView />;
      case "products":
        return <ProductAnalysisView />;
      case "geo":
        return <GeoView />;
      case "sentiment":
        return <SentimentView />;
      case "trends":
        return <TrendsForecastView />;
      case "story":
        return <DataStoryView />;
      case "scenario":
        return <ScenarioPlannerView />;
      case "report":
        return <ReportBuilderView />;
      default:
        return null;
    }
  };

  return (
    <Shell activeSection={activeSection} onSelectSection={setActiveSection} onStartTour={() => setTourOpen(true)}>
      {renderSection()}
      <GuidedTour open={tourOpen} onClose={() => setTourOpen(false)} onNavigate={setActiveSection} />
    </Shell>
  );
}

export default App;
