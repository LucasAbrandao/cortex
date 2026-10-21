import { useCallback } from "react";
import { createApiClient, type SeriesResponse } from "@cortex/contracts";
import { useRaceLapCache, type LapSelection } from "./use-race-lap-cache";

export type Selection = LapSelection;
export type RaceSeries = SeriesResponse["series"][number];

/** Cache complete original lap samples. The clock never owns a network request. */
export function useRaceSeries(api: ReturnType<typeof createApiClient>, sessionId: string, selections: Selection[], channels: string[]) {
  const channelKey = channels.join("|");
  const load = useCallback(async (requested: Array<{ driver: string; lap: number }>) => {
    const response = await api.series(sessionId, { axis: "globalTime", selections: requested, channels: channelKey.split("|") });
    return response.series;
  }, [api, sessionId, channelKey]);
  const { items, ...state } = useRaceLapCache(sessionId, selections, load, !!channelKey);
  return { series: items, ...state };
}
