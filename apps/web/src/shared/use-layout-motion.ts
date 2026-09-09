import { useLayoutEffect, useRef, type RefObject } from "react";

/** Animate presentation changes only; never smooth source samples or the replay clock. */
export function useLayoutMotion(container: RefObject<HTMLElement | null>, signature: string) {
  const previous = useRef(new Map<string, { rect: DOMRect; clone: HTMLElement }>());
  const cleanup = useRef<(() => void)[]>([]);
  useLayoutEffect(() => {
    cleanup.current.forEach((cancel) => cancel()); cleanup.current = [];
    const next = new Map<string, { rect: DOMRect; clone: HTMLElement }>();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    for (const element of container.current?.querySelectorAll<HTMLElement>("[data-motion-id]") ?? []) {
      const key = element.dataset.motionId!; const rect = element.getBoundingClientRect();
      const before = previous.current.get(key);
      if (!reduced && before && element.animate) {
        const x = before.rect.left - rect.left; const y = before.rect.top - rect.top;
        if (x || y) {
          const animation = element.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: "translate(0, 0)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });
          cleanup.current.push(() => animation.cancel());
        }
      }
      next.set(key, { rect, clone: element.cloneNode(true) as HTMLElement });
    }
    if (!reduced) for (const [key, before] of previous.current) {
      if (next.has(key) || !before.clone.animate || !before.rect.width) continue;
      const ghost = before.clone;
      ghost.setAttribute("aria-hidden", "true"); ghost.setAttribute("inert", "");
      ghost.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
      Object.assign(ghost.style, { position: "fixed", left: `${before.rect.left}px`, top: `${before.rect.top}px`, width: `${before.rect.width}px`, height: `${before.rect.height}px`, pointerEvents: "none", zIndex: "10", margin: "0" });
      document.body.append(ghost);
      const animation = ghost.animate([{ opacity: .7 }, { opacity: 0, transform: "translateY(-4px)" }], { duration: 150 });
      animation.onfinish = () => ghost.remove();
      cleanup.current.push(() => { animation.cancel(); ghost.remove(); });
    }
    previous.current = next;
  }, [container, signature]);
  useLayoutEffect(() => () => { cleanup.current.forEach((cancel) => cancel()); }, []);
}
