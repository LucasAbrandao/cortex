"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { PageHeader, StatusBadge } from "../../shared/ui";
import { useCortex } from "../navigation/app-shell";
import { StatePanel } from "../../shared/state-panel";
import { TelemetryWorkspace, telemetryColor, type TelemetryAxis } from "../../shared/telemetry-workspace";
import { IMPORT_LIMITS, type ImportMapping, type ImportedTelemetrySession, type ParsedTelemetryFile } from "./telemetry-import";
import { useTelemetryImport } from "./telemetry-provider";
import { supportsDistance } from "../../shared/telemetry-display";

const number = (value: number, pt: boolean) => new Intl.NumberFormat(pt ? "pt-BR" : "en").format(value);
const fileSize = (bytes: number, pt: boolean) => `${number(Math.ceil(bytes / 1024), pt)} KB`;

function PrivacyNotice({ pt }: { pt: boolean }) {
  return <p className="telemetry-privacy" role="note">{pt ? "Processamento local. Seu arquivo não é enviado, salvo ou registrado. Os dados são descartados ao sair do Telemetry Lab ou recarregar a página." : "Local processing. Your file is not uploaded, saved, or logged. Data is discarded when you leave Telemetry Lab or reload the page."}</p>;
}

export function TelemetryScreen() {
  const { locale } = useCortex();
  const { session } = useTelemetryImport();
  const pt = locale === "pt-BR";
  return <div className="page-stack telemetry-page">
    <PageHeader eyebrow={pt ? "Local e privado" : "Local and private"} title="Telemetry Lab" description={pt ? "Transforme seu CSV ou JSON em uma sessão de análise. Confirme as colunas e unidades para investigar os dados reais do arquivo." : "Turn your CSV or JSON into an analysis session. Confirm columns and units to inspect the real data in your file."} />
    <section className="telemetry-panel telemetry-intro" aria-label={pt ? "Análise de arquivos" : "File analysis"}>
      <StatusBadge tone="ready">{pt ? "CSV e JSON disponíveis" : "CSV and JSON available"}</StatusBadge>
      <h2>{pt ? "Do arquivo ao gráfico, no seu navegador." : "From file to chart, in your browser."}</h2>
      <p>{pt ? "Visualize uma amostra, mapeie tempo e canais numéricos e compare até quatro séries. Lacunas e valores ausentes continuam visíveis." : "Preview a sample, map time and numeric channels, and compare up to four series. Gaps and missing values remain visible."}</p>
      <div className="action-row"><Link className="button button-primary" href="/telemetry/import">{pt ? "Importar arquivo" : "Import file"}</Link>{session && <Link className="button button-secondary" href="/telemetry/session">{pt ? "Voltar à sessão" : "Return to session"}</Link>}</div>
      <p className="telemetry-muted">{pt ? "CSV UTF-8 com vírgula, ponto e vírgula ou tabulação; JSON como lista de registros. RCZ não é suportado." : "UTF-8 CSV with comma, semicolon, or tab separators; JSON as an array of records. RCZ is not supported."}</p>
      <PrivacyNotice pt={pt} />
    </section>
  </div>;
}

