import { act, cleanup, renderHook } from "@testing-library/react";
import type { LoadJob } from "@cortex/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSessionLoad } from "./use-session-load";

function job(id: string, status: LoadJob["status"] = "running"): LoadJob {
  return { requestId: "test", id, status, stage: "download", progress: null, message: "Loading",
    source: null, sessionId: status === "succeeded" ? "spa" : null, error: null };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function apiMock() {
  return {
    createJob: vi.fn().mockResolvedValue(job("a")),
    getJob: vi.fn().mockResolvedValue(job("a")),
    cancelJob: vi.fn().mockResolvedValue(job("a", "cancelled"))
  };
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("session load lifecycle", () => {
  it("backs off repeated polling and stops at a terminal response", async () => {
    const api = apiMock();
    const { result } = renderHook(() => useSessionLoad(api));
    await act(() => result.current.start());
    expect(api.getJob).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(649));
    expect(api.getJob).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(api.getJob).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(974));
    expect(api.getJob).toHaveBeenCalledTimes(2);
    api.getJob.mockResolvedValue(job("a", "succeeded"));
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(result.current.state).toBe("ready");
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(api.getJob).toHaveBeenCalledTimes(3);
  });

  it("ignores a successful poll that arrives after cancellation", async () => {
    const api = apiMock();
    const poll = deferred<LoadJob>();
    api.getJob.mockReturnValue(poll.promise);
    const { result } = renderHook(() => useSessionLoad(api));
    await act(() => result.current.start());
    await act(() => result.current.cancel());
    await act(async () => { poll.resolve(job("a", "succeeded")); });
    expect(result.current.state).toBe("cancelled");
    expect(result.current.job?.status).toBe("cancelled");
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(api.getJob).toHaveBeenCalledTimes(1);
  });

  it("cancels delayed creation before allowing a retry to create a new job", async () => {
    const api = apiMock();
    const creation = deferred<LoadJob>();
    const events: string[] = [];
    api.createJob.mockImplementationOnce(() => { events.push("create a"); return creation.promise; });
    api.createJob.mockImplementationOnce(() => { events.push("create b"); return Promise.resolve(job("b", "succeeded")); });
    api.cancelJob.mockImplementation(async () => { events.push("cancel a"); return job("a", "cancelled"); });
    const { result } = renderHook(() => useSessionLoad(api));
    let first!: Promise<void>;
    await act(async () => { first = result.current.start(); });
    let cancellation!: Promise<void>;
    act(() => { cancellation = result.current.cancel(); });
    expect(result.current.state).toBe("cancelled");
    let retry!: Promise<void>;
    await act(async () => { retry = result.current.start(); });
    expect(api.createJob).toHaveBeenCalledTimes(1);
    await act(async () => { creation.resolve(job("a")); await Promise.all([first, cancellation, retry]); });
    expect(events).toEqual(["create a", "cancel a", "create b"]);
    expect(result.current.state).toBe("ready");
    expect(result.current.job?.id).toBe("b");
    expect(api.getJob).not.toHaveBeenCalled();
  });

  it("ignores an older poll after a fresh attempt succeeds", async () => {
    const api = apiMock();
    const old = deferred<LoadJob>();
    api.getJob.mockReturnValue(old.promise);
    api.createJob.mockResolvedValueOnce(job("a")).mockResolvedValueOnce(job("b", "succeeded"));
    const { result } = renderHook(() => useSessionLoad(api));
    await act(() => result.current.start());
    await act(() => result.current.start());
    await act(async () => { old.resolve(job("a", "failed")); });
    expect(result.current.state).toBe("ready");
    expect(result.current.job?.id).toBe("b");
  });

  it("keeps the cancellation barrier through multiple cancelled retries", async () => {
    const api = apiMock();
    const creation = deferred<LoadJob>();
    const events: string[] = [];
    api.createJob.mockImplementationOnce(() => { events.push("create a"); return creation.promise; });
    api.createJob.mockImplementationOnce(() => { events.push("create c"); return Promise.resolve(job("c", "succeeded")); });
    api.cancelJob.mockImplementation(async () => { events.push("cancel a"); return job("a", "cancelled"); });
    const { result } = renderHook(() => useSessionLoad(api));
    let first!: Promise<void>;
    await act(async () => { first = result.current.start(); });
    let cancelA!: Promise<void>;
    act(() => { cancelA = result.current.cancel(); });
    let second!: Promise<void>;
    await act(async () => { second = result.current.start(); });
    let cancelB!: Promise<void>;
    act(() => { cancelB = result.current.cancel(); });
    let third!: Promise<void>;
    await act(async () => { third = result.current.start(); });
    expect(api.createJob).toHaveBeenCalledTimes(1);
    await act(async () => { creation.resolve(job("a")); await Promise.all([first, cancelA, second, cancelB, third]); });
    expect(events).toEqual(["create a", "cancel a", "create c"]);
    expect(result.current.state).toBe("ready");
    expect(result.current.job?.id).toBe("c");
  });

  it("does not resume polling when a response arrives after unmount", async () => {
    const api = apiMock();
    const old = deferred<LoadJob>();
    api.getJob.mockReturnValue(old.promise);
    const { result, unmount } = renderHook(() => useSessionLoad(api));
    await act(() => result.current.start());
    unmount();
    await act(async () => { old.resolve(job("a")); });
    await act(() => vi.advanceTimersByTimeAsync(10000));
    expect(api.getJob).toHaveBeenCalledTimes(1);
    expect(api.cancelJob).not.toHaveBeenCalled();
  });

  it("can retry a failed creation and keeps a completed job ready if cancel is too late", async () => {
    const api = apiMock();
    api.createJob.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(job("b", "succeeded"));
    api.cancelJob.mockResolvedValue(job("b", "succeeded"));
    const { result } = renderHook(() => useSessionLoad(api));
    await act(() => result.current.start());
    expect(result.current.state).toBe("error");
    await act(() => result.current.start());
    await act(() => result.current.cancel());
    expect(result.current.state).toBe("ready");
    expect(result.current.job?.id).toBe("b");
  });
});
