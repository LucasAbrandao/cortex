import { expect, test, type Page } from "@playwright/test";

// Explicit test inputs. Production never substitutes these for a user's file.
const csv = "time,driver,lap,distance,speed,brake\n0,A,1,0,0,false\n1,A,1,30,42,true\n2,A,1,60,,false\n3,A,1,90,73,false\n0,B,1,0,7,false\n1,B,1,25,37,false\n2,B,1,50,47,true\n3,B,1,75,57,false";
const confirmLabel = "Revisei e confirmo as colunas, a base de tempo e as unidades selecionadas.";

async function selectFile(page: Page, text = csv, name = "controlled-telemetry.csv") {
  await page.getByLabel("Arquivo de telemetria", { exact: true }).setInputFiles({ name, mimeType: name.endsWith("json") ? "application/json" : "text/csv", buffer: Buffer.from(text) });
  await expect(page.getByRole("heading", { name: "Mapear colunas", exact: true })).toBeVisible();
}
async function analyze(page: Page, units = "s", base = "file", distance = true) {
  await page.getByRole("combobox", { name: "Unidade de tempo", exact: true }).selectOption(units);
  await page.getByRole("combobox", { name: "Base do tempo", exact: true }).selectOption(base);
  if (distance) await page.getByRole("combobox", { name: "Unidade de distância", exact: true }).selectOption("m");
  await page.getByRole("checkbox", { name: confirmLabel, exact: true }).check();
  await page.getByRole("button", { name: "Analisar dados do arquivo", exact: true }).click();
}

