"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { TrackResponse } from "@cortex/contracts";
import { telemetryColor } from "../../shared/telemetry-workspace";

type Segment = TrackResponse["segments"][number];
type Marker = { driver: string; x: number; y: number; heading?: number; estimated?: boolean; color?: string };

export function RaceTrack3D({ reference, markers, originalMarkers, focused, locale, fallback, illustration, demoPlaying = false, onReady }: {
  reference: Segment[];
  markers: Marker[];
  originalMarkers?: Marker[];
  focused: string;
  locale: string;
  fallback: React.ReactNode;
  illustration?: number[][];
  demoPlaying?: boolean;
  onReady?: () => void;
}) {
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [cameraMode, setCameraMode] = useState<"auto" | "exploring" | "fixed">("auto");
  const savedCamera = useRef<[number, number, number] | null>(null);
  const progress = useRef(0);
  const [estimated, setEstimated] = useState(true);
  const [active, setActive] = useState(true);
  const [visible, setVisible] = useState(true);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => { if (webgl === false) onReady?.(); }, [webgl, onReady]);
  useEffect(() => {
    if (typeof WebGLRenderingContext === "undefined") { setWebgl(false); return; }
    try {
      const canvas = document.createElement("canvas");
      setWebgl(Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl")));
    } catch { setWebgl(false); }
  }, []);
  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setActive(Boolean(entry?.isIntersecting)), { rootMargin: "120px" });
    observer.observe(host.current); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const rect = host.current?.closest(".race-experience")?.querySelector(".scene-spacer")?.getBoundingClientRect();
      if (rect) progress.current = Math.max(0, Math.min(1, (200 - rect.top) / Math.max(1, rect.height)));
    }); };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  const pt = locale === "pt-BR";
  return <div ref={host} className="race-scene" data-camera-mode={cameraMode} data-active={active && visible} data-scene-source={illustration ? "illustration" : "telemetry"}>
    {webgl !== true ? fallback : active && <Canvas frameloop={visible ? "always" : "never"} onCreated={() => onReady?.()} role="img" aria-label={illustration ? pt ? "Apresentação ilustrativa de Spa" : "Illustrative Spa presentation" : pt ? "Simulação tridimensional de Spa com movimento estimado entre amostras" : "Three-dimensional Spa simulation with estimated movement between samples"} dpr={[1, 1.4]} camera={{ position: savedCamera.current ?? [0, 8.2, 8.8], fov: 40, near: .1, far: 80 }} gl={{ antialias: true, alpha: true, powerPreference: "default" }}>
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 8, 6]} intensity={2.4} color="#dcecff" />
      <TrackScene reference={reference} markers={estimated ? markers : originalMarkers ?? markers} focused={focused} cameraMode={cameraMode} savedCamera={savedCamera} progress={progress} illustration={illustration} demoPlaying={demoPlaying && visible} />
    </Canvas>}
    {webgl === true && <div className="scene-hud">{!illustration && <button type="button" className="scene-data-mode" aria-pressed={estimated} onClick={() => setEstimated((value) => !value)}><i />{estimated ? pt ? "MOVIMENTO ESTIMADO" : "ESTIMATED MOVEMENT" : pt ? "POSIÇÕES ORIGINAIS" : "ORIGINAL POSITIONS"}</button>}<div className="scene-camera-actions"><button type="button" className="button button-secondary button-small" aria-pressed={cameraMode === "exploring"} onClick={() => setCameraMode(cameraMode === "exploring" ? "fixed" : "exploring")}>{cameraMode === "exploring" ? pt ? "Fixar câmera" : "Lock camera" : pt ? "Explorar pista" : "Explore track"}</button>{cameraMode !== "auto" && <button type="button" className="button button-secondary button-small" onClick={() => setCameraMode("auto")}>{pt ? "Restaurar vista" : "Reset view"}</button>}</div></div>}
  </div>;
}

