import type { components } from "@cortex/contracts";

export type TelemetryAxis = components["schemas"]["ComparisonSeries"]["axis"];
type Sample = components["schemas"]["TelemetrySample"];
type Channel = components["schemas"]["ChannelDefinition"];
type Series = components["schemas"]["ComparisonSeries"];
export const sampleAxis = (sample: Sample, axis: TelemetryAxis): number | null =>
  axis === "globalTime" ? sample.time : axis === "lapTime" ? sample.lapTime : sample.distance;
const clock = (sample: Sample) => sample.time ?? sample.lapTime;
const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
export const numericValue = (value: unknown): number | null => typeof value === "boolean" ? Number(value) : typeof value === "number" && Number.isFinite(value) ? value : null;

/** Distance alignment requires original distance and time for every selected record. */
export function supportsDistance(series: Series[]): boolean {
  return series.length > 0 && series.every((item) => {
    let previous = -Infinity;
    let previousTime = -Infinity;
    return item.samples.length >= 2 && item.samples.every((sample) => {
      const distance = sample.distance;
      const time = clock(sample);
      if (!finite(distance) || !finite(time) || distance <= previous || time <= previousTime) return false;
      previous = distance;
      previousTime = time;
      return true;
    });
  });
}

/** Read a source sample; a missing record or a long temporal gap is a barrier. */
export function sampleAtCursor(samples: Sample[], axis: TelemetryAxis, cursor: number | null): Sample | null {
  if (cursor === null) return null;
  let candidate = -1;
  let latest = -Infinity;
  for (let index = 0; index < samples.length; index++) {
    const value = sampleAxis(samples[index]!, axis);
    if (finite(value) && value <= cursor && value > latest) { latest = value; candidate = index; }
  }
  if (candidate < 0) return null;
  const sample = samples[candidate]!;
  if (!finite(clock(sample))) return null;
  if (cursor === latest) return sample;
  if (axis !== "distance" && cursor - latest > 2) return null;
  const next = samples[candidate + 1];
  if (!next) return axis === "distance" ? null : sample;
  const nextAxis = sampleAxis(next, axis);
  const nextClock = clock(next);
  if (!finite(nextAxis) || !finite(nextClock) || nextAxis <= latest || nextClock <= clock(sample)! || (axis === "distance" && nextClock - clock(sample)! > 2)) return null;
  return sample;
}

export type PlotPoint = { x: number; y: number };
/** Segments retain source order and evaluate gaps in seconds, including distance plots. */
export function channelSegments(samples: Sample[], channel: Channel, axis: TelemetryAxis, range: { start: number; end: number }, clip: number | null = null): PlotPoint[][] {
  const segments: PlotPoint[][] = [];
  let current: PlotPoint[] | null = null;
  let previousX: number | null = null;
  let previousTime: number | null = null;
  for (const sample of samples) {
    const x = sampleAxis(sample, axis);
    const y = numericValue(sample.values[channel.id]);
    const time = clock(sample);
    if (!finite(x) || y === null || !finite(time) || x < range.start || x > range.end || (clip !== null && x > clip)) {
      current = null; previousX = null; previousTime = null; continue;
    }
    if (previousX !== null && previousTime !== null && (x <= previousX || time <= previousTime || time - previousTime > 2)) current = null;
    if (!current) { current = []; segments.push(current); }
    current.push({ x, y }); previousX = x; previousTime = time;
  }
  return segments;
}
