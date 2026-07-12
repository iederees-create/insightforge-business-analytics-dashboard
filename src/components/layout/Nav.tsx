import { useDatasetStore } from "../../store/datasetStore";
import { NAV_SECTIONS, stageMeetsRequirement } from "./navSections";
import type { NavSectionId } from "./navSections";

export interface NavProps {
  activeSection: NavSectionId;
  onSelect: (section: NavSectionId) => void;
  orientation?: "vertical" | "horizontal";
}

/** Primary section navigation. Sections the current import stage hasn't unlocked yet are visibly disabled, not hidden. */
export function Nav({ activeSection, onSelect, orientation = "vertical" }: NavProps) {
  const stage = useDatasetStore((state) => state.stage);

  return (
    <nav aria-label="Dashboard sections">
      <ul className={orientation === "vertical" ? "flex flex-col gap-1" : "flex flex-wrap gap-1"}>
        {NAV_SECTIONS.map((section) => {
          const unlocked = stageMeetsRequirement(stage, section.requiresStage);
          const isActive = section.id === activeSection;
          return (
            <li key={section.id}>
              <button
                type="button"
                disabled={!unlocked}
                aria-current={isActive ? "page" : undefined}
                title={unlocked ? undefined : "Import and map a data file first"}
                onClick={() => unlocked && onSelect(section.id)}
                className={`w-full rounded-md px-3 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  isActive ? "bg-accent text-white" : "text-text hover:bg-surface"
                }`}
              >
                {section.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
