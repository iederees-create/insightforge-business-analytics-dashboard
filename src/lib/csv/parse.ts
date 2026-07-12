import Papa from "papaparse";
import type { RawRow } from "../../types/domain";

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB cap, per Part 19 DoS guard
export const MAX_ROWS = 250_000;

export interface ParseResult {
  headers: string[];
  rows: RawRow[];
  truncated: boolean;
  errors: string[];
}

export class FileTooLargeError extends Error {
  constructor(sizeBytes: number) {
    super(
      `File is ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB, which exceeds the ${
        MAX_FILE_SIZE_BYTES / (1024 * 1024)
      } MB limit for local browser processing.`,
    );
    this.name = "FileTooLargeError";
  }
}

function detectDelimiter(fileName: string): string | undefined {
  if (fileName.toLowerCase().endsWith(".tsv")) return "\t";
  return undefined; // let Papa Parse auto-detect for .csv
}

/**
 * Parses a CSV/TSV File entirely client-side. Never uploads the file.
 * Supports cancellation via AbortSignal and streams via a worker to keep the UI responsive.
 */
export function parseDelimitedFile(
  file: File,
  options: { signal?: AbortSignal } = {},
): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Promise.reject(new FileTooLargeError(file.size));
  }

  return new Promise((resolve, reject) => {
    const rows: RawRow[] = [];
    const errors: string[] = [];
    let headers: string[] = [];
    let truncated = false;
    let cancelled = false;
    let activeParser: Papa.Parser | undefined;

    const onAbort = () => {
      cancelled = true;
      activeParser?.abort();
    };
    options.signal?.addEventListener("abort", onAbort);

    Papa.parse<RawRow>(file, {
      header: true,
      skipEmptyLines: "greedy",
      delimiter: detectDelimiter(file.name),
      worker: true,
      chunk: (results, chunkParser) => {
        activeParser = chunkParser;
        if (!headers.length) headers = results.meta.fields ?? [];
        for (const row of results.data) {
          if (rows.length >= MAX_ROWS) {
            truncated = true;
            chunkParser.abort();
            break;
          }
          rows.push(row);
        }
        for (const err of results.errors) {
          errors.push(`Row ${err.row ?? "?"}: ${err.message}`);
        }
      },
      complete: () => {
        options.signal?.removeEventListener("abort", onAbort);
        if (cancelled) {
          reject(new DOMException("Import cancelled by user.", "AbortError"));
          return;
        }
        resolve({ headers, rows, truncated, errors: errors.slice(0, 50) });
      },
      error: (err) => {
        options.signal?.removeEventListener("abort", onAbort);
        reject(err);
      },
    });
  });
}

/** Parses JSON array-of-objects input (optional secondary format per Part 5). */
export async function parseJsonFile(file: File): Promise<ParseResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(file.size);
  }
  const text = await file.text();
  const data = JSON.parse(text);
  if (!Array.isArray(data)) {
    throw new Error("JSON file must contain an array of row objects.");
  }
  const rows: RawRow[] = data.slice(0, MAX_ROWS).map((row) => {
    const out: RawRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = value === null || value === undefined ? "" : String(value);
    }
    return out;
  });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  return { headers, rows, truncated: data.length > MAX_ROWS, errors: [] };
}
