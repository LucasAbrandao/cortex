import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReplayResponse, SessionManifestResponse } from "@cortex/contracts";
import { orderByPosition } from "./race-explorer-model";
import { telemetryColor } from "../../shared/telemetry-workspace";

type Manifest = SessionManifestResponse["manifest"];
export type TrackPresentation = "integrated" | "expanded";

export function TrackMonitor({ mode, onMode, locale, children, onSize }: { mode: TrackPresentation; onMode: (mode: TrackPresentation) => void; locale: string; children: React.ReactNode; onSize?: (height: number) => void }) {
  const pt = locale === "pt-BR";
  const [size, setSize] = useState({ width: 100, height: 460 });
  const panel = useRef<HTMLElement>(null);
  useEffect(() => onSize?.(size.height), [size.height, onSize]);
  const resize = (width: number, height: number) => setSize({ width: Math.max(50, Math.min(100, width)), height: Math.max(280, Math.min(680, height)) });
  return <section ref={panel} className={`race-track-panel track-${mode}`} aria-label={pt ? "Monitor da pista" : "Track monitor"} style={mode === "integrated" ? { width: `${size.width}%`, height: size.height } : undefined}>
    <header className="track-monitor-header"><h2>{pt ? "SPA / VISTA DA PISTA" : "SPA / TRACK VIEW"}</h2><div className="track-presentation-actions">
      <button className="button button-small button-secondary" type="button" aria-pressed={mode === "integrated"} onClick={() => onMode(mode === "expanded" ? "integrated" : "expanded")}>{mode === "expanded" ? pt ? "Painel compacto" : "Compact panel" : pt ? "Pista ampla" : "Wide track"}</button>
    </div></header>
    <div className="track-monitor-body">{children}</div>
    {mode === "integrated" && <button type="button" className="track-size-handle" aria-label={pt ? "Redimensionar pista; use as setas" : "Resize track; use arrow keys"} title={pt ? "Arraste ou use as setas para redimensionar" : "Drag or use arrow keys to resize"} onKeyDown={(event) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault(); event.stopPropagation();
      resize(size.width + (event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : 0), size.height + (event.key === "ArrowDown" ? 20 : event.key === "ArrowUp" ? -20 : 0));
    }} onPointerDown={(event) => {
      if (event.button !== 0) return;
      event.preventDefault(); const element = event.currentTarget; element.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, ...size }; const width = panel.current?.parentElement?.clientWidth ?? 1;
      const move = (next: PointerEvent) => resize(start.width + (next.clientX - start.x) / width * 100, start.height + next.clientY - start.y);
      const end = () => { element.removeEventListener("pointermove", move); element.removeEventListener("pointerup", end); element.removeEventListener("pointercancel", end); element.removeEventListener("lostpointercapture", end); };
      element.addEventListener("pointermove", move); element.addEventListener("pointerup", end); element.addEventListener("pointercancel", end); element.addEventListener("lostpointercapture", end);
    }}>↘</button>}
  </section>;
}

