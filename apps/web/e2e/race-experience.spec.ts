import { expect, test, type Page } from "@playwright/test";
import { fixtureResponse } from "../src/test/race-fixture";

const url = "/f1/2025/belgium/race";
async function mockSession(page: Page, missingTrack = false) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const body = missingTrack && request.url().endsWith("/track") ? { requestId: "missing", sessionId: "spa", trackAvailable: false, segments: [] } : fixtureResponse(request.url(), request.postDataJSON() ?? undefined);
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
}

test("presentation is independent of FastF1, interruptible, and swaps one canvas to paused telemetry", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  let requests = 0;
  page.on("request", (request) => { if (request.url().includes("/api/f1/")) requests++; });
  await mockSession(page);
  await page.goto(url);
  await expect(page.locator(".race-experience")).toHaveAttribute("data-intro-ready", "true");
  await expect(page.locator(".race-experience")).toHaveClass(/is-revealed/, { timeout: 7000 });
  expect(requests).toBe(0);
  await expect(page.getByText("Apresentação da pista · movimento ilustrativo")).toBeVisible();
  await page.screenshot({ path: info.outputPath("presentation-desktop.png") });
  await page.getByRole("button", { name: "Pausar apresentação" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir apresentação" })).toBeVisible();
  const canvas = await page.locator(".race-scene canvas").elementHandle();
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeVisible();
  await expect(page.locator(".race-scene")).toHaveAttribute("data-scene-source", "telemetry");
  await expect(page.locator(".race-scene canvas")).toHaveCount(1);
  expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page.getByText("Apresentação da pista · movimento ilustrativo")).toHaveCount(0);
  const time = await page.getByTestId("race-time").getAttribute("data-time");
  await page.getByRole("button", { name: "Painel compacto" }).click();
  const panel = page.getByRole("region", { name: "Monitor da pista" });
  const before = await panel.boundingBox();
  const resize = page.getByRole("button", { name: "Redimensionar pista; use as setas" });
  await resize.press("ArrowDown");
  await expect.poll(async () => (await panel.boundingBox())!.height).toBe(before!.height + 20);
  await resize.press("ArrowLeft");
  expect((await panel.boundingBox())!.width).toBeLessThan(before!.width);
  await page.getByRole("button", { name: "Pista ampla" }).click();
  await expect(page.getByTestId("race-time")).toHaveAttribute("data-time", time!);
  await expect(page.locator(".race-experience")).toHaveAttribute("data-presentation", "expanded");
});

test("scroll keeps the wide scene visible, makes charts solid and restores the transport", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await mockSession(page); await page.goto(url);
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  const chart = page.locator(".monitor-chart").first();
  await expect(chart).toBeAttached();
  await page.getByRole("button", { name: "Reproduzir", exact: true }).click();
  const before = Number(await page.getByTestId("race-time").getAttribute("data-time"));
  await chart.evaluate((element) => window.scrollTo(0, element.getBoundingClientRect().top + window.scrollY - 210));
  await expect(page.locator(".race-companion")).toHaveAttribute("data-transport", "compact");
  await expect.poll(() => chart.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe("rgb(26, 33, 41)");
  await expect(page.locator(".race-scene")).toHaveAttribute("data-active", "true");
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time"))).toBeGreaterThan(before);
  await page.screenshot({ path: info.outputPath("opaque-analysis.png") });
  await page.getByRole("button", { name: "Expandir controles" }).click();
  await expect(page.getByText("Opções da volta", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Recolher controles" }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator(".race-companion")).toHaveAttribute("data-transport", "expanded");
  await expect.poll(() => chart.evaluate((element) => Number(getComputedStyle(element).getPropertyValue("--chart-alpha")))).toBeLessThan(1);
});

test("slow loading and cancellation do not turn the illustrative scene into session data", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ requestId: "slow", id: "slow", status: route.request().url().endsWith("/cancel") ? "cancelled" : "running", stage: "cache", progress: null, message: "Loading", source: null, sessionId: null, error: null }) }));
  await page.goto(url);
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  await expect(page.getByRole("button", { name: "Cancelar", exact: true })).toBeVisible();
  await expect(page.locator(".race-scene")).toHaveAttribute("data-scene-source", "illustration");
  await expect(page.getByTestId("race-time")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("missing real positions never fall back to illustrative cars", async ({ page }) => {
  await mockSession(page, true); await page.goto(url);
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  await expect(page.getByRole("button", { name: "Reproduzir", exact: true })).toBeVisible();
  await expect(page.locator(".race-scene")).toHaveAttribute("data-scene-source", "telemetry");
  await expect(page.locator(".race-stage-shell .state-panel")).toBeVisible();
  await expect(page.getByText("Apresentação da pista · movimento ilustrativo")).toHaveCount(0);
});

test("mobile reduced-motion entry is immediate and WebGL failure has a usable fallback", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => { Object.defineProperty(window, "WebGLRenderingContext", { value: undefined }); });
  await page.goto(url);
  await expect(page.locator(".race-experience")).toHaveClass(/is-revealed/);
  await expect(page.locator(".presentation-map")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reproduzir apresentação" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Carregar sessão real" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("mobile-fallback.png"), fullPage: true });
});
