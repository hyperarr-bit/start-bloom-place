/**
 * Resgate do teste cancelado no iPHONE (20/09): a tela oferecia o mensal "em
 * vez de R$ 159,90 de uma vez" — preço do Android e mecânica de compra única.
 * No iPhone o anual é R$ 97,90 por ano, assinatura.
 *
 * 16/10 (escada da 1.0.16): no iPhone o teste cancelado tenta ANTES o mensal 19,90 direto
 * (saida_direto_19) e o presente 69,90; esta tela (mensal 24,90) é a RESERVA quando os dois não
 * existem. O mock antigo não tinha situacaoDoPresente/carregarPresente69/carregarMensal19: a
 * reserva só aparecia porque as chamadas LANÇAVAM — e, com a máquina carregada, os imports a mais
 * passavam do 1 s do findByText (falhava na suíte inteira, passava sozinho). Agora o mock diz
 * explicitamente "sem presente, sem 19,90" e há um caso com o presente na loja.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SaveOfferDowngrade } from "./SaveOfferDowngrade";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1" }, isSubscribed: true, billingPeriod: "annual" }) }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => true }));
vi.mock("@/lib/teste-gratis", () => ({ trialCartaoAtivo: () => true }));
vi.mock("@/lib/loja", () => ({ ehApple: () => true }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
// 01/10 (teste de preço): o preço do ano vem do que ela COMPROU (pedido do
// lembrete) ou da loja — nunca de um "97,90" chumbado.
const loja = vi.hoisted(() => ({
  preco: "R$ 97,90" as string | null,
  presente: null as null | { preco: string; valor: number; precoMes: string | null; produto: string; comTrial: boolean; dias: number },
}));
vi.mock("@/lib/revenuecat", () => ({
  estadoTrialCancelado: async () => true, comprar: vi.fn(), motivoUltimaCompra: () => null,
  prefetchAnualIos: async () => {}, precoAnualIos: () => loja.preco,
  idProdutoAnualIos: () => "core_anual_97", valorAnualIos: () => 97.9,
  // a pessoa está no teste cancelado; presente 69,90 e mensal 19,90 fora da loja (a reserva é esta tela)
  situacaoDoPresente: async () => ({ lugar: "cancelou_teste", fimMs: null }),
  carregarPresente69: async () => loja.presente,
  carregarMensal19: async () => null,
}));
const ESPERA = { timeout: 5000 };

afterEach(cleanup);

describe("SaveOfferDowngrade no iPhone", () => {
  it("compara com o anual do iPhone, por ano (preço da loja), e nunca fala em 'de uma vez'", async () => {
    localStorage.clear();
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText(/em vez de R\$ 97,90 por ano/, {}, ESPERA)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/159,90|de uma vez|vitalíc|pra sempre/i);
    expect(screen.getByRole("button", { name: /Mudar pro mensal — R\$ 24,90\/mês/ })).toBeInTheDocument();
  });

  it("quem comprou no braço 69,90 lê 69,90 (o preço guardado na compra vence o da loja de agora)", async () => {
    localStorage.clear();
    localStorage.setItem("core-lembrete-teste", JSON.stringify({ fimMs: Date.now() + 86400e3, precoAno: "R$ 69,90" }));
    render(<SaveOfferDowngrade />);
    expect(await screen.findByText(/em vez de R\$ 69,90 por ano/, {}, ESPERA)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/97,90/);
  });

  it("loja muda e nada guardado: fala 'do anual', sem inventar número", async () => {
    localStorage.clear();
    loja.preco = null;
    try {
      render(<SaveOfferDowngrade />);
      expect(await screen.findByText(/em vez do anual/, {}, ESPERA)).toBeInTheDocument();
      expect(document.body.textContent).not.toMatch(/97,90|69,90/);
    } finally { loja.preco = "R$ 97,90"; }
  });

  it("com o presente 69,90 na loja: ele aparece NO LUGAR do mensal 24,90 (nunca os dois)", async () => {
    localStorage.clear();
    loja.presente = { preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,82", produto: "core_anual_69", comTrial: false, dias: 0 };
    try {
      render(<SaveOfferDowngrade />);
      const folha = await screen.findByTestId("presente69", {}, ESPERA);
      expect(folha).toHaveAttribute("data-lugar", "cancelou_teste");
      expect(document.body.textContent).not.toMatch(/Mudar pro mensal — R\$ 24,90/);
    } finally { loja.presente = null; }
  });
});
