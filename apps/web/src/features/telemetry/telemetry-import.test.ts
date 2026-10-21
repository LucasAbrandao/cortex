import { afterEach, describe, expect, it, vi } from "vitest";
import {
  IMPORT_LIMITS, ImportFailure, normalizeTelemetry, parseTelemetryText,
  type ImportMapping, type ImportWorkerRequest, type ImportWorkerResponse
} from "./telemetry-import";

const parse = (text: string, name = "run.csv") => parseTelemetryText(text, name, new TextEncoder().encode(text).byteLength);
const mapping = (overrides: Partial<ImportMapping> = {}): ImportMapping => ({
  time: "t", timeUnit: "s", timeBase: "file", decimal: ".", entity: null, lap: null,
  distance: null, distanceUnit: "m", channels: [{ column: "v", unit: null }], ...overrides
});

function failure(run: () => unknown, code: string, row?: number) {
  try { run(); } catch (error) {
    expect(error).toBeInstanceOf(ImportFailure);
    expect(error).toMatchObject({ code, ...(row === undefined ? {} : { row }) });
    return;
  }
  throw new Error("Expected ImportFailure " + code);
}

describe("bounded local CSV/JSON inspection", () => {
  it("reads BOM, CRLF, quoted delimiters, escaped quotes and embedded newlines without interpreting text", () => {
    const text = '\uFEFF"time";"v";"note"\r\n0;0;"line one\nline ""two"""\r\n1;12;"<script>unsafe</script>"\r\n';
    const result = parse(text, "C:\\private\\RUN.CSV");
    expect(result.name).toBe("RUN.CSV");
    expect(result.columns).toEqual(["time", "v", "note"]);
    expect(result.rows).toEqual([["0", "0", 'line one\nline "two"'], ["1", "12", "<script>unsafe</script>"]]);
  });

  it("supports tabs and retains records whose explicitly present cells are all empty", () => {
    expect(parse("t\tv\n0\t0\n\t\n1\t2\n").rows).toEqual([["0", "0"], ["", ""], ["1", "2"]]);
    expect(parse("t,v\n\n0,0\n\n1,2\n").rows).toHaveLength(2);
  });

  it.each([
    ["t,t\n0,1", "INVALID_HEADERS"],
    ["t, \n0,1", "INVALID_HEADERS"],
    ["t,v\n0,1,2", "INVALID_CSV"],
    ['t;v\n0;"unterminated', "INVALID_CSV"],
    ['t,v\n0,"quoted"tail', "INVALID_CSV"],
    ["t,v;x\n0,1;2", "AMBIGUOUS_DELIMITER"]
  ])("rejects ambiguous or damaged CSV: %s", (text, code) => {
    failure(() => parse(text), code);
  });

  it("unions flat JSON columns in source order and preserves missing, zero and false", () => {
    const result = parse('[{"t":0,"v":0,"brake":false},{"t":1,"v":2,"distance":null}]', "run.json");
    expect(result.columns).toEqual(["t", "v", "brake", "distance"]);
    expect(result.rows).toEqual([[0, 0, false, null], [1, 2, null, null]]);
  });

  it("uses own JSON properties without reading inherited object names", () => {
    const result = parse('[{"t":0,"__proto__":1},{"t":1,"v":2}]', "run.json");
    expect(result.rows).toEqual([[0, 1, null], [1, null, 2]]);
  });

  it.each([
    ["{", "INVALID_JSON"], ['{"data":[]}', "INVALID_JSON_SHAPE"],
    ['[{"t":0,"v":{"nested":1}}]', "INVALID_JSON_SHAPE"],
    ['[{"t":0,"v":[1]}]', "INVALID_JSON_SHAPE"],
    ["[null]", "INVALID_JSON_SHAPE"], ["[]", "EMPTY_FILE"],
    ['[{}]', "INVALID_HEADERS"]
  ])("rejects unsupported JSON structures: %s", (text, code) => {
    failure(() => parse(text, "run.json"), code);
  });

  it("does not accept unsupported extensions, empty input or header-only CSV", () => {
    failure(() => parse("t,v\n0,1", "run.rcz"), "UNSUPPORTED_FORMAT");
    failure(() => parse(" \n"), "EMPTY_FILE");
    failure(() => parse("t,v\n"), "EMPTY_FILE");
  });

  it("enforces both declared and actual UTF-8 byte limits", () => {
    failure(() => parseTelemetryText("t,v\n0,1", "run.csv", IMPORT_LIMITS.maxBytes + 1), "FILE_TOO_LARGE");
    failure(() => parseTelemetryText("x".repeat(IMPORT_LIMITS.maxBytes + 1), "run.csv", 1), "FILE_TOO_LARGE");
    failure(() => parseTelemetryText("t,v\n0,1", "run.csv", -1), "READ_FAILED");
  });

  it("blocks row, column and cell limits rather than returning a truncated dataset", () => {
    failure(() => parse("t,v\n" + "0,1\n".repeat(IMPORT_LIMITS.maxRows + 1)), "TOO_MANY_ROWS");
    const columns = Array.from({ length: 65 }, (_, index) => "c" + index).join(",");
    failure(() => parse(columns + "\n" + Array(65).fill("0").join(",")), "TOO_MANY_COLUMNS");
    const header = Array.from({ length: 11 }, (_, index) => "c" + index).join(",");
    failure(() => parse(header + "\n" + (Array(11).fill("0").join(",") + "\n").repeat(45455)), "TOO_MANY_CELLS");
  });
});