for (const width of [1440, 1200, 1024, 390]) {
  test(`Telemetry real file: values, distance, keyboard, PT/EN and privacy at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const errors: string[] = []; const apiRequests: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("request", (request) => { if (request.url().includes("/api/")) apiRequests.push(request.url()); });
    await page.goto("/telemetry/import");
    await selectFile(page);
    await expect(page.getByRole("button", { name: "Analisar dados do arquivo", exact: true })).toBeDisabled();
    await page.getByRole("checkbox", { name: "brake", exact: true }).check();
    await page.screenshot({ path: info.outputPath(`mapping-${width}.png`), fullPage: true });
    await analyze(page);
    await expect(page).toHaveURL(/\/telemetry\/session$/);
    await expect(page.getByRole("heading", { name: "Séries comparadas" })).toBeVisible();
    const chart = page.getByRole("img", { name: /speed: telemetria sincronizada/ });
    await expect(chart).toBeVisible();
    await expect(chart.locator(".monitor-series-path").first()).not.toHaveAttribute("d", "");
    await page.getByRole("slider", { name: "Cursor da telemetria" }).press("End");
    await page.locator(".telemetry-table-wrap summary").click();
    await expect(page.getByRole("cell", { name: "73", exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: "57", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Canal da tabela", exact: true }).selectOption("import:brake");
    await expect(page.getByRole("cell", { name: "false", exact: true })).toHaveCount(2);
    await page.getByRole("combobox", { name: "Canal da tabela", exact: true }).selectOption("import:speed");
    await expect(page.getByText(/3\/4 amostras válidas neste canal/)).toBeVisible();
    await chart.press("ArrowLeft");
    await expect(page.getByRole("slider", { name: "Cursor da telemetria" })).toHaveValue("2");
    await expect(page.getByRole("cell", { name: "—", exact: true })).toBeVisible();
    await page.getByRole("combobox", { name: "Eixo de análise", exact: true }).selectOption("distance");
    await expect(page.getByRole("columnheader", { name: "Distância da amostra (m)" })).toBeVisible();
    await page.getByRole("button", { name: "Aproximar", exact: true }).click();
    await expect(page.getByRole("button", { name: "Afastar", exact: true })).toBeEnabled();
    await page.getByRole("button", { name: "Restaurar visualização", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`analysis-${width}.png`), fullPage: true });
    if (width < 768) await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
    else await page.locator(".sidebar").hover();
    await page.getByRole("combobox", { name: "Idioma", exact: true }).selectOption("en");
    if (width < 768) await page.getByRole("button", { name: "Close menu", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Compared series", exact: true })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Entity", exact: true })).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: info.outputPath(`english-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
    // Next's development inspector owns this database; application datasets never do.
    expect((await page.evaluate(() => indexedDB.databases())).filter((database) => database.name !== "__next_debug_channel")).toEqual([]);
    expect(apiRequests).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("Telemetry JSON drag/drop normalizes milliseconds, blocks unavailable distance and discards data", async ({ page }) => {
  await page.goto("/telemetry/import");
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(new File(['[{"time":0,"speed":0,"brake":false},{"time":1000,"speed":12,"brake":true}]'], "controlled.json", { type: "application/json" }));
    return data;
  });
  await page.getByRole("region", { name: "Selecionar arquivo de telemetria" }).dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByRole("heading", { name: "Mapear colunas" })).toBeVisible();
  await analyze(page, "ms", "series", false);
  await expect(page).toHaveURL(/\/telemetry\/session$/);
  await expect(page.getByRole("combobox", { name: "Eixo de análise" }).locator('option[value="distance"]')).toHaveJSProperty("disabled", true);
  await page.getByRole("slider", { name: "Cursor da telemetria" }).press("End");
  await expect(page.getByRole("slider", { name: "Cursor da telemetria" })).toHaveAttribute("max", "1");
  await page.locator(".telemetry-table-wrap summary").click();
  await expect(page.getByRole("cell", { name: "12", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Descartar e importar outro", exact: true }).click();
  await expect(page).toHaveURL(/\/telemetry\/import$/);
  await expect(page.getByRole("heading", { name: "Inspeção do arquivo" })).toHaveCount(0);
  await page.goto("/telemetry/session");
  await expect(page.getByRole("heading", { name: "Nenhuma sessão local aberta" })).toBeVisible();
});

test("Telemetry rejects malformed, empty, unsupported, oversized and nonmonotonic files safely", async ({ page }) => {
  await page.goto("/telemetry/import");
  const input = page.getByLabel("Arquivo de telemetria", { exact: true });
  for (const [name, text, message] of [
    ["bad.json", '{"SENSITIVE_FILE_SENTINEL":', "JSON inválido"],
    ["empty.csv", "", "O arquivo está vazio"],
    ["bad.rcz", "SENSITIVE_FILE_SENTINEL", "Escolha um arquivo .csv ou .json"],
  ]) {
    await input.setInputFiles({ name: name!, mimeType: "application/octet-stream", buffer: Buffer.from(text!) });
    await expect(page.getByText(new RegExp(message!))).toBeVisible();
    await expect(page.locator("main")).not.toContainText("SENSITIVE_FILE_SENTINEL");
  }
  await input.setInputFiles({ name: "large.csv", mimeType: "text/csv", buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 32) });
  await expect(page.getByText("O arquivo excede o limite de tamanho. Exporte um trecho menor.")).toBeVisible();
  await selectFile(page, "time,speed\n0,10\n0,20");
  await analyze(page, "s", "file", false);
  await expect(page.getByText(/O tempo precisa ser estritamente crescente/)).toBeVisible();
  await expect(page.getByText(/Registro 3/)).toBeVisible();
  await expect(page).toHaveURL(/\/telemetry\/import$/);
  await selectFile(page, "time,speed\n0,10\n1,20", "recovered.csv");
  await analyze(page, "s", "file", false);
  await expect(page).toHaveURL(/\/telemetry\/session$/);
});

test("Telemetry limits comparison to four series and forgets files after navigation and reload", async ({ page }) => {
  await page.goto("/telemetry/import");
  await selectFile(page, "time,driver,speed\n" + ["A", "B", "C", "D", "E"].map((driver) => `0,${driver},0\n1,${driver},10`).join("\n"));
  await analyze(page, "s", "file", false);
  await expect(page).toHaveURL(/\/telemetry\/session$/);
  const choices = page.getByRole("group", { name: "Selecionar até quatro séries" }).getByRole("checkbox");
  await expect(choices).toHaveCount(5);
  await expect(choices.nth(4)).toBeDisabled();
  await choices.nth(0).uncheck();
  await choices.nth(4).check();
  await expect(choices.nth(0)).toBeDisabled();
  await page.locator(".sidebar").hover();
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Race Explorer", exact: true }).click();
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Importar telemetria", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inspeção do arquivo" })).toHaveCount(0);
  await selectFile(page, "time,speed\n0,11\n1,22");
  await analyze(page, "s", "file", false);
  await expect(page).toHaveURL(/\/telemetry\/session$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Nenhuma sessão local aberta" })).toBeVisible();
});

test("Telemetry compares two laps of one entity using an explicitly derived relative clock", async ({ page }) => {
  await page.goto("/telemetry/import");
  await selectFile(page, "time,driver,lap,speed\n0,A,1,5\n1,A,1,10\n10,A,2,15\n11,A,2,20");
  await analyze(page, "s", "file", false);
  await expect(page).toHaveURL(/\/telemetry\/session$/);
  await page.getByRole("combobox", { name: "Eixo de análise", exact: true }).selectOption("lapTime");
  await page.getByRole("slider", { name: "Cursor da telemetria" }).press("End");
  await page.locator(".telemetry-table-wrap summary").click();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(3);
  await expect(page.getByRole("cell", { name: "10", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "20", exact: true })).toBeVisible();
  await expect(page.getByRole("slider", { name: "Cursor da telemetria" })).toHaveAttribute("max", "1");
});