function TrackScene({ reference, markers, focused, cameraMode, savedCamera, progress, illustration, demoPlaying }: { illustration?: number[][]; demoPlaying: boolean; reference: Segment[]; markers: Marker[]; focused: string; cameraMode: "auto" | "exploring" | "fixed"; savedCamera: React.RefObject<[number, number, number] | null>; progress: React.RefObject<number> }) {
  const grid = useRef<THREE.GridHelper>(null);
  const interacting = useRef(false);
  const target = useMemo(() => new THREE.Vector3(), []);
  const reducedMotion = useRef(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { reducedMotion.current = media.matches; };
    update(); media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const bounds = useMemo(() => illustration ? pointsBounds(illustration) : sceneBounds(reference), [reference, illustration]);
  const track = useMemo(() => illustration ? [presentationGeometry(illustration, bounds)] : buildTrack(reference, bounds), [reference, bounds, illustration]);
  useEffect(() => () => track.forEach((geometry) => geometry.dispose()), [track]);
  useFrame((state, delta) => {
    const reduced = reducedMotion.current;
    if (cameraMode === "auto") {
      const p = reduced ? 0 : progress.current;
      const landscape = state.size.width > state.size.height;
      const radius = 8.5 * Math.max(1, state.size.height / state.size.width);
      const polar = THREE.MathUtils.degToRad(38 + 3 * p);
      const azimuth = THREE.MathUtils.degToRad((landscape ? -65 : -3) + 6 * p);
      target.setFromSphericalCoords(radius, polar, azimuth);
      if (reduced) state.camera.position.copy(target);
      else state.camera.position.lerp(target, 1 - Math.exp(-5 * Math.min(delta, .1)));
    }
    state.camera.lookAt(0, 0, 0);
    savedCamera.current = state.camera.position.toArray();
    if (grid.current) for (const material of [grid.current.material].flat()) {
      material.transparent = true; material.depthWrite = false;
      material.opacity = THREE.MathUtils.damp(material.opacity, cameraMode === "exploring" && interacting.current ? .5 : 0, 7, Math.min(delta, .1));
    }
  });
  return <>
    <gridHelper ref={grid} args={[18, 36, "#547c99", "#29465c"]} position={[0, -.18, 0]} onUpdate={(helper) => { for (const material of [helper.material].flat()) { material.transparent = true; material.opacity = 0; } }} />
    <group rotation-x={-Math.PI / 2}>
      {track.map((geometry, index) => <mesh key={index} geometry={geometry}><meshStandardMaterial color="#bccbd1" emissive="#66828c" emissiveIntensity={.18} roughness={.62} metalness={.15} /></mesh>)}
      {illustration && <IllustrativeCars points={illustration} bounds={bounds} playing={demoPlaying} reduced={reducedMotion} />}
      {markers.map((marker, index) => <Car key={`${marker.driver}-${index}`} marker={marker} bounds={bounds} focused={marker.driver === focused} />)}
    </group>
    <CameraControls enabled={cameraMode === "exploring"} interacting={interacting} />
  </>;
}

function Car({ marker, bounds, focused }: { marker: Marker; bounds: Bounds; focused: boolean }) {
  const position = normalize(marker.x, marker.y, bounds);
  const color = marker.color ?? telemetryColor(marker.driver);
  return <group position={[position.x, position.y, .12]} rotation-z={marker.heading ?? 0} scale={focused ? 1.2 : 1}>
    <mesh><boxGeometry args={[.24, .10, .07]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={focused ? .8 : .25} /></mesh>
    <mesh position={[-.07, 0, .055]}><boxGeometry args={[.09, .075, .05]} /><meshStandardMaterial color="#dce9f5" /></mesh>
    <mesh position={[.14, 0, -.005]} scale={[.04, .19, .025]} geometry={carBox}><meshStandardMaterial color={color} /></mesh>
    <mesh position={[-.13, 0, .035]} scale={[.04, .17, .025]} geometry={carBox}><meshStandardMaterial color={color} /></mesh>
    {[-.085, .085].flatMap((x) => [-.075, .075].map((y) => <mesh key={`${x}-${y}`} geometry={carWheel} position={[x, y, -.015]}><meshStandardMaterial color="#080c13" roughness={.9} /></mesh>))}
    {focused && <pointLight color={color} intensity={1.5} distance={1.4} position={[0, 0, .3]} />}
  </group>;
}

// Shared by every miniature; retained for the lifetime of the scene module.
const carBox = new THREE.BoxGeometry(1, 1, 1);
const carWheel = new THREE.CylinderGeometry(.038, .038, .035, 8);

function CameraControls({ enabled, interacting }: { enabled: boolean; interacting: React.RefObject<boolean> }) {
  const { camera, gl } = useThree();
  const orbit = useRef<OrbitControls | null>(null);
  useFrame(() => orbit.current?.update());
  useEffect(() => {
    if (!enabled) return;
    const controls = new OrbitControls(camera, gl.domElement);
    orbit.current = controls;
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 6; controls.maxDistance = 20;
    controls.minPolarAngle = .45; controls.maxPolarAngle = 1.35;
    gl.domElement.tabIndex = 0;
    const keyboard = (event: KeyboardEvent) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "-", "="].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const spherical = new THREE.Spherical().setFromVector3(camera.position);
      spherical.theta += event.key === "ArrowLeft" ? -.1 : event.key === "ArrowRight" ? .1 : 0;
      spherical.phi = THREE.MathUtils.clamp(spherical.phi + (event.key === "ArrowUp" ? -.08 : event.key === "ArrowDown" ? .08 : 0), .45, 1.35);
      spherical.radius = THREE.MathUtils.clamp(spherical.radius + (event.key === "-" ? 1 : event.key === "+" || event.key === "=" ? -1 : 0), 6, 20);
      camera.position.setFromSpherical(spherical); controls.update();
    };
    gl.domElement.addEventListener("keydown", keyboard);
    controls.addEventListener("start", () => { interacting.current = true; });
    controls.addEventListener("end", () => { interacting.current = false; });
    return () => { interacting.current = false; orbit.current = null; gl.domElement.tabIndex = -1; gl.domElement.removeEventListener("keydown", keyboard); controls.dispose(); };
  }, [camera, enabled, gl, interacting]);
  return null;
}

