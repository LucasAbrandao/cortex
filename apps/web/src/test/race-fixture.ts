/** Deterministic test data only; never imported by production screens. */
export const testDrivers = ["PIA", "NOR", "LEC", "VER", "RUS", "HAM", "ANT", "ALO", "STR", "HAD", "GAS", "COL", "LAW", "TSU", "SAI", "ALB", "OCO", "HUL", "BEA", "BOR"];
export const raceManifest = {
  requestId: "test-manifest",
  manifest: {
    schemaVersion: "2", normalizerVersion: "5", fastf1Version: "3.8.3", sessionId: "spa", year: 2025, event: "Belgium", session: "R", source: "fastf1",
    drivers: testDrivers.map((code, index) => ({ code, name: `Test ${code}`, team: "Test team", position: index + 1, status: "Finished" })),
    laps: testDrivers.flatMap((driver, index) => [7, 8, 9].map((number) => ({ driver, number, lapTime: 80 + index, time: 100 + (number - 7) * (80 + index) + index, position: index + 1 }))),
    channels: [
      { id: "speed", label: "Speed", valueType: "continuous", unit: "km/h", origin: "source", suggestedView: "line" },
      { id: "throttle", label: "Throttle", valueType: "continuous", unit: "%", origin: "source", suggestedView: "line" },
      { id: "brake", label: "Brake", valueType: "boolean", unit: null, origin: "source", suggestedView: "events" },
      { id: "gear", label: "Gear", valueType: "discrete", unit: null, origin: "source", suggestedView: "step" }
    ], trackAvailable: true, limitations: [], createdAt: "2026-09-04T00:00:00Z"
  }
};
export const raceReplay = { requestId: "test-replay", sessionId: "spa", frames: [20, 100, 180, 260].map((time) => ({ time, standings: testDrivers.map((driver, index) => ({ driver, time, lapsCompleted: time <= 20 ? 6 : time <= 100 ? 7 : 8, position: time >= 100 && index < 2 ? 2 - index : index + 1, status: "Finished" })) })) };

export function fixtureSeries(driver: string, lap: number) {
  const summary = raceManifest.manifest.laps.find((item) => item.driver === driver && item.number === lap)!;
  return { driver, lap, axis: "globalTime", availability: { status: "available", validSamples: 81, totalSamples: 81, reason: null }, samples: Array.from({ length: 81 }, (_, i) => ({ time: summary.time - summary.lapTime + i, lapTime: i, distance: null, lapNumber: lap, values: { speed: 200 + i, throttle: i % 10 * 10, brake: i % 7 === 0, gear: Math.min(8, 3 + Math.floor(i / 10)) } })) };
}
export function fixtureResponse(url: string, payload?: { selections?: Array<{ driver: string; lap: number }>; drivers?: string[] }) {
  if (url.endsWith("/f1/jobs")) return { requestId: "test-job", id: "job", status: "succeeded", stage: "ready", progress: 1, message: "Test fixture", source: null, sessionId: "spa", error: null };
  if (url.endsWith("/manifest")) return raceManifest;
  if (url.endsWith("/replay")) return raceReplay;
  if (url.endsWith("/track")) return { requestId: "test-track", sessionId: "spa", trackAvailable: true, segments: raceManifest.manifest.laps.filter((lap) => payload?.drivers?.includes(lap.driver) || payload?.selections?.some((item) => item.driver === lap.driver && item.lap === lap.number)).map((lap) => ({ driver: lap.driver, lap: lap.number, samples: Array.from({ length: 81 }, (_, i) => ({ time: lap.time - lap.lapTime + i, lapTime: i, lapNumber: lap.number, x: i === 40 ? null : Math.cos(i / 80 * Math.PI * 2) * 500, y: Math.sin(i / 80 * Math.PI * 2) * 400, onTrack: true })) })) };
  return { requestId: "test-series", sessionId: "spa", series: (payload?.selections ?? []).map((item) => fixtureSeries(item.driver, item.lap)) };
}
