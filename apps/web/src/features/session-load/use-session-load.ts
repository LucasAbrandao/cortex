import { useCallback, useEffect, useRef, useState } from "react";
import type { createApiClient, LoadJob } from "@cortex/contracts";

type Api = Pick<ReturnType<typeof createApiClient>, "createJob" | "getJob" | "cancelJob">;
export type SessionLoadState = "initial" | "loading" | "ready" | "cancelled" | "error";
type Attempt = {
  active: boolean;
  cancelled: boolean;
  creation: Promise<LoadJob> | null;
  cancellation: Promise<void> | null;
  barrier: Promise<void> | null;
};

const INITIAL_POLL_DELAY = 650;
const MAXIMUM_POLL_DELAY = 2500;

/** One load attempt owns its polling; obsolete responses cannot restore the UI. */
export function useSessionLoad(api: Api) {
  const [state, setState] = useState<SessionLoadState>("initial");
  const [job, setJob] = useState<LoadJob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const current = useRef<Attempt | null>(null);
  const mounted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAt = useRef(0);

  const clearPolling = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const ownsUi = useCallback((attempt: Attempt) => mounted.current && current.current === attempt, []);
  const applyJob = useCallback((next: LoadJob) => {
    setJob(next);
    setState(next.status === "succeeded" ? "ready" : next.status === "cancelled" ? "cancelled"
      : next.status === "failed" ? "error" : "loading");
  }, []);

  const start = useCallback(async () => {
    const previous = current.current;
    if (previous) previous.active = false;
    clearPolling();
    const attempt: Attempt = { active: true, cancelled: false, creation: null, cancellation: null,
      barrier: previous?.cancellation ?? previous?.barrier ?? null };
    current.current = attempt;
    startedAt.current = Date.now();
    setElapsedSeconds(0);
    setJob(null);
    setState("loading");

    const isActive = () => ownsUi(attempt) && attempt.active;
    const poll = async (jobId: string, delay: number): Promise<void> => {
      if (!isActive()) return;
      try {
        const next = await api.getJob(jobId);
        if (!isActive()) return;
        applyJob(next);
        if (next.status === "queued" || next.status === "running") {
          timer.current = setTimeout(() => {
            timer.current = null;
            void poll(jobId, Math.min(MAXIMUM_POLL_DELAY, Math.round(delay * 1.5)));
          }, delay);
        }
      } catch {
        if (isActive()) setState("error");
      }
    };

    try {
      // A retry must not join a job whose delayed creation is still being cancelled.
      await attempt.barrier;
      if (!isActive()) return;
      attempt.creation = api.createJob({ year: 2025, event: "Belgium", session: "R" });
      const created = await attempt.creation;
      if (!isActive()) return;
      applyJob(created);
      if (created.status === "queued" || created.status === "running") void poll(created.id, INITIAL_POLL_DELAY);
    } catch {
      if (isActive()) setState("error");
    }
  }, [api, applyJob, clearPolling, ownsUi]);

  const cancel = useCallback(async () => {
    const attempt = current.current;
    if (!attempt || attempt.cancelled) return;
    attempt.active = false;
    attempt.cancelled = true;
    clearPolling();
    setState("cancelled");
    attempt.cancellation = (async () => {
      // Carry earlier cancellation through retries cancelled before their own POST.
      await attempt.barrier;
      // The user may cancel before the POST has returned the job ID.
      const created = await attempt.creation?.catch(() => null);
      if (!created) return;
      try {
        const cancelled = await api.cancelJob(created.id);
        if (ownsUi(attempt)) applyJob(cancelled);
      } catch {
        if (ownsUi(attempt)) setState("error");
      }
    })();
    await attempt.cancellation;
  }, [api, applyJob, clearPolling, ownsUi]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (current.current) current.current.active = false;
      clearPolling();
    };
  }, [clearPolling]);
  useEffect(() => {
    if (state !== "loading") return;
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(interval);
  }, [state]);

  return { state, job, elapsedSeconds, start, cancel };
}
