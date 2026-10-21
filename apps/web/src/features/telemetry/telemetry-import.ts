import type { components } from "@cortex/contracts";

type Cell = string | number | boolean | null;
type Channel = components["schemas"]["ChannelDefinition"];
type Series = components["schemas"]["ComparisonSeries"];
type Sample = components["schemas"]["TelemetrySample"];

export const IMPORT_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  maxRows: 50000,
  maxColumns: 64,
  maxCells: 500000,
  previewRows: 20
} as const;

export type ParsedTelemetryFile = {
  name: string;
  size: number;
  format: "csv" | "json";
  columns: string[];
  rows: Cell[][];
};

export type ImportMapping = {
  time: string;
  timeUnit: "s" | "ms";
  timeBase: "file" | "series";
  decimal: "." | ",";
  entity: string | null;
  lap: string | null;
  distance: string | null;
  distanceUnit: "m" | "km";
  channels: Array<{ column: string; unit: string | null }>;
};

export type ImportedTelemetrySession = {
  source: "local-file";
  file: { name: string; size: number; format: "csv" | "json" };
  timeBase: "file" | "series";
  channels: Channel[];
  series: Series[];
  diagnostics: { missingTime: number; invalidValues: number };
};

export type ImportWorkerRequest =
  | { id: number; kind: "inspect"; file: File }
  | { id: number; kind: "normalize"; parsed: ParsedTelemetryFile; mapping: ImportMapping };

export type ImportWorkerResponse =
  | { id: number; status: "success"; kind: "inspect"; parsed: ParsedTelemetryFile }
  | { id: number; status: "success"; kind: "normalize"; session: ImportedTelemetrySession }
  | { id: number; status: "error"; code: string; row?: number };

export class ImportFailure extends Error {
  readonly code: string;
  readonly row?: number;

  constructor(code: string, row?: number) {
    super(code);
    this.name = "ImportFailure";
    this.code = code;
    this.row = row;
  }
}

function checkDimensions(rows: number, columns: number) {
  if (columns > IMPORT_LIMITS.maxColumns) throw new ImportFailure("TOO_MANY_COLUMNS");
  if (rows > IMPORT_LIMITS.maxRows) throw new ImportFailure("TOO_MANY_ROWS");
  if (rows * columns > IMPORT_LIMITS.maxCells) throw new ImportFailure("TOO_MANY_CELLS");
}

function checkHeaders(columns: string[]) {
  if (!columns.length || columns.some((column) => !column.trim()) || new Set(columns).size !== columns.length) {
    throw new ImportFailure("INVALID_HEADERS");
  }
  checkDimensions(0, columns.length);
}

/** RFC-style quoted fields; only physically blank records are ignored. */
function csvRecords(text: string, delimiter: string, limit?: number): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;
  let started = false;
  const finishField = () => { record.push(field); field = ""; closedQuote = false; };
  const finishRecord = () => {
    if (!started && !record.length && !field.length) return;
    finishField();
    records.push(record);
    record = [];
    started = false;
    if (limit === undefined) checkDimensions(Math.max(0, records.length - 1), records[0]!.length);
  };
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else field += character;
      continue;
    }
    if (character === delimiter) {
      finishField(); started = true;
      if (record.length >= IMPORT_LIMITS.maxColumns && limit === undefined) throw new ImportFailure("TOO_MANY_COLUMNS");
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRecord();
      if (limit !== undefined && records.length >= limit) return records;
    } else if (closedQuote) {
      throw new ImportFailure("INVALID_CSV", records.length + 1);
    } else if (character === '"') {
      if (field.length) throw new ImportFailure("INVALID_CSV", records.length + 1);
      quoted = true; started = true;
    } else { field += character; started = true; }
  }
  if (quoted) throw new ImportFailure("INVALID_CSV", records.length + 1);
  finishRecord();
  return records;
}

function parseCsv(text: string): Pick<ParsedTelemetryFile, "columns" | "rows"> {
  const candidates: Array<{ delimiter: string; columns: number; consistent: boolean }> = [];
  for (const delimiter of [",", ";", "\t"]) {
    try {
      const width = csvRecords(text, delimiter, 1)[0]?.length ?? 0;
      if (width <= 1) continue;
      let consistent = false;
      try {
        consistent = csvRecords(text, delimiter, IMPORT_LIMITS.previewRows + 1).every((record) => record.length === width);
      } catch { /* The full parse will report the original damaged record. */ }
      candidates.push({ delimiter, columns: width, consistent });
    } catch {
      // A quote valid for one dialect can be invalid for another dialect.
    }
  }
  candidates.sort((left, right) => Number(right.consistent) - Number(left.consistent) || right.columns - left.columns);
  if (candidates.length > 1 && candidates[0]!.columns === candidates[1]!.columns && candidates[0]!.consistent === candidates[1]!.consistent) throw new ImportFailure("AMBIGUOUS_DELIMITER");
  const records = csvRecords(text, candidates[0]?.delimiter ?? ",");
  const columns = records[0]?.map((column) => column.trim()) ?? [];
  checkHeaders(columns);
  const rows = records.slice(1);
  if (!rows.length) throw new ImportFailure("EMPTY_FILE");
  const mismatch = rows.findIndex((record) => record.length !== columns.length);
  if (mismatch !== -1) throw new ImportFailure("INVALID_CSV", mismatch + 2);
  checkDimensions(rows.length, columns.length);
  return { columns, rows };
}

