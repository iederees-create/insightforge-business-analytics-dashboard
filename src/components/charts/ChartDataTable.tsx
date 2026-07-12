import { useId, useState } from "react";

export interface ChartDataTableProps {
  /** Column headers, first one is typically the category/date axis. */
  headers: string[];
  rows: (string | number)[][];
  /** Caption describing what the table contains, read by screen readers. */
  caption: string;
}

/**
 * Accessible tabular fallback rendered alongside every chart (Part 19: "data-table
 * alternatives"). The table itself is always in the DOM for screen readers; sighted
 * users can toggle it open via the disclosure button instead of it always taking
 * visual space.
 */
export function ChartDataTable({ headers, rows, caption }: ChartDataTableProps) {
  const [expanded, setExpanded] = useState(false);
  const tableId = useId();

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-controls={tableId}
        className="text-xs font-medium text-accent underline decoration-dotted underline-offset-2 hover:no-underline"
      >
        {expanded ? "Hide data table" : "Show data table"}
      </button>
      <div id={tableId} className={expanded ? "mt-2 overflow-x-auto" : "sr-only"}>
        <table className="w-full min-w-[24rem] border-collapse text-left text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="border-b border-border px-2 py-1 font-semibold text-text-muted">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  // eslint-disable-next-line react/no-array-index-key
                  <td key={cellIndex} className="border-b border-border px-2 py-1 text-text">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
