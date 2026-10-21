import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@cortex/contracts";
import { useRaceSeries } from "./use-race-series";
import { useRaceTracks } from "./use-race-tracks";
import type { LapSelection } from "./use-race-lap-cache";

type Api = ReturnType<typeof createApiClient>;
type Props = { api: Api; session: string; selections: LapSelection[]; channels: string[] };
type Item = LapSelection & { samples: unknown[] };
type View = { items: Item[]; loading: boolean; error: boolean; retry: () => void };
type Adapter = {
  name: string; method: "series" | "track";
  use: (props: Props) => View;
  item: (lap: number) => Item;
  response: (items: Item[]) => unknown;
};

const adapters: Adapter[] = [
  {
    name: "series", method: "series",
    use: ({ api, session, selections, channels }) => {
      const { series, ...state } = useRaceSeries(api, session, selections, channels);
      return { items: series, ...state };
    },
    item: (lap) => ({ driver: "PIA", lap, samples: [], axis: "globalTime", availability: { status: "absent", reason: null, totalSamples: 0, validSamples: 0 } }),
    response: (series) => ({ requestId: "test", sessionId: "spa", series })
  },
  {
    name: "tracks", method: "track",
    use: ({ api, session, selections }) => {
      const { tracks, ...state } = useRaceTracks(api, session, selections);
      return { items: tracks, ...state };
    },
    item: (lap) => ({ driver: "PIA", lap, samples: [] }),
    response: (segments) => ({ requestId: "test", sessionId: "spa", trackAvailable: true, segments })
  }
];

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(adapter: Adapter, requests: ReturnType<typeof deferred>[]) {
  const request = vi.fn<(session: string, payload: unknown) => Promise<unknown>>();
  for (const pending of requests) request.mockReturnValueOnce(pending.promise);
  const api = { [adapter.method]: request } as unknown as Api;
  const props: Props = { api, session: "spa", selections: [{ driver: "PIA", lap: 7 }], channels: ["speed"] };
  return { request, props };
}

async function finish(pending: ReturnType<typeof deferred>, response: unknown) {
  await act(async () => { pending.resolve(response); await pending.promise; });
}

afterEach(cleanup);

