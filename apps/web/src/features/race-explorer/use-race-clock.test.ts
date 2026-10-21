import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRaceClock } from "./use-race-clock";

function controlledFrames() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
  const cancel = vi.fn((frame: number) => pending.delete(frame));
  vi.stubGlobal("requestAnimationFrame", request);
  vi.stubGlobal("cancelAnimationFrame", cancel);
  return {
    pending, cancel,
    advance: (now: number) => act(() => {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(now));
    })
  };
}

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Race replay clock", () => {
  it("plays from the current cursor and pauses without leaving a scheduled tick", () => {
    const frames = controlledFrames();
    const { result } = renderHook(() => useRaceClock(0, 100, null));
    act(() => { result.current.resetTime(10); result.current.setPlaying(true); });
    frames.advance(0); frames.advance(500);
    expect(result.current.time).toBe(10.5);
    expect(result.current.playing).toBe(true);
    act(() => result.current.setPlaying(false));
    expect(frames.pending.size).toBe(0);
    frames.advance(1500);
    expect(result.current.time).toBe(10.5);
    expect(result.current.playing).toBe(false);
  });

  it("reanchors a seek while playing and clamps it to the global bounds", () => {
    const frames = controlledFrames();
    const { result } = renderHook(() => useRaceClock(0, 100, null));
    act(() => { result.current.resetTime(10); result.current.setPlaying(true); });
    frames.advance(0); frames.advance(500);
    act(() => result.current.seek(50));
    expect(result.current.time).toBe(50);
    expect(result.current.playing).toBe(true);
    expect(frames.pending.size).toBe(1);
    frames.advance(600); frames.advance(1600);
    expect(result.current.time).toBe(51);
    act(() => result.current.seek(-5));
    expect(result.current.time).toBe(0);
    act(() => result.current.seek(105));
    frames.advance(1700);
    expect(result.current.time).toBe(100);
    expect(result.current.playing).toBe(false);
  });

  it("changes playback rate without restarting the cursor or duplicating ticks", () => {
    const frames = controlledFrames();
    const { result } = renderHook(() => useRaceClock(0, 100, null));
    act(() => { result.current.resetTime(10); result.current.setPlaying(true); });
    frames.advance(1000); frames.advance(2000);
    expect(result.current.time).toBe(11);
    act(() => result.current.setSpeed(2));
    expect(result.current.time).toBe(11);
    expect(frames.pending.size).toBe(1);
    frames.advance(2100); frames.advance(3100);
    expect(result.current.time).toBe(13);
  });

  it("stops exactly at the selected lap end and can continue after an explicit play", () => {
    const frames = controlledFrames();
    const { result } = renderHook(() => useRaceClock(0, 100, 20));
    act(() => { result.current.resetTime(10); result.current.setPlaying(true); });
    frames.advance(0); frames.advance(11000);
    expect(result.current.time).toBe(20);
    expect(result.current.playing).toBe(false);
    expect(frames.pending.size).toBe(0);
    act(() => result.current.setPlaying(true));
    frames.advance(12000); frames.advance(13000);
    expect(result.current.time).toBe(21);
    expect(result.current.playing).toBe(true);
  });

  it("stops at the global end rather than overshooting it", () => {
    const frames = controlledFrames();
    const { result } = renderHook(() => useRaceClock(10, 12, null));
    act(() => { result.current.resetTime(10); result.current.setPlaying(true); });
    frames.advance(0); frames.advance(3000);
    expect(result.current.time).toBe(12);
    expect(result.current.playing).toBe(false);
    expect(frames.pending.size).toBe(0);
  });

  it("cancels its active animation frame when unmounted", () => {
    const frames = controlledFrames();
    const view = renderHook(() => useRaceClock(0, 100, null));
    act(() => { view.result.current.resetTime(10); view.result.current.setPlaying(true); });
    frames.advance(0);
    expect(frames.pending.size).toBe(1);
    view.unmount();
    expect(frames.cancel).toHaveBeenCalled();
    expect(frames.pending.size).toBe(0);
    frames.advance(1000);
    expect(frames.pending.size).toBe(0);
  });
});
