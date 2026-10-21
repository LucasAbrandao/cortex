import type { SeriesResponse, SessionManifestResponse } from "@cortex/contracts";

type Series = SeriesResponse["series"][number];
type Manifest = SessionManifestResponse["manifest"];

export function lapTimeFor(manifest: Manifest, driver: string, lap: number | null): number | null {
  return manifest.laps.find((item) => item.driver === driver && item.number === lap)?.lapTime ?? null;
}

function chartValue(value: unknown): number | null {
  if (typeof value === "boolean") return value ? 1 : 0;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function channelValues(series: Series, channel: string): number[] {
  return series.samples.map((sample) => chartValue(sample.values[channel])).filter((value): value is number => value !== null);
}

export function maxChannelValue(series: Series, channel: string): number | null {
  const values = channelValues(series, channel);
  return values.length ? Math.max(...values) : null;
}

export function averageChannelValue(series: Series, channel: string): number | null {
  const values = channelValues(series, channel);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function activeChannelSamples(series: Series, channel: string): number | null {
  const values = channelValues(series, channel);
  return values.length ? values.filter((value) => value > 0).length : null;
}

/** A missing or invalid gear breaks adjacency; it cannot prove a gear change. */
export function gearChanges(series: Series): number | null {
  let previous: number | null = null;
  let observed = false;
  let changes = 0;
  for (const sample of series.samples) {
    const gear = sample.values.gear;
    if (typeof gear !== "number" || !Number.isFinite(gear)) { previous = null; continue; }
    observed = true;
    if (previous !== null && gear !== previous) changes += 1;
    previous = gear;
  }
  return observed ? changes : null;
}
