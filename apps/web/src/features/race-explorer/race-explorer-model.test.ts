import { describe, expect, it } from "vitest";

import { activeLapWindow, lapWindow, maximumComparisonDuration, nextPlaybackTime, raceBounds, selectionsForWindow, lastAtOrBefore, orderByPosition, visualTrackPosition } from "./race-explorer-model";


const laps = [
  { driver: "PIA", number: 7, time: 180, lapTime: 80 },
  { driver: "PIA", number: 8, time: 261, lapTime: 81 },
  { driver: "NOR", number: 9, time: 190, lapTime: 90 },
  { driver: "LEC", number: 10, time: null, lapTime: 88 }
];

describe("Race Explorer time model", () => {
  it("starts at a proven lap start before the first completed-lap frame", () => {
    expect(raceBounds(laps, [180, 261])).toEqual({ start: 100, end: 261 });
    expect(selectionsForWindow(laps, ["PIA"], 170, 60)).toEqual([{ driver: "PIA", lap: 7 }, { driver: "PIA", lap: 8 }]);
    expect(selectionsForWindow(laps, ["LEC"], 170, 60)).toEqual([]);
  });
  it("never reads future or stale samples and preserves false", () => {
    const samples = [{ time: 10, value: false }, { time: 11, value: true }];
    expect(lastAtOrBefore(samples, 10.9, (item) => item.time)?.value).toBe(false);
    expect(lastAtOrBefore(samples, 9, (item) => item.time)).toBeNull();
    expect(lastAtOrBefore(samples, 14, (item) => item.time)).toBeNull();
  });
  it("smooths only adjacent valid position samples and never crosses broken data", () => {
    expect(visualTrackPosition([
      { time: 10, x: 0, y: 0, onTrack: true },
      { time: 10.5, x: 100, y: 0, onTrack: true }
    ], 10.25)).toEqual({ x: 50, y: 0, heading: 0, estimated: true });
    expect(visualTrackPosition([
      { time: 10, x: 0, y: 0, onTrack: true },
      { time: 10.2, x: null, y: 0, onTrack: true },
      { time: 10.4, x: 100, y: 0, onTrack: true }
    ], 10.3)).toBeNull();
    expect(visualTrackPosition([
      { time: 10, x: 0, y: 0, onTrack: true },
      { time: 10.2, x: 5000, y: 0, onTrack: true }
    ], 10.1)).toBeNull();
  });
  it("orders only recorded positions", () => {
    expect(orderByPosition([{ driver: "PIA", position: 2 }, { driver: "NOR", position: 1 }, { driver: "LEC", position: null }]).map((row) => row.driver)).toEqual(["NOR", "PIA", "LEC"]);
  });
  it("derives a lap boundary only from its own complete values", () => {
    expect(lapWindow(laps, "PIA", 7)).toMatchObject({ start: 100, end: 180, duration: 80 });
    expect(lapWindow(laps, "LEC", 10)).toBeNull();
    expect(activeLapWindow(laps, "PIA", 180)?.lap).toBe(8);
    expect(activeLapWindow(laps, "PIA", 99.9)).toBeNull();
  });

  it("uses the longest reliable comparison duration and never repeats a lap", () => {
    expect(maximumComparisonDuration(laps, [{ driver: "PIA", lap: 7 }, { driver: "NOR", lap: 9 }, { driver: "LEC", lap: 10 }])).toBe(90);
    expect(nextPlaybackTime({ current: 89, elapsed: 3, minimum: 0, maximum: 90, selectedLapEnd: null, mode: "comparison", endBehavior: "continue" })).toEqual({ time: 90, stopped: true, completedSelectedLap: false });
  });

  it("pauses at the selected real-race lap boundary only when requested", () => {
    expect(nextPlaybackTime({ current: 178, elapsed: 4, minimum: 0, maximum: 300, selectedLapEnd: 180, mode: "race", endBehavior: "pause" })).toEqual({ time: 180, stopped: true, completedSelectedLap: true });
    expect(nextPlaybackTime({ current: 178, elapsed: 4, minimum: 0, maximum: 300, selectedLapEnd: 180, mode: "race", endBehavior: "continue" })).toEqual({ time: 182, stopped: false, completedSelectedLap: false });
  });
});
