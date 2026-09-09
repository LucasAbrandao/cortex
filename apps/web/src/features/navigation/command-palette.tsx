"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Icon, type IconName } from "../../shared/ui";

export type PaletteItem = { id: string; group: string; label: string; detail: string; icon: IconName; onSelect: () => void };

export function CommandPalette({ open, onClose, items, placeholder, emptyLabel, title }: { open: boolean; onClose: () => void; items: PaletteItem[]; placeholder: string; emptyLabel: string; title: string }) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => items.filter((item) => `${item.label} ${item.detail} ${item.group}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [items, query]);
  const grouped = useMemo(() => Array.from(new Set(filtered.map((item) => item.group))).map((group) => [group, filtered.filter((item) => item.group === group)] as const), [filtered]);

  useEffect(() => {
    if (!open) return;
    setQuery(""); setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  if (!open) return null;
  const choose = (item: PaletteItem) => { item.onSelect(); onClose(); };
  return <div className="command-palette-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="command-palette" role="dialog" aria-modal="true" aria-label={title}>
      <div className="command-search"><Icon name="search" /><input ref={inputRef} aria-label={title} placeholder={placeholder} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); onClose(); }
        if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => Math.min(filtered.length - 1, index + 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
        if (event.key === "Enter" && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
      }} /><kbd>Esc</kbd></div>
      <div className="command-results">{grouped.length ? grouped.map(([group, groupItems]) => <section key={group} className="command-group" aria-label={group}><h2>{group}</h2>{groupItems.map((item) => {
        const index = filtered.indexOf(item); return <button key={item.id} type="button" className={`command-item ${index === activeIndex ? "is-active" : ""}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(item)}><span className="command-item-icon"><Icon name={item.icon} /></span><span><strong>{item.label}</strong><small>{item.detail}</small></span><Icon name="chevron" size={15} /></button>;
      })}</section>) : <p className="command-empty">{emptyLabel}</p>}</div>
      <footer><span><kbd>↑↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer>
    </section>
  </div>;
}
