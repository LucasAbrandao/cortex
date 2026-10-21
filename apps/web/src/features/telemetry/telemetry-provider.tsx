"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import type { ImportMapping, ImportedTelemetrySession, ParsedTelemetryFile } from "./telemetry-import";

type Status = "idle" | "reading" | "inspected" | "normalizing" | "ready" | "cancelled" | "error";
type Failure = { code: string; row?: number };
type WorkerResponse =
  | { id: number; status: "success"; kind: "inspect"; parsed: ParsedTelemetryFile }
  | { id: number; status: "success"; kind: "normalize"; session: ImportedTelemetrySession }
  | { id: number; status: "error"; code: string; row?: number };
type ImportContext = {
  status: Status; parsed: ParsedTelemetryFile | null; session: ImportedTelemetrySession | null; failure: Failure | null;
  inspect: (file: File) => void; normalize: (mapping: ImportMapping) => void; cancel: () => void; clear: () => void;
};

const TelemetryContext = createContext<ImportContext | null>(null);

/** The route layout owns this memory. No file content enters browser storage or the API. */
export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("idle");
  const [parsed, setParsed] = useState<ParsedTelemetryFile | null>(null);
  const [session, setSession] = useState<ImportedTelemetrySession | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const worker = useRef<Worker | null>(null);
  const attempt = useRef(0);

  const stop = useCallback(() => {
    attempt.current += 1;
    worker.current?.terminate();
    worker.current = null;
  }, []);
  useEffect(() => stop, [stop]);

  const start = useCallback((request: { kind: "inspect"; file: File } | { kind: "normalize"; parsed: ParsedTelemetryFile; mapping: ImportMapping }) => {
    stop();
    const id = attempt.current;
    setFailure(null);
    setSession(null);
    setStatus(request.kind === "inspect" ? "reading" : "normalizing");
    if (request.kind === "inspect") setParsed(null);
    try {
      const next = new Worker(new URL("./telemetry-import.worker.ts", import.meta.url), { type: "module" });
      worker.current = next;
      next.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data;
        if (id !== attempt.current || response.id !== id) return;
        next.terminate();
        worker.current = null;
        if (response.status === "error") {
          setFailure({ code: response.code, row: response.row });
          setStatus("error");
        } else if (response.kind === "inspect") {
          setParsed(response.parsed);
          setStatus("inspected");
        } else {
          setSession(response.session);
          setStatus("ready");
        }
      };
      next.onerror = (event) => {
        event.preventDefault();
        if (id !== attempt.current) return;
        next.terminate();
        worker.current = null;
        setFailure({ code: "worker_error" });
        setStatus("error");
      };
      next.postMessage({ id, ...request });
    } catch {
      if (id !== attempt.current) return;
      stop();
      setFailure({ code: "worker_error" });
      setStatus("error");
    }
  }, [stop]);

  const inspect = useCallback((file: File) => start({ kind: "inspect", file }), [start]);
  const normalize = useCallback((mapping: ImportMapping) => {
    if (parsed) start({ kind: "normalize", parsed, mapping });
  }, [parsed, start]);
  const cancel = useCallback(() => { stop(); setFailure(null); setStatus("cancelled"); }, [stop]);
  const clear = useCallback(() => {
    stop(); setParsed(null); setSession(null); setFailure(null); setStatus("idle");
  }, [stop]);

  return <TelemetryContext.Provider value={{ status, parsed, session, failure, inspect, normalize, cancel, clear }}>{children}</TelemetryContext.Provider>;
}

export function useTelemetryImport() {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error("TelemetryProvider is required");
  return context;
}
