/**
 * 1.0.21 — achado no QA do Simulador (27/10): o PortaoBoasVindas (montado no App inteiro) tirava a conta recém-nascida
 * do /app pra /home no mesmo segundo (BoasVindasPago "pulado" → navigate), e a TelaParabens do cadastro nunca aparecia.
 * Com o enxuto: no /app o portão não faz nada; fora dele, a Parabéns aparece 1x e o "Entrar" vai pra Home.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";

const conta = vi.hoisted(() => ({ created_at: new Date().toISOString() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: conta.created_at, email: "a@x.com" }, isSubscribed: true, subLoaded: true }) }));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: (k: string, d: unknown) => (k === "core-user-name" ? "Bia" : d), set: () => {}, loaded: true }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

import { PortaoBoasVindas } from "@/components/onboarding/PortaoBoasVindas";

const G = globalThis as { __FLUXO_ENXUTO_PADRAO_APP__?: string };
let antes: string | undefined;
const App = ({ rota }: { rota: string }) => (
  <MemoryRouter initialEntries={[rota]}>
    <PortaoBoasVindas />
    <Routes>
      <Route path="/app" element={<p>FUNIL</p>} />
      <Route path="/home" element={<p>HOME</p>} />
      <Route path="/financas" element={<p>FINANCAS</p>} />
    </Routes>
  </MemoryRouter>
);
beforeEach(() => {
  localStorage.clear();
  antes = G.__FLUXO_ENXUTO_PADRAO_APP__; delete G.__FLUXO_ENXUTO_PADRAO_APP__;
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "ios", isNativePlatform: () => true };
});
afterEach(() => { cleanup(); G.__FLUXO_ENXUTO_PADRAO_APP__ = antes; delete (window as { Capacitor?: unknown }).Capacitor; });

describe("PortaoBoasVindas × fluxo enxuto", () => {
  it("no /app (o cadastro pós-compra) não tira a pessoa de lá nem desenha nada", () => {
    render(<App rota="/app" />);
    expect(screen.getByText("FUNIL")).toBeInTheDocument();
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
  });
  it("fora do /app (assinou pelo gate/Porta): a Parabéns aparece 1x; Entrar → Home; não volta", () => {
    const r = render(<App rota="/financas" />);
    fireEvent.click(screen.getByTestId("parabens-entrar"));
    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
    r.unmount();
    render(<App rota="/home" />);
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
  });
  it("a Parabéns do cadastro marca e a rota sai do /app: o portão NÃO mostra uma 2ª (bug do QA 27/10)", () => {
    const Cadastro = () => { const nav = useNavigate(); return <button onClick={() => { localStorage.setItem("core-boas-vindas-visto", "1"); nav("/home"); }}>entrar-cadastro</button>; };
    render(
      <MemoryRouter initialEntries={["/app"]}>
        <PortaoBoasVindas />
        <Routes><Route path="/app" element={<Cadastro />} /><Route path="/home" element={<p>HOME</p>} /></Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("entrar-cadastro"));
    expect(screen.getByText("HOME")).toBeInTheDocument();
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
  });
  it("já viu a Parabéns no cadastro (mesma marca): nada", () => {
    localStorage.setItem("core-boas-vindas-visto", "1");
    render(<App rota="/home" />);
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
  });
  it("conta antiga: nada", () => {
    conta.created_at = "2026-01-01T00:00:00Z";
    render(<App rota="/home" />);
    expect(screen.queryByTestId("tela-parabens")).toBeNull();
    conta.created_at = new Date().toISOString();
  });
});
