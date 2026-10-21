import type { TrackResponse } from "@cortex/contracts";
import { describe, expect, it } from "vitest";

import { indexTrackSamples, visualMarkers, visualMarkersFromIndex } from "./race-track-markers";

type Segment = TrackResponse["segments"][number];
type Sample = Segment["samples"][number];

function sample(time: number | null, x: number | null, lap = 1): Sample {
  return { time, lapTime: time, lapNumber: lap, x, y: 0, onTrack: true };
}

describe("Race track marker indexing", () => {
  it.each([null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "keeps a %s timestamp as a barrier between original samples",
    (invalidTime) => {
      const segments: Segment[] = [{
        driver: "PIA", lap: 1,
        samples: [sample(10, 0), sample(invalidTime, 50), sample(10.4, 100)]
      }];
      const index = indexTrackSamples(segments);

      expect(visualMarkers(segments, ["PIA"], 10.2)).toEqual([]);
      expect(visualMarkersFromIndex(index, ["PIA"], 10.2)).toEqual([]);
      expect(visualMarkersFromIndex(index, ["PIA"], 10)).toEqual([
        { driver: "PIA", x: 0, y: 0, heading: 0, estimated: false }
      ]);
      expect(visualMarkersFromIndex(index, ["PIA"], 10.4)).toEqual([
        { driver: "PIA", x: 100, y: 0, heading: 0, estimated: false }
      ]);
      expect(index.get("PIA")).toEqual(segments[0].samples);
    }
  );

  it("orders received lap segments without moving a barrier inside either lap", () => {
    const earlier: Segment = {
      driver: "PIA", lap: 1,
      samples: [sample(10, 0), sample(null, 50), sample(10.4, 100)]
    };
    const later: Segment = {
      driver: "PIA", lap: 2,
      samples: [sample(20, 200, 2), sample(20.4, 300, 2)]
    };
    const segments = [later, earlier];
    const index = indexTrackSamples(segments);

    expect(visualMarkers(segments, ["PIA"], 10.2)).toEqual([]);
    expect(visualMarkersFromIndex(index, ["PIA"], 20.2)).toEqual([
      { driver: "PIA", x: expect.closeTo(250), y: 0, heading: 0, estimated: true }
    ]);
    expect(index.get("PIA")?.filter((point) => point.time !== null).map((point) => point.time))
      .toEqual([10, 10.4, 20, 20.4]);
    expect(segments).toEqual([later, earlier]);
    expect(earlier.samples.map((point) => point.time)).toEqual([10, null, 10.4]);
  });

  it("keeps valid continuity between consecutive laps received out of order", () => {
    const segments: Segment[] = [
      { driver: "PIA", lap: 2, samples: [sample(10.4, 100, 2), sample(10.6, 200, 2)] },
      { driver: "PIA", lap: 1, samples: [sample(10, 0), sample(10.2, 50)] }
    ];
    const index = indexTrackSamples(segments);

    expect(visualMarkers(segments, ["PIA"], 10.3)).toEqual([
      { driver: "PIA", x: expect.closeTo(75), y: 0, heading: 0, estimated: true }
    ]);
    expect(visualMarkersFromIndex(index, ["PIA"], 10.4)).toEqual([
      { driver: "PIA", x: 100, y: 0, heading: 0, estimated: false }
    ]);
    expect(visualMarkersFromIndex(index, ["PIA"], 10.5)).toEqual([
      { driver: "PIA", x: expect.closeTo(150), y: 0, heading: 0, estimated: true }
    ]);
  });

  it.each([null, 3])("breaks continuity when the next lap is %s", (lap) => {
    const segments: Segment[] = [
      { driver: "PIA", lap: 1, samples: [sample(10, 0), sample(10.2, 50)] },
      { driver: "PIA", lap, samples: [sample(10.4, 100), sample(10.6, 200)] }
    ];
    const index = indexTrackSamples(segments);

    expect(visualMarkers(segments, ["PIA"], 10.3)).toEqual([]);
    expect(visualMarkersFromIndex(index, ["PIA"], 10.4)).toEqual([
      { driver: "PIA", x: 100, y: 0, heading: 0, estimated: false }
    ]);
  });

  it("preserves each original trajectory when lap segments overlap", () => {
    const segments: Segment[] = [
      { driver: "PIA", lap: 2, samples: [sample(10.4, 100, 2), sample(10.8, 200, 2)] },
      { driver: "PIA", lap: 1, samples: [sample(10, 0), sample(10.6, 30)] }
    ];

    expect(visualMarkers(segments, ["PIA"], 10.7)).toEqual([
      { driver: "PIA", x: expect.closeTo(175), y: 0, heading: 0, estimated: true }
    ]);
  });

  it("keeps gaps and backward timestamps instead of repairing their sample order", () => {
    const segments: Segment[] = [{
      driver: "PIA", lap: 1,
      samples: [sample(10, 0), sample(12, 100), sample(10.4, 200)]
    }];
    const index = indexTrackSamples(segments);

    expect(visualMarkers(segments, ["PIA"], 10.2)).toEqual([]);
    expect(visualMarkersFromIndex(index, ["PIA"], 11)).toEqual([]);
    expect(index.get("PIA")?.map((point) => point.time)).toEqual([10, 12, 10.4]);
  });

  it.each([
    { name: "gap", before: sample(10, 0), after: sample(12, 100), between: 11 },
    { name: "implausible jump", before: sample(10, 0), after: sample(10.2, 5000), between: 10.1 },
    { name: "backward timestamp", before: sample(10, 0), after: sample(9.8, 100), between: 9.9 }
  ])("shows the exact original endpoint after a $name through the indexer", ({ before, after, between }) => {
    const segments: Segment[] = [{ driver: "PIA", lap: 1, samples: [before, after] }];
    const index = indexTrackSamples(segments);
    expect(visualMarkers(segments, ["PIA"], between)).toEqual([]);
    expect(visualMarkersFromIndex(index, ["PIA"], between)).toEqual([]);
    const expected = [{ driver: "PIA", x: after.x, y: after.y, heading: 0, estimated: false }];
    expect(visualMarkers(segments, ["PIA"], after.time!)).toEqual(expected);
    expect(visualMarkersFromIndex(index, ["PIA"], after.time!)).toEqual(expected);
  });
});