type Bounds = { minX: number; maxX: number; minY: number; maxY: number; scale: number };
function pointsBounds(points: number[][]): Bounds {
  const xs = points.map((p) => p[0]!); const ys = points.map((p) => p[1]!);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, scale: 7 / Math.max(maxX - minX, maxY - minY, 1) };
}
function presentationCurve(points: number[][], bounds: Bounds) {
  const path = new THREE.CurvePath<THREE.Vector3>();
  const vertices = points.map(([x, y]) => { const p = normalize(x!, y!, bounds); return new THREE.Vector3(p.x, p.y, 0); });
  for (let i = 1; i < vertices.length; i++) path.add(new THREE.LineCurve3(vertices[i - 1]!, vertices[i]!));
  return path;
}
function presentationGeometry(points: number[][], bounds: Bounds) {
  return new THREE.TubeGeometry(presentationCurve(points, bounds), points.length * 2, .035, 5, false);
}
function IllustrativeCars({ points, bounds, playing, reduced }: { points: number[][]; bounds: Bounds; playing: boolean; reduced: React.RefObject<boolean> }) {
  const cars = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const path = useMemo(() => presentationCurve(points, bounds), [points, bounds]);
  const count = useThree((state) => state.size.width < 768 ? 3 : 5);
  useFrame((_, delta) => {
    if (playing && !reduced.current) elapsed.current += Math.min(delta, .05);
    cars.current?.children.forEach((car, i) => {
      const t = (elapsed.current / 40 + i / count) % 1;
      const position = path.getPointAt(t); const tangent = path.getTangentAt(t);
      car.position.set(position.x, position.y, 0); car.rotation.z = Math.atan2(tangent.y, tangent.x);
    });
  });
  return <group ref={cars}>{Array.from({ length: count }, (_, i) => <group key={i}><Car marker={{ driver: `DEMO_${i}`, color: ["#80b4f5", "#ddb578", "#79c7b0", "#c3aff0", "#e4e5df"][i], x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 }} bounds={bounds} focused={false} /></group>)}</group>;
}
function sceneBounds(segments: Segment[]): Bounds {
  const valid = segments.flatMap((segment) => segment.samples).filter((sample): sample is typeof sample & { x: number; y: number } => sample.x !== null && sample.y !== null && Number.isFinite(sample.x) && Number.isFinite(sample.y));
  if (!valid.length) return { minX: -1, maxX: 1, minY: -1, maxY: 1, scale: 1 };
  const minX = Math.min(...valid.map((point) => point.x)); const maxX = Math.max(...valid.map((point) => point.x));
  const minY = Math.min(...valid.map((point) => point.y)); const maxY = Math.max(...valid.map((point) => point.y));
  return { minX, maxX, minY, maxY, scale: 7 / Math.max(maxX - minX, maxY - minY, 1) };
}
function normalize(x: number, y: number, bounds: Bounds) { return { x: (x - (bounds.minX + bounds.maxX) / 2) * bounds.scale, y: (y - (bounds.minY + bounds.maxY) / 2) * bounds.scale }; }
function buildTrack(segments: Segment[], bounds: Bounds): THREE.TubeGeometry[] {
  const first = segments.find((segment) => segment.samples.filter(validSample).length > 2);
  if (!first) return [];
  const chunks: THREE.Vector3[][] = []; let current: THREE.Vector3[] = []; let previous: (Segment["samples"][number] & { time: number; x: number; y: number }) | null = null;
  for (const sample of first.samples) {
    if (!validSample(sample)) { if (current.length > 2) chunks.push(current); current = []; previous = null; continue; }
    if (previous) {
      const duration = sample.time - previous.time;
      const distance = Math.hypot(sample.x - previous.x, sample.y - previous.y) / 10;
      if (duration <= 0 || duration > 1 || distance > 150 * duration + 5) { if (current.length > 2) chunks.push(current); current = []; }
    }
    const point = normalize(sample.x, sample.y, bounds); current.push(new THREE.Vector3(point.x, point.y, 0));
    previous = sample;
  }
  if (current.length > 2) chunks.push(current);
  return chunks.map((points) => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let index = 1; index < points.length; index += 1) path.add(new THREE.LineCurve3(points[index - 1]!, points[index]!));
    return new THREE.TubeGeometry(path, Math.min(700, points.length * 2), .035, 5, false);
  });
}
function validSample(sample: Segment["samples"][number]): sample is typeof sample & { time: number; x: number; y: number } { return sample.onTrack === true && sample.x !== null && sample.y !== null && sample.time !== null && Number.isFinite(sample.x) && Number.isFinite(sample.y) && Number.isFinite(sample.time); }
