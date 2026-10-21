"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SeriesResponse, SessionManifestResponse } from "@cortex/contracts";
import { channelSegments, sampleAtCursor, sampleAxis, type TelemetryAxis } from "./telemetry-display";
export type { TelemetryAxis } from "./telemetry-display";
import { useLayoutMotion } from "./use-layout-motion";

type Series = SeriesResponse["series"][number];
type Channel = SessionManifestResponse["manifest"]["channels"][number];
export const telemetryColor = (driver: string) => {
  const primary: Record<string, string> = { PIA: "#FFAD66", NOR: "#65DCE8", LEC: "#FF8099", VER: "#B9AAFF", RUS: "#9FC8FF", ALB: "#F5D477", HAM: "#FF5969", LAW: "#8FD6A7", BOR: "#D0B8F4", GAS: "#7D9EFA", BEA: "#F0BA8E", HUL: "#DAE784", TSU: "#97B6FF", STR: "#63B39B", OCO: "#B7D9CD", ANT: "#69BDD8", ALO: "#7CD7B4", SAI: "#C6D57C", COL: "#C694E9", HAD: "#D69ACA" };
  if (Object.hasOwn(primary, driver)) return primary[driver]!;
  const colors = ["#65DCE8", "#FFAD66", "#B9AAFF", "#FF9FAD", "#F5C77A", "#8FD6A7"];
  return colors[Array.from(driver).reduce((hash, character, index) => hash + character.charCodeAt(0) * (index + 1), 0) % colors.length]!;
};
const sampleTime = sampleAxis;
const format = (value: unknown, locale: string) => value === null || value === undefined ? "—" : typeof value === "number" ? new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(value) : String(value);
const availabilityLabel = (series: Series, pt: boolean) => {
  const labels = pt
    ? { available: "Disponível", partial: "Parcial", absent: "Ausente", unmapped: "Não mapeado", uncalibrated: "Não calibrado" }
    : { available: "Available", partial: "Partial", absent: "Absent", unmapped: "Unmapped", uncalibrated: "Uncalibrated" };
  const reason = series.availability.reason === "One or more mapped source samples are unavailable." && pt ? "Uma ou mais amostras mapeadas estão ausentes." : series.availability.reason;
  return `${labels[series.availability.status]}${reason ? ` · ${reason}` : ""}`;
};