export function TimingTower({ manifest, rows, time, focus, monitored, onFocus, onMonitor, animate, locale, lap, adaptive = false }: {
  manifest: Manifest; rows: ReplayResponse["frames"][number]["standings"]; time: number; focus: string; monitored: string[];
  onFocus: (driver: string) => void; onMonitor: (driver: string) => void; animate: boolean; locale: string; lap?: number | null; adaptive?: boolean;
}) {
  const pt = locale === "pt-BR";
  const container = useRef<HTMLOListElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [compact, setCompact] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!adaptive) return;
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const root = panel.current?.closest(".race-companion");
      const scene = root?.querySelector(".scene-spacer")?.getBoundingClientRect();
      const transport = root?.querySelector(".race-transport")?.getBoundingClientRect();
      if (!scene) return;
      const boundary = (transport?.bottom ?? 140) + 32;
      setCompact((current) => window.innerWidth < 1200 || scene.bottom < boundary + (current ? 32 : 0));
      panel.current?.style.setProperty("--tower-fade", String(Math.max(.65, Math.min(1, (scene.bottom - boundary) / 200))));
    }); };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [adaptive]);
  const previous = useRef(new Map<string, number>());
  const animations = useRef<Animation[]>([]);
  const display = orderByPosition(manifest.drivers.map((driver) => {
    const record = lap === undefined ? rows.find((row) => row.driver === driver.code && row.time !== null && row.time <= time) : manifest.laps.find((row) => row.driver === driver.code && row.number === lap);
    return { driver: driver.code, name: driver.name, position: record?.position ?? null, time: record?.time ?? null };
  }));
  const order = display.map((row) => row.driver).join("|");
  const shown = compact && !expanded ? display.filter((row, index) => index < 3 || row.driver === focus) : display;
  useLayoutEffect(() => {
    animations.current.forEach((animation) => animation.cancel());
    animations.current = [];
    const next = new Map<string, number>();
    for (const element of container.current?.querySelectorAll<HTMLElement>("[data-driver]") ?? []) {
      const driver = element.dataset.driver!; const y = element.offsetTop; const before = previous.current.get(driver);
      if (animate && before !== undefined && before !== y && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches && element.animate) {
        animations.current.push(element.animate([{ transform: `translateY(${before - y}px)` }, { transform: "translateY(0)" }], { duration: 420, easing: "cubic-bezier(.22,.75,.2,1)" }));
      }
      next.set(driver, y);
    }
    previous.current = next;
  }, [order, animate]);
  return <section ref={panel} className={`timing-tower ${compact ? "is-compact" : ""} ${expanded ? "is-open" : ""}`} aria-label={lap === undefined ? pt ? "Classificação no instante" : "Standings at this instant" : pt ? "Classificação por volta" : "Standings by lap"}>
    <header><h2>{pt ? "Classificação" : "Standings"}</h2><span>{lap === undefined ? pt ? "Últimos registros" : "Latest records" : `${pt ? "Volta" : "Lap"} ${lap ?? "—"}`}</span></header>
    <p className="timing-note">{lap === undefined ? pt ? "Atualiza nas passagens registradas; pode haver defasagem entre pilotos." : "Updates at recorded crossings; drivers may have different record ages." : pt ? "Cada piloto cruzou em um momento diferente." : "Each driver crossed at a different time."}</p>
    <div className="tower-columns"><span>POS</span><span>{pt ? "PILOTO / REGISTRO" : "DRIVER / RECORD"}</span><span>{pt ? "SEGUIR" : "FOLLOW"}</span></div>
    <ol ref={container} className="timing-rows">{shown.map((row) => <li key={row.driver} data-driver={row.driver} data-position={row.position ?? ""} className={focus === row.driver ? "is-focused" : ""}>
      <span className="tower-position">{row.position ?? "—"}</span>
      <button className="tower-driver" type="button" aria-label={`${pt ? "Focar" : "Focus"} ${row.driver}`} aria-pressed={focus === row.driver} onClick={() => onFocus(row.driver)}><span><i style={{ background: telemetryColor(row.driver) }} /><strong>{row.driver}</strong></span><small>{row.time === null ? pt ? "Sem registro" : "No record" : lap === undefined ? `${Math.max(0, Math.floor(time - row.time))} s ${pt ? "atrás" : "ago"}` : new Date(row.time * 1000).toISOString().slice(11, 19)}</small></button>
      <button className="monitor-toggle" type="button" aria-label={`${pt ? "Mostrar na simulação" : "Show in simulation"} ${row.driver}`} aria-pressed={monitored.includes(row.driver)} onClick={() => onMonitor(row.driver)}>{monitored.includes(row.driver) ? "✓" : "+"}</button>
    </li>)}</ol>
    {compact && <button type="button" className="button button-secondary tower-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? pt ? "Resumir classificação" : "Collapse standings" : pt ? "Ver classificação" : "View standings"}</button>}
  </section>;
}
