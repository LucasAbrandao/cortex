export type PlaybackMode = "race" | "comparison";
export type EndBehavior = "pause" | "continue";

export type LapLike = {
  driver: string;
  number: number | null;
  lapTime: number | null;
  time: number | null;
};

export type LapWindow = {
  driver: string;
  lap: number;
  start: number;
  end: number;
  duration: number;
};

/**
 * A lap boundary is derived only when FastF1 supplied both its completion time
 * and its duration. A missing term stays unavailable; it is never guessed from
 * a neighbouring lap.
 */
export function lapWindowFor(lap: LapLike | undefined): LapWindow | null {
  if (!lap || lap.number === null || !isFinitePositive(lap.time) || !isFinitePositive(lap.lapTime)) return null;
  const start = lap.time - lap.lapTime;
  return start >= 0 ? { driver: lap.driver, lap: lap.number, start, end: lap.time, duration: lap.lapTime } : null;
}

export function lapWindow(laps: LapLike[], driver: string, number: number | null): LapWindow | null {
  return lapWindowFor(laps.find((lap) => lap.driver === driver && lap.number === number));
}

export function activeLapWindow(laps: LapLike[], driver: string, time: number | null): LapWindow | null {
  if (time === null) return null;
  return laps
    .filter((lap) => lap.driver === driver)
    .map(lapWindowFor)
    .filter((window): window is LapWindow => window !== null)
    .filter((window) => time >= window.start && time <= window.end)
    .at(-1) ?? null;
}

export function maximumComparisonDuration(laps: LapLike[], selections: Array<{ driver: string; lap: number | null }>): number | null {
  const durations = selections.map((selection) => lapWindow(laps, selection.driver, selection.lap)?.duration).filter((value): value is number => typeof value === "number");
  return durations.length ? Math.max(...durations) : null;
}

export function clampTimeline(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function raceBounds(laps: LapLike[], frameTimes: number[]) {
  const windows = laps.map(lapWindowFor).filter((item): item is LapWindow => item !== null);
  const starts = [...windows.map((item) => item.start), ...frameTimes].filter(Number.isFinite);
  const ends = [...windows.map((item) => item.end), ...frameTimes].filter(Number.isFinite);
  return { start: starts.length ? Math.min(...starts) : null, end: ends.length ? Math.max(...ends) : null };
}

/** All overlapping laps plus one future lap per driver, independent of frame rate. */
export function selectionsForWindow(laps: LapLike[], drivers: string[], time: number | null, seconds: number) {
  if (time === null) return [];
  return drivers.flatMap((driver) => {
    const windows = laps.filter((lap) => lap.driver === driver).map(lapWindowFor)
      .filter((item): item is LapWindow => item !== null).sort((a, b) => a.start - b.start);
    const overlapping = windows.filter((item) => item.end >= time - seconds && item.start <= time);
    const next = windows.find((item) => item.start > time);
    return [...overlapping, ...(next ? [next] : [])].map((item) => ({ driver, lap: item.lap }));
  });
}

export function lastAtOrBefore<T>(samples: T[], time: number | null, getTime: (sample: T) => number | null, maxAge = 2): T | null {
  if (time === null) return null;
  let result: T | null = null;
  let latest = -Infinity;
  for (const sample of samples) {
    const timestamp = getTime(sample);
    if (timestamp !== null && timestamp <= time && timestamp > latest && time - timestamp <= maxAge) {
      result = sample; latest = timestamp;
    }
  }
  return result;
}

export type TrackPoint = { time: number | null; x: number | null; y: number | null; onTrack: boolean | null };
export type VisualTrackPosition = { x: number; y: number; heading: number; estimated: boolean };

const maximumVisualGap = 1;
const maximumMetersPerSecond = 150;
const coordinateUnitsPerMeter = 10;

/**
 * Finds a visual-only position between adjacent original FastF1 samples.
 * It never crosses an invalid sample, a time discontinuity or an implausible jump.
 */
export function visualTrackPosition(samples: TrackPoint[], time: number): VisualTrackPosition | null {
  let previous: { time: number; x: number; y: number; onTrack: true } | null = null;
  for (const sample of samples) {
    if (!validTrackPoint(sample)) { previous = null; continue; }
    if (previous === null) {
      if (sample.time === time) return { x: sample.x, y: sample.y, heading: 0, estimated: false };
      previous = sample;
      continue;
    }
    const start = previous.time;
    const end = sample.time;
    if (end <= start) { previous = sample; continue; }
    const duration = end - start;
    const dx = sample.x - previous.x;
    const dy = sample.y - previous.y;
    const distanceMeters = Math.hypot(dx, dy) / coordinateUnitsPerMeter;
    const continuous = duration <= maximumVisualGap && distanceMeters <= maximumMetersPerSecond * duration + 5;
    if (continuous && time >= start && time <= end) {
      const progress = (time - start) / duration;
      return {
        x: previous.x + dx * progress,
        y: previous.y + dy * progress,
        heading: Math.atan2(dy, dx),
        estimated: progress > 0 && progress < 1
      };
    }
    previous = sample;
  }
  return null;
}

function validTrackPoint(point: TrackPoint): point is { time: number; x: number; y: number; onTrack: true } {
  return point.onTrack === true && point.time !== null && point.x !== null && point.y !== null
    && Number.isFinite(point.time) && Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function orderByPosition<T extends { driver: string; position: number | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.driver.localeCompare(b.driver));
}

export function nextPlaybackTime({ current, elapsed, minimum, maximum, selectedLapEnd, mode, endBehavior }: {
  current: number;
  elapsed: number;
  minimum: number;
  maximum: number;
  selectedLapEnd: number | null;
  mode: PlaybackMode;
  endBehavior: EndBehavior;
}): { time: number; stopped: boolean; completedSelectedLap: boolean } {
  const target = current + elapsed;
  if (mode === "race" && endBehavior === "pause" && selectedLapEnd !== null && current < selectedLapEnd && target >= selectedLapEnd) {
    return { time: selectedLapEnd, stopped: true, completedSelectedLap: true };
  }
  if (target >= maximum) return { time: maximum, stopped: true, completedSelectedLap: false };
  return { time: clampTimeline(target, minimum, maximum), stopped: false, completedSelectedLap: false };
}

function isFinitePositive(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