function parseJson(text: string): Pick<ParsedTelemetryFile, "columns" | "rows"> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new ImportFailure("INVALID_JSON"); }
  if (!Array.isArray(parsed)) throw new ImportFailure("INVALID_JSON_SHAPE");
  if (!parsed.length) throw new ImportFailure("EMPTY_FILE");
  checkDimensions(parsed.length, 0);
  const columns: string[] = [];
  const keys = new Set<string>();
  for (const [index, value] of parsed.entries()) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) throw new ImportFailure("INVALID_JSON_SHAPE", index + 1);
    for (const [key, cell] of Object.entries(value)) {
      if (cell !== null && !["string", "number", "boolean"].includes(typeof cell)) throw new ImportFailure("INVALID_JSON_SHAPE", index + 1);
      if (!keys.has(key)) { keys.add(key); columns.push(key); }
    }
    checkDimensions(parsed.length, columns.length);
  }
  checkHeaders(columns);
  const rows: Cell[][] = parsed.map((value: Record<string, Cell>) => columns.map((column) => Object.hasOwn(value, column) ? value[column]! : null));
  return { columns, rows };
}

export function parseTelemetryText(text: string, name: string, size: number): ParsedTelemetryFile {
  if (!Number.isFinite(size) || size < 0) throw new ImportFailure("READ_FAILED");
  if (size > IMPORT_LIMITS.maxBytes || new TextEncoder().encode(text).byteLength > IMPORT_LIMITS.maxBytes) throw new ImportFailure("FILE_TOO_LARGE");
  const safeName = name.split(/[\\/]/).at(-1) ?? "";
  const extension = safeName.split(".").at(-1)?.toLowerCase();
  if (extension !== "csv" && extension !== "json") throw new ImportFailure("UNSUPPORTED_FORMAT");
  const content = text.replace(/^\uFEFF/, "");
  if (!content.trim()) throw new ImportFailure("EMPTY_FILE");
  const data = extension === "csv" ? parseCsv(content) : parseJson(content);
  return { name: safeName, size, format: extension, ...data };
}

const isMissing = (cell: Cell) => cell === null || typeof cell === "string" && !cell.trim();

function numberValue(cell: Cell, decimal: "." | ","): number | null {
  if (typeof cell === "number") return Number.isFinite(cell) ? cell : null;
  if (typeof cell !== "string") return null;
  const value = cell.trim();
  const valid = decimal === "." ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/ : /^[+-]?(?:\d+(?:,\d*)?|,\d+)(?:[eE][+-]?\d+)?$/;
  if (!valid.test(value)) return null;
  const numeric = Number(decimal === "," ? value.replace(",", ".") : value);
  return Number.isFinite(numeric) ? numeric : null;
}

function channelValue(cell: Cell, decimal: "." | ","): number | boolean | null {
  if (typeof cell === "boolean") return cell;
  if (typeof cell === "string" && /^(true|false)$/i.test(cell.trim())) return cell.trim().toLowerCase() === "true";
  return numberValue(cell, decimal);
}

function checkMapping(parsed: ParsedTelemetryFile, mapping: ImportMapping) {
  if (!["s", "ms"].includes(mapping.timeUnit) || !["file", "series"].includes(mapping.timeBase) ||
      ![".", ","].includes(mapping.decimal) || !["m", "km"].includes(mapping.distanceUnit) || !mapping.channels.length) {
    throw new ImportFailure("INVALID_MAPPING");
  }
  const roles = [mapping.time, mapping.entity, mapping.lap, mapping.distance, ...mapping.channels.map((channel) => channel.column)].filter((role): role is string => role !== null);
  if (new Set(roles).size !== roles.length || roles.some((role) => !parsed.columns.includes(role)) ||
      mapping.channels.some((channel) => channel.unit !== null && typeof channel.unit !== "string")) throw new ImportFailure("INVALID_MAPPING");
}

