import type { ReactNode } from "react";

export type IconName = "command" | "search" | "home" | "race" | "telemetry" | "import" | "settings" | "chevron" | "close" | "panel";

const paths: Record<IconName, ReactNode> = {
  command: <><path d="M7 3H5a2 2 0 0 0-2 2v2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M17 21h2a2 2 0 0 0 2-2v-2"/><path d="M7 12h10"/></>,
  search: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></>,
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z"/><path d="M9 21v-6h6v6"/></>,
  race: <><path d="M4 19V5"/><path d="M4 5c5-3 8 3 16 0v10c-8 3-11-3-16 0"/></>,
  telemetry: <><path d="M3 12h3l2.2-6 4 12 2.2-6H21"/></>,
  import: <><path d="M12 3v12"/><path d="m8 11 4 4 4-4"/><path d="M4 21h16"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.12 2.12-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56v.08h-3v-.08A1.7 1.7 0 0 0 10.66 18.7a1.7 1.7 0 0 0-1.88.34l-.06.06L6.6 16.98l.06-.06A1.7 1.7 0 0 0 7 15.04a1.7 1.7 0 0 0-1.56-1.04h-.08v-3h.08A1.7 1.7 0 0 0 7 9.96a1.7 1.7 0 0 0-.34-1.88L6.6 8.02 8.72 5.9l.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.04-1.56V4.7h3v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.12 2.12-.06.06A1.7 1.7 0 0 0 19.4 10c.18.42.6.9 1.24 1v3c-.64.1-1.06.58-1.24 1Z"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  close: <><path d="m6 6 12 12"/><path d="m18 6-12 12"/></>,
  panel: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M15 4v16"/></>
};

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" className="ui-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export function PageHeader({ eyebrow, title, description, actions, meta }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; meta?: ReactNode }) {
  return <header className="page-header">
    <div className="page-header-copy">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p>{description}</p> : null}
      {meta ? <div className="page-header-meta">{meta}</div> : null}
    </div>
    {actions ? <div className="page-header-actions">{actions}</div> : null}
  </header>;
}

export function StatusBadge({ tone = "neutral", children }: { tone?: "ready" | "planned" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  return <span className={`status-badge status-${tone}`}><span aria-hidden="true" className="status-dot" />{children}</span>;
}
