import { IMPORT_LIMITS, ImportFailure, normalizeTelemetry, parseTelemetryText, type ImportWorkerRequest, type ImportWorkerResponse } from "./telemetry-import";

declare const self: {
  onmessage: ((event: MessageEvent<ImportWorkerRequest>) => void) | null;
  postMessage: (message: ImportWorkerResponse) => void;
};

self.onmessage = async ({ data }) => {
  try {
    if (data.kind === "normalize") {
      self.postMessage({ id: data.id, status: "success", kind: "normalize", session: normalizeTelemetry(data.parsed, data.mapping) });
      return;
    }
    if (data.file.size > IMPORT_LIMITS.maxBytes) throw new ImportFailure("FILE_TOO_LARGE");
    let buffer: ArrayBuffer;
    try { buffer = await data.file.arrayBuffer(); } catch { throw new ImportFailure("READ_FAILED"); }
    let content: string;
    try { content = new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch { throw new ImportFailure("INVALID_ENCODING"); }
    const parsed = parseTelemetryText(content, data.file.name, data.file.size);
    self.postMessage({ id: data.id, status: "success", kind: "inspect", parsed });
  } catch (error) {
    const failure = error instanceof ImportFailure ? error : new ImportFailure("READ_FAILED");
    self.postMessage({ id: data.id, status: "error", code: failure.code, ...(failure.row === undefined ? {} : { row: failure.row }) });
  }
};