const errorMessages: Record<string, [string, string]> = {
  unsupported_format: ["Escolha um arquivo .csv ou .json.", "Choose a .csv or .json file."],
  file_too_large: ["O arquivo excede o limite de tamanho. Exporte um trecho menor.", "The file exceeds the size limit. Export a smaller section."],
  empty_file: ["O arquivo está vazio. Escolha um arquivo com cabeçalho e amostras.", "The file is empty. Choose a file with headers and samples."],
  invalid_json: ["JSON inválido. Confira a sintaxe e use uma lista de registros.", "Invalid JSON. Check the syntax and use an array of records."],
  invalid_json_shape: ["Use uma lista JSON de objetos planos, com as colunas em cada registro.", "Use a JSON array of flat objects, with columns in each record."],
  invalid_csv: ["CSV inválido. Confira aspas, delimitadores e o número de colunas.", "Invalid CSV. Check quotes, separators, and column counts."],
  ambiguous_delimiter: ["Não foi possível identificar o delimitador. Use vírgula, ponto e vírgula ou tabulação de forma consistente.", "The separator could not be identified. Use comma, semicolon, or tab consistently."],
  too_many_rows: ["O arquivo excede o limite de linhas. Exporte um trecho menor.", "The file exceeds the row limit. Export a smaller section."],
  too_many_columns: ["O arquivo excede o limite de colunas. Exporte menos canais.", "The file exceeds the column limit. Export fewer channels."],
  too_many_cells: ["O arquivo excede o limite de células. Reduza linhas ou colunas.", "The file exceeds the cell limit. Reduce rows or columns."],
  invalid_headers: ["Informe nomes únicos e não vazios no cabeçalho.", "Provide unique, nonempty column headers."],
  invalid_mapping: ["Revise o mapeamento: selecione tempo e pelo menos um canal numérico, sem repetir papéis.", "Review the mapping: select time and at least one numeric channel without duplicate roles."],
  no_valid_time: ["Não há tempo numérico válido na coluna selecionada. Confira a coluna e a unidade.", "There is no valid numeric time in the selected column. Check the column and unit."],
  no_numeric_channel: ["Selecione pelo menos um canal que contenha números válidos com tempo válido.", "Select at least one channel containing valid numbers with valid time."],
  non_monotonic_time: ["O tempo precisa ser estritamente crescente em cada série. Confira a coluna de volta e a base do tempo; não reordenamos suas amostras.", "Time must increase strictly within each series. Check the lap column and time base; your samples are not reordered."],
  invalid_entity: ["A coluna de entidade contém uma célula vazia. Corrija o arquivo ou remova esse mapeamento.", "The entity column contains an empty cell. Correct the file or remove that mapping."],
  invalid_encoding: ["A codificação do arquivo não é UTF-8. Exporte novamente em UTF-8.", "The file encoding is not UTF-8. Export it again as UTF-8."],
  worker_error: ["Não foi possível processar o arquivo. Tente novamente com um trecho menor.", "The file could not be processed. Try again with a smaller section."],
  read_failed: ["Não foi possível ler este arquivo. Selecione-o novamente.", "This file could not be read. Select it again."],
};

