import type { ReactNode } from "react";

import { useCortex } from "../features/navigation/app-shell";

export type VisualState = "loading" | "error" | "empty" | "warning" | "unavailable";

export function StatePanel({ state, children, body }: { state: VisualState; children?: ReactNode; body?: string }) {
  const { t } = useCortex();
  const content = {
    loading: { title: t.loadingTitle, body: t.stateDescription },
    error: { title: t.errorTitle, body: t.stateDescription },
    empty: { title: t.emptyTitle, body: t.stateDescription },
    warning: { title: t.warningTitle, body: t.stateDescription },
    unavailable: { title: t.unavailableTitle, body: t.stateDescription }
  }[state];

  return (
    <section className={`state-panel state-${state}`} aria-live={state === "loading" ? "polite" : undefined} role={state === "error" ? "alert" : "status"}>
      <span className="state-icon" aria-hidden="true">{state === "loading" ? "◌" : "!"}</span>
      <div>
        <h2>{content.title}</h2>
        <p>{body ?? content.body}</p>
        {children}
      </div>
    </section>
  );
}