type Props = {
  series: Series[]; channels: Channel[]; axis: TelemetryAxis; cursor: number | null;
  range: { start: number; end: number }; visible: string[]; onVisible: (ids: string[]) => void;
  onInspect: (time: number) => void; locale: string; following: boolean;
  /** An imported file is fully available; its inspection cursor does not clip the plot. */
  staticData?: boolean;
  entityLabel?: string;
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
    {props.series.some((item) => item.availability.status !== "available") && <ul className="inline-notice" aria-label={pt ? "Disponibilidade das séries" : "Series availability"}>
      {props.series.filter((item) => item.availability.status !== "available").map((item) => <li key={`${item.driver}:${item.lap}`}>{item.driver}{item.lap !== null ? ` · ${item.lap}` : ""}: {availabilityLabel(item, pt)}</li>)}
    </ul>}
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
    const key = props.axis === "globalTime" && !props.staticData ? series.driver : `${series.driver}:${series.lap}`;
    groups.set(key, [...(groups.get(key) ?? []), series]);
  }
  return [...groups].map(([key, items]) => {
    const item = items[0]!;
    const duration = props.durations?.[`${item.driver}:${item.lap}`];
    const ended = props.axis === "lapTime" && (duration === null || (typeof duration === "number" && props.cursor !== null && props.cursor > duration));
    return { key, driver: item.driver, lap: item.lap, sample: ended ? null : sampleAtCursor(items.flatMap((entry) => entry.samples), props.axis, props.cursor) };
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
  const clip = axis === "globalTime" && !props.staticData ? cursor : null;
  const plots = useMemo(() => series.map((item) => ({ item, segments: channelSegments(item.samples, channel, axis, { start: range.start, end: range.end }, clip) })), [series, channel, axis, range.start, range.end, clip]);
  const bounds = useMemo(() => {
    let min = Infinity; let max = -Infinity; let count = 0;
    for (const plot of plots) for (const segment of plot.segments) for (const point of segment) { min = Math.min(min, point.y); max = Math.max(max, point.y); count++; }
    return { min: count ? min : 0, max: count ? max : 1, count };
  }, [plots]);
  const fixed = channel.id === "throttle" ? [0, 100] : channel.id === "brake" ? [0, 1] : channel.id === "gear" ? [0, 8] : channel.id === "speed" ? [0, Math.max(400, bounds.max)] : null;
  const min = fixed?.[0] ?? bounds.min;
  const max = fixed?.[1] ?? bounds.max;
  const chartX = (x: number) => 52 + (x - range.start) / width * (right - 52);
  const geometry = useMemo(() => plots.map(({ item, segments }) => {
    const points: Array<{ x: number; y: number }> = [];
    const paths: string[] = [];
    const x = (value: number) => 52 + (value - range.start) / Math.max(.001, range.end - range.start) * (svgWidth - 76);
    const y = (value: number) => 152 - (value - min) / Math.max(.001, max - min) * 130;
    for (const segment of segments) {
      if (channel.suggestedView === "events") {
        for (const point of segment) if (point.y > 0) points.push({ x: x(point.x), y: y(point.y) });
      } else if (segment.length === 1) points.push({ x: x(segment[0]!.x), y: y(segment[0]!.y) });
      else paths.push(segment.map((point, index) => index === 0 ? `M${x(point.x)},${y(point.y)}` : channel.suggestedView === "step" ? `L${x(point.x)},${y(segment[index - 1]!.y)}L${x(point.x)},${y(point.y)}` : `L${x(point.x)},${y(point.y)}`).join(""));
    }
    return { item, d: paths.join(""), points };
  }), [plots, range.start, range.end, svgWidth, min, max, channel.suggestedView]);
  const inspect = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    // The SVG preserves no aspect ratio: plot coordinates and pointer coordinates agree.
    const value = range.start + Math.max(0, Math.min(1, ((event.clientX - rect.left) / rect.width * svgWidth - 52) / (right - 52))) * width;
    props.onInspect(value);
  };
  const samples = currentSamples(props);
  return <section className="monitor-chart" data-channel={channel.id} data-motion-id={channel.id}>
    <header><h3>{channel.label} <small>{channel.unit ?? (channel.id.startsWith("import:") ? pt ? "unidade desconhecida" : "unknown unit" : "")}</small></h3><span className={`channel-origin is-${channel.origin}`}>{channel.origin === "derived" ? pt ? "Derivado" : "Derived" : pt ? "Original" : "Original"}</span></header>
    <div className="live-readouts">{samples.map((row) => <span key={row.key}><i style={{ background: telemetryColor(row.driver) }} />{row.driver}{(axis !== "globalTime" || props.staticData) && row.lap !== null ? ` · ${row.lap}` : ""}<strong>{format(row.sample?.values[channel.id], locale)}</strong></span>)}{!samples.length && <span>{pt ? "Nenhuma série selecionada" : "No selected series"}</span>}</div>
    {series.map((item) => { const valid = item.samples.filter((sample) => sampleTime(sample, axis) !== null && sample.values[channel.id] !== null && sample.values[channel.id] !== undefined).length; return valid < item.samples.length ? <p className="inline-notice" key={`${item.driver}:${item.lap}`}>{item.driver}: {valid}/{item.samples.length} {pt ? "amostras válidas neste canal; lacunas preservadas." : "valid samples in this channel; gaps preserved."}</p> : null; })}
    <svg ref={svg} className="monitor-chart-svg" viewBox={`0 0 ${svgWidth} 190`} preserveAspectRatio="none" role="img" tabIndex={0} aria-label={`${channel.label}: ${pt ? "telemetria sincronizada; setas para inspecionar" : "synchronized telemetry; arrow keys to inspect"}`} onPointerDown={inspect} onPointerMove={(event) => { if (event.buttons === 1) inspect(event); }} onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); event.stopPropagation(); props.onInspect(Math.max(range.start, Math.min(range.end, (cursor ?? range.end) + (event.key === "ArrowLeft" ? -1 : 1)))); }
    }}>
      {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="52" x2={right} y1={152 - fraction * 130} y2={152 - fraction * 130} className="monitor-grid-line" /><text x="45" y={156 - fraction * 130} textAnchor="end" className="chart-tick">{format(min + fraction * (max - min), locale)}</text></g>)}
      {geometry.map(({ item, d, points }) => {
        const alternate = (axis === "lapTime" || props.staticData) && series.findIndex((entry) => entry.driver === item.driver) !== series.indexOf(item);
        return <g key={`${item.driver}:${item.lap}`} style={{ color: telemetryColor(item.driver) }}><path d={d} className="monitor-series-path" strokeDasharray={alternate ? "6 4" : undefined} />{points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="currentColor" />)}</g>;
      })}
      {cursor !== null && cursor >= range.start && cursor <= range.end && <line data-testid="replay-cursor" data-time={cursor} x1={chartX(cursor)} x2={chartX(cursor)} y1="15" y2="158" className="chart-cursor" />}
      <text x="52" y="180" className="chart-tick">{format(range.start, locale)} {axis === "distance" ? "m" : "s"}</text><text x={right} y="180" textAnchor="end" className="chart-tick">{format(range.end, locale)} {axis === "distance" ? "m" : "s"}</text>
      {!bounds.count && <text x={svgWidth / 2} y="90" textAnchor="middle" className="chart-tick">{pt ? "Sem amostras neste intervalo" : "No samples in this interval"}</text>}
    </svg>
  </section>;
}

