"use client";

import { useEffect, useRef, useState } from "react";
import type { SeriesResponse, SessionManifestResponse } from "@cortex/contracts";
import { lastAtOrBefore } from "../features/race-explorer/race-explorer-model";
import { useLayoutMotion } from "./use-layout-motion";

type Series = SeriesResponse["series"][number];
type Channel = SessionManifestResponse["manifest"]["channels"][number];
export type TelemetryAxis = "globalTime" | "lapTime";
export const telemetryColor = (driver: string) => {
  const primary: Record<string, string> = { PIA: "#FFAD66", NOR: "#65DCE8", LEC: "#FF8099", VER: "#B9AAFF", RUS: "#9FC8FF", ALB: "#F5D477", HAM: "#FF5969", LAW: "#8FD6A7", BOR: "#D0B8F4", GAS: "#7D9EFA", BEA: "#F0BA8E", HUL: "#DAE784", TSU: "#97B6FF", STR: "#63B39B", OCO: "#B7D9CD", ANT: "#69BDD8", ALO: "#7CD7B4", SAI: "#C6D57C", COL: "#C694E9", HAD: "#D69ACA" };
  if (primary[driver]) return primary[driver];
  const colors = ["#65DCE8", "#FFAD66", "#B9AAFF", "#FF9FAD", "#F5C77A", "#8FD6A7"];
  return colors[Array.from(driver).reduce((hash, character, index) => hash + character.charCodeAt(0) * (index + 1), 0) % colors.length]!;
};
const valueOf = (value: unknown): number | null => typeof value === "boolean" ? Number(value) : typeof value === "number" && Number.isFinite(value) ? value : null;
const sampleTime = (sample: Series["samples"][number], axis: TelemetryAxis) => axis === "globalTime" ? sample.time : sample.lapTime;
const format = (value: unknown, locale: string) => value === null || value === undefined ? "—" : typeof value === "number" ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value) : String(value);

type Props = {
  series: Series[]; channels: Channel[]; axis: TelemetryAxis; cursor: number | null;
  range: { start: number; end: number }; visible: string[]; onVisible: (ids: string[]) => void;
  onInspect: (time: number) => void; locale: string; following: boolean;
  /** In comparison, each individual series stops at its own proven end. */
  durations?: Record<string, number | null>;
};

/** Source-neutral display. Every channel has its own unit; drivers share its scale. */
export function TelemetryWorkspace(props: Props) {
  const { channels, visible, onVisible, locale } = props;
  const pt = locale === "pt-BR";
  const stack = useRef<HTMLDivElement>(null);
  useLayoutMotion(stack, visible.join("|"));
  return <div className="telemetry-workspace">
    <details className="channel-menu">
      <summary>{pt ? "Canais de telemetria" : "Telemetry channels"}<span>{visible.length} / {channels.length}</span></summary>
      <fieldset className="channel-options"><legend className="sr-only">{pt ? "Canais visíveis" : "Visible channels"}</legend>
        {channels.map((channel) => <label key={channel.id}><input type="checkbox" checked={visible.includes(channel.id)} onChange={() => onVisible(visible.includes(channel.id) ? visible.filter((id) => id !== channel.id) : [...visible, channel.id])} />{channel.label}{channel.unit ? ` (${channel.unit})` : ""}</label>)}
      </fieldset>
    </details>
    <div ref={stack} className="telemetry-stack">
      {!visible.length && <p className="inline-notice">{pt ? "Selecione um canal para analisar." : "Select a channel to inspect."}</p>}
      {channels.filter((channel) => visible.includes(channel.id)).map((channel) => <ChannelChart key={channel.id} {...props} channel={channel} />)}
    </div>
    <TelemetryTable {...props} />
  </div>;
}

function currentSamples(props: Props) {
  const groups = new Map<string, Series[]>();
  for (const series of props.series) {
    const key = props.axis === "globalTime" ? series.driver : `${series.driver}:${series.lap}`;
    groups.set(key, [...(groups.get(key) ?? []), series]);
  }
  return [...groups].map(([key, items]) => {
    const item = items[0]!;
    const duration = props.durations?.[`${item.driver}:${item.lap}`];
    const ended = props.axis === "lapTime" && (duration === null || (typeof duration === "number" && props.cursor !== null && props.cursor > duration));
    return { key, driver: item.driver, lap: item.lap, sample: ended ? null : lastAtOrBefore(items.flatMap((entry) => entry.samples), props.cursor, (sample) => sampleTime(sample, props.axis)) };
  });
}

