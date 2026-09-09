import { expect, test, type Page } from "@playwright/test";
import { fixtureResponse } from "../src/test/race-fixture";

const routes = ["/", "/f1", "/f1/2025/belgium/race", "/telemetry", "/telemetry/import", "/telemetry/session"];

test("browser reports the requested responsive viewports", async ({ page }) => {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect.poll(() => page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))).toEqual(viewport);
  }
});

test("all Phase 01 routes navigate without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const route of routes) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
});

test("catalog exposes only Belgium as an enabled session", async ({ page }) => {
  await page.goto("/f1");
  await expect(page.getByRole("link", { name: "Abrir Spa Race" })).toHaveAttribute("href", "/f1/2025/belgium/race");
  await expect(page.getByRole("button", { name: "Ver sessão" }).first()).toBeDisabled();
});

test("session shows a safe API-offline error when the backend is unavailable", async ({ page }) => {
  await page.route("**/api/**", (route) => route.abort("failed"));
  await page.goto("/f1/2025/belgium/race");
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  await expect(page.getByText("Não foi possível carregar a sessão pela API.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("sidebar works on hover, keyboard, mobile, and reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/");
  await page.locator(".sidebar").hover();
  await expect(page.locator(".sidebar")).toHaveCSS("width", "248px");
  await page.getByRole("separator", { name: "Redimensionar barra lateral" }).press("ArrowRight");
  await expect(page.getByRole("separator", { name: "Redimensionar barra lateral" })).toHaveAttribute("aria-valuenow", "264");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Abrir menu" }).click();
  await expect(page.getByRole("navigation", { name: "Navegação principal" })).toBeVisible();
  await page.getByLabel("Idioma").selectOption("en");
  await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
  await page.getByRole("button", { name: "Close menu" }).click();

  await page.emulateMedia({ reducedMotion: "reduce" });
  const transitionDuration = await page.locator(".sidebar").evaluate(
    (element) => Number.parseFloat(getComputedStyle(element).transitionDuration)
  );
  expect(transitionDuration).toBeLessThan(0.02);
});

test("sidebar moves one selection indicator to the most specific active route", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto("/telemetry");
  const navigation = page.getByRole("navigation", { name: "Navegação principal" });
  const navigationList = navigation.locator(".nav-list");

  await expect(navigationList).toHaveAttribute("data-active-id", "/telemetry");
  await expect(navigation.getByRole("link", { name: "Telemetria", exact: true })).toHaveAttribute("aria-current", "page");
  await navigation.getByRole("link", { name: "Importar telemetria", exact: true }).click();

  await expect(navigationList).toHaveAttribute("data-active-id", "/telemetry/import");
  await expect(navigation.getByRole("link", { name: "Importar telemetria", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(navigation.getByRole("link", { name: "Telemetria", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(navigation.locator(".nav-selection-indicator")).toHaveAttribute("data-ready", "true");
});

test("command palette supports keyboard opening, search, and Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".nav-selection-indicator")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeVisible();
  const search = page.getByRole("textbox", { name: "Paleta de comandos" });
  await search.fill("telemetria");
  await expect(page.getByRole("button", { name: /Telemetria/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Paleta de comandos" })).toBeHidden();
});


async function openCompanion(page: Page) {
  await page.route("**/api/**", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(fixtureResponse(route.request().url(), route.request().postDataJSON() ?? undefined)) });
  });
  await page.goto("/f1/2025/belgium/race");
  await page.getByRole("button", { name: "Carregar sessão real" }).click();
  await expect(page.getByRole("heading", { name: "Race Explorer · Spa 2025" })).toBeVisible();
  await expect(page.locator(".live-readouts").first()).toContainText("200");
}
async function seekTo(page: Page, value: number) {
  await page.getByRole("slider", { name: "Posição do replay" }).evaluate((element, time) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, String(time));
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}
for (const viewport of [{ width: 1440, height: 900 }, { width: 1200, height: 900 }, { width: 1024, height: 800 }, { width: 390, height: 844 }]) {
  test(`Race companion: follow, inspect and arrange at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await openCompanion(page);
    await page.getByText("Escolher pilotos", { exact: true }).click();
    await page.getByRole("searchbox", { name: "Buscar piloto" }).fill("LEC");
    await page.getByRole("checkbox", { name: /LEC/ }).check();
    await page.getByRole("searchbox").fill("VER");
    await page.getByRole("checkbox", { name: /VER/ }).check();
    await expect(page.locator(".driver-chip")).toHaveCount(4);
    await page.screenshot({ path: testInfo.outputPath("selection.png"), fullPage: true });
    await page.getByText("Escolher pilotos", { exact: true }).click();
    await page.getByRole("button", { name: "Reproduzir" }).click();
    await page.getByRole("button", { name: "Painel compacto", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pausar", exact: true })).toBeVisible();
    const monitor = page.getByRole("region", { name: "Monitor da pista" });
    await expect(monitor).toHaveClass(/track-integrated/);
    await monitor.getByRole("button", { name: "Pista ampla", exact: true }).click();
    await page.getByRole("button", { name: "Pausar", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await seekTo(page, 99.75);
    await page.getByRole("button", { name: "Avançar 1 segundo" }).click();
    await expect(page.getByTestId("race-time")).toHaveAttribute("data-time", "100.75");
    await expect(page.locator(".timing-rows").first().locator("li").first()).toHaveAttribute("data-driver", "NOR");
    await page.locator(".channel-menu summary").click();
    await expect(page.getByRole("checkbox", { name: "Brake", exact: true })).toBeChecked();
    const chart = page.getByRole("img", { name: /Speed: telemetria/ });
    await chart.press("ArrowLeft");
    await expect(page.getByText("Inspeção pausada")).toBeVisible();
    await page.getByRole("button", { name: "Voltar ao acompanhamento" }).click();
    await page.locator(".telemetry-table-wrap summary").click();
    await expect(page.locator(".telemetry-table-wrap table")).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("analysis.png"), fullPage: true });
    if (viewport.width < 768) await page.getByRole("button", { name: "Expandir controles" }).click();
    await page.getByRole("button", { name: "Comparação de voltas", exact: true }).click();
    await expect(page.getByRole("button", { name: "Remover série" })).toHaveCount(2);
    await page.getByRole("button", { name: "Adicionar série" }).click();
    await page.getByRole("button", { name: "Adicionar série" }).click();
    await expect(page.getByRole("button", { name: "Adicionar série" })).toBeDisabled();
    await page.getByRole("button", { name: "Corrida real", exact: true }).click();
    await expect(page.locator(".driver-chip")).toHaveCount(4);
    if (viewport.width < 768) await page.getByRole("button", { name: "Abrir menu" }).click();
    else await page.locator(".sidebar").hover();
    await page.getByLabel("Idioma").selectOption("en");
    if (viewport.width < 768) await page.getByRole("button", { name: "Close menu" }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByText("Lap options", { exact: true }).click();
    await expect(page.getByRole("button", { name: "Start race" })).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.getByRole("button", { name: "Compact panel", exact: true }).evaluate((element) => Number.parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThan(.02);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
    await page.screenshot({ path: testInfo.outputPath("english.png"), fullPage: true });
  });
}
test("Race companion reuses lap requests while playing and reads a later lap after crossing", async ({ page }) => {
  const updateErrors: string[] = [];
  page.on("console", (message) => { if (message.text().includes("Maximum update depth")) updateErrors.push(message.text()); });
  page.on("pageerror", (error) => updateErrors.push(error.message));
  let seriesRequests = 0;
  page.on("request", (request) => { if (request.url().endsWith("/series")) seriesRequests += 1; });
  await openCompanion(page);
  const initialRequests = seriesRequests;
  await page.getByRole("button", { name: "Reproduzir" }).click();
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time")), { timeout: 15000 }).toBeGreaterThan(25);
  expect(updateErrors).toEqual([]);
  expect(seriesRequests).toBe(initialRequests);
  await page.getByRole("button", { name: "Pausar", exact: true }).click();
  await seekTo(page, 99.75);
  await page.getByRole("button", { name: "Reproduzir" }).click();
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time"))).toBeGreaterThan(101);
  await expect(page.locator(".companion-clock strong")).toHaveText("PIA · Volta 8");
  await expect(page.locator(".live-readouts").first()).toContainText("201");
  expect(updateErrors).toEqual([]);
});

test("Race companion keeps one clock while the 3D scene leaves and returns to view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCompanion(page);
  await page.getByRole("button", { name: "Selecionar todos" }).click();
  await expect(page.locator(".driver-chip")).toHaveCount(20);
  await page.getByRole("button", { name: "Reproduzir" }).click();
  const before = Number(await page.getByTestId("race-time").getAttribute("data-time"));
  await page.locator(".monitor-chart").first().scrollIntoViewIfNeeded();
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time"))).toBeGreaterThan(before + .2);
  const during = Number(await page.getByTestId("race-time").getAttribute("data-time"));
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await expect(page.getByRole("img", { name: /Simulação tridimensional|Traçado real/ })).toBeVisible();
  await expect.poll(async () => Number(await page.getByTestId("race-time").getAttribute("data-time"))).toBeGreaterThan(during);
});

test("Spa camera locks across scroll and standings reserve chart space", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openCompanion(page);
  const scene = page.locator(".race-scene");
  await page.getByRole("button", { name: "Explorar pista", exact: true }).click();
  await expect(scene).toHaveAttribute("data-camera-mode", "exploring");
  const canvas = scene.locator("canvas");
  const rect = (await canvas.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
  await page.mouse.down(); await page.mouse.move(rect.x + rect.width / 2 + 90, rect.y + rect.height / 2 + 20, { steps: 12 }); await page.mouse.up();
  await page.getByRole("button", { name: "Fixar câmera" }).click();
  await expect(scene).toHaveAttribute("data-camera-mode", "fixed");
  await page.getByRole("button", { name: "Painel compacto", exact: true }).click();
  await page.getByRole("button", { name: "Pista ampla", exact: true }).click();
  await expect(scene).toHaveAttribute("data-camera-mode", "fixed");
  await page.locator(".monitor-chart").last().scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-active", "true");
  const tower = page.locator(".timing-rail .timing-tower");
  await expect(tower).toHaveClass(/is-compact/);
  await expect(tower.locator("li")).toHaveCount(3);
  const towerBounds = (await tower.boundingBox())!;
  const chartBounds = (await page.locator(".monitor-chart").last().boundingBox())!;
  expect(towerBounds.x).toBeGreaterThanOrEqual(chartBounds.x + chartBounds.width);
  await tower.getByRole("button", { name: "Ver classificação" }).click();
  await expect(tower.locator("li")).toHaveCount(20);
  await tower.getByRole("button", { name: "Focar HAM", exact: true }).click();
  await tower.getByRole("button", { name: "Resumir classificação" }).click();
  await expect(tower.locator("li")).toHaveCount(4);
  await expect(tower.locator("li[data-driver='HAM']")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("compact-analysis.png") });
  await page.getByRole("button", { name: "Explorar pista", exact: true }).scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-active", "true");
  await expect(scene).toHaveAttribute("data-camera-mode", "fixed");
  await page.getByRole("button", { name: "Restaurar vista" }).click();
  await expect(scene).toHaveAttribute("data-camera-mode", "auto");
});