export function TelemetryImportScreen() {
  const { locale } = useCortex();
  const pt = locale === "pt-BR";
  const { parsed, session, status, failure, inspect, normalize, cancel, clear } = useTelemetryImport();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const requestedSession = useRef(false);
  const [dragging, setDragging] = useState(false);
  const [selectionError, setSelectionError] = useState(false);
  const busy = status === "reading" || status === "normalizing";
  useEffect(() => {
    if (status === "ready" && session && requestedSession.current) { requestedSession.current = false; router.push("/telemetry/session"); }
  }, [router, session, status]);
  const choose = (files: FileList | File[]) => {
    if (files.length !== 1) { setSelectionError(true); return; }
    requestedSession.current = false;
    setSelectionError(false);
    inspect(files[0]!);
  };
  const errorText = failure ? errorMessages[failure.code.toLowerCase()]?.[pt ? 0 : 1] ?? (pt ? "Não foi possível continuar. Confira o formato e o mapeamento ou selecione outro arquivo." : "Unable to continue. Check the format and mapping or select another file.") : null;
  return <div className="page-stack telemetry-page">
    <PageHeader eyebrow={pt ? "Arquivo real · processamento local" : "Real file · local processing"} title={pt ? "Importar telemetria" : "Import telemetry"} description={pt ? "Selecione um CSV ou JSON, confira a amostra e confirme o significado de cada coluna." : "Select a CSV or JSON, review the sample, and confirm what each column means."} />
    <PrivacyNotice pt={pt} />
    {session && <Link className="button button-secondary telemetry-clear" href="/telemetry/session">{pt ? "Voltar à sessão aberta" : "Return to open session"}</Link>}
    <section className={`telemetry-panel telemetry-dropzone ${dragging ? "is-dragging" : ""}`} aria-label={pt ? "Selecionar arquivo de telemetria" : "Select telemetry file"} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files); }}>
      <span className="telemetry-drop-mark" aria-hidden="true">↥</span>
      <h2>{pt ? "Arraste um arquivo CSV ou JSON" : "Drop a CSV or JSON file"}</h2>
      <p>{pt ? "Ou escolha um arquivo no seu dispositivo." : "Or choose a file from your device."}</p>
      <input ref={input} className="sr-only" type="file" tabIndex={-1} accept=".csv,.json" aria-label={pt ? "Arquivo de telemetria" : "Telemetry file"} onChange={(event) => { if (event.currentTarget.files?.length) choose(event.currentTarget.files); event.currentTarget.value = ""; }} />
      <button className="button button-primary" type="button" onClick={() => input.current?.click()}>{parsed || busy ? pt ? "Trocar arquivo" : "Replace file" : pt ? "Selecionar arquivo" : "Choose file"}</button>
      <p className="telemetry-muted">{pt ? "Limites" : "Limits"}: {fileSize(IMPORT_LIMITS.maxBytes, pt)} · {number(IMPORT_LIMITS.maxRows, pt)} {pt ? "linhas" : "rows"} · {IMPORT_LIMITS.maxColumns} {pt ? "colunas" : "columns"} · {number(IMPORT_LIMITS.maxCells, pt)} {pt ? "células" : "cells"}.</p>
    </section>
    <div aria-live="polite" aria-atomic="true">
      {busy && <StatePanel state="loading" body={status === "reading" ? pt ? "Lendo e verificando o arquivo no navegador…" : "Reading and checking the file in your browser…" : pt ? "Preparando séries com o mapeamento confirmado…" : "Preparing series using your confirmed mapping…"}><button className="button button-secondary" type="button" onClick={cancel}>{pt ? "Cancelar" : "Cancel"}</button></StatePanel>}
      {status === "cancelled" && <StatePanel state="warning" body={pt ? "Processamento cancelado. Você pode revisar o mapeamento ou escolher outro arquivo." : "Processing cancelled. Review the mapping or choose another file."} />}
      {(failure || selectionError) && <StatePanel state="error" body={selectionError ? pt ? "Selecione um único arquivo por vez." : "Select one file at a time." : `${errorText}${failure?.row ? ` ${pt ? "Registro" : "Record"} ${failure.row}.` : ""}`} />}
    </div>
    {parsed && <>
      <FilePreview parsed={parsed} pt={pt} />
      <MappingForm key={`${parsed.name}:${parsed.size}:${parsed.rows.length}`} parsed={parsed} pt={pt} busy={busy} onConfirm={(mapping) => { requestedSession.current = true; normalize(mapping); }} />
      <button className="button button-quiet telemetry-clear" type="button" onClick={() => { requestedSession.current = false; clear(); }}>{pt ? "Descartar arquivo e recomeçar" : "Discard file and start again"}</button>
    </>}
  </div>;
}

function valueType(value: unknown, pt: boolean) {
  if (value === null || value === "") return pt ? "ausente" : "missing";
  if (typeof value === "boolean") return pt ? "booleano" : "boolean";
  if (typeof value === "number" || (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))) return pt ? "numérico" : "numeric";
  return pt ? "texto" : "text";
}

function previewText(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value);
  return text.length > 200 ? `${text.slice(0, 199)}…` : text;
}

