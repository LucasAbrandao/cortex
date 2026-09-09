"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { createApiClient, type LoadJob } from "@cortex/contracts";

import { StatePanel, type VisualState } from "../../shared/state-panel";
import { useCortex } from "../navigation/app-shell";
import { RaceStage } from "../race-explorer/race-stage";
import { RaceExplorerScreen } from "../race-explorer/race-explorer-screen";

type LoadState = "initial" | "ready" | "cancelled" | Exclude<VisualState, "warning" | "unavailable">;

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api";

export function SessionLoadScreen() {
  const { t, locale } = useCortex();
  const api = useMemo(() => createApiClient(apiBaseUrl), []);
  const [state, setState] = useState<LoadState>("initial");
  const [job, setJob] = useState<LoadJob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef<number | null>(null);

  const clearPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const applyJob = useCallback((nextJob: LoadJob) => {
    setJob(nextJob);
    if (nextJob.status === "succeeded") {
      setState("ready");
    } else if (nextJob.status === "cancelled") {
      setState("cancelled");
    } else if (nextJob.status === "failed") {
      setState("error");
    }
  }, []);

  const poll = useCallback(async (jobId: string) => {
    try {
      const nextJob = await api.getJob(jobId);
      applyJob(nextJob);
      if (nextJob.status === "queued" || nextJob.status === "running") {
        pollTimer.current = setTimeout(() => void poll(jobId), 650);
      }
    } catch {
      setState("error");
    }
  }, [api, applyJob]);

  const start = useCallback(async () => {
    clearPolling();
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    setJob(null);
    setState("loading");
    try {
      const created = await api.createJob({ year: 2025, event: "Belgium", session: "R" });
      applyJob(created);
      if (created.status === "queued" || created.status === "running") {
        void poll(created.id);
      }
    } catch {
      setState("error");
    }
  }, [api, applyJob, clearPolling, poll]);

  const cancel = useCallback(async () => {
    clearPolling();
    if (job !== null) {
      try {
        applyJob(await api.cancelJob(job.id));
      } catch {
        setState("error");
        return;
      }
    }
    setState("cancelled");
  }, [api, applyJob, clearPolling, job]);

  useEffect(() => {
    if (state !== "loading" || startedAt.current === null) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - (startedAt.current ?? Date.now())) / 1000));
    }, 250);
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => clearPolling, [clearPolling]);

  const description = {
    initial: t.sessionInitial,
    loading: t.sessionLoading,
    cancelled: t.sessionCancelled,
    error: t.sessionError,
    empty: t.sessionEmpty,
    unavailable: t.sessionUnavailable,
    ready: t.sessionReady
  }[state];
  const source = job?.source === "normalized-cache" ? t.sourceNormalizedCache : t.sourceUnknown;


  return (
    <RaceStage locale={locale} real={state === "ready" && !!job?.sessionId}>{state === "ready" && job?.sessionId ? <RaceExplorerScreen sessionId={job.sessionId} /> : <div className="page-stack session-landing">
      <header className="page-heading">
        <p className="eyebrow">RACE EXPLORER <span> / </span> BELGIUM 2025</p>
        <h1>Spa<span>Francorchamps.</span></h1>
        <p>{locale === "pt-BR" ? "A corrida em perspectiva. Cada volta, um novo detalhe." : "A different perspective. Every lap, a new detail."}</p>
      </header>
      <div className="landing-circuit-meta"><span>01 / BELGIUM</span><span>{locale === "pt-BR" ? "VISTA DO CIRCUITO" : "CIRCUIT VIEW"}</span></div>
      <section className="load-panel" aria-labelledby="load-state-title">
        <p className="label">{t.currentState}</p>
        <h2 id="load-state-title">{description}</h2>
        {state === "loading" ? (
          <>
            <dl className="job-meta" aria-live="polite">
              <div><dt>{t.jobStage}</dt><dd>{job?.stage ?? "catalog"}</dd></div>
              <div><dt>{t.jobElapsed}</dt><dd>{elapsedSeconds}s</dd></div>
              <div><dt>{t.jobSource}</dt><dd>{source}</dd></div>
            </dl>
            <StatePanel state="loading" body={t.jobProgressBody}><button className="button button-secondary" onClick={() => void cancel()}>{t.cancel}</button></StatePanel>
          </>
        ) : null}
        {state === "cancelled" ? <StatePanel state="warning" body={t.jobProgressBody}><button className="button button-secondary" onClick={() => void start()}>{t.retry}</button></StatePanel> : null}
        {state === "error" ? <StatePanel state="error" body={t.jobProgressBody}><button className="button button-secondary" onClick={() => void start()}>{t.retry}</button></StatePanel> : null}
        {state === "ready" ? <p className="job-ready" role="status">{t.jobReady}</p> : null}
        <div className="action-row state-actions">
          {state === "initial" || state === "ready" ? <button className="button button-primary" onClick={() => void start()}>{t.showLoading}</button> : null}
          <Link className="button button-quiet" href="/f1">{t.backToCatalog}</Link>
        </div>
      </section>
    </div>}</RaceStage>
  );
}
