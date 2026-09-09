import { useEffect, useRef, useState } from "react";
import { clampTimeline } from "./race-explorer-model";

export function useRaceClock(minimum: number | null, maximum: number | null, stopAt: number | null) {
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [seekVersion, setSeekVersion] = useState(0);
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (!playing || minimum === null || maximum === null) return;
    let frame = 0;
    let anchor: number | null = null;
    let lastPublished = 0;
    const start = timeRef.current ?? minimum;
    const end = stopAt !== null && stopAt > start ? Math.min(stopAt, maximum) : maximum;
    const tick = (now: number) => {
      anchor ??= now;
      const next = Math.min(end, start + (now - anchor) / 1000 * speed);
      timeRef.current = next;
      if (now - lastPublished >= 33 || next >= end) { setTime(next); lastPublished = now; }
      if (next >= end) setPlaying(false);
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, minimum, maximum, stopAt, seekVersion]);
  const seek = (value: number) => {
    const next = minimum === null || maximum === null ? value : clampTimeline(value, minimum, maximum);
    timeRef.current = next; setTime(next); setSeekVersion((version) => version + 1);
  };
  const resetTime = (value: number) => { timeRef.current = value; setTime(value); setSeekVersion((version) => version + 1); };
  return { time, playing, speed, seekVersion, seek, resetTime, setPlaying, setSpeed };
}
