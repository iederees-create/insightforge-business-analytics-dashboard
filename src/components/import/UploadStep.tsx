import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { parseDelimitedFile, parseJsonFile, FileTooLargeError, MAX_FILE_SIZE_BYTES } from "../../lib/csv/parse";
import { useDatasetStore } from "../../store/datasetStore";
import { Button } from "../common/Button";

const MAX_FILE_SIZE_MB = MAX_FILE_SIZE_BYTES / (1024 * 1024);

/** Step 1 of the import wizard: drag/drop or file-picker upload, parsed entirely client-side. */
export function UploadStep() {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setWarnings([]);
    setIsParsing(true);
    const isJson = file.name.toLowerCase().endsWith(".json");
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = isJson ? await parseJsonFile(file) : await parseDelimitedFile(file, { signal: controller.signal });
      if (result.rows.length === 0) {
        setError("No data rows were found in this file. Check that it has a header row and at least one data row.");
        return;
      }
      const notices: string[] = [];
      if (result.truncated) notices.push(`This file has more rows than the ${MAX_FILE_SIZE_MB.toFixed(0)} MB / row limit allows; only the first rows were loaded.`);
      if (result.errors.length > 0) notices.push(`${result.errors.length} row(s) had parsing issues and may be incomplete.`);
      setWarnings(notices);
      useDatasetStore.getState().setImportedFile(file.name, result.headers, result.rows);
    } catch (err: unknown) {
      if (err instanceof FileTooLargeError) {
        setError(err.message);
      } else if (err instanceof DOMException && err.name === "AbortError") {
        setError("Import cancelled.");
      } else if (err instanceof Error) {
        setError(`Could not read this file: ${err.message}`);
      } else {
        setError("Could not read this file.");
      }
    } finally {
      setIsParsing(false);
      abortControllerRef.current = null;
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const onCancel = () => {
    abortControllerRef.current?.abort();
  };

  return (
    <section aria-labelledby="upload-step-heading" className="max-w-2xl">
      <h2 id="upload-step-heading" className="text-xl font-semibold text-text">
        Import your data
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        CSV, TSV, or JSON (array of objects). Everything is parsed and analyzed in this browser tab — your file is never
        uploaded anywhere. Files up to {MAX_FILE_SIZE_MB.toFixed(0)} MB are supported.
      </p>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`mt-4 flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
          isDragging ? "border-accent bg-accent/5" : "border-border bg-surface"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 text-text-muted" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l-3.75 3.75M12 9.75l3.75 3.75M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z" />
        </svg>
        <p className="text-sm text-text">Drag and drop a file here, or</p>
        <Button variant="primary" onClick={() => inputRef.current?.click()} disabled={isParsing}>
          Choose a file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.tsv,.json,text/csv"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFile(file);
            event.target.value = "";
          }}
        />
        {isParsing && (
          <div className="flex items-center gap-2 text-sm text-text-muted" role="status">
            <span>Parsing file…</span>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {warnings.map((warning) => (
        <p key={warning} role="status" className="mt-3 rounded-md border border-warning bg-warning/10 px-3 py-2 text-sm text-warning">
          {warning}
        </p>
      ))}
    </section>
  );
}
