"use client";

import { createApiClient, type ReplayResponse, type SeriesResponse, type SessionManifestResponse, type TrackResponse } from "@cortex/contracts";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { StatePanel } from "../../shared/state-panel";
import { TelemetryWorkspace, telemetryColor as driverColor } from "../../shared/telemetry-workspace";
import { useCortex } from "../navigation/app-shell";
import { activeLapWindow, lapWindow, raceBounds, selectionsForWindow, lastAtOrBefore, type PlaybackMode } from "./race-explorer-model";
import { useRaceClock } from "./use-race-clock";
import { useRaceSeries } from "./use-race-series";
import { useLayoutMotion } from "../../shared/use-layout-motion";
import { useRaceTracks } from "./use-race-tracks";
import { TimingTower } from "./race-monitor-panels";
import { indexTrackSamples, visualMarkersFromIndex } from "./race-track-markers";

import { useRaceStage } from "./race-stage";
import { useRaceScroll } from "./use-race-scroll";

type Manifest = SessionManifestResponse["manifest"];
type ReplayFrame = ReplayResponse["frames"][number];
type Comparison = { driver: string; lap: number | null };
type Series = SeriesResponse["series"][number];
type TrackSegment = TrackResponse["segments"][number];
const markerMaxAgeSeconds = 2;

