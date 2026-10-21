import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

test("bounded telemetry performance measurement", async ({ page }, info) => {
  test.skip(process.env.CORTEX_PERF_SMOKE !== "1", "Opt-in hardware-specific measurement, separate from required CI");
  test.setTimeout(120000);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto("/telemetry/import");
  const metric = async () => {
    const result = await cdp.send("Performance.getMetrics");
    return Object.fromEntries(result.metrics.filter((item) => ["JSHeapUsedSize", "JSHeapTotalSize", "Nodes"].includes(item.name)).map((item) => [item.name, item.value]));
  };
  const before = await metric();
  const columns = ["time", ...Array.from({ length: 9 }, (_, index) => `signal${index}`)];
  const rows = Array.from({ length: 50000 }, (_, index) => [(index / 10).toFixed(1), ...Array.from({ length: 9 }, (_, channel) => (index + channel) % 300)].join(","));
  const buffer = Buffer.from([columns.join(","), ...rows].join("\n"));
  const started = Date.now();
  await page.getByLabel("Arquivo de telemetria", { exact: true }).setInputFiles({ name: "bounded-controlled.csv", mimeType: "text/csv", buffer });
  await expect(page.getByRole("heading", { name: "Mapear colunas" })).toBeVisible();
  const inspectionMs = Date.now() - started;
  await page.getByRole("combobox", { name: "Unidade de tempo", exact: true }).selectOption("s");
  await page.getByRole("combobox", { name: "Base do tempo", exact: true }).selectOption("file");
  await page.getByRole("checkbox", { name: "Revisei e confirmo as colunas, a base de tempo e as unidades selecionadas.", exact: true }).check();
  const analysisStarted = Date.now();
  await page.getByRole("button", { name: "Analisar dados do arquivo", exact: true }).click();
  await expect(page).toHaveURL(/\/telemetry\/session$/);
  await expect(page.locator(".monitor-chart-svg")).toHaveCount(4);
  await page.locator(".monitor-chart-svg").first().scrollIntoViewIfNeeded();
  const analysisMs = Date.now() - analysisStarted;
  const interactionRoundtripMs: number[] = [];
  for (let index = 0; index < 10; index++) {
    const start = Date.now();
    await page.getByRole("slider", { name: "Cursor da telemetria" }).press(index % 2 ? "Home" : "End");
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    interactionRoundtripMs.push(Date.now() - start);
  }
  const after = await metric();
  const resources = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /\/_next\/static\/.*\.js(?:\?|$)/.test(entry.name)).map((entry) => {
    const resource = entry as PerformanceResourceTiming;
    return { transferred: resource.transferSize, encoded: resource.encodedBodySize };
  }));
  const evidence = { mode: process.env.CI === "true" ? "production" : "development", rows: 50000, columns: 10, cells: 500000, bytes: buffer.byteLength, inspectionMs, analysisMs, interactionRoundtripMs, mainPageBefore: before, mainPageAfter: after, observedJavaScriptTransferredBytes: resources.reduce((sum, item) => sum + item.transferred, 0), observedJavaScriptEncodedBytes: resources.reduce((sum, item) => sum + item.encoded, 0), limitations: "Chromium desktop, one local run. Main-page heap excludes worker memory. Interaction timings include automation and two animation frames; no FPS or comparative gain claimed." };
  const evidencePath = info.outputPath("measurement.json");
  await writeFile(evidencePath, JSON.stringify(evidence, null, 2));
  await info.attach("bounded-telemetry-performance", { contentType: "application/json", path: evidencePath });
  await page.screenshot({ path: info.outputPath("bounded-analysis.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
