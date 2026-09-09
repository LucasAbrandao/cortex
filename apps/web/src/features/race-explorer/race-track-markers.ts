import type { TrackResponse } from "@cortex/contracts";
import { visualTrackPosition } from "./race-explorer-model";
type Segment = TrackResponse["segments"][number];
type Marker = { driver: string; x: number; y: number; heading?: number; estimated?: boolean };

export function visualMarkers(segments: Segment[], drivers: string[], time: number): Marker[] {
  return visualMarkersFromIndex(indexTrackSamples(segments), drivers, time);
}
export function indexTrackSamples(segments: Segment[]): Map<string, Segment["samples"]> {
  const result = new Map<string, Segment["samples"]>();
  for (const segment of segments) result.set(segment.driver, [...(result.get(segment.driver) ?? []), ...segment.samples]);
  for (const samples of result.values()) samples.sort((a, b) => (a.time ?? Infinity) - (b.time ?? Infinity));
  return result;
}
export function visualMarkersFromIndex(index: Map<string, Segment["samples"]>, drivers: string[], time: number): Marker[] {
  return drivers.flatMap((driver) => {
    const samples = index.get(driver) ?? [];
    const position = visualTrackPosition(samples, time);
    return position ? [{ driver, ...position }] : [];
  });
}
