import { describe, expect, it } from "vitest";
import { parseDelimitedFile, parseJsonFile, FileTooLargeError, MAX_FILE_SIZE_BYTES } from "./parse";

function csvFile(content: string, name = "test.csv"): File {
  return new File([content], name, { type: "text/csv" });
}

describe("parseDelimitedFile", () => {
  it("parses a simple CSV into header/row pairs", async () => {
    const file = csvFile("date,revenue\n2024-01-01,100\n2024-01-02,200\n");
    const result = await parseDelimitedFile(file);
    expect(result.headers).toEqual(["date", "revenue"]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toEqual({ date: "2024-01-01", revenue: "100" });
  });

  it("actually resolves for a real File object without hanging (regression test for the worker:true bug)", async () => {
    const file = csvFile("a,b\n1,2\n");
    await expect(parseDelimitedFile(file)).resolves.toBeDefined();
  });

  it("rejects files over the size cap", async () => {
    const bigContent = "a,b\n" + "1,2\n".repeat(1);
    const file = csvFile(bigContent);
    Object.defineProperty(file, "size", { value: MAX_FILE_SIZE_BYTES + 1 });
    await expect(parseDelimitedFile(file)).rejects.toBeInstanceOf(FileTooLargeError);
  });

  it("supports cancellation via AbortSignal", async () => {
    const file = csvFile("a,b\n1,2\n2,3\n3,4\n");
    const controller = new AbortController();
    const pending = parseDelimitedFile(file, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("parseJsonFile", () => {
  it("parses an array of objects into headers/rows", async () => {
    const file = new File([JSON.stringify([{ date: "2024-01-01", revenue: 100 }])], "test.json", { type: "application/json" });
    const result = await parseJsonFile(file);
    expect(result.headers).toEqual(["date", "revenue"]);
    expect(result.rows[0].revenue).toBe("100");
  });

  it("rejects non-array JSON", async () => {
    const file = new File([JSON.stringify({ foo: "bar" })], "test.json", { type: "application/json" });
    await expect(parseJsonFile(file)).rejects.toThrow("array");
  });
});
