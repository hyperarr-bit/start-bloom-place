/**
 * A VITRINE DO ANDROID — 3º arranjo (01/09): DUAS colunas, VITALÍCIO em foco.
 *
 * Este arquivo existe porque a escolha é contraintuitiva nos DOIS sentidos, e
 * já mudou de lado uma vez. O histórico, com dinheiro em cima de cada um:
 *
 *   1. só o vitalício de 97,90 (até 31/08 21h) — o mensal só aparecia como
 *      resgate, depois de a folha do Google recusar o pagamento;
 *   2. duas colunas com o MENSAL em foco (31/08 21h → 01/09) — a aposta era
 *      que mensalidade rende mais no mesmo dinheiro preso, já que a Play fica
 *      com 15% e segura o caixa 60 dias;
 *   3. duas colunas com o VITALÍCIO em foco — este.
 *
 * POR QUE O 2 PERDEU, com o número que decidiu (01/09, janela BRT, até 09:45):
 *   a campanha do app gastou R$ 397,22 → R$ 452,83 com o imposto de 14% da Meta;
 *   8 vendas (sete de 24,90 + uma de 97,90) = R$ 272,20 bruto → R$ 231,37
 *   líquido → ROI 0,51×. Os MESMOS 8 compradores no vitalício dariam R$ 783,20
 *   bruto → R$ 665,72 líquido → ROI 1,47×, sem convencer ninguém a mais.
 *
 * E não foi por falta de conversão: o mensal fechou MELHOR na folha do Google —
 * 30% (6 de 20) contra os ~13% históricos do vitalício. Só que o tíquete é 3,9×
 * maior; pra empatar, o barato precisaria fechar ~4× melhor, e fechou ~2×.
 *
 * O que este teste trava:
 *   · as DUAS colunas continuam na tela (o mensal não pode sumir — ele ancora o
 *     preço e é o resgate de quem recusa);
 *   · o VITALÍCIO nasce selecionado;
 *   · a âncora do topo abre no preço do vitalício e o CTA fala de pagamento
 *     único, sem promessa de renovação;
 *   · dá pra escolher o mensal em um toque, e aí a tela inteira acompanha,
 *     inclusive o aviso de renovação (exigência de loja, não capricho).
 *
 * Trocar ANDROID_PLANO_INICIAL ou ANDROID_DUAS_COLUNAS quebra aqui DE
 * PROPÓSITO: é superfície de venda, e a troca tem que ser consciente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PaywallW } from "./PaywallW";

vi.mock("@/lib/revenuecat", () => ({
  initRevenueCat: vi.fn().mockResolvedValue(undefined),
  prefetchVitalicio: vi.fn().mockResolvedValue(undefined),
  estadoRevenueCat: () => "pronto",
  temVitalicio97: () => true,
  comprar: vi.fn(),
  comprarVitalicio: vi.fn(),
  comprarAnual97: vi.fn(),
  restaurar: vi.fn().mockResolvedValue(false),
  compraVitaliciaLocal: vi.fn().mockResolvedValue(false),
  compraAssinaturaLocal: vi.fn().mockResolvedValue(false),
  motivoUltimaCompra: () => null,
  inicioUltimaFolha: () => null,
  sincronizarAssinatura: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));

const montar = () =>
  render(
    <MemoryRouter>
      <PaywallW area="dinheiro" answers={{ gasto: "R$ 100 a R$ 300" }} onPagoSemConta={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  (window as { Capacitor?: unknown }).Capacitor = { getPlatform: () => "android", isNativePlatform: () => true };
  localStorage.clear();
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; });

describe("paywall do Android: dois preços, vitalício em foco", () => {
  it("mostra as DUAS colunas — nenhum dos preços sai da tela", () => {
    montar();
    expect(screen.getByText(/cancele quando quiser/i)).toBeTruthy();   // coluna mensal
    expect(screen.getByText(/MELHOR ESCOLHA/i)).toBeTruthy();          // coluna vitalício
    expect(screen.getAllByText(/97,90/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24,90/).length).toBeGreaterThan(0);
  });

  it("o VITALÍCIO nasce selecionado: CTA de pagamento único, sem renovação", () => {
    montar();
    expect(screen.getByText(/Quero pra sempre/i)).toBeTruthy();
    /* A letra legal do vitalício fala de pagamento ÚNICO. Se aparecesse
     * "Assinatura de R$ 24,90/mês" aqui, o padrão teria voltado pro mensal. */
    expect(screen.getByText(/Pagamento/i)).toBeTruthy();
    expect(screen.queryByText(/Começar por R\$ ?24,90\/mês/i)).toBeNull();
  });

  it("escolher o mensal vira a tela inteira, com o aviso de renovação", () => {
    montar();
    fireEvent.click(screen.getByText(/cancele quando quiser/i));
    expect(screen.getByText(/Começar por R\$ ?24,90\/mês/i)).toBeTruthy();
    expect(screen.getByText(/Assinatura de R\$ ?24,90\/mês/i)).toBeTruthy();
    expect(screen.getByText(/cancela quando quiser/i)).toBeTruthy();
  });

  it("não sorteia braço de A/B — a vitrine é decisão, não teste", () => {
    montar();
    expect(localStorage.getItem("core-w-braco")).toBeNull();
  });
});
