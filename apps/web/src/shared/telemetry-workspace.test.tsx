import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { SeriesResponse, SessionManifestResponse } from "@cortex/contracts";
import { TelemetryWorkspace, telemetryColor } from "./telemetry-workspace";

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
  it("renders the full static import beyond its inspection cursor and draws isolated samples", () => {
    const data = [{ ...series[0]!, samples: [0, 1, 4].map((time) => ({ time, lapTime: time, lapNumber: null, distance: time * 100, values: { speed: time } })) }];
    const { container } = render(<TelemetryWorkspace {...props} series={data} staticData />);
    expect(container.querySelector(".monitor-series-path")?.getAttribute("d")).toContain("L");
    expect(container.querySelectorAll("svg circle")).toHaveLength(1);
  });
  it("labels distance in meters and treats arbitrary entity names as identifiers", () => {
    render(<TelemetryWorkspace {...props} axis="distance" entityLabel="Entidade" />);
    expect(screen.getByRole("columnheader", { name: "Distância da amostra (m)" })).toBeInTheDocument();
    expect(telemetryColor("__proto__")).toMatch(/^#[A-Fa-f0-9]{6}$/);
    expect(telemetryColor("constructor")).toMatch(/^#[A-Fa-f0-9]{6}$/);
  });
  it("keeps two imported laps of one entity as separate table rows", () => {
    render(<TelemetryWorkspace {...props} staticData series={[series[0]!, { ...series[0]!, lap: 8, availability: { status: "absent", reason: "Lap 8 unavailable", validSamples: 0, totalSamples: 0 }, samples: [] }]} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    expect(rows[1]).not.toHaveTextContent("Lap 8 unavailable");
    expect(rows[2]).toHaveTextContent("Lap 8 unavailable");
  });
});
