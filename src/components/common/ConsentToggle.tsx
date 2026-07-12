import { useId } from "react";
import { useDatasetStore } from "../../store/datasetStore";

/**
 * Explicit opt-in checkbox for local persistence (Part 5/19). Nothing is written to
 * localStorage anywhere in the app until this is checked — see storageConsent in
 * useDatasetStore and the same pattern followed by useThemePreference.
 */
export function ConsentToggle() {
  const storageConsent = useDatasetStore((state) => state.storageConsent);
  const setStorageConsent = useDatasetStore((state) => state.setStorageConsent);
  const inputId = useId();

  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-surface p-3">
      <input
        id={inputId}
        type="checkbox"
        checked={storageConsent}
        onChange={(event) => setStorageConsent(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--color-accent)]"
      />
      <label htmlFor={inputId} className="text-sm text-text">
        <span className="font-medium">Remember my column mapping and theme on this device.</span>
        <br />
        <span className="text-text-muted">
          Your data file itself is never uploaded or stored — everything runs in this browser tab. Checking this box only
          saves your column-mapping choices and theme preference to this browser's local storage, so you don't have to
          re-map next time. Uncheck it (or use "Delete all data") to remove anything saved.
        </span>
      </label>
    </div>
  );
}
