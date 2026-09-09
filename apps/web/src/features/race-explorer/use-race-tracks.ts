import { useEffect, useMemo, useRef, useState } from "react";
import { createApiClient, type TrackResponse } from "@cortex/contracts";

type Segment = TrackResponse["segments"][number];
type Selection = { driver: string; lap: number | null };
const keyFor = (selection: Selection) => `${selection.driver}:${selection.lap}`;
export function useRaceTracks(api: ReturnType<typeof createApiClient>, sessionId: string, selections: Selection[]) {
  const cache = useRef(new Map<string, Segment>());
  const pending = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const generation = useRef(0);
  const [revision, setRevision] = useState(0);
  const signature = selections.filter((item) => item.lap !== null).map(keyFor).sort().join("|");
  useEffect(() => {
    generation.current += 1; cache.current.clear(); pending.current.clear(); failed.current.clear();
    setRevision((value) => value + 1);
    return () => { generation.current += 1; };
  }, [sessionId]);
  useEffect(() => {
    const wanted = new Set(signature.split("|").filter(Boolean));
    for (const key of cache.current.keys()) if (!wanted.has(key)) cache.current.delete(key);
    const missing = signature.split("|").filter(Boolean).filter((key) => !cache.current.has(key) && !pending.current.has(key) && !failed.current.has(key));
    if (!missing.length) return;
    const requestedGeneration = generation.current;
    missing.forEach((key) => pending.current.add(key));
    const requested = missing.map((key) => { const [driver, lap] = key.split(":"); return { driver: driver!, lap: Number(lap) }; });
    void api.track(sessionId, { selections: requested }).then((response) => {
      if (requestedGeneration !== generation.current) return;
      for (const segment of response.segments) cache.current.set(keyFor(segment), segment);
      for (const key of missing) if (!cache.current.has(key)) failed.current.add(key);
    }).catch(() => { if (requestedGeneration === generation.current) missing.forEach((key) => failed.current.add(key)); }).finally(() => {
      if (requestedGeneration !== generation.current) return;
      missing.forEach((key) => pending.current.delete(key)); setRevision((value) => value + 1);
    });
  }, [api, sessionId, signature, revision]);
  return useMemo(() => {
    const keys = signature.split("|").filter(Boolean);
    return {
      tracks: keys.flatMap((key) => { const segment = cache.current.get(key); return segment ? [segment] : []; }),
      loading: keys.some((key) => !cache.current.has(key) && !failed.current.has(key)),
      error: keys.some((key) => failed.current.has(key)),
      retry: () => { failed.current.clear(); setRevision((value) => value + 1); }
    };
  }, [signature, revision]);
}
