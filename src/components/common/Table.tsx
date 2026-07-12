import { useMemo, useState } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => string | number;
  sortValue?: (row: T) => string | number;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  caption: string;
  getRowId: (row: T) => string;
  emptyMessage?: string;
}

type SortDirection = "asc" | "desc";

/** Sortable, accessible data table used both for raw data views and as a chart-independent tabular presentation. */
export function Table<T>({ columns, rows, caption, getRowId, emptyMessage = "No rows to display." }: TableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((c) => c.key === sortKey);
    if (!column) return rows;
    const valueOf = column.sortValue ?? column.render;
    const sorted = [...rows].sort((a, b) => {
      const av = valueOf(a);
      const bv = valueOf(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    return sortDirection === "asc" ? sorted : sorted.reverse();
  }, [rows, sortKey, sortDirection, columns]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  if (rows.length === 0) {
    return <p className="text-sm text-text-muted">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;
              return (
                <th key={column.key} scope="col" className="border-b border-border px-3 py-2 font-semibold text-text-muted">
                  <button
                    type="button"
                    onClick={() => toggleSort(column.key)}
                    className="flex items-center gap-1 hover:text-text"
                    aria-label={`Sort by ${column.header}${isSorted ? `, currently sorted ${sortDirection}ending` : ""}`}
                  >
                    {column.header}
                    <span aria-hidden="true" className="text-[10px]">
                      {isSorted ? (sortDirection === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={getRowId(row)} className="hover:bg-bg">
              {columns.map((column) => (
                <td key={column.key} className="border-b border-border px-3 py-2 text-text">
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
