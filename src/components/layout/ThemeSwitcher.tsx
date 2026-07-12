import { useThemePreference } from "../../hooks/useThemePreference";
import type { ThemeName } from "../../hooks/useThemePreference";

const THEME_LABELS: Record<ThemeName, string> = {
  midnight: "Midnight Intelligence",
  light: "Light Executive",
  emerald: "Emerald Operations",
};

/** Cycles through the three themes on click; persistence is consent-gated inside useThemePreference. */
export function ThemeSwitcher() {
  const { theme, cycleTheme } = useThemePreference();

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-bg"
      aria-label={`Current theme: ${THEME_LABELS[theme]}. Activate to switch to the next theme.`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.36-6.36l-.7.7M6.34 17.66l-.7.7m12.02 0l-.7-.7M6.34 6.34l-.7-.7M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
      {THEME_LABELS[theme]}
    </button>
  );
}
