import type { SeriesResponse } from "@cortex/contracts";
import { describe, expect, it } from "vitest";
import { activeChannelSamples, averageChannelValue, gearChanges, maxChannelValue } from "./race-metrics";

function series(values: Array<number | boolean | null>): SeriesResponse["series"][number] {
  return {
    driver: "PIA", lap: 7, axis: "globalTime",
    availability: { status: "partial", reason: null, totalSamples: values.length, validSamples: values.filter((value) => value !== null).length },
    samples: values.map((gear, time) => ({ time, lapTime: time, distance: null, lapNumber: 7, values: { gear } }))
  };
}

describe("original lap metrics", () => {
  it("counts only adjacent numeric gear changes across complete runs", () => {
    expect(gearChanges(series([3, null, 4]))).toBe(0);
    expect(gearChanges(series([3, 4, null, 4, 5]))).toBe(2);
    expect(gearChanges(series([3, Number.NaN, 4, Infinity, 5, false, 6]))).toBe(0);
  });

  it("preserves zero and distinguishes unavailable gear from no observed changes", () => {
    expect(gearChanges(series([0, 0, 1]))).toBe(1);
    expect(gearChanges(series([0, null, 0]))).toBe(0);
    expect(gearChanges(series([null, null]))).toBeNull();
    expect(gearChanges(series([]))).toBeNull();
  });

  it("preserves numeric and boolean sample aggregation without filling absences", () => {
    const samples = series([0, null, 4, false, true]);
    expect(maxChannelValue(samples, "gear")).toBe(4);
    expect(averageChannelValue(samples, "gear")).toBe(1.25);
    expect(activeChannelSamples(samples, "gear")).toBe(2);
    expect(activeChannelSamples(series([false, 0, null]), "gear")).toBe(0);
    expect(maxChannelValue(samples, "missing")).toBeNull();
    expect(averageChannelValue(samples, "missing")).toBeNull();
    expect(activeChannelSamples(samples, "missing")).toBeNull();
  });
});