function ChannelChart(props: Props & { channel: Channel }) {
  const { channel, series, axis, cursor, range, locale } = props;
  const pt = locale === "pt-BR";
  const svg = useRef<SVGSVGElement>(null);
  const [svgWidth, setSvgWidth] = useState(800);
  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setSvgWidth(Math.max(220, entry.contentRect.width)); });
    observer.observe(svg.current); return () => observer.disconnect();
  }, []);
  const right = svgWidth - 24;
  const width = Math.max(.001, range.end - range.start);
  const numbers = series.flatMap((item) => item.samples.flatMap((sample) => {
    const x = sampleTime(sample, axis); const y = valueOf(sample.values[channel.id]);
    return x !== null && y !== null && x >= range.start && x <= range.end && (axis !== "globalTime" || cursor === null || x <= cursor) ? [y] : [];
  }));
  const fixed = channel.id === "throttle" ? [0, 100] : channel.id === "brake" ? [0, 1] : channel.id === "gear" ? [0, 8] : channel.id === "speed" ? [0, Math.max(400, ...numbers)] : null;
  const min = fixed?.[0] ?? (numbers.length ? Math.min(...numbers) : 0);
  const max = fixed?.[1] ?? (numbers.length ? Math.max(...numbers) : 1);
  const chartX = (x: number) => 52 + (x - range.start) / width * (right - 52);
  const chartY = (y: number) => 152 - (y - min) / Math.max(.001, max - min) * 130;
  const inspect = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // The SVG preserves no aspect ratio: plot coordinates and pointer coordinates agree.
    const value = range.start + Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * svgWidth - 52) / (right - 52))) * width;
    props.onInspect(value);
  };
  const samples = currentSamples(props);
  return <section className="monitor-chart" data-channel={channel.id} data-motion-id={channel.id}>
    <header><h3>{channel.label} <small>{channel.unit}</small></h3><span className={`channel-origin is-${channel.origin}`}>{channel.origin === "derived" ? pt ? "Derivado" : "Derived" : pt ? "Original" : "Original"}</span></header>
    <div className="live-readouts">{samples.map((row) => <span key={row.key}><i style={{ background: telemetryColor(row.driver) }} />{row.driver}{axis === "lapTime" ? ` · ${row.lap}` : ""}<strong>{format(row.sample?.values[channel.id], locale)}</strong></span>)}{!samples.length && <span>{pt ? "Nenhum piloto monitorado" : "No monitored drivers"}</span>}</div>
    <svg ref={svg} className="monitor-chart-svg" viewBox={`0 0 ${svgWidth} 190`} preserveAspectRatio="none" role="img" tabIndex={0} aria-label={`${channel.label}: ${pt ? "telemetria sincronizada; setas para inspecionar" : "synchronized telemetry; arrow keys to inspect"}`} onPointerDown={inspect} onPointerMove={(event) => { if (event.buttons === 1) inspect(event); }} onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); props.onInspect(Math.max(range.start, Math.min(range.end, (cursor ?? range.end) + (event.key === "ArrowLeft" ? -1 : 1)))); }
    }}>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="52" x2={right} y1={152 - fraction * 130} y2={152 - fraction * 130} className="monitor-grid-line" /><text x="45" y={156 - fraction * 130} textAnchor="end" className="chart-tick">{format(min + fraction * (max - min), locale)}</text></g>)}
      {series.map((item) => {
        let open = false; let previous: number | null = null; let previousY = 0;
        const events: Array<{ x: number; y: number }> = [];
        const d = item.samples.reduce((path, sample) => {
          const x = sampleTime(sample, axis); const y = valueOf(sample.values[channel.id]);
          if (x === null || y === null || x < range.start || x > range.end || (axis === "globalTime" && cursor !== null && x > cursor)) { open = false; previous = null; return path; }
          if (previous !== null && (x - previous > 2 || x <= previous)) open = false;
          previous = x;
          if (channel.suggestedView === "events") { if (y > 0) events.push({ x: chartX(x), y: chartY(y) }); return path; }
          const command = !open ? `M${chartX(x)},${chartY(y)}` : channel.suggestedView === "step" ? `L${chartX(x)},${chartY(previousY)}L${chartX(x)},${chartY(y)}` : `L${chartX(x)},${chartY(y)}`;
          open = true; previousY = y; return path + command;
        }, "");
        const alternate = axis === "lapTime" && series.findIndex((entry) => entry.driver === item.driver) !== series.indexOf(item);
        return <g key={`${item.driver}:${item.lap}`} style={{ color: telemetryColor(item.driver) }}><path d={d} className="monitor-series-path" strokeDasharray={alternate ? "6 4" : undefined} />{events.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="currentColor" />)}</g>;
      })}
      {cursor !== null && cursor >= range.start && cursor <= range.end && <line data-testid="replay-cursor" data-time={cursor} x1={chartX(cursor)} x2={chartX(cursor)} y1="15" y2="158" className="chart-cursor" />}
      <text x="52" y="180" className="chart-tick">{format(range.start, locale)} s</text><text x={right} y="180" textAnchor="end" className="chart-tick">{format(range.end, locale)} s</text>
      {!numbers.length && <text x={svgWidth / 2} y="90" textAnchor="middle" className="chart-tick">{pt ? "Sem amostras neste intervalo" : "No samples in this interval"}</text>}
    </svg>
  </section>;
}

export function TelemetryTable(props: Props) {
  const [channel, setChannel] = useState("speed");
  const pt = props.locale === "pt-BR";
  const selected = props.channels.find((item) => item.id === channel) ?? props.channels[0];
  return <details className="telemetry-table-wrap"><summary><h3>{pt ? "Tabela de amostras no instante" : "Samples at this instant"}</h3></summary>
    <label className="compact-control">{pt ? "Canal da tabela" : "Table channel"}<select value={selected?.id ?? ""} onChange={(event) => setChannel(event.target.value)}>{props.channels.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div><table><thead><tr><th>{pt ? "Piloto" : "Driver"}</th><th>{pt ? "Volta" : "Lap"}</th><th>{pt ? "Tempo da amostra" : "Sample time"}</th><th>{selected?.label} {selected?.unit}</th></tr></thead><tbody>{currentSamples(props).map((row) => <tr key={row.key}><th scope="row">{row.driver}</th><td>{row.sample?.lapNumber ?? row.lap ?? "—"}</td><td>{format(row.sample ? sampleTime(row.sample, props.axis) : null, props.locale)}</td><td>{format(selected ? row.sample?.values[selected.id] : null, props.locale)}</td></tr>)}</tbody></table></div>
    <p className="muted">{pt ? "Última amostra original até o cursor, com no máximo 2 s de idade. Lacunas permanecem ausentes." : "Last original sample at or before the cursor, at most 2 s old. Gaps remain missing."}</p>
  </details>;
}
