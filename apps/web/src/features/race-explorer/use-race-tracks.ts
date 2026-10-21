import { useCallback } from "react";
import { createApiClient } from "@cortex/contracts";
import { useRaceLapCache, type LapSelection } from "./use-race-lap-cache";

type Selection = LapSelection;
export function useRaceTracks(api: ReturnType<typeof createApiClient>, sessionId: string, selections: Selection[]) {
  const load = useCallback(async (requested: Array<{ driver: string; lap: number }>) => {
    const response = await api.track(sessionId, { selections: requested });
    return response.segments;
  }, [api, sessionId]);
  const { items, ...state } = useRaceLapCache(sessionId, selections, load);
  return { tracks: items, ...state };
}
