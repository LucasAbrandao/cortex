"use client";

import Link from "next/link";

import { Icon, StatusBadge } from "../../shared/ui";
import { useCortex } from "../navigation/app-shell";

export function HomeScreen() {
  const { t } = useCortex();
  return (
    <div className="page-stack home-screen">
      <section className="hero" aria-labelledby="home-title">
        <div className="hero-grid-mark" aria-hidden="true" />
        <p className="eyebrow">{t.productEyebrow}</p>
        <h1 id="home-title">{t.homeTitle}</h1>
        <p className="hero-copy">{t.homeBody}</p>
        <div className="action-row">
          <Link className="button button-primary" href="/f1">{t.exploreRace}</Link>
          <Link className="button button-secondary" href="/telemetry">{t.exploreTelemetry}</Link>
        </div>
      </section>
      <section className="mission-grid" aria-label={t.productEyebrow}>
        <article className="module-card module-card-race mission-primary">
          <StatusBadge tone="ready">{t.availableNow}</StatusBadge>
          <span className="module-icon"><Icon name="race" /></span>
          <h2>{t.raceCardTitle}</h2>
          <p>{t.raceCardBody}</p>
          <Link className="text-link" href="/f1">{t.exploreRace} <span aria-hidden="true">→</span></Link>
        </article>
        <article className="module-card module-card-telemetry mission-secondary">
          <StatusBadge tone="planned">{t.planned}</StatusBadge>
          <span className="module-icon"><Icon name="telemetry" /></span>
          <h2>{t.telemetryCardTitle}</h2>
          <p>{t.telemetryCardBody}</p>
          <Link className="text-link" href="/telemetry">{t.exploreTelemetry} <span aria-hidden="true">→</span></Link>
        </article>
        <aside className="mission-status" aria-label={t.systemStatus}>
          <div><p className="label">{t.systemStatus}</p><StatusBadge tone="ready">{t.availableNow}</StatusBadge></div>
          <p>{t.raceCardBody}</p>
          <button type="button" className="button button-secondary button-small" onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}>{t.openCommandPalette}</button>
        </aside>
      </section>
      <p className="keyboard-hint">{t.keyboardHint}</p>
    </div>
  );
}
