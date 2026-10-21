import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

// Explicit opt-in: required CI scenarios never call FastF1 or the local backend.
test("real cached Spa session follows laps and renders four viewport layouts", async ({ page }, testInfo) => {
  test.skip(process.env.CORTEX_REAL_SMOKE !== "1", "Explicit local cached-session smoke only");
  test.setTimeout(90000);
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/f1/2025/belgium/race");
  const manifestResponse = page.waitForResponse((response) => response.url().endsWith("/manifest") && response.ok());
  const succeededJob = page.waitForResponse(async (response) => response.url().includes("/api/jobs/") && response.ok()
    && (await response.json()).status === "succeeded");
  const started = Date.now();
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  const packet = await manifestResponse;
  const { manifest } = await packet.json();
  const completedJob = await (await succeededJob).json();
  expect(completedJob.source).toBe("normalized-cache");
  const evidencePath = testInfo.outputPath("session-evidence.json");
  await writeFile(evidencePath, JSON.stringify({
    sessionId: manifest.sessionId, normalizerVersion: manifest.normalizerVersion,
    drivers: manifest.drivers.length, laps: manifest.laps.length, source: completedJob.source,
    loadToManifestMs: Date.now() - started, manifestBytes: (await packet.body()).byteLength
  }, null, 2));
  await testInfo.attach("session-evidence", { contentType: "application/json", path: evidencePath });
  await expect(page.getByRole("heading", { name: "Race Explorer · Spa 2025" })).toBeVisible();
  await expect(page.getByRole("img", { name: /Simulação tridimensional|Traçado real/ })).toBeVisible();
  await page.getByRole("button", { name: "Selecionar todos" }).click();
  await expect(page.locator(".driver-chip")).toHaveCount(manifest.drivers.length);
  const lap = manifest.laps.find((item: { driver: string; number: number }) => item.driver === "PIA" && item.number === 7);
  await page.getByRole("slider", { name: "Posição do replay" }).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(value));
    element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
  }, lap.time - .25);
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time"))).toBeGreaterThan(lap.time + 1);
  await expect(page.locator(".companion-clock strong")).toHaveText("PIA · Volta 8");
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1200, height: 900 }, { width: 1024, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const coreBounds = await page.locator(".companion-heading, .race-transport, .driver-selection").evaluateAll((elements) => elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    }));
    for (const rect of coreBounds) {
      expect(rect.left).toBeGreaterThanOrEqual(0);
      expect(rect.right).toBeLessThanOrEqual(viewport.width);
    }
    await page.screenshot({ path: testInfo.outputPath(`real-${viewport.width}-overview.png`) });
    await page.locator(".race-track-panel").scrollIntoViewIfNeeded();
    await expect(page.locator(".race-scene canvas")).toBeVisible();
    await page.waitForTimeout(500);
    await page.screenshot({ path: testInfo.outputPath(`real-${viewport.width}-scene.png`) });
    await page.locator(".monitor-chart").first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath(`real-${viewport.width}-telemetry.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  expect(browserErrors).toEqual([]);
});
