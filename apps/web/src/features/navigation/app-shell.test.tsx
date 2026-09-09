import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { F1CatalogScreen } from "../f1-catalog/f1-catalog-screen";
import { SessionLoadScreen } from "../session-load/session-load-screen";
import { AppShell } from "./app-shell";

let pathname = "/f1";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() })
}));

beforeEach(() => {
  pathname = "/f1";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("app shell", () => {
  it("changes language and resizes the sidebar with the keyboard", () => {
    render(<AppShell><p>Content</p></AppShell>);

    fireEvent.change(screen.getByLabelText("Idioma"), { target: { value: "en" } });
    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();

    const separator = screen.getByRole("separator", { name: "Resize sidebar" });
    fireEvent.keyDown(separator, { key: "ArrowRight" });
    expect(separator).toHaveAttribute("aria-valuenow", "264");
  });

  it("pins the sidebar", () => {
    render(<AppShell><p>Content</p></AppShell>);

    const pin = screen.getByRole("button", { name: "Fixar barra lateral" });
    fireEvent.click(pin);
    expect(pin).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps only the most specific navigation route selected", () => {
    pathname = "/telemetry/import";
    render(<AppShell><p>Content</p></AppShell>);

    const navigation = screen.getByRole("navigation", { name: "Navegação principal" });
    expect(within(navigation).getByRole("link", { name: "Importar telemetria" })).toHaveAttribute("aria-current", "page");
    expect(within(navigation).getByRole("link", { name: "Telemetria" })).not.toHaveAttribute("aria-current");
    expect(within(navigation).queryAllByRole("link", { current: "page" })).toHaveLength(1);
    expect(navigation.querySelector(".nav-list")).toHaveAttribute("data-active-id", "/telemetry/import");
  });

  it("opens and closes the command palette with keyboard shortcuts", async () => {
    render(<AppShell><p>Content</p></AppShell>);

    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    expect(screen.getByRole("dialog", { name: "Paleta de comandos" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Paleta de comandos" })).toHaveFocus());
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Paleta de comandos" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Paleta de comandos" })).not.toBeInTheDocument();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    expect(screen.queryByRole("dialog", { name: "Paleta de comandos" })).not.toBeInTheDocument();
    expect(screen.queryByText("⌘ K")).not.toBeInTheDocument();
  });
});

describe("catalog and session states", () => {
  it("keeps unsupported events disabled while enabling Belgium", () => {
    render(<AppShell><F1CatalogScreen /></AppShell>);

    expect(screen.getByRole("link", { name: "Abrir Spa Race" })).toHaveAttribute(
      "href",
      "/f1/2025/belgium/race"
    );
    expect(screen.getAllByRole("button", { name: "Ver sessão" })[0]).toBeDisabled();
  });

  it("starts and cancels a real API job without substituting fixture data", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        requestId: "request-1",
        id: "job-1",
        status: "running",
        stage: "download",
        progress: null,
        message: "Loading FastF1 with its native cache enabled.",
        source: null,
        sessionId: null,
        error: null
      })))
      .mockImplementationOnce(() => new Promise<Response>(() => {}))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        requestId: "request-2",
        id: "job-1",
        status: "cancelled",
        stage: "download",
        progress: null,
        message: "Loading was cancelled.",
        source: null,
        sessionId: null,
        error: null
      })));
    vi.stubGlobal("fetch", fetchMock);
    render(<AppShell><SessionLoadScreen /></AppShell>);

    fireEvent.click(screen.getByRole("button", { name: "Carregar sessão real" }));
    await waitFor(() => expect(screen.getByText("Carregando a sessão real…")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.getByText("O carregamento foi cancelado.")).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/api/f1/jobs",
      expect.objectContaining({ method: "POST" })
    );
  });
});
