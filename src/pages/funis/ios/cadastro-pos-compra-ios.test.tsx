/**
 * O CADASTRO PÓS-COMPRA — iPhone × Android, agora arquivos diferentes (01/09).
 *
 * Este arquivo existe por causa de cinco problemas que passaram por revisão de
 * código, pelo typecheck e pelos testes do paywall — e só apareceram quando o
 * dono comprou de verdade num iPhone pelo TestFlight:
 *
 *   1. só existia "Continuar com Google" (a regra 4.8 exige a opção da Apple);
 *   2. "Rapidinho: como você pagou? Pix · Cartão · Saldo Google" (3.1.1);
 *   3. "Garantia de 7 dias" — na Apple quem reembolsa é a Apple;
 *   4. "o Google leva alguns segundos pra confirmar" na tela de liberação;
 *   5. o botão do Google, que no iOS não volta do navegador — a pessoa pagaria
 *      e ficaria sem conseguir criar conta.
 *
 * Todos na MESMA região do fluxo: o que vem DEPOIS da compra. Nenhum no
 * paywall. Por isso as telas viraram arquivos separados — e por isso metade
 * destes testes afirma que o Android segue exatamente como estava.
 */
import { describe, it, expect, afterEach, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SignupIOS } from "./CadastroIOS";
import { SignupScreen } from "@/pages/funis/radar/ComecarRadar";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ signUp: vi.fn(), signIn: vi.fn(), user: null, loading: false }),
}));
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ set: vi.fn(), get: () => "", data: {} }),
}));
vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(), getAttributionParams: () => ({}), captureLandingMeta: () => ({}),
}));
vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  estadoRevenueCat: () => "pronto",
  sincronizarAssinatura: vi.fn().mockResolvedValue(false),
  restaurar: vi.fn().mockResolvedValue(false),
}));

const fingir = (p: "ios" | "android") => {
  (window as { Capacitor?: unknown }).Capacitor = {
    getPlatform: () => p, isNativePlatform: () => true,
  };
};

/** posCompra = true: o estado real de quem acabou de pagar. */
const montarIOS = () =>
  render(
    <MemoryRouter>
      <SignupIOS posCompra onSession={() => {}} onConfirm={() => {}} />
    </MemoryRouter>
  );

const montarAndroid = () =>
  render(
    <MemoryRouter>
      <SignupScreen posCompra onSession={() => {}} onConfirm={() => {}} />
    </MemoryRouter>
  );

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("iPhone: a tela que aparece depois de pagar", () => {
  it("oferece Continuar com a Apple — regra 4.8", () => {
    fingir("ios");
    montarIOS();
    expect(screen.getByText("Continuar com a Apple")).toBeInTheDocument();
  });

  it("NÃO oferece o Google — no iOS ele não volta do navegador", () => {
    fingir("ios");
    montarIOS();
    expect(screen.queryByText("Continuar com Google")).toBeNull();
    // e o caminho universal continua de pé
    expect(screen.getByPlaceholderText(/melhor e-mail/i)).toBeInTheDocument();
  });

  it("não cita Pix, Google nem Play em lugar nenhum — 3.1.1", () => {
    fingir("ios");
    const { container } = montarIOS();
    const texto = container.textContent ?? "";
    expect(texto).not.toMatch(/pix/i);
    expect(texto).not.toMatch(/google/i);
    expect(texto).not.toMatch(/play/i);
  });

  it("não pergunta como a pessoa pagou", () => {
    fingir("ios");
    const { container } = montarIOS();
    expect(container.textContent ?? "").not.toMatch(/como você pagou/i);
  });

  it("não promete garantia própria — na Apple quem reembolsa é a Apple", () => {
    fingir("ios");
    const { container } = montarIOS();
    expect(container.textContent ?? "").not.toMatch(/garantia/i);
  });
});

describe("Android segue exatamente como estava", () => {
  it("mantém o Google e NÃO ganha o botão da Apple", () => {
    fingir("android");
    montarAndroid();
    expect(screen.getByText("Continuar com Google")).toBeInTheDocument();
    expect(screen.queryByText("Continuar com a Apple")).toBeNull();
  });

  it("continua perguntando como pagou (única fonte do mix Pix×cartão)", () => {
    fingir("android");
    const { container } = montarAndroid();
    expect(container.textContent ?? "").toMatch(/como você pagou/i);
  });

  it("mantém a garantia de 7 dias", () => {
    fingir("android");
    const { container } = montarAndroid();
    expect(container.textContent ?? "").toMatch(/garantia de 7 dias/i);
  });
});
