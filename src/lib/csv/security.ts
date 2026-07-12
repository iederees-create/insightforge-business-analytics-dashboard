/**
 * Security helpers for CSV/report handling (Part 19).
 * - neutralizeFormulaInjection: guards against CSV formula injection on export
 *   (a value like `=cmd|'/C calc'!A1` executing when the file is opened in Excel/Sheets).
 * - escapeForDisplay: defence-in-depth even though React escapes by default; used when
 *   composing raw HTML strings for printable reports.
 */

const FORMULA_TRIGGER_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"]);

export function neutralizeFormulaInjection(value: string): string {
  if (!value) return value;
  const first = value[0];
  if (FORMULA_TRIGGER_CHARS.has(first)) {
    return `'${value}`;
  }
  return value;
}

/** Escapes a value for safe inclusion in a CSV cell (RFC 4180 quoting + formula guard). */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = neutralizeFormulaInjection(String(value));
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function rowsToCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return lines.join("\r\n");
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/** Escapes text for safe inclusion in generated HTML reports. Never render raw user text via innerHTML without this. */
export function escapeForDisplay(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

export function downloadCsv(fileName: string, headers: string[], rows: (string | number | null | undefined)[][]): void {
  const csv = rowsToCsv(headers, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}
