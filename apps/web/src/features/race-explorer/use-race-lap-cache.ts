import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";

export type LapSelection = { driver: string; lap: number | null };
type RequestedLap = { driver: string; lap: number };
const keyFor = (selection: LapSelection) => `${selection.driver}:${selection.lap}`;

/** Retain only the requested window (including its caller-selected next laps). */
export function useRaceLapCache<Item extends LapSelection>(
  contextKey: string,
  selections: LapSelection[],
  load: (selections: RequestedLap[]) => Promise<Item[]>,
  enabled = true
) {
  const unique = new Map<string, RequestedLap>();
  for (const { driver, lap } of selections) {
    if (lap !== null && Number.isFinite(lap)) unique.set(keyFor({ driver, lap }), { driver, lap });
  }
  const signature = JSON.stringify([...unique.values()].sort((a, b) => keyFor(a).localeCompare(keyFor(b))));
  const requestedSelections = useMemo(() => JSON.parse(signature) as RequestedLap[], [signature]);
  const scope = useMemo(() => ({
    cache: new Map<string, Item>(), pending: new Set<string>(), failed: new Set<string>(),
    wanted: new Set<string>(), active: false
  }), [contextKey, load, enabled]);
  const [revision, setRevision] = useState(0);

  // A new scope is empty during render; invalidate old settlements at commit,
  // before passive effects or an unmounted request can publish another update.
  useLayoutEffect(() => {
    scope.active = true;
    return () => { scope.active = false; };
  }, [scope]);

  useEffect(() => {
    scope.wanted = new Set(requestedSelections.map(keyFor));
    for (const key of scope.cache.keys()) if (!scope.wanted.has(key)) scope.cache.delete(key);
    for (const key of scope.failed) if (!scope.wanted.has(key)) scope.failed.delete(key);
    if (!enabled) return;
    const missing = requestedSelections.filter((selection) => {
      const key = keyFor(selection);
      return !scope.cache.has(key) && !scope.pending.has(key) && !scope.failed.has(key);
    });
    if (!missing.length) return;
    const keys = missing.map(keyFor);
    const requested = new Set(keys);
    keys.forEach((key) => scope.pending.add(key));
    void (async () => {
      try {
        const items = await load(missing);
        if (!scope.active) return;
        for (const item of items) {
          const key = keyFor(item);
          if (requested.has(key) && scope.wanted.has(key)) scope.cache.set(key, item);
        }
        for (const key of keys) if (scope.wanted.has(key) && !scope.cache.has(key)) scope.failed.add(key);
      } catch {
        if (scope.active) for (const key of keys) if (scope.wanted.has(key)) scope.failed.add(key);
      } finally {
        if (scope.active) {
          keys.forEach((key) => scope.pending.delete(key));
          if (keys.some((key) => scope.wanted.has(key))) setRevision((value) => value + 1);
        }
      }
    })();
  }, [scope, requestedSelections, load, enabled, revision]);

  const retry = useCallback(() => {
    if (!scope.active) return;
    scope.failed.clear();
    setRevision((value) => value + 1);
  }, [scope]);
  return useMemo(() => {
    const keys = requestedSelections.map(keyFor);
    return {
      items: enabled ? keys.flatMap((key) => { const item = scope.cache.get(key); return item ? [item] : []; }) : [],
      loading: enabled && keys.some((key) => !scope.cache.has(key) && !scope.failed.has(key)),
      error: enabled && keys.some((key) => scope.failed.has(key)),
      retry
    };
  }, [scope, requestedSelections, enabled, revision, retry]);
}