function FilePreview({ parsed, pt }: { parsed: ParsedTelemetryFile; pt: boolean }) {
  return <section className="telemetry-panel" aria-labelledby="telemetry-preview-title">
    <div className="telemetry-section-heading"><h2 id="telemetry-preview-title">{pt ? "Inspeção do arquivo" : "File inspection"}</h2><StatusBadge tone="ready">{pt ? "Leitura local concluída" : "Local reading complete"}</StatusBadge></div>
    <dl className="telemetry-file-meta"><div><dt>{pt ? "Arquivo" : "File"}</dt><dd>{parsed.name}</dd></div><div><dt>{pt ? "Tamanho" : "Size"}</dt><dd>{fileSize(parsed.size, pt)}</dd></div><div><dt>{pt ? "Amostras" : "Samples"}</dt><dd>{number(parsed.rows.length, pt)}</dd></div><div><dt>{pt ? "Colunas" : "Columns"}</dt><dd>{parsed.columns.length}</dd></div></dl>
    <p className="telemetry-muted">{pt ? `Preview dos primeiros ${Math.min(parsed.rows.length, IMPORT_LIMITS.previewRows)} registros, com até 200 caracteres por célula apenas na visualização. O dado original permanece intacto. O tipo é inferido desta amostra; o mapeamento é validado no conjunto completo.` : `Preview of the first ${Math.min(parsed.rows.length, IMPORT_LIMITS.previewRows)} records, with up to 200 characters per displayed cell. Original data remains intact. Types are inferred from this sample; mapping is validated against the complete dataset.`}</p>
    <div className="telemetry-preview" tabIndex={0} role="region" aria-label={pt ? "Prévia das amostras, com rolagem horizontal" : "Sample preview, horizontally scrollable"}><table><caption className="sr-only">{pt ? "Amostra original do arquivo" : "Original file sample"}</caption><thead><tr>{parsed.columns.map((column, index) => <th key={column} scope="col">{previewText(column)}<small>{[...new Set(parsed.rows.slice(0, IMPORT_LIMITS.previewRows).map((row) => valueType(row[index], pt)))].join(" / ")}</small></th>)}</tr></thead><tbody>{parsed.rows.slice(0, IMPORT_LIMITS.previewRows).map((row, rowIndex) => <tr key={rowIndex}>{parsed.columns.map((column, index) => <td key={column}>{previewText(row[index])}</td>)}</tr>)}</tbody></table></div>
  </section>;
}

const normalizedName = (column: string) => column.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
function initialMapping(parsed: ParsedTelemetryFile): ImportMapping {
  const suggest = (names: string[]) => parsed.columns.find((column) => names.includes(normalizedName(column))) ?? null;
  const time = suggest(["time", "tempo", "timestamp", "elapsed", "seconds", "timems", "times", "t"]) ?? "";
  const entity = suggest(["driver", "piloto", "entity", "entidade", "car", "carro"]);
  const lap = suggest(["lap", "volta", "lapnumber"]);
  const distance = suggest(["distance", "distancia", "distancem", "distancekm"]);
  const excluded = [time, entity, lap, distance];
  const channels = parsed.columns.filter((column, index) => !excluded.includes(column) && parsed.rows.slice(0, IMPORT_LIMITS.previewRows).some((row) => typeof row[index] === "number" || (typeof row[index] === "string" && String(row[index]).trim() !== "" && Number.isFinite(Number(row[index]))))).map((column) => ({ column, unit: null }));
  return { time, timeUnit: "s", timeBase: "file", decimal: ".", entity, lap, distance, distanceUnit: "m", channels };
}

