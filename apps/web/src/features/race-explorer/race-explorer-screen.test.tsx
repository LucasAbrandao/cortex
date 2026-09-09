import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureResponse } from "../../test/race-fixture";
import { AppShell } from "../navigation/app-shell";
import { RaceStage } from "./race-stage";
import { RaceExplorerScreen } from "./race-explorer-screen";

vi.mock("next/navigation", () => ({ usePathname: () => "/f1/2025/belgium/race", useRouter: () => ({ push: vi.fn() }) }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function setup() {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(fixtureResponse(url, init?.body ? JSON.parse(String(init.body)) : undefined)))));
  vi.stubGlobal("fetch", fetchMock);
  render(<AppShell><RaceStage locale="pt-BR" real><RaceExplorerScreen sessionId="spa" /></RaceStage></AppShell>);
  return fetchMock;
}

describe("Race companion", () => {
  it("keeps monitored drivers, focus, and comparison selections independent", async () => {
    setup();
    await screen.findByRole("heading", { name: "Race Explorer · Spa 2025" });
    fireEvent.click(screen.getByText("Opções da volta"));
    expect(screen.getByRole("checkbox", { name: "Pausar ao fim da volta escolhida" })).not.toBeChecked();
    const selection = screen.getByRole("region", { name: "Seleção de pilotos" });
    const originalTime = screen.getByTestId("race-time").getAttribute("data-time");
    fireEvent.click(within(selection).getByRole("button", { name: "Focar NOR" }));
    expect(screen.getByTestId("race-time")).toHaveAttribute("data-time", originalTime);
    expect(within(selection).getByRole("button", { name: "Remover PIA" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Comparação de voltas" }));
    expect(screen.getAllByRole("button", { name: "Remover série" })).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Adicionar série" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar série" }));
    expect(screen.getByRole("button", { name: "Adicionar série" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Corrida real" }));
    expect(screen.getByTestId("race-time")).toHaveAttribute("data-time", originalTime);
    expect(screen.queryByRole("button", { name: "Remover série" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Comparação de voltas" }));
    expect(screen.getAllByRole("button", { name: "Remover série" })).toHaveLength(4);
  });

  it("prefetches next laps once and follows their original samples across a boundary", async () => {
    const fetchMock = setup();
    await screen.findByRole("heading", { name: "Race Explorer · Spa 2025" });
    await waitFor(() => expect(document.querySelector(".live-readouts")?.textContent).toContain("200"));
    const before = fetchMock.mock.calls.filter(([url]) => url.endsWith("/series")).length;
    fireEvent.click(screen.getByRole("button", { name: "Avançar 1 segundo" }));
    await waitFor(() => expect(document.querySelector(".live-readouts")?.textContent).toContain("201"));
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith("/series"))).toHaveLength(before);
    fireEvent.change(screen.getByRole("slider", { name: "Posição do replay" }), { target: { value: "101" } });
    await waitFor(() => expect(document.querySelector(".live-readouts")?.textContent).toContain("201"));
    expect(screen.getByTestId("race-time")).toHaveAttribute("data-time", "101");
    const tower = screen.getByRole("region", { name: "Classificação no instante" });
    expect(tower.querySelector("[data-driver]")).toHaveAttribute("data-driver", "NOR");
    fireEvent.keyDown(screen.getAllByRole("img", { name: /telemetria sincronizada/ })[0]!, { key: "ArrowLeft" });
    expect(screen.getByText("Inspeção pausada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproduzir" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar ao acompanhamento" }));
    expect(screen.getByText("● Seguindo replay")).toBeInTheDocument();
  });

  it("restores wide presentation without interrupting playback", async () => {
    setup();
    await screen.findByRole("heading", { name: "Race Explorer · Spa 2025" });
    fireEvent.click(screen.getByRole("button", { name: "Reproduzir" }));
    fireEvent.click(screen.getByRole("button", { name: "Painel compacto" }));
    expect(screen.getByRole("region", { name: "Monitor da pista" })).toHaveClass("track-integrated");
    fireEvent.click(screen.getByRole("button", { name: "Pista ampla" }));
    expect(screen.getByRole("region", { name: "Monitor da pista" })).toHaveClass("track-expanded");
    expect(screen.getByRole("button", { name: "Pausar" })).toBeInTheDocument();
  });

  it("keeps the full simulation grid independent from the four analyzed drivers", async () => {
    setup();
    await screen.findByRole("heading", { name: "Race Explorer · Spa 2025" });
    // JSDOM does not apply the responsive stylesheet that hides the mobile copy.
    const desktopActions = document.querySelector<HTMLElement>(".driver-bulk-actions")!;
    fireEvent.click(within(desktopActions).getByRole("button", { name: "Selecionar todos" }));
    expect(document.querySelectorAll(".driver-chip")).toHaveLength(20);
    expect(screen.getByRole("button", { name: "Analisar LEC" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Analisar LEC" }));
    fireEvent.click(screen.getByRole("button", { name: "Analisar VER" }));
    expect(screen.getByRole("button", { name: "Parar de analisar VER" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Remover VER" }));
    expect(within(screen.getByRole("region", { name: "Seleção de pilotos" })).queryByRole("button", { name: "Focar VER" })).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector(".live-readouts")?.textContent).toContain("VER"));
  });
});
