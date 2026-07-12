/** Shared value types for the chart primitives in this directory. */

export interface CategoryDatum {
  label: string;
  value: number;
}

export interface SeriesPoint {
  x: Date | string | number;
  y: number | null;
}

export interface Series {
  id: string;
  name: string;
  points: SeriesPoint[];
  /** When set, renders a shaded band (e.g. forecast uncertainty) around this series. */
  band?: { lower: number; upper: number }[];
}

/** The six categorical fill/pattern classes registered in src/styles/globals.css. */
export const CHART_COLOR_CLASSES = [
  "chart-color-1",
  "chart-color-2",
  "chart-color-3",
  "chart-color-4",
  "chart-color-5",
  "chart-color-6",
] as const;

/** Distinct SVG dash patterns so line series never rely on color alone. */
export const LINE_DASH_PATTERNS = ["none", "6,4", "2,3", "10,3,2,3", "1,4", "8,2,2,2"] as const;

/** Distinct point-marker shapes, paired 1:1 with LINE_DASH_PATTERNS. */
export type MarkerShape = "circle" | "square" | "triangle" | "diamond" | "cross" | "star";
export const MARKER_SHAPES: MarkerShape[] = ["circle", "square", "triangle", "diamond", "cross", "star"];

export function colorClassFor(index: number): string {
  return CHART_COLOR_CLASSES[index % CHART_COLOR_CLASSES.length];
}
