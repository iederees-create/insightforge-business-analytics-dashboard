import { useCallback, useEffect, useState } from "react";
import { useDatasetStore } from "../store/datasetStore";

export type ThemeName = "midnight" | "light" | "emerald";

const THEMES: ThemeName[] = ["midnight", "light", "emerald"];
const THEME_STORAGE_KEY = "insightforge:theme-preference";

/**
 * Mirrors the consent-gated persistence pattern already used by useDatasetStore for the
 * column-mapping preference (see src/store/datasetStore.ts): only ever write to
 * localStorage when the buyer has opted in via storageConsent, wrap every access in
 * try/catch since storage can fail (quota, private mode), and let the app keep working
 * without it either way. datasetStore itself has no theme field, so this hook applies
 * the same guarded read/write logic locally rather than persisting unconditionally.
 */
function readPersistedTheme(): ThemeName | null {
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return raw && THEMES.includes(raw as ThemeName) ? (raw as ThemeName) : null;
  } catch {
    return null;
  }
}

function prefersDarkScheme(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function useThemePreference(): { theme: ThemeName; setTheme: (theme: ThemeName) => void; cycleTheme: () => void } {
  const storageConsent = useDatasetStore((state) => state.storageConsent);
  const [theme, setThemeState] = useState<ThemeName>(() => readPersistedTheme() ?? (prefersDarkScheme() ? "midnight" : "light"));

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const setTheme = useCallback(
    (next: ThemeName) => {
      setThemeState(next);
      if (storageConsent) {
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, next);
        } catch {
          // Storage can fail (quota, private mode) — the app must keep working without it.
        }
      }
    },
    [storageConsent],
  );

  const cycleTheme = useCallback(() => {
    const nextIndex = (THEMES.indexOf(theme) + 1) % THEMES.length;
    setTheme(THEMES[nextIndex]);
  }, [theme, setTheme]);

  return { theme, setTheme, cycleTheme };
}

export { THEMES };
