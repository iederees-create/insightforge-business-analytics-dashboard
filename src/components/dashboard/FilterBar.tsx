import { useMemo } from "react";
import type { DatasetFilters, MappedRow } from "../../types/domain";

export interface FilterBarProps {
  rows: MappedRow[];
  filters: Partial<DatasetFilters>;
  onChange: (filters: Partial<DatasetFilters>) => void;
  showComparison: boolean;
}

function uniqueValues(rows: MappedRow[], field: "category" | "product" | "channel" | "region"): string[] {
  return [...new Set(rows.map((r) => r[field]).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
}

function toDateInputValue(date: Date | undefined): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function MultiSelect({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (values: string[]) => void }) {
  if (options.length === 0) return null;
  return (
    <div>
      <label className="text-xs font-medium text-text-muted" htmlFor={`filter-${label}`}>
        {label}
      </label>
      <select
        id={`filter-${label}`}
        multiple
        value={selected}
        onChange={(event) => onChange(Array.from(event.target.selectedOptions, (o) => o.value))}
        className="mt-1 block h-24 w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Date range, comparison-period, and category/product/channel/region filters, feeding filterRows(). */
export function FilterBar({ rows, filters, onChange, showComparison }: FilterBarProps) {
  const categories = useMemo(() => uniqueValues(rows, "category"), [rows]);
  const products = useMemo(() => uniqueValues(rows, "product"), [rows]);
  const channels = useMemo(() => uniqueValues(rows, "channel"), [rows]);
  const regions = useMemo(() => uniqueValues(rows, "region"), [rows]);

  const setDateRangeField = (key: "start" | "end", value: string) => {
    const current = filters.dateRange ?? { start: new Date(0), end: new Date() };
    const date = value ? new Date(value) : current[key];
    onChange({ ...filters, dateRange: { ...current, [key]: date } });
  };

  const setComparisonField = (key: "start" | "end", value: string) => {
    const current = filters.comparisonRange ?? { start: new Date(0), end: new Date() };
    const date = value ? new Date(value) : current[key];
    onChange({ ...filters, comparisonRange: { ...current, [key]: date } });
  };

  return (
    <fieldset className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-4">
      <legend className="col-span-full mb-1 text-sm font-semibold text-text">Filters</legend>

      <div>
        <label className="text-xs font-medium text-text-muted" htmlFor="filter-date-start">
          Date from
        </label>
        <input
          id="filter-date-start"
          type="date"
          value={toDateInputValue(filters.dateRange?.start)}
          onChange={(event) => setDateRangeField("start", event.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-text-muted" htmlFor="filter-date-end">
          Date to
        </label>
        <input
          id="filter-date-end"
          type="date"
          value={toDateInputValue(filters.dateRange?.end)}
          onChange={(event) => setDateRangeField("end", event.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
        />
      </div>

      {showComparison && (
        <>
          <div>
            <label className="text-xs font-medium text-text-muted" htmlFor="filter-compare-start">
              Compare from
            </label>
            <input
              id="filter-compare-start"
              type="date"
              value={toDateInputValue(filters.comparisonRange?.start)}
              onChange={(event) => setComparisonField("start", event.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-muted" htmlFor="filter-compare-end">
              Compare to
            </label>
            <input
              id="filter-compare-end"
              type="date"
              value={toDateInputValue(filters.comparisonRange?.end)}
              onChange={(event) => setComparisonField("end", event.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-surface px-2 py-1 text-sm text-text"
            />
          </div>
        </>
      )}

      <MultiSelect label="Category" options={categories} selected={filters.categories ?? []} onChange={(v) => onChange({ ...filters, categories: v })} />
      <MultiSelect label="Product" options={products} selected={filters.products ?? []} onChange={(v) => onChange({ ...filters, products: v })} />
      <MultiSelect label="Channel" options={channels} selected={filters.channels ?? []} onChange={(v) => onChange({ ...filters, channels: v })} />
      <MultiSelect label="Region" options={regions} selected={filters.regions ?? []} onChange={(v) => onChange({ ...filters, regions: v })} />

      <div className="col-span-full">
        <button
          type="button"
          onClick={() => onChange({})}
          className="text-xs font-medium text-accent underline decoration-dotted underline-offset-2 hover:no-underline"
        >
          Clear all filters
        </button>
      </div>
    </fieldset>
  );
}