/** Normalize only explicitly mapped source cells; invalid cells remain barriers. */
export function normalizeTelemetry(parsed: ParsedTelemetryFile, mapping: ImportMapping): ImportedTelemetrySession {
  checkHeaders(parsed.columns);
  checkDimensions(parsed.rows.length, parsed.columns.length);
  if (!parsed.rows.length) throw new ImportFailure("EMPTY_FILE");
  checkMapping(parsed, mapping);
  const indices = new Map(parsed.columns.map((column, index) => [column, index]));
  const read = (row: Cell[], column: string | null): Cell => column === null ? null : row[indices.get(column)!] ?? null;
  const diagnostics = { missingTime: 0, invalidValues: 0 };
  const groups = new Map<string, { driver: string; lap: number | null; first: number | null; previous: number | null; samples: Sample[] }>();
  const entityTimes = new Map<string, number>();
  const kinds = mapping.channels.map(() => ({ numbers: 0, booleans: 0, integers: true }));
  let validTimes = 0;
  let numericWithTime = false;
  for (const [index, row] of parsed.rows.entries()) {
    const rowNumber = index + (parsed.format === "csv" ? 2 : 1);
    if (row.length !== parsed.columns.length) throw new ImportFailure("INVALID_CSV", rowNumber);
    const numeric = (column: string | null) => {
      const cell = read(row, column);
      const value = numberValue(cell, mapping.decimal);
      if (value === null && !isMissing(cell)) diagnostics.invalidValues += 1;
      return value;
    };
    const entity = read(row, mapping.entity);
    if (mapping.entity !== null && isMissing(entity)) throw new ImportFailure("INVALID_ENTITY", rowNumber);
    const driver = mapping.entity === null ? "FILE" : String(entity);
    const rawLap = numeric(mapping.lap);
    const lap = rawLap !== null && Number.isSafeInteger(rawLap) && rawLap >= 0 ? rawLap : null;
    if (rawLap !== null && lap === null) diagnostics.invalidValues += 1;
    const rawTime = numeric(mapping.time);
    const timestamp = rawTime === null ? null : rawTime / (mapping.timeUnit === "ms" ? 1000 : 1);
    if (timestamp === null) diagnostics.missingTime += 1;
    else validTimes += 1;
    const key = JSON.stringify([driver, lap]);
    let group = groups.get(key);
    if (!group) { group = { driver, lap, first: null, previous: null, samples: [] }; groups.set(key, group); }
    if (timestamp !== null) {
      const previous = mapping.timeBase === "file" ? entityTimes.get(driver) ?? null : group.previous;
      if (previous !== null && timestamp <= previous) throw new ImportFailure("NON_MONOTONIC_TIME", rowNumber);
      group.previous = timestamp;
      entityTimes.set(driver, timestamp);
      group.first ??= timestamp;
    }
    const distance = numeric(mapping.distance);
    const normalizedDistance = distance === null ? null : distance * (mapping.distanceUnit === "km" ? 1000 : 1);
    if (normalizedDistance !== null && !Number.isFinite(normalizedDistance)) diagnostics.invalidValues += 1;
    const values = Object.fromEntries(mapping.channels.map((channel, channelIndex) => {
      const cell = read(row, channel.column);
      const value = channelValue(cell, mapping.decimal);
      if (value === null && !isMissing(cell)) diagnostics.invalidValues += 1;
      if (typeof value === "number") {
        kinds[channelIndex]!.numbers += 1;
        kinds[channelIndex]!.integers &&= Number.isInteger(value);
        if (timestamp !== null) numericWithTime = true;
      } else if (typeof value === "boolean") kinds[channelIndex]!.booleans += 1;
      return [`import:${channel.column}`, value];
    }));
    const relativeTime = timestamp === null ? null : mapping.timeBase === "series" ? timestamp : timestamp - group.first!;
    if (relativeTime !== null && !Number.isFinite(relativeTime)) diagnostics.invalidValues += 1;
    group.samples.push({
      time: mapping.timeBase === "file" ? timestamp : null,
      lapTime: relativeTime !== null && Number.isFinite(relativeTime) ? relativeTime : null,
      distance: normalizedDistance !== null && Number.isFinite(normalizedDistance) ? normalizedDistance : null,
      lapNumber: lap,
      values
    });
  }
  if (!validTimes) throw new ImportFailure("NO_VALID_TIME");
  if (!numericWithTime) throw new ImportFailure("NO_NUMERIC_CHANNEL");
  const channels: Channel[] = mapping.channels.map((channel, index) => {
    const kind = kinds[index]!;
    const valueType = kind.numbers === 0 && kind.booleans > 0 ? "boolean" : kind.booleans === 0 && kind.numbers > 0 && kind.integers ? "integer" : "continuous";
    return { id: `import:${channel.column}`, label: channel.column, unit: channel.unit?.trim() || null, origin: "source", valueType, suggestedView: valueType === "boolean" ? "events" : "line" };
  });
  const series: Series[] = [...groups.values()].map((group) => {
    const validSamples = group.samples.filter((sample) => (mapping.timeBase === "file" ? sample.time : sample.lapTime) !== null && Object.values(sample.values).some((value) => value !== null)).length;
    const status = validSamples === group.samples.length ? "available" : validSamples ? "partial" : "absent";
    return { driver: group.driver, lap: group.lap, axis: mapping.timeBase === "file" ? "globalTime" : "lapTime", samples: group.samples,
      availability: { status, validSamples, totalSamples: group.samples.length, reason: status === "available" ? null : "One or more mapped source samples are unavailable." } };
  });
  return { source: "local-file", file: { name: parsed.name, size: parsed.size, format: parsed.format }, timeBase: mapping.timeBase, channels, series, diagnostics };
}