export function RaceExplorerScreen({ sessionId }: { sessionId: string }) {
  const { locale, t } = useCortex();
  const pt = locale === "pt-BR";
  const api = useMemo(() => createApiClient(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000/api"), []);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [frames, setFrames] = useState<ReplayFrame[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<PlaybackMode>("race");
  const [focus, setFocus] = useState<Comparison | null>(null);
  const [monitored, setMonitored] = useState<string[]>([]);
  const [analyzed, setAnalyzed] = useState<string[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [visible, setVisible] = useState<string[]>([]);
  const [windowSeconds, setWindowSeconds] = useState(60);
  const [following, setFollowing] = useState(true);
  const [inspectionRange, setInspectionRange] = useState<{ start: number; end: number } | null>(null);
  const [pauseAtEnd, setPauseAtEnd] = useState(false);
  const stage = useRaceStage();
  const presentation = stage?.presentation ?? "expanded";
  const [transportExpanded, setTransportExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [lapOptions, setLapOptions] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const toolbar = root.current?.querySelector(".race-transport");
    if (!toolbar || typeof ResizeObserver === "undefined") return;
    const header = document.querySelector(".top-bar");
    const measure = () => {
      root.current?.style.setProperty("--transport-height", `${toolbar.getBoundingClientRect().height}px`);
      root.current?.style.setProperty("--shell-height", `${header?.getBoundingClientRect().height ?? 60}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar); if (header) observer.observe(header); measure(); return () => observer.disconnect();
  }, [manifest, mode]);
  const modeTimes = useRef({ race: 0, comparison: 0 });
  const skipAnimation = useRef(0);
  const chips = useRef<HTMLDivElement>(null);
  useLayoutMotion(chips, monitored.join("|"));
  const bounds = useMemo(() => raceBounds(manifest?.laps ?? [], frames.map((frame) => frame.time)), [manifest, frames]);
  const comparisonWindows = comparisons.map((item) => manifest ? lapWindow(manifest.laps, item.driver, item.lap) : null);
  const comparisonDuration = comparisonWindows.length && comparisonWindows.every((item) => item !== null) ? Math.max(...comparisonWindows.map((item) => item!.duration)) : null;
  const selectedWindow = manifest && focus ? lapWindow(manifest.laps, focus.driver, focus.lap) : null;
  const clock = useRaceClock(mode === "race" ? bounds.start : 0, mode === "race" ? bounds.end : comparisonDuration, mode === "race" && pauseAtEnd ? selectedWindow?.end ?? null : null);
  const { time, playing } = clock;

  useEffect(() => {
    let current = true;
    setError(false);
    void Promise.all([api.manifest(sessionId), api.replay(sessionId)]).then(([response, replay]) => {
      if (!current) return;
      const data = response.manifest;
      const first = data.drivers.find((driver) => driver.code === "PIA")?.code ?? data.drivers[0]?.code;
      setManifest(data); setFrames(replay.frames);
      if (!first) return;
      const initialFocus = { driver: first, lap: lapOrFallback(data, first, 7) };
      setFocus(initialFocus);
      const initialDrivers = ["PIA", "NOR"].filter((code) => data.drivers.some((driver) => driver.code === code));
      if (initialDrivers.length < 2) initialDrivers.push(...data.drivers.map((driver) => driver.code).filter((code) => !initialDrivers.includes(code)).slice(0, 2 - initialDrivers.length));
      setMonitored(initialDrivers); setAnalyzed(initialDrivers);
      setComparisons(initialDrivers.map((driver, index) => ({ driver, lap: lapOrFallback(data, driver, index ? 9 : 7) })));
      setVisible(data.channels.filter((item) => ["speed", "throttle", "brake", "gear"].includes(item.id)).map((item) => item.id));
      const start = lapWindow(data.laps, first, initialFocus.lap)?.start ?? raceBounds(data.laps, replay.frames.map((frame) => frame.time)).start;
      if (start !== null) { modeTimes.current.race = start; clock.resetTime(start); }
    }).catch(() => { if (current) setError(true); });
    return () => { current = false; };
  }, [api, sessionId, retry]);

  const activeWindow = manifest && focus ? activeLapWindow(manifest.laps, focus.driver, time) : null;
  const displayWindow = mode === "race" ? activeWindow : selectedWindow;
  const selectedDrivers = mode === "race" ? monitored : Array.from(new Set(comparisons.map((item) => item.driver)));
  const trackDriversKey = Array.from(new Set([...selectedDrivers, ...(focus ? [focus.driver] : [])])).sort().join("|");
  const trackSelections = mode === "race" ? selectionsForWindow(manifest?.laps ?? [], trackDriversKey.split("|"), time, 2) : comparisons.filter((item) => item.lap !== null);
  const referenceDriver = manifest?.drivers.find((driver) => driver.code === "PIA")?.code ?? manifest?.drivers[0]?.code;
  const referenceLap = referenceDriver && manifest ? lapOrFallback(manifest, referenceDriver, 7) : null;
  if (referenceDriver && referenceLap !== null && !trackSelections.some((item) => item.driver === referenceDriver && item.lap === referenceLap)) trackSelections.push({ driver: referenceDriver, lap: referenceLap });
  const trackData = useRaceTracks(api, sessionId, trackSelections);
  const tracks = trackData.tracks;
  const trackIndex = useMemo(() => indexTrackSamples(tracks), [tracks]);
  const focusTrack = useMemo(() => tracks.filter((segment) => segment.driver === referenceDriver && segment.lap === referenceLap), [tracks, referenceDriver, referenceLap]);

  const requests = mode === "race" ? selectionsForWindow(manifest?.laps ?? [], analyzed, time, windowSeconds) : comparisons.filter((item) => item.lap !== null);
  const channels = useMemo(() => manifest?.channels.map((item) => item.id) ?? [], [manifest]);
  const data = useRaceSeries(api, sessionId, requests, channels);
  const series = data.series.filter((item) => mode === "comparison" ? comparisons.some((selection) => selection.driver === item.driver && selection.lap === item.lap) : analyzed.includes(item.driver) && (lapWindow(manifest?.laps ?? [], item.driver, item.lap)?.start ?? Infinity) <= (time ?? -Infinity));
  const range = following || !inspectionRange ? mode === "race" ? { start: (time ?? 0) - windowSeconds, end: time ?? 0 } : { start: 0, end: comparisonDuration ?? 1 } : inspectionRange;
  const durations = Object.fromEntries(comparisons.map((item) => [`${item.driver}:${item.lap}`, lapWindow(manifest?.laps ?? [], item.driver, item.lap)?.duration ?? null]));

  const seek = (value: number, pause = true) => { if (pause) clock.setPlaying(false); skipAnimation.current = performance.now() + 500; clock.seek(value); };
  const togglePlayback = () => {
    setFollowing(true); setInspectionRange(null);
    if (!playing && time !== null && time >= (mode === "race" ? bounds.end ?? Infinity : comparisonDuration ?? Infinity)) clock.seek(mode === "race" ? bounds.start ?? 0 : 0);
    clock.setPlaying(!playing);
  };
  const changeMode = (next: PlaybackMode) => {
    if (next === mode) return;
    modeTimes.current[mode] = time ?? 0;
    clock.setPlaying(false); setMode(next); setFollowing(true); setInspectionRange(null);
    clock.resetTime(modeTimes.current[next]); skipAnimation.current = performance.now() + 500;
  };
  const selectFocus = (driver: string) => {
    if (!manifest) return;
    const lap = activeLapWindow(manifest.laps, driver, mode === "race" ? time : modeTimes.current.race)?.lap ?? firstLapFor(manifest, driver);
    setFocus({ driver, lap });
  };
  const selectLap = (lap: number) => {
    if (!manifest || !focus) return;
    const window = lapWindow(manifest.laps, focus.driver, lap);
    setFocus({ ...focus, lap });
    if (window && mode === "race") { seek(window.start); setFollowing(true); setInspectionRange(null); }
  };
  const toggleMonitor = (driver: string) => setMonitored((current) => current.includes(driver) ? current.filter((item) => item !== driver) : [...current, driver]);
  const toggleAnalysis = (driver: string) => setAnalyzed((current) => current.includes(driver) ? current.filter((item) => item !== driver) : current.length < 4 ? [...current, driver] : current);
  const setComparison = (next: Comparison[]) => { setComparisons(next); clock.setPlaying(false); clock.resetTime(0); setFollowing(true); setInspectionRange(null); };
  const inspect = (value: number) => { if (following) setInspectionRange(range); setFollowing(false); seek(value); };


  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditableTarget(event.target) || time === null) return;
      if (event.code === "Space") { event.preventDefault(); togglePlayback(); }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); seek(time + (event.key === "ArrowLeft" ? -5 : 5)); }
    };
    window.addEventListener("keydown", keydown); return () => window.removeEventListener("keydown", keydown);
  }, [time, playing, mode]);
  useEffect(() => {
    const visibility = () => { if (document.hidden) clock.setPlaying(false); };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [clock.setPlaying]);
  useRaceScroll(root, !!manifest);
  const setScene = stage?.setScene;
  // Publish visual state in the same commit as the clock. A passive effect
  // schedules another root update after every tick; under sustained replay
  // React can repeatedly flush it inside the next animation-frame update.
  useLayoutEffect(() => {
    if (!setScene) return;
    const valid = time !== null && focus && manifest;
    setScene({ reference: valid ? focusTrack : [], markers: valid ? mode === "race" ? visualMarkersFromIndex(trackIndex, trackDriversKey.split("|"), time) : comparisonMarkers(tracks, comparisons, manifest, time) : [], originalMarkers: valid ? mode === "race" ? markerPositions(tracks, trackDriversKey.split("|"), time) : comparisonMarkers(tracks, comparisons, manifest, time) : [], focused: focus?.driver ?? "", fallback: focusTrack.length && valid ? <TrackMap segments={focusTrack} markers={mode === "race" ? markerPositions(tracks, trackDriversKey.split("|"), time) : comparisonMarkers(tracks, comparisons, manifest, time)} noTrack={t.noTrack} noMarker={t.noMarker} locale={locale} /> : <StatePanel state={trackData.loading || !manifest ? "loading" : "warning"} body={trackData.loading || !manifest ? t.sessionLoading : t.noTrack} /> });
  }, [setScene, time, focus?.driver, manifest, focusTrack, trackIndex, tracks, mode, trackDriversKey, comparisons, trackData.loading, locale, t.noTrack, t.noMarker, t.sessionLoading]);
  useLayoutEffect(() => () => setScene?.(null), [setScene]);

  if (error) return <StatePanel state="error" body={t.raceExplorerError}><button type="button" className="button button-secondary" onClick={() => setRetry((value) => value + 1)}>{t.retry}</button></StatePanel>;
  if (manifest && !manifest.drivers.length) return <StatePanel state="empty" body={t.sessionEmpty} />;
  if (!manifest || !focus) return <StatePanel state="loading" body={t.sessionLoading} />;
  if (time === null || bounds.start === null || bounds.end === null) return <StatePanel state="unavailable" body={t.timelineUnavailable} />;


  const rows = frameAt(frames, mode === "race" ? time : modeTimes.current.race)?.standings ?? [];
  const canPlay = mode === "race" || comparisonDuration !== null;
  const currentLap = displayWindow?.lap ?? null;
  const metricsSeries = mode === "comparison" ? series : series.filter((item) => activeLapWindow(manifest.laps, item.driver, time)?.lap === item.lap);
  const towerProps = { manifest, rows, time: mode === "race" ? time : modeTimes.current.race, focus: focus.driver, monitored, onFocus: selectFocus, onMonitor: toggleMonitor, locale };

  return <div ref={root} className={`race-companion presentation-${presentation}`} data-mode={mode}>
    <header className="companion-heading"><div><p className="eyebrow">BELGIUM · 2025 · RACE</p><h1>{t.explorerTitle}</h1></div><p>{pt ? "Replay para acompanhar sua transmissão. Sincronize o vídeo manualmente." : "Replay alongside your broadcast. Sync your video manually."}</p></header>
    <section className={`race-transport ${transportExpanded ? "is-manually-expanded" : ""}`} aria-label={t.replayControls}>
      <button type="button" className="transport-expand icon-button" aria-label={transportExpanded ? pt ? "Recolher controles" : "Collapse controls" : pt ? "Expandir controles" : "Expand controls"} aria-expanded={transportExpanded} onClick={() => setTransportExpanded(!transportExpanded)}>{transportExpanded ? "−" : "•••"}</button>
      <div className="transport-main">
        <div className="playback-mode" aria-label={t.raceMode}><button type="button" className="mode-button" aria-pressed={mode === "race"} onClick={() => changeMode("race")}>{t.realRace}</button><button type="button" className="mode-button" aria-pressed={mode === "comparison"} onClick={() => changeMode("comparison")}>{t.lapComparison}</button></div>
        <button type="button" className="replay-action icon-button" aria-label={playing ? t.pause : t.play} disabled={!canPlay} onClick={togglePlayback}>{playing ? "Ⅱ" : "▶"}</button>
        <div className="companion-clock"><strong>{mode === "race" ? `${focus.driver} · ${t.lap} ${currentLap ?? "—"}` : t.lapComparison}</strong><output data-testid="race-time" data-time={time}>{mode === "race" ? formatSessionTime(time, locale) : formatComparisonClock(time, locale)}</output><small>/ {mode === "race" ? formatSessionTime(bounds.end, locale) : formatComparisonClock(comparisonDuration ?? 0, locale)}</small></div>
        <div className="transport-sync"><button type="button" className="button button-secondary button-small" aria-label={pt ? "Recuar 1 segundo" : "Back 1 second"} onClick={() => seek(time - 1, false)}>−1 s</button><button type="button" className="button button-secondary button-small" aria-label={pt ? "Avançar 1 segundo" : "Forward 1 second"} onClick={() => seek(time + 1, false)}>+1 s</button></div>
        <select className="transport-speed-select" aria-label={pt ? "Velocidade do replay" : "Replay speed"} value={clock.speed} onChange={(event) => clock.setSpeed(Number(event.target.value))}>{[.5, 1, 2, 5].map((speed) => <option key={speed} value={speed}>{new Intl.NumberFormat(locale).format(speed)}×</option>)}</select>
        <div className="transport-speeds" role="group" aria-label={pt ? "Velocidade" : "Speed"}>{[.5, 1, 2, 5].map((speed) => <button type="button" key={speed} aria-pressed={clock.speed === speed} onClick={() => clock.setSpeed(speed)}>{new Intl.NumberFormat(locale).format(speed)}×</button>)}</div>
      </div>
      <div className="transport-navigation">
        <details className="transport-options" open={lapOptions} onToggle={(event) => setLapOptions(event.currentTarget.open)}><summary>{pt ? "Opções da volta" : "Lap options"}</summary><div>
        {mode === "race" ? <><button className="button button-secondary button-small" type="button" onClick={() => { seek(bounds.start!); setFollowing(true); clock.setPlaying(true); }}>{pt ? "Iniciar corrida" : "Start race"}</button>
          <label className="compact-control lap-navigation">{pt ? `Ir para volta · ${focus.driver}` : `Go to lap · ${focus.driver}`}<select aria-label={t.selectedLap} value={focus.lap ?? ""} onChange={(event) => selectLap(Number(event.target.value))}>{lapsFor(manifest, focus.driver).map((lap) => <option key={lap} value={lap} disabled={!lapWindow(manifest.laps, focus.driver, lap)}>{lap}</option>)}</select></label>
          <label className="pause-at-end"><input type="checkbox" checked={pauseAtEnd} onChange={(event) => setPauseAtEnd(event.target.checked)} />{pt ? "Pausar ao fim da volta escolhida" : "Pause at selected lap end"}</label></> : <span className="timing-note">{pt ? "Cada piloto termina na duração da própria volta." : "Each driver stops at their own lap duration."}</span>}
        </div></details>
        <label className="session-seek"><span>{mode === "race" ? t.sessionTime : t.relativeTime}</span><input aria-label={t.seek} type="range" min={mode === "race" ? bounds.start : 0} max={mode === "race" ? bounds.end : comparisonDuration ?? 1} step=".001" value={time} disabled={!canPlay} onChange={(event) => seek(Number(event.target.value))} /></label>
      </div>
    </section>

    <section className="driver-selection" aria-label={pt ? "Seleção de pilotos" : "Driver selection"}>
      {mode === "race" ? <>
        <div className="monitor-selection-header"><h2>{pt ? "Carros na simulação" : "Cars in simulation"} <small>{monitored.length}/{manifest.drivers.length}</small></h2><div className="driver-bulk-actions"><button className="button button-secondary button-small" type="button" onClick={() => setMonitored(manifest.drivers.map((driver) => driver.code))}>{pt ? "Selecionar todos" : "Select all"}</button><button className="button button-secondary button-small" type="button" onClick={() => setMonitored([])}>{pt ? "Limpar" : "Clear"}</button></div><details className="driver-picker"><summary>{pt ? "Escolher pilotos" : "Choose drivers"}</summary><div className="driver-picker-menu"><div className="mobile-bulk-actions"><button className="button button-small" type="button" onClick={() => setMonitored(manifest.drivers.map((driver) => driver.code))}>{pt ? "Selecionar todos" : "Select all"}</button><button className="button button-small" type="button" onClick={() => setMonitored([])}>{pt ? "Limpar" : "Clear"}</button></div><input type="search" aria-label={pt ? "Buscar piloto" : "Search drivers"} placeholder={pt ? "Nome, equipe ou sigla" : "Name, team or code"} value={search} onChange={(event) => setSearch(event.target.value)} /><div>{manifest.drivers.filter((driver) => [driver.code, driver.name, driver.team].join(" ").toLowerCase().includes(search.toLowerCase())).map((driver) => <label key={driver.code}><input type="checkbox" checked={monitored.includes(driver.code)} onChange={() => toggleMonitor(driver.code)} /><strong>{driver.code}</strong><span>{driver.name}</span></label>)}</div></div></details></div>
        <div ref={chips} className="monitored-chips">{monitored.map((driver) => <div className="driver-chip" data-motion-id={driver} key={driver} style={{ borderColor: driverColor(driver) }}><button type="button" aria-label={`${pt ? "Focar" : "Focus"} ${driver}`} aria-pressed={focus.driver === driver} onClick={() => selectFocus(driver)}><i style={{ background: driverColor(driver) }} /><strong>{driver}</strong><small>{t.lap} {activeLapWindow(manifest.laps, driver, time)?.lap ?? "—"}</small></button><button type="button" className="analyze-toggle" aria-label={`${analyzed.includes(driver) ? pt ? "Parar de analisar" : "Stop analyzing" : pt ? "Analisar" : "Analyze"} ${driver}`} aria-pressed={analyzed.includes(driver)} disabled={!analyzed.includes(driver) && analyzed.length >= 4} onClick={() => toggleAnalysis(driver)}>∿</button><button type="button" aria-label={`${pt ? "Remover" : "Remove"} ${driver}`} onClick={() => toggleMonitor(driver)}>×</button></div>)}{!monitored.length && <p className="muted">{pt ? "Escolha pilotos para visualizar na simulação." : "Choose drivers to show in the simulation."}</p>}</div>
      </> : <><div className="monitor-selection-header"><h2>{t.lapComparison} <small>{comparisons.length}/4</small></h2><button className="button button-secondary button-small" type="button" disabled={comparisons.length >= 4} onClick={() => { const next = manifest.laps.find((lap) => lap.number !== null && !comparisons.some((item) => item.driver === lap.driver && item.lap === lap.number)); if (next) setComparison([...comparisons, { driver: next.driver, lap: next.number }]); }}>{t.addSeries}</button></div><div className="comparison-strip">{comparisons.map((comparison, index) => <ComparisonCard key={index} manifest={manifest} comparison={comparison} index={index} onChange={(next) => { if (!comparisons.some((item, itemIndex) => itemIndex !== index && item.driver === next.driver && item.lap === next.lap)) setComparison(comparisons.map((item, itemIndex) => itemIndex === index ? next : item)); }} onRemove={() => setComparison(comparisons.filter((_, itemIndex) => itemIndex !== index))} labels={{ driver: t.driver, lap: t.lap, remove: t.removeSeries, comparison: t.comparison }} />)}</div>{comparisonDuration === null && <p className="inline-notice">{t.timelineUnavailable}</p>}</>}
      <p className="selection-focus">{pt ? "Em foco na pista" : "Track focus"}: <strong>{focus.driver}</strong></p>
    </section>

    <div className="companion-layout">
    <div className="companion-grid">
      <div className="scene-spacer"><div className="scene-section-label"><span>SPA–FRANCORCHAMPS</span><span>{pt ? "ROLE PARA INVESTIGAR" : "SCROLL TO EXPLORE"} ↓</span></div>{trackData.error && <div className="track-data-notice" role="status"><span>{pt ? "Posições de um piloto indisponíveis." : "A driver's positions are unavailable."}</span><button type="button" className="button button-secondary button-small" onClick={trackData.retry}>{t.retry}</button></div>}</div>
      <aside className="timing-rail"><TimingTower {...towerProps} adaptive animate={mode === "race" && playing && performance.now() > skipAnimation.current} /></aside>
    </div>

    <section className="companion-analysis" aria-label={t.analysisZone}>
      <header className="analysis-heading"><div><p className="eyebrow">{mode === "race" ? pt ? "ACOMPANHAMENTO" : "FOLLOWING" : pt ? "INVESTIGAÇÃO" : "INSPECTION"}</p><h2>{t.charts}</h2></div><div className="analysis-controls">{mode === "race" && <label className="compact-control">{pt ? "Janela" : "Window"}<select value={windowSeconds} onChange={(event) => { setWindowSeconds(Number(event.target.value)); setInspectionRange(null); }}>{[30, 60, 120].map((seconds) => <option key={seconds} value={seconds}>{seconds} s</option>)}</select></label>}<span className={following ? "follow-state" : "inspect-state"}>{following ? pt ? "● Seguindo replay" : "● Following replay" : pt ? "Inspeção pausada" : "Paused inspection"}</span>{!following && <button className="button button-primary button-small" type="button" onClick={() => { setFollowing(true); setInspectionRange(null); }}>{pt ? "Voltar ao acompanhamento" : "Return to following"}</button>}</div></header>
      {mode === "race" && <details className="analysis-driver-picker"><summary>{pt ? `Pilotos nos gráficos · ${analyzed.length}/4` : `Drivers in charts · ${analyzed.length}/4`}</summary><div>{manifest.drivers.map((driver) => <label key={driver.code}><input type="checkbox" checked={analyzed.includes(driver.code)} disabled={!analyzed.includes(driver.code) && analyzed.length >= 4} onChange={() => toggleAnalysis(driver.code)} /><i style={{ background: driverColor(driver.code) }} /><strong>{driver.code}</strong><span>{driver.name}</span></label>)}</div></details>}
      <div className="series-status" role="status">{data.error ? <><span>{pt ? "Falha ao carregar uma ou mais voltas." : "One or more laps failed to load."}</span><button className="button button-secondary button-small" type="button" onClick={data.retry}>{t.retry}</button></> : data.loading ? pt ? "Preparando telemetria das voltas…" : "Preparing lap telemetry…" : <span>{mode === "race" ? t.sessionTime : t.relativeTime} · {pt ? "Arraste no gráfico para inspecionar" : "Drag on the chart to inspect"}</span>}</div>
      <TelemetryWorkspace series={series} channels={manifest.channels} axis={mode === "race" ? "globalTime" : "lapTime"} cursor={time} range={range} visible={visible} onVisible={setVisible} onInspect={inspect} locale={locale} following={following} durations={durations} />
      <details className="lap-inspector"><summary>{pt ? "Análise da volta e classificação por passagem" : "Lap analysis and crossing standings"}</summary><LapMetrics series={metricsSeries} manifest={manifest} labels={{ title: t.lapMetrics, lapTime: t.metricLapTime, topSpeed: t.metricTopSpeed, averageSpeed: t.metricAverageSpeed, throttle: t.metricThrottleSamples, brake: t.metricBrakeSamples, gearChanges: t.metricGearChanges, drs: t.metricDrsSamples, unavailable: t.metricUnavailable, delta: t.totalDelta }} locale={locale} /><TimingTower {...towerProps} lap={focus.lap} animate={false} /></details>
    </section>
    </div>
  </div>;
}

function ComparisonCard({ manifest, comparison, index, onChange, onRemove, labels }: { manifest: Manifest; comparison: Comparison; index: number; onChange: (value: Comparison) => void; onRemove: () => void; labels: { driver: string; lap: string; remove: string; comparison: string } }) { const laps = lapsFor(manifest, comparison.driver); return <fieldset className="comparison-control"><legend><span className="driver-color-dot" style={{ backgroundColor: driverColor(comparison.driver) }} />{`${labels.comparison} ${index + 1}`}</legend><label><span>{labels.driver}</span><select value={comparison.driver} onChange={(event) => onChange({ driver: event.target.value, lap: firstLapFor(manifest, event.target.value) })}>{manifest.drivers.map((driver) => <option key={driver.code} value={driver.code}>{driver.code}</option>)}</select></label><label><span>{labels.lap}</span><select value={comparison.lap ?? ""} onChange={(event) => onChange({ ...comparison, lap: Number(event.target.value) })}>{laps.map((lap) => <option key={lap} value={lap}>{lap}</option>)}</select></label><button className="icon-button" type="button" onClick={onRemove} aria-label={labels.remove}>×</button></fieldset>; }
function TrackMap({ segments, markers, noTrack, noMarker, locale }: { segments: TrackSegment[]; markers: Array<{ driver: string; x: number; y: number }>; noTrack: string; noMarker: string; locale: string }) {
  const svg = useRef<SVGSVGElement>(null);
  const [markerScale, setMarkerScale] = useState(3);
  const geometry = useMemo(() => {
    const valid = segments.flatMap((segment) => segment.samples).filter((sample) => sample.x !== null && sample.y !== null && sample.onTrack === true);
    const bounds = boundsFor(valid);
    return bounds ? { bounds, paths: segments.map((segment) => ({ key: `${segment.driver}-${segment.lap}`, driver: segment.driver, path: trackPath(segment, bounds) })) } : null;
  }, [segments]);
  useEffect(() => {
    if (!svg.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setMarkerScale(1000 / Math.max(100, Math.min(entry.contentRect.width, entry.contentRect.height))); });
    observer.observe(svg.current); return () => observer.disconnect();
  }, [geometry !== null]);
  if (!geometry) return <StatePanel state="warning" body={noTrack} />;
  return <div className="track-map-wrap"><svg ref={svg} className="track-map" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet" role="img" aria-label={locale === "pt-BR" ? "Traçado real da pista, com posições brutas válidas" : "Real track with valid original positions"}><title>Track map</title>
    {geometry.paths.map((item) => <g key={item.key}><path d={item.path} className="track-path track-path-base" /><path d={item.path} className="track-path track-path-focus" style={{ stroke: driverColor(item.driver) }} /></g>)}
    {markers.map((marker, index) => <TrackMarker key={`${marker.driver}-${index}`} marker={marker} index={index} bounds={geometry.bounds} scale={markerScale} />)}
  </svg>{markers.length === 0 ? <p className="track-absence">{noMarker}</p> : null}</div>;
}
function TrackMarker({ marker, index, bounds, scale }: { marker: { driver: string; x: number; y: number }; index: number; bounds: NonNullable<ReturnType<typeof boundsFor>>; scale: number }) {
  const x = scaleX(marker.x, bounds); const y = scaleY(marker.y, bounds);
  const offsets = [{ x: 10, y: -24 }, { x: 10, y: 10 }, { x: -44, y: -24 }, { x: -44, y: 10 }];
  const offset = offsets[index % offsets.length]!;
  const labelX = Math.max(0, Math.min(1000 - 36 * scale, x + offset.x * scale));
  const labelY = Math.max(0, Math.min(1000 - 18 * scale, y + offset.y * scale));
  return <g><circle className="track-marker" cx={x} cy={y} r={5 * scale} style={{ fill: driverColor(marker.driver) }} /><rect className="track-label-bg" x={labelX} y={labelY} width={36 * scale} height={18 * scale} rx={3 * scale} /><text className="track-marker-label" x={labelX + 18 * scale} y={labelY + 13 * scale} style={{ fontSize: 11 * scale }} textAnchor="middle">{marker.driver}</text></g>;
}
function LapMetrics({ series, manifest, labels, locale }: { series: Series[]; manifest: Manifest; labels: { title: string; lapTime: string; topSpeed: string; averageSpeed: string; throttle: string; brake: string; gearChanges: string; drs: string; unavailable: string; delta: string }; locale: string }) { const baseTime = series[0] ? lapTimeFor(manifest, series[0].driver, series[0].lap) : null; return <section className="lap-metrics" aria-label={labels.title}><h3>{labels.title}</h3><div>{series.map((item) => { const total = lapTimeFor(manifest, item.driver, item.lap); return <article key={`${item.driver}-${item.lap}`} className="lap-metric-card" style={{ borderColor: driverColor(item.driver) }}><h4><span className="driver-color-dot" style={{ backgroundColor: driverColor(item.driver) }} />{item.driver} · {item.lap ?? "—"}</h4><Metric name={labels.lapTime} value={formatSeconds(total, locale)} unavailable={labels.unavailable} />{item !== series[0] ? <Metric name={labels.delta} value={formatDelta(total, baseTime, locale)} unavailable={labels.unavailable} /> : null}<Metric name={labels.topSpeed} value={formatSpeed(maxChannelValue(item, "speed"), locale)} unavailable={labels.unavailable} /><Metric name={labels.averageSpeed} value={formatSpeed(averageChannelValue(item, "speed"), locale)} unavailable={labels.unavailable} /><Metric name={labels.throttle} value={formatCount(activeChannelSamples(item, "throttle"), locale)} unavailable={labels.unavailable} /><Metric name={labels.brake} value={formatCount(activeChannelSamples(item, "brake"), locale)} unavailable={labels.unavailable} /><Metric name={labels.gearChanges} value={formatCount(gearChanges(item), locale)} unavailable={labels.unavailable} /><Metric name={labels.drs} value={formatCount(activeChannelSamples(item, "drs"), locale)} unavailable={labels.unavailable} /></article>; })}</div></section>; }
function Metric({ name, value, unavailable }: { name: string; value: string | null; unavailable: string }) { return <p><span>{name}</span><strong>{value ?? unavailable}</strong></p>; }
function firstLapFor(manifest: Manifest, driver: string): number | null { return lapsFor(manifest, driver)[0] ?? null; }
function lapOrFallback(manifest: Manifest, driver: string, preferred: number): number | null { return lapsFor(manifest, driver).includes(preferred) ? preferred : firstLapFor(manifest, driver); }
function lapsFor(manifest: Manifest, driver: string): number[] { return manifest.laps.filter((lap) => lap.driver === driver && lap.number !== null).map((lap) => lap.number as number); }
function lapTimeFor(manifest: Manifest, driver: string, lap: number | null): number | null { return manifest.laps.find((item) => item.driver === driver && item.number === lap)?.lapTime ?? null; }
function frameAt(frames: ReplayFrame[], time: number | null): ReplayFrame | null { if (time === null || !frames.length) return null; let low = 0; let high = frames.length - 1; while (low <= high) { const middle = Math.floor((low + high) / 2); if ((frames[middle]?.time ?? Infinity) <= time) low = middle + 1; else high = middle - 1; } return frames[high] ?? null; }
function chartValue(value: unknown): number | null { if (typeof value === "boolean") return value ? 1 : 0; return typeof value === "number" && Number.isFinite(value) ? value : null; }
function formatComparisonClock(value: number, locale: string): string { return `${String(Math.floor(value / 60)).padStart(2, "0")}:${formatRelativeTime(value % 60, locale)}`; }
function formatRelativeTime(value: number, locale: string): string { return new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(value); }
function formatSessionTime(value: number, locale: string): string { const hours = Math.floor(value / 3600); const minutes = Math.floor(value % 3600 / 60); const seconds = Math.floor(value % 60); const two = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false }); return `${two.format(hours)}:${two.format(minutes)}:${two.format(seconds)}`; }
function formatSeconds(value: number | null, locale: string): string | null { return value === null ? null : `${formatRelativeTime(value, locale)} s`; }
function formatSpeed(value: number | null, locale: string): string | null { return value === null ? null : `${formatAxis(value, locale)} km/h`; }
function formatCount(value: number | null, locale: string): string | null { return value === null ? null : new Intl.NumberFormat(locale).format(value); }
function formatDelta(value: number | null, base: number | null, locale: string): string | null { return value === null || base === null ? null : `${value >= base ? "+" : ""}${formatRelativeTime(value - base, locale)} s`; }
function channelValues(series: Series, channel: string): number[] { return series.samples.map((sample) => chartValue(sample.values[channel])).filter((value): value is number => value !== null); }
function maxChannelValue(series: Series, channel: string): number | null { const values = channelValues(series, channel); return values.length ? Math.max(...values) : null; }
function averageChannelValue(series: Series, channel: string): number | null { const values = channelValues(series, channel); return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function activeChannelSamples(series: Series, channel: string): number | null { const values = channelValues(series, channel); return values.length ? values.filter((value) => value > 0).length : null; }
function gearChanges(series: Series): number | null { const values = channelValues(series, "gear"); return values.length ? values.slice(1).filter((value, index) => value !== values[index]).length : null; }
function markerPositions(segments: TrackSegment[], drivers: string[], time: number): Array<{ driver: string; x: number; y: number }> { return drivers.flatMap((driver) => { const marker = markerPositionFor(segments.filter((segment) => segment.driver === driver), time); return marker ? [{ driver, ...marker }] : []; }); }
function comparisonMarkers(segments: TrackSegment[], comparisons: Comparison[], manifest: Manifest, time: number): Array<{ driver: string; x: number; y: number }> { return comparisons.flatMap((comparison) => { const window = lapWindow(manifest.laps, comparison.driver, comparison.lap); if (!window || time > window.duration) return []; const marker = markerPositionFor(segments.filter((segment) => segment.driver === comparison.driver && segment.lap === comparison.lap), window.start + time); return marker ? [{ driver: comparison.driver, ...marker }] : []; }); }
function boundsFor(points: Array<{ x: number | null; y: number | null }>): { minX: number; maxX: number; minY: number; maxY: number; width: number; height: number } | null { const valid = points.filter((point): point is { x: number; y: number } => point.x !== null && point.y !== null); if (!valid.length) return null; const rawMinX = Math.min(...valid.map((point) => point.x)); const rawMaxX = Math.max(...valid.map((point) => point.x)); const rawMinY = Math.min(...valid.map((point) => point.y)); const rawMaxY = Math.max(...valid.map((point) => point.y)); const extent = Math.max(rawMaxX - rawMinX, rawMaxY - rawMinY) * 1.12 || 1; const centerX = (rawMinX + rawMaxX) / 2; const centerY = (rawMinY + rawMaxY) / 2; return { minX: centerX - extent / 2, maxX: centerX + extent / 2, minY: centerY - extent / 2, maxY: centerY + extent / 2, width: 1000, height: 1000 }; }
function scaleX(value: number, bounds: NonNullable<ReturnType<typeof boundsFor>>): number { return (value - bounds.minX) / (bounds.maxX - bounds.minX) * bounds.width; }
function scaleY(value: number, bounds: NonNullable<ReturnType<typeof boundsFor>>): number { return bounds.height - (value - bounds.minY) / (bounds.maxY - bounds.minY) * bounds.height; }
function trackPath(segment: TrackSegment, bounds: NonNullable<ReturnType<typeof boundsFor>>): string { let open = false; let previousTime: number | null = null; return segment.samples.reduce((path, sample) => { if (sample.x === null || sample.y === null || sample.onTrack !== true || sample.time === null || (previousTime !== null && sample.time - previousTime > markerMaxAgeSeconds)) { open = false; previousTime = sample.time; return path; } const command = open ? "L" : "M"; open = true; previousTime = sample.time; return `${path}${command}${scaleX(sample.x, bounds).toFixed(1)},${scaleY(sample.y, bounds).toFixed(1)}`; }, ""); }
function isEditableTarget(target: EventTarget | null): boolean { return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(target.tagName)); }
function markerPositionFor(segments: TrackSegment[], time: number): { x: number; y: number } | null {
  const point = lastAtOrBefore(segments.flatMap((segment) => segment.samples), time, (sample) => sample.time, markerMaxAgeSeconds);
  return point && point.x !== null && point.y !== null && point.onTrack === true ? { x: point.x, y: point.y } : null;
}
function formatAxis(value: number | null, locale: string): string { return value === null ? "—" : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value); }