export function TelemetryTable(props: Props) {
  const [channel, setChannel] = useState("speed");
  const pt = props.locale === "pt-BR";
  const selected = props.channels.find((item) => item.id === channel) ?? props.channels[0];
  return <details className="telemetry-table-wrap"><summary><h3>{pt ? "Tabela de amostras no instante" : "Samples at this instant"}</h3></summary>
    <label className="compact-control">{pt ? "Canal da tabela" : "Table channel"}<select value={selected?.id ?? ""} onChange={(event) => setChannel(event.target.value)}>{props.channels.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
    <div><table><thead><tr><th>{props.entityLabel ?? (pt ? "Piloto" : "Driver")}</th><th>{pt ? "Volta" : "Lap"}</th><th>{props.axis === "distance" ? pt ? "Distância da amostra (m)" : "Sample distance (m)" : pt ? "Tempo da amostra (s)" : "Sample time (s)"}</th><th>{selected?.label} {selected?.unit}</th><th>{pt ? "Disponibilidade" : "Availability"}</th></tr></thead><tbody>{currentSamples(props).map((row) => <tr key={row.key}><th scope="row">{row.driver}</th><td>{row.sample?.lapNumber ?? row.lap ?? "—"}</td><td>{format(row.sample ? sampleTime(row.sample, props.axis) : null, props.locale)}</td><td>{format(selected ? row.sample?.values[selected.id] : null, props.locale)}</td><td>{props.series.filter((item) => item.driver === row.driver && ((props.axis === "globalTime" && !props.staticData) || item.lap === row.lap)).map((item) => availabilityLabel(item, pt)).filter((value, index, items) => items.indexOf(value) === index).join("; ")}</td></tr>)}</tbody></table></div>
    <p className="muted">{props.axis === "distance" ? pt ? "Última amostra original até a distância do cursor, sem atravessar registros ausentes ou lacunas temporais maiores que 2 s. Não há extrapolação." : "Last original sample at or before the cursor distance, without crossing missing records or temporal gaps longer than 2 s. No extrapolation." : pt ? "Última amostra original até o cursor, com no máximo 2 s de idade. Lacunas permanecem ausentes." : "Last original sample at or before the cursor, at most 2 s old. Gaps remain missing."}</p>
  </details>;
}
