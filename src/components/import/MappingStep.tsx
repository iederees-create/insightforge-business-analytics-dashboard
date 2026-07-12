import { useMemo, useState } from "react";
import { COLUMN_ROLES, COLUMN_ROLE_LABELS } from "../../types/domain";
import type { ColumnMapping, ColumnRole } from "../../types/domain";
import { autoDetectMapping, hasMinimumViableMapping } from "../../lib/csv/mapping";
import { IMPORT_TEMPLATES } from "../../lib/csv/templates";
import { useDatasetStore, getPersistedMappingPreference } from "../../store/datasetStore";
import { Button } from "../common/Button";
import { ConsentToggle } from "../common/ConsentToggle";

const NONE_VALUE = "__none__";

/** Step 3: maps source headers to canonical column roles, with template presets and an explicit storage-consent checkbox. */
export function MappingStep() {
  const headers = useDatasetStore((state) => state.headers);
  const storeMapping = useDatasetStore((state) => state.mapping);

  const [draftMapping, setDraftMapping] = useState<ColumnMapping>(() => {
    if (Object.keys(storeMapping).length > 0) return storeMapping;
    return getPersistedMappingPreference() ?? autoDetectMapping(headers);
  });
  const [templateId, setTemplateId] = useState<string>("");

  const isViable = useMemo(() => hasMinimumViableMapping(draftMapping), [draftMapping]);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const template = IMPORT_TEMPLATES.find((t) => t.id === id);
    if (template) setDraftMapping(template.mapping);
  };

  const updateRole = (role: ColumnRole, header: string) => {
    setDraftMapping((prev) => {
      const next = { ...prev };
      if (header === NONE_VALUE) {
        delete next[role];
      } else {
        next[role] = header;
      }
      return next;
    });
  };

  const usedHeaders = new Set(Object.values(draftMapping));

  const handleConfirm = () => {
    useDatasetStore.getState().setMapping(draftMapping);
    useDatasetStore.getState().confirmMapping();
  };

  return (
    <section aria-labelledby="mapping-step-heading" className="max-w-3xl">
      <h2 id="mapping-step-heading" className="text-xl font-semibold text-text">
        Map your columns
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        Tell InsightForge which of your columns hold which kind of data. A Date and Revenue column unlock most of the
        dashboard; every other column is optional and simply unlocks more metrics when mapped.
      </p>

      <div className="mt-4">
        <label htmlFor="template-select" className="text-sm font-medium text-text">
          Start from a template (optional)
        </label>
        <select
          id="template-select"
          value={templateId}
          onChange={(event) => applyTemplate(event.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
        >
          <option value="">Choose a template…</option>
          {IMPORT_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {templateId && (
          <p className="mt-1 text-xs text-text-muted">{IMPORT_TEMPLATES.find((t) => t.id === templateId)?.description}</p>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {COLUMN_ROLES.map((role) => {
          const selectId = `mapping-${role}`;
          const currentValue = draftMapping[role] ?? NONE_VALUE;
          return (
            <div key={role}>
              <label htmlFor={selectId} className="text-sm font-medium text-text">
                {COLUMN_ROLE_LABELS[role]}
                {(role === "date" || role === "revenue") && <span className="text-accent"> *</span>}
              </label>
              <select
                id={selectId}
                value={currentValue}
                onChange={(event) => updateRole(role, event.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
              >
                <option value={NONE_VALUE}>None</option>
                {headers.map((header) => (
                  <option key={header} value={header} disabled={usedHeaders.has(header) && draftMapping[role] !== header}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-text-muted">* Date and Revenue are needed for the core dashboard; other fields are optional.</p>

      <div className="mt-5">
        <ConsentToggle />
      </div>

      {!isViable && (
        <p role="status" className="mt-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
          Map at least Date and Revenue to unlock the main dashboard. You can still continue with a partial mapping —
          unavailable metrics will explain what to map to unlock them.
        </p>
      )}

      <div className="mt-5 flex justify-between">
        <Button variant="secondary" onClick={() => useDatasetStore.setState({ stage: "preview" })}>
          Back
        </Button>
        <Button variant="primary" onClick={handleConfirm}>
          Confirm mapping
        </Button>
      </div>
    </section>
  );
}