function MappingForm({ parsed, pt, busy, onConfirm }: { parsed: ParsedTelemetryFile; pt: boolean; busy: boolean; onConfirm: (mapping: ImportMapping) => void }) {
  const [mapping, setMapping] = useState<ImportMapping>(() => initialMapping(parsed));
  const [timeUnitChosen, setTimeUnitChosen] = useState(false);
  const [timeBaseChosen, setTimeBaseChosen] = useState(false);
  const [distanceUnitChosen, setDistanceUnitChosen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [validation, setValidation] = useState(false);
  const update = <K extends keyof ImportMapping>(key: K, value: ImportMapping[K]) => {
    setMapping((current) => ({ ...current, [key]: value, ...(["time", "entity", "lap", "distance"].includes(key) ? { channels: current.channels.filter((channel) => channel.column !== value) } : {}) }));
    if (key === "distance") setDistanceUnitChosen(false);
    setConfirmed(false); setValidation(false);
  };
  const options = <>{parsed.columns.map((column) => <option key={column} value={column}>{column}</option>)}</>;
  const ready = !!mapping.time && !!mapping.channels.length && timeUnitChosen && timeBaseChosen && (!mapping.distance || distanceUnitChosen) && confirmed;
  const submit = (event: FormEvent) => { event.preventDefault(); if (!ready) { setValidation(true); return; } onConfirm(mapping); };
  return <form className="telemetry-panel telemetry-mapping" aria-labelledby="telemetry-mapping-title" aria-busy={busy} onSubmit={submit}>
    <div className="telemetry-section-heading"><h2 id="telemetry-mapping-title">{pt ? "Mapear colunas" : "Map columns"}</h2><StatusBadge tone="warning">{pt ? "Confirmação necessária" : "Confirmation required"}</StatusBadge></div>
    <p className="telemetry-muted">{pt ? "Os nomes reconhecidos são sugestões. Escolha unidade e base do tempo, revise o mapeamento e confirme antes de analisar. Tempo e pelo menos um canal numérico são obrigatórios." : "Recognized names are suggestions. Choose the time unit and base, review the mapping, and confirm before analysis. Time and at least one numeric channel are required."}</p>
    <fieldset disabled={busy}><legend>{pt ? "Tempo e agrupamento" : "Time and grouping"}</legend><div className="telemetry-mapping-grid">
      <label>{pt ? "Coluna de tempo *" : "Time column *"}<select value={mapping.time} onChange={(event) => update("time", event.target.value)} required><option value="">{pt ? "Selecionar coluna" : "Select column"}</option>{options}</select></label>
      <label>{pt ? "Unidade de tempo" : "Time unit"}<select value={timeUnitChosen ? mapping.timeUnit : ""} onChange={(event) => { setTimeUnitChosen(!!event.target.value); if (event.target.value) update("timeUnit", event.target.value as "s" | "ms"); }} required><option value="">{pt ? "Confirmar unidade" : "Confirm unit"}</option><option value="s">{pt ? "Segundos (s)" : "Seconds (s)"}</option><option value="ms">{pt ? "Milissegundos (ms)" : "Milliseconds (ms)"}</option></select></label>
      <label>{pt ? "Base do tempo" : "Time base"}<select value={timeBaseChosen ? mapping.timeBase : ""} onChange={(event) => { setTimeBaseChosen(!!event.target.value); if (event.target.value) update("timeBase", event.target.value as "file" | "series"); }} required><option value="">{pt ? "Confirmar base" : "Confirm base"}</option><option value="file">{pt ? "Tempo contínuo do arquivo" : "Continuous file time"}</option><option value="series">{pt ? "Tempo reiniciado por série / volta" : "Time restarts per series / lap"}</option></select></label>
      <label>{pt ? "Separador decimal" : "Decimal separator"}<select value={mapping.decimal} onChange={(event) => update("decimal", event.target.value as "." | ",")}><option value=".">{pt ? "Ponto (1.25)" : "Period (1.25)"}</option><option value=",">{pt ? "Vírgula (1,25)" : "Comma (1,25)"}</option></select></label>
      <label>{pt ? "Entidade / piloto (opcional)" : "Entity / driver (optional)"}<select value={mapping.entity ?? ""} onChange={(event) => update("entity", event.target.value || null)}><option value="">{pt ? "Uma entidade: FILE" : "One entity: FILE"}</option>{options}</select></label>
      <label>{pt ? "Volta (opcional)" : "Lap (optional)"}<select value={mapping.lap ?? ""} onChange={(event) => update("lap", event.target.value || null)}><option value="">{pt ? "Sem identificação de volta" : "No lap identification"}</option>{options}</select></label>
      <label>{pt ? "Distância (opcional)" : "Distance (optional)"}<select value={mapping.distance ?? ""} onChange={(event) => update("distance", event.target.value || null)}><option value="">{pt ? "Não mapeada" : "Not mapped"}</option>{options}</select></label>
      <label>{pt ? "Unidade de distância" : "Distance unit"}<select value={distanceUnitChosen ? mapping.distanceUnit : ""} disabled={!mapping.distance} required={!!mapping.distance} onChange={(event) => { setDistanceUnitChosen(!!event.target.value); if (event.target.value) update("distanceUnit", event.target.value as "m" | "km"); }}><option value="">{pt ? "Confirmar unidade" : "Confirm unit"}</option><option value="m">{pt ? "Metros (m)" : "Meters (m)"}</option><option value="km">{pt ? "Quilômetros (km)" : "Kilometers (km)"}</option></select></label>
    </div></fieldset>
    <fieldset disabled={busy}><legend>{pt ? "Canais numéricos *" : "Numeric channels *"}</legend><div className="telemetry-channel-mapping">{parsed.columns.map((column) => {
      const channel = mapping.channels.find((item) => item.column === column);
      const reserved = [mapping.time, mapping.entity, mapping.lap, mapping.distance].includes(column);
      return <div className="telemetry-channel-row" key={column}><label className="telemetry-checkbox"><input type="checkbox" checked={!!channel} disabled={reserved} onChange={(event) => update("channels", event.target.checked ? [...mapping.channels, { column, unit: null }] : mapping.channels.filter((item) => item.column !== column))} /><span>{column}{reserved && <small>{pt ? " · coluna de referência" : " · reference column"}</small>}</span></label><label className="telemetry-channel-unit"><span>{pt ? "Unidade" : "Unit"}</span><input aria-label={`${pt ? "Unidade" : "Unit"} · ${column}`} type="text" maxLength={24} value={channel?.unit ?? ""} disabled={!channel || reserved} placeholder={pt ? "não informada" : "not specified"} onChange={(event) => update("channels", mapping.channels.map((item) => item.column === column ? { ...item, unit: event.target.value || null } : item))} /></label></div>;
    })}</div></fieldset>
    <label className="telemetry-checkbox telemetry-confirm"><input type="checkbox" checked={confirmed} disabled={busy} onChange={(event) => { setConfirmed(event.target.checked); setValidation(false); }} /><span>{pt ? "Revisei e confirmo as colunas, a base de tempo e as unidades selecionadas." : "I reviewed and confirm the selected columns, time base, and units."}</span></label>
    {validation && <p className="telemetry-form-error" role="alert">{pt ? "Selecione tempo e canais numéricos, escolha a unidade e a base do tempo e confirme o mapeamento." : "Select time and numeric channels, choose the time unit and base, and confirm the mapping."}</p>}
    <button className="button button-primary" type="submit" disabled={busy || !ready}>{pt ? "Analisar dados do arquivo" : "Analyze file data"}</button>
  </form>;
}

type Series = ImportedTelemetrySession["series"][number];
const seriesKey = (series: Series) => JSON.stringify([series.driver, series.lap]);
function dataBounds(series: Series[], axis: TelemetryAxis) {
  let start = Infinity; let end = -Infinity;
  for (const item of series) for (const sample of item.samples) {
    const value = axis === "distance" ? sample.distance : axis === "lapTime" ? sample.lapTime : sample.time;
    if (value !== null && Number.isFinite(value)) { start = Math.min(start, value); end = Math.max(end, value); }
  }
  return Number.isFinite(start) && Number.isFinite(end) ? { start, end: end > start ? end : start + 1 } : null;
}

export function TelemetrySessionScreen() {
  const { locale } = useCortex();
  const { session, clear } = useTelemetryImport();
  const pt = locale === "pt-BR";
  const router = useRouter();
  if (!session) return <div className="page-stack telemetry-page"><PageHeader eyebrow="Telemetry Lab" title={pt ? "Nenhuma sessão local aberta" : "No local session open"} /><StatePanel state="empty" body={pt ? "Selecione um arquivo e confirme o mapeamento. Os dados não são recuperados após sair do módulo ou recarregar a página." : "Select a file and confirm its mapping. Data cannot be restored after leaving the module or reloading the page."}><Link className="button button-primary" href="/telemetry/import">{pt ? "Importar arquivo" : "Import file"}</Link></StatePanel></div>;
  return <SessionWorkspace key={session.file.name + session.file.size} session={session} locale={locale} onDiscard={() => { clear(); router.push("/telemetry/import"); }} />;
}

function SessionWorkspace({ session, locale, onDiscard }: { session: ImportedTelemetrySession; locale: string; onDiscard: () => void }) {
  const pt = locale === "pt-BR";
  const [selected, setSelected] = useState(() => session.series.slice(0, 4).map(seriesKey));
  const [visible, setVisible] = useState(() => session.channels.slice(0, 4).map((channel) => channel.id));
  const [axis, setAxis] = useState<TelemetryAxis>(session.timeBase === "series" ? "lapTime" : "globalTime");
  const [position, setPosition] = useState<number | null>(null);
  const [zoom, setZoom] = useState<{ start: number; end: number } | null>(null);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesPage, setSeriesPage] = useState(0);
  const matchingSeries = useMemo(() => session.series.filter((item) => `${item.driver} ${item.lap ?? ""}`.toLocaleLowerCase(locale).includes(seriesSearch.toLocaleLowerCase(locale))), [session, seriesSearch, locale]);
  const page = Math.min(seriesPage, Math.max(0, Math.ceil(matchingSeries.length / 50) - 1));
  const listedSeries = matchingSeries.slice(page * 50, (page + 1) * 50);
  const series = useMemo(() => session.series.filter((item) => selected.includes(seriesKey(item))), [session, selected]);
  const distanceAvailable = useMemo(() => supportsDistance(series), [series]);
  const baseAxis = session.timeBase === "series" ? "lapTime" : "globalTime";
  const activeAxis = axis === "distance" && !distanceAvailable ? baseAxis : axis;
  const bounds = useMemo(() => dataBounds(series, activeAxis), [series, activeAxis]);
  const range = bounds && zoom ? { start: Math.max(bounds.start, zoom.start), end: Math.min(bounds.end, zoom.end) } : bounds;
  const cursor = range ? Math.max(range.start, Math.min(range.end, position ?? range.start)) : null;
  const adjustZoom = (factor: number) => {
    if (!range || !bounds || cursor === null) return;
    const width = Math.min(bounds.end - bounds.start, Math.max(.001, (range.end - range.start) * factor));
    const start = Math.max(bounds.start, Math.min(bounds.end - width, cursor - width / 2));
    setZoom({ start, end: start + width });
  };
  return <div className="page-stack telemetry-page telemetry-session">
    <PageHeader eyebrow={pt ? "Dados reais do arquivo" : "Real file data"} title="Telemetry Lab" description={session.file.name} actions={<button className="button button-secondary" type="button" onClick={onDiscard}>{pt ? "Descartar e importar outro" : "Discard and import another"}</button>} />
    <PrivacyNotice pt={pt} />
    <section className="telemetry-panel telemetry-session-controls" aria-labelledby="telemetry-series-title">
      <div className="telemetry-section-heading"><h2 id="telemetry-series-title">{pt ? "Séries comparadas" : "Compared series"}</h2><StatusBadge tone="ready">{selected.length}/4</StatusBadge></div>
      {session.series.length > 10 && <label className="telemetry-search">{pt ? "Buscar série" : "Search series"}<input type="search" value={seriesSearch} onChange={(event) => { setSeriesSearch(event.target.value); setSeriesPage(0); }} placeholder={pt ? "Entidade ou volta" : "Entity or lap"} /></label>}
      <fieldset className="telemetry-series-list"><legend className="sr-only">{pt ? "Selecionar até quatro séries" : "Select up to four series"}</legend>{listedSeries.map((item) => {
        const key = seriesKey(item); const checked = selected.includes(key);
        return <label className="telemetry-series-option" key={key}><input type="checkbox" checked={checked} disabled={!checked && selected.length >= 4} onChange={() => { setSelected((current) => checked ? current.filter((id) => id !== key) : [...current, key]); setPosition(null); setZoom(null); }} /><i aria-hidden="true" style={{ background: telemetryColor(item.driver) }} /><span><strong>{item.driver}</strong><small>{item.lap === null ? pt ? "sem volta identificada" : "no identified lap" : `${pt ? "Volta" : "Lap"} ${item.lap}`} · {number(item.samples.length, pt)} {pt ? "amostras" : "samples"}</small></span></label>;
      })}</fieldset>
      {!matchingSeries.length && <p className="telemetry-muted">{pt ? "Nenhuma série corresponde à busca." : "No series matches your search."}</p>}
      {matchingSeries.length > 50 && <div className="telemetry-section-heading"><p className="telemetry-muted">{pt ? "Página" : "Page"} {page + 1}/{Math.ceil(matchingSeries.length / 50)} · {number(matchingSeries.length, pt)} {pt ? "séries" : "series"}</p><div className="action-row"><button className="button button-secondary button-small" type="button" disabled={page === 0} onClick={() => setSeriesPage(page - 1)}>{pt ? "Página anterior" : "Previous page"}</button><button className="button button-secondary button-small" type="button" disabled={(page + 1) * 50 >= matchingSeries.length} onClick={() => setSeriesPage(page + 1)}>{pt ? "Próxima página" : "Next page"}</button></div></div>}
      <div className="telemetry-view-controls"><label>{pt ? "Eixo de análise" : "Analysis axis"}<select value={activeAxis} onChange={(event) => { setAxis(event.target.value as TelemetryAxis); setPosition(null); setZoom(null); }}><option value={baseAxis}>{baseAxis === "lapTime" ? pt ? "Tempo relativo da série (s)" : "Relative series time (s)" : pt ? "Tempo do arquivo (s)" : "File time (s)"}</option>{session.timeBase === "file" && <option value="lapTime">{pt ? "Tempo desde o início da série (s)" : "Time since series start (s)"}</option>}<option value="distance" disabled={!distanceAvailable}>{pt ? "Distância (m)" : "Distance (m)"}</option></select></label><div className="action-row"><button className="button button-secondary button-small" type="button" disabled={!bounds} onClick={() => adjustZoom(.5)}>{pt ? "Aproximar" : "Zoom in"}</button><button className="button button-secondary button-small" type="button" disabled={!zoom} onClick={() => adjustZoom(2)}>{pt ? "Afastar" : "Zoom out"}</button><button className="button button-quiet button-small" type="button" onClick={() => { setZoom(null); setPosition(null); }}>{pt ? "Restaurar visualização" : "Reset view"}</button></div></div>
      {session.timeBase === "file" && activeAxis === "lapTime" && <p className="telemetry-muted">{pt ? "Eixo derivado: tempo do arquivo menos o primeiro tempo válido de cada série. As amostras originais são preservadas." : "Derived axis: file time minus the first valid time in each series. Original samples are preserved."}</p>}
      {!distanceAvailable && <p className="telemetry-muted">{pt ? "Distância requer pelo menos duas amostras por série selecionada e distância/tempo válidos, estritamente crescentes em todas elas." : "Distance requires at least two samples per selected series and valid, strictly increasing distance/time in every series."}</p>}
      <p className="telemetry-muted">{pt ? "Amostras sem tempo" : "Samples missing time"}: {session.diagnostics.missingTime}. {pt ? "Valores inválidos" : "Invalid values"}: {session.diagnostics.invalidValues}. {pt ? "Nenhuma lacuna é preenchida." : "No gaps are filled."}</p>
      {range && cursor !== null && <label className="telemetry-cursor">{pt ? "Cursor compartilhado" : "Shared cursor"}<output>{new Intl.NumberFormat(locale, { maximumFractionDigits: 3 }).format(cursor)} {activeAxis === "distance" ? "m" : "s"}</output><input type="range" aria-label={pt ? "Cursor da telemetria" : "Telemetry cursor"} min={range.start} max={range.end} step="any" value={cursor} onChange={(event) => setPosition(Number(event.target.value))} /></label>}
    </section>
    {!selected.length ? <StatePanel state="empty" body={pt ? "Selecione uma série para analisar." : "Select a series to analyze."} /> : !range ? <StatePanel state="unavailable" body={pt ? "As séries selecionadas não têm amostras válidas neste eixo." : "The selected series contain no valid samples on this axis."} /> : <TelemetryWorkspace series={series} channels={session.channels} axis={activeAxis} cursor={cursor} range={range} visible={visible} onVisible={setVisible} onInspect={setPosition} locale={locale} following={false} staticData entityLabel={pt ? "Entidade" : "Entity"} />}
  </div>;
}