describe("source-preserving telemetry normalization", () => {
  it("groups interleaved source entities and laps, converts only explicit time/distance units and retains false", () => {
    const inspected = parse("t,entity,lap,v,brake,distance\n0,A,7,0,false,0\n1000,B,9,10,true,0\n2000,A,7,,false,0.1\n3000,A,7,bad,false,0.2");
    const result = normalizeTelemetry(inspected, mapping({
      timeUnit: "ms", entity: "entity", lap: "lap", distance: "distance", distanceUnit: "km",
      channels: [{ column: "v", unit: "km/h" }, { column: "brake", unit: null }]
    }));
    expect(result.source).toBe("local-file");
    expect(result.series.map((series) => [series.driver, series.lap])).toEqual([["A", 7], ["B", 9]]);
    expect(result.series[0]!.samples.map((sample) => [sample.time, sample.lapTime, sample.distance])).toEqual([[0, 0, 0], [2, 2, 100], [3, 3, 200]]);
    expect(result.series[0]!.samples[0]!.values).toEqual({ "import:v": 0, "import:brake": false });
    expect(result.series[0]!.samples[1]!.values["import:v"]).toBeNull();
    expect(result.series[0]!.samples[2]!.values["import:v"]).toBeNull();
    expect(result.channels[1]).toMatchObject({ id: "import:brake", valueType: "boolean", suggestedView: "events", origin: "source", unit: null });
    expect(result.diagnostics).toEqual({ missingTime: 0, invalidValues: 1 });
  });

  it("labels the unmapped entity FILE without inventing lap 1 or forcing a relative source clock to zero", () => {
    const inspected = parse("t,v\n5,0\n6,2");
    const fileSession = normalizeTelemetry(inspected, mapping());
    expect(fileSession.series[0]).toMatchObject({ driver: "FILE", lap: null, axis: "globalTime" });
    expect(fileSession.series[0]!.samples.map((sample) => [sample.time, sample.lapTime, sample.lapNumber])).toEqual([[5, 0, null], [6, 1, null]]);
    const seriesSession = normalizeTelemetry(inspected, mapping({ timeBase: "series" }));
    expect(seriesSession.series[0]!.samples.map((sample) => [sample.time, sample.lapTime])).toEqual([[null, 5], [null, 6]]);
  });

  it("preserves missing time/channel rows as null barriers and reports partial availability", () => {
    const result = normalizeTelemetry(parse("t,v\n0,0\n,2\n2,"), mapping());
    expect(result.series[0]!.samples.map((sample) => [sample.time, sample.values["import:v"]])).toEqual([[0, 0], [null, 2], [2, null]]);
    expect(result.series[0]!.availability).toMatchObject({ status: "partial", validSamples: 1, totalSamples: 3 });
    expect(result.diagnostics).toEqual({ missingTime: 1, invalidValues: 0 });
  });

  it("requires explicit decimal convention and never parses numeric prefixes or thousands separators", () => {
    const inspected = parse('t;v\n0;"1,25"\n1;"2,5"\n2;"3 km/h"\n3;"1.000,00"');
    const result = normalizeTelemetry(inspected, mapping({ decimal: "," }));
    expect(result.series[0]!.samples.map((sample) => sample.values["import:v"])).toEqual([1.25, 2.5, null, null]);
    expect(result.diagnostics.invalidValues).toBe(2);
  });

  it("keeps invalid and absent laps null and normalizes nonfinite channel/distance cells to null", () => {
    const inspected = parse('[{"t":0,"v":1,"lap":-1,"d":1e308},{"t":1,"v":1e400,"lap":null,"d":null}]', "run.json");
    const result = normalizeTelemetry(inspected, mapping({ lap: "lap", distance: "d", distanceUnit: "km" }));
    expect(result.series).toHaveLength(1);
    expect(result.series[0]!.lap).toBeNull();
    expect(result.series[0]!.samples.map((sample) => sample.distance)).toEqual([null, null]);
    expect(result.series[0]!.samples[1]!.values["import:v"]).toBeNull();
    expect(result.diagnostics.invalidValues).toBe(3);
  });

  it.each([
    "t,v\n0,1\n0,2",
    "t,v\n1,1\n0,2",
    "t,v\n1,1\n,2\n0,3"
  ])("rejects duplicate/regressing original times without sorting or deduplicating: %s", (text) => {
    failure(() => normalizeTelemetry(parse(text), mapping()), "NON_MONOTONIC_TIME");
  });

  it("rejects per-lap resets presented as a file clock and accepts them only for explicit relative series", () => {
    const inspected = parse("t,lap,v\n0,1,1\n1,1,2\n0,2,3\n1,2,4");
    failure(() => normalizeTelemetry(inspected, mapping({ lap: "lap" })), "NON_MONOTONIC_TIME", 4);
    const result = normalizeTelemetry(inspected, mapping({ lap: "lap", timeBase: "series" }));
    expect(result.series.map((series) => series.samples.map((sample) => sample.lapTime))).toEqual([[0, 1], [0, 1]]);
  });

  it("keeps separate entity clocks independent and identifies the source row of a missing mapped entity", () => {
    const result = normalizeTelemetry(parse("t,e,v\n0,A,1\n0,B,2\n1,A,3\n1,B,4"), mapping({ entity: "e" }));
    expect(result.series).toHaveLength(2);
    failure(() => normalizeTelemetry(parse("t,e,v\n0,A,1\n1,,2"), mapping({ entity: "e" })), "INVALID_ENTITY", 3);
  });

  it("requires at least one numeric channel at a valid time and does not treat booleans as numeric input", () => {
    failure(() => normalizeTelemetry(parse("t,v\n0,false\n1,true"), mapping()), "NO_NUMERIC_CHANNEL");
    failure(() => normalizeTelemetry(parse("t,v\n,2\n,3"), mapping()), "NO_VALID_TIME");
    failure(() => normalizeTelemetry(parse("t,v\n0,\n,3"), mapping()), "NO_NUMERIC_CHANNEL");
  });

  it("preserves lap zero and renders numeric channels as continuous source curves", () => {
    const result = normalizeTelemetry(parse("t,lap,v\n0,0,0\n1,0,10"), mapping({ lap: "lap" }));
    expect(result.series[0]!.lap).toBe(0);
    expect(result.series[0]!.samples[0]!.values["import:v"]).toBe(0);
    expect(result.channels[0]).toMatchObject({ valueType: "integer", suggestedView: "line" });
  });

  it("rejects role reuse, unknown fields, repeated channel mappings and invalid unit declarations", () => {
    const inspected = parse("t,v\n0,1\n1,2");
    for (const selection of [
      mapping({ channels: [{ column: "t", unit: null }] }),
      mapping({ entity: "v" }),
      mapping({ time: "missing" }),
      mapping({ channels: [{ column: "v", unit: null }, { column: "v", unit: null }] }),
      mapping({ timeUnit: "minutes" as ImportMapping["timeUnit"] })
    ]) failure(() => normalizeTelemetry(inspected, selection), "INVALID_MAPPING");
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function worker() {
  vi.resetModules();
  const scope = {
    onmessage: null as ((event: MessageEvent<ImportWorkerRequest>) => Promise<void>) | null,
    postMessage: vi.fn<(message: ImportWorkerResponse) => void>()
  };
  vi.stubGlobal("self", scope);
  await import("./telemetry-import.worker");
  return scope;
}

const mockFile = (bytes: Uint8Array, name = "run.csv", size = bytes.length) => ({
  name, size, arrayBuffer: vi.fn(async () => bytes.buffer)
}) as unknown as File;

describe("private import worker protocol", () => {
  it("returns inspected data and normalized real samples with the original request id", async () => {
    const scope = await worker();
    await scope.onmessage!({ data: { id: 7, kind: "inspect", file: mockFile(new TextEncoder().encode("t,v\n0,0\n1,2")) } } as MessageEvent<ImportWorkerRequest>);
    const inspected = scope.postMessage.mock.calls[0]![0];
    expect(inspected).toMatchObject({ id: 7, status: "success", kind: "inspect" });
    if (inspected.status !== "success" || inspected.kind !== "inspect") throw new Error("Missing inspection");
    await scope.onmessage!({ data: { id: 8, kind: "normalize", parsed: inspected.parsed, mapping: mapping() } } as MessageEvent<ImportWorkerRequest>);
    expect(scope.postMessage.mock.calls[1]![0]).toMatchObject({ id: 8, status: "success", kind: "normalize", session: { source: "local-file", series: [{ samples: [{ values: { "import:v": 0 } }, { values: { "import:v": 2 } }] }] } });
  });

  it("rejects malformed UTF-8 rather than replacing source bytes", async () => {
    const scope = await worker();
    await scope.onmessage!({ data: { id: 9, kind: "inspect", file: mockFile(new Uint8Array([0xc3, 0x28])) } } as MessageEvent<ImportWorkerRequest>);
    expect(scope.postMessage).toHaveBeenCalledWith({ id: 9, status: "error", code: "INVALID_ENCODING" });
  });

  it("rejects an oversized file before reading it", async () => {
    const scope = await worker();
    const file = mockFile(new Uint8Array(), "run.csv", IMPORT_LIMITS.maxBytes + 1);
    await scope.onmessage!({ data: { id: 10, kind: "inspect", file } } as MessageEvent<ImportWorkerRequest>);
    expect(file.arrayBuffer).not.toHaveBeenCalled();
    expect(scope.postMessage).toHaveBeenCalledWith({ id: 10, status: "error", code: "FILE_TOO_LARGE" });
  });

  it("returns only safe error codes and source rows, without raw file data or exception messages", async () => {
    const scope = await worker();
    const file = { name: "run.csv", size: 1, arrayBuffer: async () => { throw new Error("private secret source contents"); } } as unknown as File;
    await scope.onmessage!({ data: { id: 11, kind: "inspect", file } } as MessageEvent<ImportWorkerRequest>);
    expect(scope.postMessage).toHaveBeenCalledWith({ id: 11, status: "error", code: "READ_FAILED" });
    await scope.onmessage!({ data: { id: 12, kind: "normalize", parsed: parse("t,v\n1,2\n1,3"), mapping: mapping() } } as MessageEvent<ImportWorkerRequest>);
    expect(scope.postMessage).toHaveBeenLastCalledWith({ id: 12, status: "error", code: "NON_MONOTONIC_TIME", row: 3 });
  });
});

