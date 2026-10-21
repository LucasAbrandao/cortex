import type { TrackResponse } from "@cortex/contracts";
import { visualTrackPosition } from "./race-explorer-model";
type Segment = TrackResponse["segments"][number];
type Marker = { driver: string; x: number; y: number; heading?: number; estimated?: boolean };

export function visualMarkers(segments: Segment[], drivers: string[], time: number): Marker[] {
  return visualMarkersFromIndex(indexTrackSamples(segments), drivers, time);
}
export function indexTrackSamples(segments: Segment[]): Map<string, Segment["samples"]> {
  const byDriver = new Map<string, Segment[]>();
  for (const segment of segments) {
    const driverSegments = byDriver.get(segment.driver) ?? [];
    driverSegments.push(segment);
    byDriver.set(segment.driver, driverSegments);
  }

  const result = new Map<string, Segment["samples"]>();
  for (const [driver, driverSegments] of byDriver) {
    const ordered = driverSegments.map((segment) => {
      let minimumTime = Infinity;
      let maximumTime = -Infinity;
      for (const sample of segment.samples) {
        if (sample.time === null || !Number.isFinite(sample.time)) continue;
        minimumTime = Math.min(minimumTime, sample.time);
        maximumTime = Math.max(maximumTime, sample.time);
      }
      return { segment, minimumTime, maximumTime };
    }).sort((a, b) => a.minimumTime - b.minimumTime || (a.segment.lap ?? Infinity) - (b.segment.lap ?? Infinity));

    const samples: Segment["samples"] = [];
    let previous: typeof ordered[number] | undefined;
    for (const current of ordered) {
      if (current.segment.samples.length === 0) continue;
      if (previous) {
        const last = previous.segment.samples.at(-1)!;
        const first = current.segment.samples[0];
        const consecutive = previous.segment.lap !== null && current.segment.lap === previous.segment.lap + 1;
        const orderedBoundary = last.time !== null && first.time !== null
          && Number.isFinite(last.time) && Number.isFinite(first.time)
          && last.time === previous.maximumTime && first.time === current.minimumTime
          && last.time < first.time;
        if (!consecutive || !orderedBoundary) {
          // Internal separator: never estimate between blocks without proven adjacency.
          samples.push({ time: null, lapTime: null, lapNumber: null, x: null, y: null, onTrack: null });
        }
      }
      // Preserve original order: invalid samples and time discontinuities are barriers.
      samples.push(...current.segment.samples);
      previous = current;
    }
    result.set(driver, samples);
  }
  return result;
}
export function visualMarkersFromIndex(index: Map<string, Segment["samples"]>, drivers: string[], time: number): Marker[] {
  return drivers.flatMap((driver) => {
    const samples = index.get(driver) ?? [];
    const position = visualTrackPosition(samples, time);
    return position ? [{ driver, ...position }] : [];
  });
}
