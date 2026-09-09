import { useEffect, type RefObject } from "react";

export const chartSurfaceOpacity = (top: number, height: number) => .82 + .18 * Math.max(0, Math.min(1, (height - top) / (height * .55)));

/** One measured scroll pass; never updates replay state or requests data. */
export function useRaceScroll(root: RefObject<HTMLDivElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(() => {
      const element = root.current; if (!element) return;
      const analysis = element.querySelector(".companion-analysis")?.getBoundingClientRect();
      const toolbar = element.querySelector(".race-transport");
      const compact = element.dataset.transport === "compact";
      const editing = toolbar?.contains(document.activeElement) && !!document.activeElement?.matches("input, select, [open] *");
      if (analysis && !editing) element.dataset.transport = analysis.top < window.innerHeight * (compact ? .78 : .68) ? "compact" : "expanded";
      element.querySelectorAll<HTMLElement>(".monitor-chart").forEach((chart) => {
        chart.style.setProperty("--chart-alpha", String(chartSurfaceOpacity(chart.getBoundingClientRect().top, window.innerHeight)));
      });
    }); };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    if (root.current) observer?.observe(root.current);
    const mutations = new MutationObserver(update);
    if (root.current) mutations.observe(root.current, { childList: true, subtree: true });
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update); window.addEventListener("focusout", update);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); mutations.disconnect(); window.removeEventListener("scroll", update); window.removeEventListener("resize", update); window.removeEventListener("focusout", update); };
  }, [root, enabled]);
}
