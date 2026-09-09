"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type ComponentProps } from "react";
import dynamic from "next/dynamic";
import type { RaceTrack3D as RaceTrackComponent } from "./race-track-3d";
const RaceTrack3D = dynamic(() => import("./race-track-3d").then((module) => module.RaceTrack3D), { ssr: false });
import { TrackMonitor, type TrackPresentation } from "./race-monitor-panels";
import spa from "./circuits/spa.json";

type Scene = Pick<ComponentProps<typeof RaceTrackComponent>, "reference" | "markers" | "originalMarkers" | "focused" | "fallback">;
type StageContext = { setScene: (scene: Scene | null) => void; presentation: TrackPresentation; finishIntro: () => void };
const Context = createContext<StageContext | null>(null);
export const useRaceStage = () => useContext(Context);

/** Presentation lives outside session data: it never feeds the replay or charts. */
export function RaceStage({ children, locale, real }: { children: ReactNode; locale: string; real: boolean }) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [presentation, setPresentation] = useState<TrackPresentation>("expanded");
  const [intro, setIntro] = useState(true);
  const [demoPlaying, setDemoPlaying] = useState(true);
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const finishIntro = useCallback(() => setIntro(false), []);
  const onReady = useCallback(() => setReady(true), []);
  const onSize = useCallback((height: number) => root.current?.style.setProperty("--compact-height", `${height + 40}px`), []);
  const pt = locale === "pt-BR";
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const reduce = () => { if (media?.matches) { finishIntro(); setDemoPlaying(false); } };
    reduce(); media?.addEventListener("change", reduce);
    window.addEventListener("scroll", finishIntro, { passive: true });
    window.addEventListener("keydown", finishIntro);
    return () => { media?.removeEventListener("change", reduce); window.removeEventListener("scroll", finishIntro); window.removeEventListener("keydown", finishIntro); };
  }, [finishIntro]);
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(finishIntro, 2800);
    return () => clearTimeout(timer);
  }, [ready, finishIntro]);
  useEffect(() => { if (real) finishIntro(); }, [real, finishIntro]);
  useEffect(() => {
    let frame = 0;
    const measure = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const element = root.current; if (!element) return;
      const main = element.closest(".main-content")?.getBoundingClientRect();
      const anchor = element.querySelector(".scene-spacer")?.getBoundingClientRect();
      element.style.setProperty("--stage-left", `${Math.max(0, main?.left ?? 0)}px`);
      element.style.setProperty("--compact-top", `${anchor ? anchor.top - element.getBoundingClientRect().top : 220}px`);
    }); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (root.current) observer?.observe(root.current);
    const main = root.current?.closest(".main-content"); if (main) observer?.observe(main);
    measure(); window.addEventListener("resize", measure);
    return () => { observer?.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", measure); };
  }, [real, presentation, scene !== null]);
  const context = useMemo(() => ({ setScene, presentation, finishIntro }), [presentation, finishIntro]);
  return <Context.Provider value={context}><div ref={root} className={`race-experience ${intro ? "is-introducing" : "is-revealed"}`} data-source={real ? "session" : "presentation"} data-presentation={presentation} data-intro-ready={ready} onPointerDownCapture={finishIntro} onFocusCapture={finishIntro}>
    <div className={`race-stage-shell ${presentation === "expanded" ? "stage-wide" : "stage-compact"}`}>
      {!real && !ready && <div className="stage-preview"><PresentationMap /></div>}
      <TrackMonitor mode={presentation} onMode={setPresentation} locale={locale} onSize={onSize}>
        <RaceTrack3D reference={real ? scene?.reference ?? [] : []} markers={real ? scene?.markers ?? [] : []} originalMarkers={scene?.originalMarkers} focused={real ? scene?.focused ?? "" : ""} locale={locale} illustration={real ? undefined : spa.points} demoPlaying={demoPlaying} onReady={onReady} fallback={real ? scene?.fallback ?? <p className="scene-empty">{pt ? "Preparando pista real…" : "Preparing real track…"}</p> : <PresentationMap />} />
        {real && scene && !scene.reference.length && <div className="scene-empty">{scene.fallback}</div>}
      </TrackMonitor>
    </div>
    {!real && <div className="presentation-label"><span className="presentation-dot" />{pt ? "Apresentação da pista · movimento ilustrativo" : "Circuit presentation · illustrative motion"}<button type="button" onClick={() => setDemoPlaying(!demoPlaying)} aria-label={demoPlaying ? pt ? "Pausar apresentação" : "Pause presentation" : pt ? "Reproduzir apresentação" : "Play presentation"}>{demoPlaying ? "Ⅱ" : "▶"}</button></div>}
    {intro && <button type="button" className="skip-intro" onClick={finishIntro}>{pt ? "Pular apresentação" : "Skip presentation"} <span aria-hidden="true">↗</span></button>}
    <div className="race-content-layer">{children}</div>
  </div></Context.Provider>;
}

function PresentationMap() {
  const xs = spa.points.map((p) => p[0]!); const ys = spa.points.map((p) => p[1]!);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  return <svg className="presentation-map" viewBox={`${x - 800} ${y - 800} ${w + 1600} ${h + 1600}`} role="img" aria-label="Spa-Francorchamps"><polyline fill="none" stroke="#c5d2db" strokeWidth="65" points={spa.points.map((p) => p.join(",")).join(" ")} /></svg>;
}
