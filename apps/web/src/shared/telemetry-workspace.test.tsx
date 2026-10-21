import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SeriesResponse, SessionManifestResponse } from "@cortex/contracts";
import { TelemetryWorkspace } from "./telemetry-workspace";

afterEach(cleanup);
const channels: SessionManifestResponse["manifest"]["channels"] = [{ id: "speed", label: "Speed", unit: "km/h", valueType: "continuous", origin: "source", suggestedView: "line" }];
const series: SeriesResponse["series"] = [{ driver: "PIA", lap: 7, axis: "globalTime", samples: [{ time: 0, lapTime: 0, distance: null, lapNumber: 7, values: { speed: 0 } }], availability: { status: "partial", reason: "Samples missing", validSamples: 1, totalSamples: 2 } }];
const props = { channels, series, axis: "globalTime" as const, cursor: 0, range: { start: 0, end: 10 }, visible: ["speed"], onVisible: () => {}, onInspect: () => {}, locale: "pt-BR", following: false };

describe("shared telemetry workspace", () => {
  it("shows partial data and its reason while retaining a valid zero", () => {
    render(<TelemetryWorkspace {...props} />);
    expect(screen.getByRole("list", { name: "Disponibilidade das séries" })).toHaveTextContent("Parcial · Samples missing");
    expect(screen.getByRole("table")).toHaveTextContent("Parcial · Samples missing");
    expect(screen.getAllByRole("cell", { name: "0" })).toHaveLength(2);
  });

  it("translates availability without replacing missing values with zero", () => {
    render(<TelemetryWorkspace {...props} locale="en" series={[{ ...series[0]!, samples: [], availability: { status: "uncalibrated", reason: "No calibration", validSamples: 0, totalSamples: 0 } }]} />);
    expect(screen.getByRole("list", { name: "Series availability" })).toHaveTextContent("Uncalibrated · No calibration");
    expect(screen.getByRole("table")).toHaveTextContent("—");
    expect(screen.getByText("No samples in this interval")).toBeInTheDocument();
  });
});
