import { useMemo } from "react";
import { inferColumnType } from "../../lib/csv/mapping";
import { useDatasetStore } from "../../store/datasetStore";
import { Button } from "../common/Button";

const PREVIEW_ROW_COUNT = 10;

/** Step 2: shows the first rows of the parsed file and the inferred type per column before mapping. */
export function PreviewStep() {
  const headers = useDatasetStore((state) => state.headers);
  const rawRows = useDatasetStore((state) => state.rawRows);
  const fileName = useDatasetStore((state) => state.fileName);

  const previewRows = rawRows.slice(0, PREVIEW_ROW_COUNT);
  const inferredTypes = useMemo(
    () => Object.fromEntries(headers.map((header) => [header, inferColumnType(rawRows, header)])),
    [headers, rawRows],
  );

  return (
    <section aria-labelledby="preview-step-heading">
      <h2 id="preview-step-heading" className="text-xl font-semibold text-text">
        Preview: {fileName}
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {rawRows.length.toLocaleString()} row(s), {headers.length} column(s). Showing the first {Math.min(PREVIEW_ROW_COUNT, rawRows.length)} rows and
        each column's detected type.
      </p>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] border-collapse text-left text-xs">
          <caption className="sr-only">Preview of the first rows of {fileName}</caption>
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} scope="col" className="border-b border-border bg-surface px-3 py-2 font-semibold text-text">
                  {header}
                  <span className="block font-normal text-text-muted">({inferredTypes[header]})</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <tr key={rowIndex}>
                {headers.map((header) => (
                  <td key={header} className="border-b border-border px-3 py-2 text-text">
                    {row[header] || <span className="text-text-muted">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-between">
        <Button variant="secondary" onClick={() => useDatasetStore.getState().clearAllData()}>
          Start over
        </Button>
        <Button variant="primary" onClick={() => useDatasetStore.setState({ stage: "mapping" })}>
          Continue to column mapping
        </Button>
      </div>
    </section>
  );
}
