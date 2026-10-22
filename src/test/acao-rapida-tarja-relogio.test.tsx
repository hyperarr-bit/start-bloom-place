/**
 * B5 (1.0.18, QA 21/10): "Registrar Gasto" nas ações rápidas com o teclado do iPhone — o WKWebView rola a Home pra
 * mostrar o "R$ 0,00" e a linha "🔥 1 dia · garantido hoje" ficava por baixo do relógio/ilha (a barra de status do
 * app é transparente). A mesma TarjaDoRelogio do cadastro pós-compra (1.0.17): com o teclado aberto E a página rolada,
 * uma tarja da cor do fundo cobre a área segura de cima; fechou o teclado, some. Sem teclado, nada muda.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { QuickActions } from "@/components/home/QuickActions";
import { instalarTecladoIphone } from "@/test/helpers/teclado-iphone";

vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => true, plataformaApp: () => "ios" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "uid-1" }, session: null, loading: false, isSubscribed: true, subLoaded: true }) }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), markActivation: vi.fn(async () => {}) }));

const store = (): UserDataContextType => {
  const dados: Record<string, unknown> = {};
  return { get: <T,>(k: string, f: T) => (k in dados ? (dados[k] as T) : f), set: (k, v) => { dados[k] = v; }, loaded: true, isGuest: true, fetchKey: async () => null };
};
afterEach(() => { cleanup(); });

describe("ações rápidas × teclado do iPhone (B5)", () => {
  it("sem ação aberta não há tarja; 'Registrar Gasto' + teclado com a página rolada → tarja no topo da tela; fechou o teclado → some", () => {
    const teclado = instalarTecladoIphone({ alturaTela: 844, larguraTela: 390, alturaTeclado: 336 });
    try {
      render(<MemoryRouter><UserDataContext.Provider value={store()}><QuickActions /></UserDataContext.Provider></MemoryRouter>);
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /Registrar Gasto/ }));
      const campo = screen.getByPlaceholderText("R$ 0,00");
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull(); // formulário aberto, teclado ainda não
      teclado.abrir(campo, 180, 163); // o iPhone rolou a página 180 e deslocou a área visível 163
      const tarja = screen.getByTestId("tarja-do-relogio");
      expect(tarja.style.top).toBe("163px");
      expect(tarja.className).toMatch(/pointer-events-none/);
      expect(tarja.className).toMatch(/bg-background/);
      teclado.soltarFoco();
      teclado.assentar();
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
    } finally { teclado.desinstalar(); }
  });

  it("teclado aberto SEM a página rolar (campo já à vista): nenhuma tarja", () => {
    const teclado = instalarTecladoIphone({ alturaTela: 844, larguraTela: 390, alturaTeclado: 336 });
    try {
      render(<MemoryRouter><UserDataContext.Provider value={store()}><QuickActions /></UserDataContext.Provider></MemoryRouter>);
      fireEvent.click(screen.getByRole("button", { name: /Registrar Gasto/ }));
      teclado.abrir(screen.getByPlaceholderText("R$ 0,00"), 0, 0);
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
    } finally { teclado.desinstalar(); }
  });
});
