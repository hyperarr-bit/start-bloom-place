/**
 * A DEMO DA WEB COM OS MÓDULOS NOVOS (30/09). /preview/pet, /preview/relacionamentos e
 * /preview/beleza são vitrine de venda: abrem com o módulo NOVO de verdade e as sementes
 * de `preview-seeds.ts`, sem cair no "algo deu errado", com o conteúdo da conta de
 * exemplo na tela — e sem nenhum botão de lembrete (na web ele não toca).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: vi.fn(),
  trackEventBeacon: vi.fn(),
  markActivation: vi.fn(async () => {}),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: false, subLoaded: true }),
}));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));

import Preview from "@/pages/Preview";

MotionGlobalConfig.skipAnimations = true;
if (!("ResizeObserver" in globalThis)) {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
}
Element.prototype.scrollIntoView = () => {};

const abrirDemo = (modulo: string) => {
  window.history.pushState({}, "", `/preview/${modulo}`);
  return render(
    <MemoryRouter initialEntries={[`/preview/${modulo}`]}>
      <Routes><Route path="/preview/:moduleKey" element={<Preview />} /></Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); window.history.pushState({}, "", "/"); });

const semErro = () => expect(document.body.textContent ?? "").not.toMatch(/algo deu errado|Something went wrong/i);

describe("demo dos módulos novos na web", () => {
  it("PET: o RG da Mel, a carteirinha e o dia do pet — sem interruptor de aviso", async () => {
    abrirDemo("pet");
    const rg = await screen.findByTestId("rg-do-pet", {}, { timeout: 8000 });
    expect(within(rg).getByText("Mel")).toBeInTheDocument();
    expect(screen.getAllByText("NexGard").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByTestId("aba-saude"));
    expect(screen.getByTestId("avisos-pet-so-no-app")).toBeInTheDocument();
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("aba-gastos"));
    expect(screen.getByText("Ração 15 kg")).toBeInTheDocument();
    semErro();
  });

  it("RELAÇÕES: as pessoas da conta de exemplo e as próximas datas — sem 'Me avisa antes'", async () => {
    abrirDemo("relacionamentos");
    expect((await screen.findAllByText("Ju", {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Vó Cida").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Me avisa antes/ })).not.toBeInTheDocument();
    semErro();
  });

  it("BELEZA: a rotina de um mês (não mais vazia), as fotos da pele, MEUS PRODUTOS, CABELO e CUIDADOS", async () => {
    abrirDemo("beleza");
    expect((await screen.findAllByText("Sérum de vitamina C", {}, { timeout: 8000 })).length).toBeGreaterThan(0);
    expect(screen.getByTestId("fotos-da-pele")).toHaveTextContent("As manchas da bochecha mais claras com a vitamina C");
    expect(screen.queryByTestId("lembrete-skincare")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /MEUS PRODUTOS/ }));
    expect(screen.getAllByText("Fusion Water FPS 60").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /CABELO/ }));
    expect(await screen.findByTestId("aba-cabelo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /CUIDADOS/ }));
    expect((await screen.findAllByText("Sobrancelha")).length).toBeGreaterThan(0);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    semErro();
  });
});
