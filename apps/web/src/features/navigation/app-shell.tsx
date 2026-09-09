"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";

import { copy, type Copy, type Locale } from "../../i18n";
import { Icon, type IconName, StatusBadge } from "../../shared/ui";
import { AnimatedNavigationList } from "./animated-navigation-list";
import { CommandPalette, type PaletteItem } from "./command-palette";

type CortexContextValue = { locale: Locale; setLocale: (locale: Locale) => void; t: Copy };
const CortexContext = createContext<CortexContextValue | null>(null);
export const useCortex = (): CortexContextValue => { const context = useContext(CortexContext); if (!context) throw new Error("useCortex must be used inside AppShell"); return context; };

const navItems = [
  { href: "/", icon: "home", label: "home" }, { href: "/f1", icon: "race", label: "raceExplorer" },
  { href: "/telemetry", icon: "telemetry", label: "telemetry" }, { href: "/telemetry/import", icon: "import", label: "importTelemetry" }
] as const satisfies readonly { href: string; icon: IconName; label: keyof Copy }[];
const clampWidth = (value: number): number => Math.min(320, Math.max(216, value));
const isActiveRoute = (pathname: string, href: string): boolean => href === "/" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

function routeContext(pathname: string, t: Copy) {
  if (pathname === "/") return { title: t.home, crumb: "Cortex", project: null };
  if (pathname.startsWith("/f1/2025")) return { title: "Spa 2025", crumb: `${t.raceExplorer} / Belgium`, project: t.raceExplorer };
  if (pathname === "/f1") return { title: t.raceExplorer, crumb: "Cortex", project: t.raceExplorer };
  if (pathname === "/telemetry/import") return { title: t.importTelemetry, crumb: `${t.telemetry} / ${t.workspace}`, project: t.telemetry };
  if (pathname === "/telemetry/session") return { title: t.workspace, crumb: t.telemetry, project: t.telemetry };
  return { title: t.telemetry, crumb: "Cortex", project: t.telemetry };
}

