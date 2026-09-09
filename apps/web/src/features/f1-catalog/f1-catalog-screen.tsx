"use client";

import Link from "next/link";

import { PageHeader } from "../../shared/ui";
import { useCortex } from "../navigation/app-shell";

const events = [
  "Australia", "China", "Japan", "Bahrain", "Saudi Arabia", "Miami", "Emilia-Romagna", "Monaco",
  "Spain", "Canada", "Austria", "Great Britain", "Belgium", "Hungary", "Netherlands", "Italy",
  "Azerbaijan", "Singapore", "United States", "Mexico", "Brazil", "Las Vegas", "Qatar", "Abu Dhabi"
];

export function F1CatalogScreen() {
  const { t } = useCortex();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t.catalogEyebrow} title={t.catalogTitle} description={t.catalogBody} />
      <section className="calendar-panel" aria-labelledby="calendar-title">
        <div className="panel-heading">
          <h2 id="calendar-title">{t.raceCalendar}</h2>
          <span className="season-chip">2025</span>
        </div>
        <ol className="event-grid">
          {events.map((event, index) => {
            const enabled = event === "Belgium";
            const descriptionId = `event-${index}-description`;
            return (
              <li className={`event-card ${enabled ? "is-enabled" : ""}`} key={event}>
                <span className="event-round">{String(index + 1).padStart(2, "0")}</span>
                <h3>{enabled ? t.belgium : event}</h3>
                <p>{enabled ? t.spaRace : t.unavailableReason}</p>
                {enabled ? (
                  <Link className="button button-primary button-small" href="/f1/2025/belgium/race">{t.openSpa}</Link>
                ) : (
                  <>
                    <span id={descriptionId} className="status-pill status-planned">{t.comingSoon}</span>
                    <button className="button button-disabled button-small" type="button" disabled aria-describedby={descriptionId}>
                      {t.viewSession}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
