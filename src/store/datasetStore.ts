import { create } from "zustand";
import type { ColumnMapping, MappedRow, RawRow } from "../types/domain";
import { applyMapping } from "../lib/csv/mapping";

export type ImportStage = "idle" | "preview" | "mapping" | "quality" | "ready";

interface DatasetState {
  stage: ImportStage;
  fileName: string | null;
  headers: string[];
  rawRows: RawRow[];
  mapping: ColumnMapping;
  mappedRows: MappedRow[];
  /** Explicit consent gate — nothing is written to localStorage until this is true (Part 5/19). */
  storageConsent: boolean;

  setImportedFile: (fileName: string, headers: string[], rawRows: RawRow[]) => void;
  setMapping: (mapping: ColumnMapping) => void;
  confirmMapping: () => void;
  advanceToReady: () => void;
  setStorageConsent: (consent: boolean) => void;
  clearAllData: () => void;
}

const STORAGE_KEY = "insightforge:mapping-preference";

function loadPersistedMapping(): ColumnMapping | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ColumnMapping) : null;
  } catch {
    return null;
  }
}

export const useDatasetStore = create<DatasetState>((set, get) => ({
  stage: "idle",
  fileName: null,
  headers: [],
  rawRows: [],
  mapping: {},
  mappedRows: [],
  storageConsent: false,

  setImportedFile: (fileName, headers, rawRows) => {
    set({ fileName, headers, rawRows, stage: "preview" });
  },

  setMapping: (mapping) => {
    set({ mapping });
    if (get().storageConsent) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mapping));
      } catch {
        // Storage can fail (quota, private mode) — the app must keep working without it.
      }
    }
  },

  confirmMapping: () => {
    const { rawRows, mapping } = get();
    set({ mappedRows: applyMapping(rawRows, mapping), stage: "quality" });
  },

  advanceToReady: () => set({ stage: "ready" }),

  setStorageConsent: (consent) => {
    set({ storageConsent: consent });
    if (!consent) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  },

  /** "Delete All Data" action required by Part 19 — clears in-memory state and any persisted preference. */
  clearAllData: () => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({
      stage: "idle",
      fileName: null,
      headers: [],
      rawRows: [],
      mapping: {},
      mappedRows: [],
    });
  },
}));

export function getPersistedMappingPreference(): ColumnMapping | null {
  return loadPersistedMapping();
}