export function AppShell({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("pt-BR"); const [pinned, setPinned] = useState(false); const [hovered, setHovered] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false); const [drawerMotion, setDrawerMotion] = useState(false); const [width, setWidth] = useState(248); const [announcement, setAnnouncement] = useState(""); const [paletteOpen, setPaletteOpen] = useState(false); const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null); const menuButtonRef = useRef<HTMLButtonElement>(null);
  const t = copy[locale]; const pathname = usePathname(); const router = useRouter(); const sidebarId = useId(); const expanded = pinned || hovered;
  const activeNavItem = [...navItems].filter((item) => isActiveRoute(pathname, item.href)).sort((left, right) => right.href.length - left.href.length)[0] ?? null;
  const context = routeContext(pathname, t);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  useEffect(() => { const onKey = (event: globalThis.KeyboardEvent) => { const target = event.target; const editable = target instanceof HTMLElement && target.matches("input, textarea, select, [contenteditable=true]"); if (event.ctrlKey && !editable && event.key.toLowerCase() === "k") { event.preventDefault(); setPaletteOpen(true); } else if (event.key === "/" && !editable) { event.preventDefault(); setPaletteOpen(true); } else if (event.key === "Escape") { setPaletteOpen(false); setProjectMenuOpen(false); } }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, []);
  useEffect(() => { if (!drawerOpen) return; const handleKeyDown = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") { setDrawerOpen(false); menuButtonRef.current?.focus(); return; } if (event.key !== "Tab") return; const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])'); if (!focusable?.length) return; const first = focusable[0]; const last = focusable[focusable.length - 1]; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } }; document.addEventListener("keydown", handleKeyDown); drawerRef.current?.querySelector<HTMLElement>("a[href]")?.focus(); return () => document.removeEventListener("keydown", handleKeyDown); }, [drawerOpen]);
  const adjustWidth = useCallback((next: number) => { const resolved = clampWidth(next); setWidth(resolved); setAnnouncement(`${t.sidebarWidth}: ${resolved}px`); }, [t.sidebarWidth]);
  const resizeWithPointer = (event: PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); const initialX = event.clientX; const initialWidth = width; const move = (moveEvent: globalThis.PointerEvent) => adjustWidth(initialWidth + moveEvent.clientX - initialX); const finish = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", finish); }; window.addEventListener("pointermove", move); window.addEventListener("pointerup", finish); };
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLDivElement>) => { if (event.key === "ArrowLeft") { event.preventDefault(); adjustWidth(width - 16); } if (event.key === "ArrowRight") { event.preventDefault(); adjustWidth(width + 16); } if (event.key === "Home") { event.preventDefault(); adjustWidth(216); } if (event.key === "End") { event.preventDefault(); adjustWidth(320); } };
  const selectProject = (href: string) => { router.push(href); setProjectMenuOpen(false); };
  const paletteItems = useMemo<PaletteItem[]>(() => [
    ...navItems.map((item) => ({ id: item.href, group: t.commandNavigation, label: t[item.label], detail: item.href === "/" ? "Cortex" : t.workspace, icon: item.icon, onSelect: () => router.push(item.href) })),
    { id: "project-race", group: t.commandProjects, label: t.raceExplorer, detail: t.projectRaceDescription, icon: "race", onSelect: () => router.push("/f1") },
    { id: "project-telemetry", group: t.commandProjects, label: t.telemetry, detail: t.projectTelemetryDescription, icon: "telemetry", onSelect: () => router.push("/telemetry") },
    { id: "settings", group: t.commandSettings, label: t.language, detail: `${t.portuguese} / ${t.english}`, icon: "settings", onSelect: () => setPinned((value) => !value) }
  ], [router, t]);
  const contextValue = useMemo(() => ({ locale, setLocale, t }), [locale, t]);

  return <CortexContext.Provider value={contextValue}>
    <a className="skip-link" href="#main-content">{t.skipToContent}</a>
    <div className="app-frame" style={{ "--sidebar-width": `${width}px` } as CSSProperties}>
      <button ref={menuButtonRef} className="mobile-menu-button" type="button" aria-expanded={drawerOpen} aria-controls={sidebarId} onClick={() => { setDrawerMotion(true); setDrawerOpen(true); }}><Icon name="command" /><span>{t.openMenu}</span></button>
      <aside ref={drawerRef} id={sidebarId} className={`sidebar ${expanded ? "is-expanded" : ""} ${pinned ? "is-pinned" : ""} ${drawerMotion ? "has-drawer-motion" : ""} ${drawerOpen ? "is-drawer-open" : ""}`} aria-label="Cortex" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setHovered(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false); }}>
        <div className="sidebar-brand"><span className="brand-mark" aria-hidden="true"><i />C</span><span className="sidebar-label brand-wordmark">Cortex</span><button className="icon-button pin-button" type="button" aria-pressed={pinned} aria-label={pinned ? t.unpinSidebar : t.pinSidebar} onClick={() => setPinned((value) => !value)}>⌖</button><button className="icon-button close-drawer-button" type="button" aria-label={t.closeMenu} onClick={() => { setDrawerOpen(false); menuButtonRef.current?.focus(); }}><Icon name="close" /></button></div>
        <div className="sidebar-project"><span className="sidebar-section-label">{t.currentProject}</span><button className="project-switcher" aria-expanded={projectMenuOpen} aria-haspopup="menu" onClick={() => setProjectMenuOpen((value) => !value)}><span className="project-switcher-icon"><Icon name={context.project === t.telemetry ? "telemetry" : "race"} /></span><span className="sidebar-label"><strong>{context.project ?? "Cortex"}</strong><small>{context.project ? t.workspace : t.systemStatus}</small></span><Icon name="chevron" size={14} /></button>{projectMenuOpen ? <div className="project-menu" role="menu" aria-label={t.projectSwitcher}><button role="menuitem" type="button" onClick={() => selectProject("/f1")}><Icon name="race" /><span><strong>{t.raceExplorer}</strong><small>{t.projectRaceDescription}</small></span></button><button role="menuitem" type="button" onClick={() => selectProject("/telemetry")}><Icon name="telemetry" /><span><strong>{t.telemetry}</strong><small>{t.projectTelemetryDescription}</small></span></button></div> : null}</div>
        <nav aria-label={t.navigation}><span className="sidebar-section-label">{t.navigation}</span><AnimatedNavigationList activeId={activeNavItem?.href ?? null} className="nav-list" items={navItems.map((item) => item.href)} renderItem={(href) => { const item = navItems.find((candidate) => candidate.href === href); if (!item) return null; const active = activeNavItem?.href === href; return <Link className={`nav-link ${active ? "is-active" : ""}`} href={href} aria-current={active ? "page" : undefined} onClick={() => setDrawerOpen(false)}><span className="nav-icon"><Icon name={item.icon} /></span><span className="sidebar-label">{t[item.label]}</span></Link>; }} /></nav>
        <div className="sidebar-footer"><button className="palette-trigger sidebar-label" type="button" onClick={() => setPaletteOpen(true)}><Icon name="search" /><span>{t.openCommandPalette}</span><kbd>Ctrl K</kbd></button><label className="locale-control"><span className="sidebar-label">{t.language}</span><select value={locale} onChange={(event) => setLocale(event.target.value as Locale)}><option value="pt-BR">{t.portuguese}</option><option value="en">{t.english}</option></select></label></div>
      </aside>
      <div className="sidebar-resizer" role="separator" tabIndex={0} aria-label={t.resizeSidebar} aria-orientation="vertical" aria-valuemin={216} aria-valuemax={320} aria-valuenow={width} aria-valuetext={`${t.sidebarWidth}: ${width}px`} onKeyDown={resizeWithKeyboard} onPointerDown={resizeWithPointer} />
      {drawerOpen ? <div className="drawer-backdrop" aria-hidden="true" onClick={() => setDrawerOpen(false)} /> : null}
      <main id="main-content" className="main-content"><header className="top-bar"><div className="top-bar-context"><span>{context.crumb}</span><strong>{context.title}</strong></div><div className="top-bar-actions"><button type="button" className="top-search" onClick={() => setPaletteOpen(true)} aria-label={t.openCommandPalette}><Icon name="search" /><span>{t.openCommandPalette}</span><kbd>Ctrl K</kbd></button><StatusBadge tone="ready">{t.systemStatus}</StatusBadge></div></header><div className="content-wrap">{children}</div></main>
    </div>
    <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} placeholder={t.commandPlaceholder} emptyLabel={t.commandEmpty} title={t.commandPalette} />
    <p className="sr-only" aria-live="polite">{announcement}</p>
  </CortexContext.Provider>;
}
