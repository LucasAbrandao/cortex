import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportMapping, ImportedTelemetrySession, ImportWorkerRequest, ImportWorkerResponse, ParsedTelemetryFile } from "./telemetry-import";
import { TelemetryProvider, useTelemetryImport } from "./telemetry-provider";

class ControlledWorker {
  static instances: ControlledWorker[] = [];
  onmessage: ((event: MessageEvent<ImportWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn<(request: ImportWorkerRequest) => void>();
  terminate = vi.fn();

  constructor() { ControlledWorker.instances.push(this); }
  get request() {
    const request = this.postMessage.mock.calls.at(-1)?.[0];
    if (!request) throw new Error("Worker has no request");
    return request;
  }
  // Delivery remains possible after terminate, to exercise queued, obsolete events.
  deliver(response: ImportWorkerResponse) { act(() => this.onmessage?.({ data: response } as MessageEvent<ImportWorkerResponse>)); }
  fail() {
    const event = new ErrorEvent("error", { cancelable: true });
    act(() => this.onerror?.(event));
    return event;
  }
}

const firstFile = new File(["time,speed\n0,100\n1,110"], "first.csv", { type: "text/csv" });
const replacementFile = new File(["time,speed\n0,210"], "replacement.csv", { type: "text/csv" });
const parsed: ParsedTelemetryFile = {
  name: firstFile.name, size: firstFile.size, format: "csv", columns: ["time", "speed"], rows: [["0", "100"], ["1", "110"]]
};
const mapping: ImportMapping = {
  time: "time", timeUnit: "s", timeBase: "file", decimal: ".", entity: null, lap: null,
  distance: null, distanceUnit: "m", channels: [{ column: "speed", unit: "km/h" }]
};
const session: ImportedTelemetrySession = {
  source: "local-file", file: { name: firstFile.name, size: firstFile.size, format: "csv" }, timeBase: "file",
  channels: [{ id: "import:speed", label: "speed", unit: "km/h", origin: "source", valueType: "continuous", suggestedView: "line" }],
  series: [{ driver: "FILE", lap: null, axis: "globalTime", availability: { status: "available", validSamples: 2, totalSamples: 2, reason: null },
    samples: [0, 1].map((time) => ({ time, lapTime: time, distance: null, lapNumber: null, values: { "import:speed": 100 + time * 10 } })) }],
  diagnostics: { missingTime: 0, invalidValues: 0 }
};

function Harness() {
  const value = useTelemetryImport();
  return <>
    <button onClick={() => value.inspect(firstFile)}>Inspect first</button>
    <button onClick={() => value.inspect(replacementFile)}>Replace</button>
    <button onClick={() => value.normalize(mapping)}>Normalize</button>
    <button onClick={value.cancel}>Cancel</button>
    <button onClick={value.clear}>Reset</button>
    <output data-testid="status">{value.status}</output>
    <output data-testid="parsed">{value.parsed?.name ?? "none"}</output>
    <output data-testid="session">{value.session?.file.name ?? "none"}</output>
    <output data-testid="failure">{value.failure ? `${value.failure.code}:${value.failure.row ?? ""}` : "none"}</output>
  </>;
}
function open() { return render(<TelemetryProvider><Harness /></TelemetryProvider>); }
function click(name: string) { fireEvent.click(screen.getByRole("button", { name })); }
function latestWorker() { return ControlledWorker.instances.at(-1)!; }
function inspectSuccess(worker = latestWorker(), value = parsed) {
  worker.deliver({ id: worker.request.id, status: "success", kind: "inspect", parsed: value });
}
function normalizeSuccess(worker = latestWorker()) {
  worker.deliver({ id: worker.request.id, status: "success", kind: "normalize", session });
}

beforeEach(() => {
  ControlledWorker.instances = [];
  vi.stubGlobal("Worker", ControlledWorker);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("local telemetry provider lifecycle", () => {
  it("cancels reading, terminates its worker, and ignores a queued inspection result", () => {
    open(); click("Inspect first");
    const old = latestWorker();
    expect(screen.getByTestId("status")).toHaveTextContent("reading");
    click("Cancel");
    expect(old.terminate).toHaveBeenCalledTimes(1);
    inspectSuccess(old);
    expect(screen.getByTestId("status")).toHaveTextContent("cancelled");
    expect(screen.getByTestId("parsed")).toHaveTextContent("none");
    expect(screen.getByTestId("session")).toHaveTextContent("none");
  });

  it("keeps a replacement active despite old results and mismatched response identifiers", () => {
    open(); click("Inspect first");
    const old = latestWorker();
    click("Replace");
    const current = latestWorker();
    expect(old.terminate).toHaveBeenCalledTimes(1);
    expect(current.request).toMatchObject({ kind: "inspect", file: replacementFile });
    inspectSuccess(old);
    current.deliver({ id: old.request.id, status: "error", code: "READ_FAILED" });
    expect(screen.getByTestId("status")).toHaveTextContent("reading");
    inspectSuccess(current, { ...parsed, name: replacementFile.name, size: replacementFile.size });
    old.deliver({ id: old.request.id, status: "error", code: "INVALID_CSV" });
    expect(screen.getByTestId("status")).toHaveTextContent("inspected");
    expect(screen.getByTestId("parsed")).toHaveTextContent(replacementFile.name);
    expect(screen.getByTestId("failure")).toHaveTextContent("none");
  });

  it("retains the preview after normalization failure and lets a retry supersede old responses", () => {
    open(); click("Inspect first"); inspectSuccess(); click("Normalize");
    const failed = latestWorker();
    expect(failed.request).toMatchObject({ kind: "normalize", parsed, mapping });
    failed.deliver({ id: failed.request.id, status: "error", code: "NON_MONOTONIC_TIME", row: 3 });
    expect(failed.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("failure")).toHaveTextContent("NON_MONOTONIC_TIME:3");
    expect(screen.getByTestId("parsed")).toHaveTextContent(firstFile.name);
    expect(screen.getByTestId("session")).toHaveTextContent("none");
    click("Normalize");
    const retry = latestWorker();
    expect(screen.getByTestId("status")).toHaveTextContent("normalizing");
    expect(screen.getByTestId("failure")).toHaveTextContent("none");
    normalizeSuccess(failed);
    expect(screen.getByTestId("status")).toHaveTextContent("normalizing");
    normalizeSuccess(retry);
    failed.deliver({ id: failed.request.id, status: "error", code: "INVALID_MAPPING" });
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
    expect(screen.getByTestId("session")).toHaveTextContent(firstFile.name);
    expect(screen.getByTestId("failure")).toHaveTextContent("none");
  });

  it("cancels normalization without losing its preview or accepting a late completed session", () => {
    open(); click("Inspect first"); inspectSuccess(); click("Normalize");
    const cancelled = latestWorker();
    click("Cancel"); normalizeSuccess(cancelled);
    expect(cancelled.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("cancelled");
    expect(screen.getByTestId("parsed")).toHaveTextContent(firstFile.name);
    expect(screen.getByTestId("session")).toHaveTextContent("none");
    click("Normalize"); normalizeSuccess();
    expect(screen.getByTestId("status")).toHaveTextContent("ready");
  });

  it("discards pending and completed data on reset or provider unmount", () => {
    let view = open(); click("Inspect first");
    const pending = latestWorker();
    view.unmount();
    expect(pending.terminate).toHaveBeenCalledTimes(1);
    inspectSuccess(pending);
    view = open();
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("parsed")).toHaveTextContent("none");
    click("Inspect first");
    const resetPending = latestWorker();
    click("Reset"); inspectSuccess(resetPending);
    expect(resetPending.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("parsed")).toHaveTextContent("none");
    click("Inspect first"); inspectSuccess(); click("Normalize"); normalizeSuccess();
    expect(screen.getByTestId("session")).toHaveTextContent(firstFile.name);
    click("Reset");
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("parsed")).toHaveTextContent("none");
    expect(screen.getByTestId("session")).toHaveTextContent("none");
    click("Inspect first"); inspectSuccess(); click("Normalize"); normalizeSuccess();
    view.unmount(); open();
    expect(screen.getByTestId("status")).toHaveTextContent("idle");
    expect(screen.getByTestId("parsed")).toHaveTextContent("none");
    expect(screen.getByTestId("session")).toHaveTextContent("none");
  });

  it("reports a worker runtime failure safely and supports a fresh inspection", () => {
    open(); click("Inspect first");
    const failed = latestWorker();
    expect(failed.fail().defaultPrevented).toBe(true);
    expect(failed.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("failure")).toHaveTextContent("worker_error:");
    click("Inspect first"); inspectSuccess();
    expect(screen.getByTestId("status")).toHaveTextContent("inspected");
    expect(screen.getByTestId("failure")).toHaveTextContent("none");
  });

  it("does not send file contents to network, browser storage, or console", () => {
    const fetch = vi.fn();
    const xhr = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("XMLHttpRequest", xhr);
    const storage = [vi.spyOn(Storage.prototype, "getItem"), vi.spyOn(Storage.prototype, "setItem"), vi.spyOn(Storage.prototype, "removeItem"), vi.spyOn(Storage.prototype, "clear")];
    const logs = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    open(); click("Inspect first"); inspectSuccess(); click("Normalize"); normalizeSuccess(); click("Reset");
    expect(fetch).not.toHaveBeenCalled();
    expect(xhr).not.toHaveBeenCalled();
    for (const operation of [...storage, ...logs]) expect(operation).not.toHaveBeenCalled();
  });
});
