import { useEffect, useMemo, useRef, useState } from "react";
import { createApiClient, type SeriesResponse } from "@cortex/contracts";

export type Selection = { driver: string; lap: number | null };
export type RaceSeries = SeriesResponse["series"][number];
const keyFor = (selection: Selection) => `${selection.driver}:${selection.lap}`;

/** Cache complete original lap samples. The clock never owns a network request. */
export function useRaceSeries(api: ReturnType<typeof createApiClient>, sessionId: string, selections: Selection[], channels: string[]) {
  const cache = useRef(new Map<string, RaceSeries>());
  const pending = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const signature = selections.map(keyFor).sort().join("|");
  const channelKey = channels.join("|");

  useEffect(() => {
    generation.current += 1;
    cache.current.clear(); pending.current.clear(); failed.current.clear();
    setRevision((value) => value + 1);
    return () => { generation.current += 1; };
  }, [sessionId, channelKey]);

  useEffect(() => {
    const wanted = new Set(signature.split("|").filter(Boolean));
    for (const key of cache.current.keys()) if (!wanted.has(key)) cache.current.delete(key);
    const missing = signature.split("|").filter(Boolean).filter((key) => !cache.current.has(key) && !pending.current.has(key) && !failed.current.has(key));
    if (!missing.length || !channelKey) return;
    const requestedGeneration = generation.current;
    missing.forEach((key) => pending.current.add(key));
    const requested = missing.map((key) => { const [driver, lap] = key.split(":"); return { driver: driver!, lap: Number(lap) }; });
    void api.series(sessionId, { axis: "globalTime", selections: requested, channels: channelKey.split("|") }).then((response) => {
      if (requestedGeneration !== generation.current) return;
      for (const item of response.series) cache.current.set(keyFor(item), item);
      for (const key of missing) if (!cache.current.has(key)) failed.current.add(key);
    }).catch(() => {
      if (requestedGeneration === generation.current) missing.forEach((key) => failed.current.add(key));
    }).finally(() => {
      if (requestedGeneration !== generation.current) return;
      missing.forEach((key) => pending.current.delete(key));
      setRevision((value) => value + 1);
    });
  }, [api, sessionId, signature, channelKey, revision]);

  const result = useMemo(() => {
    const keys = signature.split("|").filter(Boolean);
    return {
      series: keys.flatMap((key) => { const item = cache.current.get(key); return item ? [item] : []; }),
      loading: keys.some((key) => !cache.current.has(key) && !failed.current.has(key)),
      error: keys.some((key) => failed.current.has(key))
    };
  }, [signature, revision]);
  return { ...result, retry: () => { failed.current.clear(); setRevision((value) => value + 1); } };
}
