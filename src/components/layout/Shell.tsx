import type { ReactNode } from "react";
import { Nav } from "./Nav";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { DeleteAllDataButton } from "../common/DeleteAllDataButton";
import { useDatasetStore } from "../../store/datasetStore";
import type { NavSectionId } from "./navSections";

export interface ShellProps {
  activeSection: NavSectionId;
  onSelectSection: (section: NavSectionId) => void;
  onStartTour: () => void;
  children: ReactNode;
}

/** App frame: skip link, header with theme/data controls, section nav, and the main content region. */
export function Shell({ activeSection, onSelectSection, onStartTour, children }: ShellProps) {
  const fileName = useDatasetStore((state) => state.fileName);

  return (
    <div className="min-h-screen bg-bg text-text">
      <a
        href="#main-content"
        className="sr-only-focusable fixed left-2 top-2 z-50 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white"
      >
        Skip to content
      </a>

      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">InsightForge</p>
          <h1 className="text-lg font-semibold text-text">Business Analytics Studio</h1>
          {fileName && <p className="text-xs text-text-muted">Analyzing: {fileName}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onStartTour}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium text-text hover:bg-bg"
          >
            Guided tour
          </button>
          <ThemeSwitcher />
          {fileName && <DeleteAllDataButton />}
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:px-6">
        <aside className="shrink-0 sm:w-56" aria-label="Section navigation">
          <div data-tour="nav">
            <Nav activeSection={activeSection} onSelect={onSelectSection} />
          </div>
        </aside>
        <main id="main-content" className="min-w-0 flex-1 pb-16">
          {children}
        </main>
      </div>

      <p className="border-t border-border bg-surface px-4 py-3 text-center text-xs text-text-muted">
        All processing happens locally in this browser tab. Your file is never uploaded to a server.
      </p>
    </div>
  );
}
