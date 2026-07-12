import type { ImportStage } from "../../store/datasetStore";

export type NavSectionId =
  | "import"
  | "quality"
  | "dashboard"
  | "segmentation"
  | "products"
  | "geo"
  | "sentiment"
  | "trends"
  | "story"
  | "scenario"
  | "report";

export interface NavSectionDef {
  id: NavSectionId;
  label: string;
  /** Minimum dataset stage required before this section is reachable. */
  requiresStage: ImportStage;
}

const STAGE_ORDER: ImportStage[] = ["idle", "preview", "mapping", "quality", "ready"];

export function stageMeetsRequirement(currentStage: ImportStage, requiredStage: ImportStage): boolean {
  return STAGE_ORDER.indexOf(currentStage) >= STAGE_ORDER.indexOf(requiredStage);
}

export const NAV_SECTIONS: NavSectionDef[] = [
  { id: "import", label: "Import", requiresStage: "idle" },
  { id: "quality", label: "Data Quality", requiresStage: "quality" },
  { id: "dashboard", label: "Dashboard", requiresStage: "ready" },
  { id: "segmentation", label: "Segmentation", requiresStage: "ready" },
  { id: "products", label: "Products", requiresStage: "ready" },
  { id: "geo", label: "Geographic", requiresStage: "ready" },
  { id: "sentiment", label: "Sentiment", requiresStage: "ready" },
  { id: "trends", label: "Trends & Forecast", requiresStage: "ready" },
  { id: "story", label: "Data Story", requiresStage: "ready" },
  { id: "scenario", label: "Scenario Planner", requiresStage: "ready" },
  { id: "report", label: "Report Builder", requiresStage: "ready" },
];
