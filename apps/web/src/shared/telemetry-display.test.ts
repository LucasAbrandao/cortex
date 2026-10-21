import { describe, expect, it } from "vitest";
import type { components } from "@cortex/contracts";
import { channelSegments, sampleAtCursor, supportsDistance } from "./telemetry-display";

type Sample = components["schemas"]["TelemetrySample"];
const sample = (time: number | null, distance: number | null, value: number | boolean | null = 0): Sample => ({ time, lapTime: time, distance, lapNumber: null, values: { value } });
const channel: components["schemas"]["ChannelDefinition"] = { id: "value", label: "Value", unit: null, origin: "source", valueType: "continuous", suggestedView: "line" };
const range = { start: 0, end: 1000 };
const series = (samples: Sample[]): components["schemas"]["ComparisonSeries"] => ({ driver: "FILE", lap: null, axis: "distance", samples, availability: { status: "available", validSamples: samples.length, totalSamples: samples.length, reason: null } });

describe("source telemetry rendering", () => {
  it("measures gaps in seconds even when samples are 100 meters apart", () => {
    const samples = [sample(0, 0), sample(1, 100), sample(4, 200), sample(5, 300)];
    expect(channelSegments(samples, channel, "distance", range).map((segment) => segment.map((point) => point.x))).toEqual([[0, 100], [200, 300]]);
    expect(sampleAtCursor(samples, "distance", 50)).toBe(samples[0]);
    expect(sampleAtCursor(samples, "distance", 150)).toBeNull();
    expect(sampleAtCursor(samples, "distance", 301)).toBeNull();
  });
  it("does not connect missing source values or clocks", () => {
    const samples = [sample(0, 0), sample(1, 10, null), sample(2, 20), sample(null, null), sample(4, 40)];
    expect(channelSegments(samples, channel, "globalTime", range).map((segment) => segment.length)).toEqual([1, 1, 1]);
    expect(sampleAtCursor(samples, "globalTime", 2.5)).toBeNull();
  });
  it("retains zero and false while breaking nonmonotonic source segments", () => {
    const samples = [sample(0, 0, false), sample(1, 10), sample(1, 20), sample(.5, 30)];
    expect(channelSegments(samples, channel, "lapTime", range)).toEqual([[{ x: 0, y: 0 }, { x: 1, y: 0 }], [{ x: 1, y: 0 }], [{ x: .5, y: 0 }]]);
  });
  it("requires increasing distance and original time in every series", () => {
    const valid = series([sample(0, 0), sample(1, 100)]);
    expect(supportsDistance([valid])).toBe(true);
    expect(supportsDistance([])).toBe(false);
    for (const samples of [[sample(0, 0)], [sample(0, 0), sample(1, null)], [sample(0, 10), sample(1, 5)], [sample(1, 0), sample(0, 100)]]) expect(supportsDistance([valid, series(samples)])).toBe(false);
  });
  it("ages time readouts in seconds without inventing data at the cursor", () => {
    const samples = [sample(0, null), sample(5, null)];
    expect(sampleAtCursor(samples, "globalTime", 1)).toBe(samples[0]);
    expect(sampleAtCursor(samples, "globalTime", 3)).toBeNull();
    expect(sampleAtCursor(samples, "globalTime", -1)).toBeNull();
  });
});