describe.each(adapters)("$name lap cache", (adapter) => {
  it("deduplicates valid laps, ignores null laps and reuses the current window across renders", async () => {
    const pending = deferred();
    const { request, props } = setup(adapter, [pending]);
    props.selections = [{ driver: "PIA", lap: null }, { driver: "PIA", lap: 7 }, { driver: "PIA", lap: 7 }];
    const view = renderHook(adapter.use, { initialProps: props });
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.calls[0]?.[1]).toMatchObject({ selections: [{ driver: "PIA", lap: 7 }] });
    await finish(pending, adapter.response([adapter.item(7)]));
    const items = view.result.current.items;
    expect(items).toHaveLength(1);
    view.rerender({ ...props, selections: [{ driver: "PIA", lap: 7 }, { driver: "PIA", lap: null }] });
    expect(request).toHaveBeenCalledOnce();
    expect(view.result.current.items).toBe(items);
    expect(view.result.current.loading).toBe(false);
  });

  it("does not request or remain loading when no valid lap is selected", () => {
    const { request, props } = setup(adapter, []);
    props.selections = [{ driver: "PIA", lap: null }];
    const { result } = renderHook(adapter.use, { initialProps: props });
    expect(request).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ items: [], loading: false, error: false });
  });

  it("hides cached data in every render of a new session", async () => {
    const first = deferred(); const second = deferred();
    const { request, props } = setup(adapter, [first, second]);
    const renders: Item[][] = [];
    const view = renderHook((current: Props) => {
      const state = adapter.use(current);
      renders.push(state.items);
      return state;
    }, { initialProps: props });
    await finish(first, adapter.response([adapter.item(7)]));
    expect(view.result.current.items).toHaveLength(1);
    renders.length = 0;
    view.rerender({ ...props, session: "another-session" });
    expect(renders.length).toBeGreaterThan(0);
    expect(renders.every((items) => items.length === 0)).toBe(true);
    expect(request.mock.calls[1]?.[0]).toBe("another-session");
    await finish(second, adapter.response([adapter.item(7)]));
    expect(view.result.current.items).toHaveLength(1);
  });

  it("ignores an old session settlement while the new session is pending", async () => {
    const first = deferred(); const second = deferred();
    const { request, props } = setup(adapter, [first, second]);
    const view = renderHook(adapter.use, { initialProps: props });
    view.rerender({ ...props, session: "another-session" });
    await finish(first, adapter.response([adapter.item(7)]));
    expect(view.result.current).toMatchObject({ items: [], loading: true, error: false });
    expect(request).toHaveBeenCalledTimes(2);
    await finish(second, adapter.response([adapter.item(7)]));
    expect(view.result.current.items).toHaveLength(1);
    expect(view.result.current.loading).toBe(false);
  });

  it("ignores late failure after unmount without issuing another request", async () => {
    const pending = deferred();
    const { request, props } = setup(adapter, [pending]);
    const view = renderHook(adapter.use, { initialProps: props });
    view.unmount();
    await act(async () => { pending.reject(new Error("offline")); await pending.promise.catch(() => undefined); });
    expect(request).toHaveBeenCalledOnce();
  });

  it("retries missing laps without requesting already cached siblings", async () => {
    const first = deferred(); const second = deferred();
    const { request, props } = setup(adapter, [first, second]);
    props.selections.push({ driver: "PIA", lap: 8 });
    const view = renderHook(adapter.use, { initialProps: props });
    await finish(first, adapter.response([adapter.item(7)]));
    expect(view.result.current).toMatchObject({ loading: false, error: true });
    expect(view.result.current.items.map((item) => item.lap)).toEqual([7]);
    act(() => view.result.current.retry());
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ selections: [{ driver: "PIA", lap: 8 }] });
    act(() => view.result.current.retry());
    expect(request).toHaveBeenCalledTimes(2);
    await finish(second, adapter.response([adapter.item(8)]));
    expect(view.result.current.items.map((item) => item.lap)).toEqual([7, 8]);
    expect(view.result.current).toMatchObject({ loading: false, error: false });
  });

  it("does not retain laps outside the caller's current and next-lap window", async () => {
    const first = deferred(); const second = deferred();
    const { request, props } = setup(adapter, [first, second]);
    props.selections.push({ driver: "PIA", lap: 8 });
    const view = renderHook(adapter.use, { initialProps: props });
    await finish(first, adapter.response([adapter.item(7), adapter.item(8)]));
    view.rerender({ ...props, selections: [{ driver: "PIA", lap: 8 }] });
    expect(request).toHaveBeenCalledOnce();
    expect(view.result.current.items.map((item) => item.lap)).toEqual([8]);
    view.rerender(props);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1]).toMatchObject({ selections: [{ driver: "PIA", lap: 7 }] });
    await finish(second, adapter.response([adapter.item(7)]));
    expect(view.result.current.items.map((item) => item.lap)).toEqual([7, 8]);
  });
});

describe("series channel context", () => {
  const adapter = adapters[0]!;

  it("hides old channels immediately and ignores their pending completion", async () => {
    const first = deferred(); const second = deferred(); const third = deferred();
    const { request, props } = setup(adapter, [first, second, third]);
    const renders: Item[][] = [];
    const view = renderHook((current: Props) => {
      const state = adapter.use(current);
      renders.push(state.items);
      return state;
    }, { initialProps: props });
    await finish(first, adapter.response([adapter.item(7)]));
    renders.length = 0;
    view.rerender({ ...props, channels: ["brake"] });
    expect(renders.every((items) => items.length === 0)).toBe(true);
    view.rerender({ ...props, channels: ["gear"] });
    await finish(second, adapter.response([adapter.item(7)]));
    expect(view.result.current).toMatchObject({ items: [], loading: true, error: false });
    expect(request.mock.calls[2]?.[1]).toMatchObject({ channels: ["gear"], axis: "globalTime" });
    await finish(third, adapter.response([adapter.item(7)]));
    expect(view.result.current).toMatchObject({ loading: false, error: false });
  });

  it("does not report perpetual loading when the session has no channels", () => {
    const { request, props } = setup(adapter, []);
    props.channels = [];
    const { result } = renderHook(adapter.use, { initialProps: props });
    expect(request).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ items: [], loading: false, error: false });
  });
});
