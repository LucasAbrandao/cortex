"use client";

import Link from "next/link";

import { PageHeader, StatusBadge } from "../../shared/ui";
import { useCortex } from "../navigation/app-shell";
import { StatePanel } from "../../shared/state-panel";

export function TelemetryScreen() {
  const { t } = useCortex();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t.telemetryEyebrow} title={t.telemetryTitle} description={t.telemetryBody} />
      <section className="privacy-panel" aria-label={t.telemetryTitle}>
        <span className="privacy-mark" aria-hidden="true">↯</span>
        <div>
          <h2>{t.noUpload}</h2>
          <p>{t.formats}</p>
        </div>
        <Link className="button button-primary" href="/telemetry/import">{t.startImport}</Link>
      </section>
    </div>
  );
}

export function TelemetryImportScreen() {
  const { t } = useCortex();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t.importEyebrow} title={t.importTitle} description={t.importBody} />
      <section className="import-prototype" aria-label={t.importTitle}>
        <StatusBadge tone="warning">{t.importNotice}</StatusBadge>
        <div className="dropzone" aria-disabled="true">
          <span aria-hidden="true">⇧</span>
          <p>{t.noUpload}</p>
          <button className="button button-disabled" type="button" disabled>{t.chooseFile}</button>
        </div>
        <StatePanel state="warning"><p>{t.importDisabled}</p></StatePanel>
      </section>
    </div>
  );
}

export function TelemetrySessionScreen() {
  const { t } = useCortex();
  return (
    <div className="page-stack">
      <PageHeader eyebrow={t.sessionDemoEyebrow} title={t.sessionDemoTitle} description={t.sessionDemoBody} />
      <section className="workspace-placeholder">
        <StatusBadge tone="warning">{t.fixtureOnly}</StatusBadge>
        <StatePanel state="empty"><p>{t.sessionDemoBody}</p></StatePanel>
      </section>
    </div>
  );
}
