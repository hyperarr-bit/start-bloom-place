/**
 * PAYWALL SEM TESTE (12/11, 1.0.26 iPhone / Android 138) — chave `paywall_teste` (lib/paywall-teste), padrão "off".
 *  · a chave: padrão off; metadata do RevenueCat on/off (a `current` vence); a resposta fica no aparelho (reabrir o app
 *    antes de a loja responder mostra o mesmo paywall); força de QA; a chave nova é do APARELHO (sobrevive às vassouras);
 *  · as offerings: `sem_teste` primeiro; ids do Android (produto:plano_base); core_anual_69_direto nunca casa core_anual_69;
 *  · a tela (conta VAZIA, sem seeds): nenhum texto de teste, anual marcado, os produtos novos, preços da loja;
 *  · a saída: Voltar ou folha cancelada → presente 69,90 SEM teste (core_anual_69_direto), 1x por paywall aberto;
 *  · as molduras: ComecarW (funil) e o gate do TrialBanner — off = PaywallSemTeste; on = o paywall de hoje;
 *  · reabrir: quem pagou não vê paywall nenhum, com a chave on ou off.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const loja = vi.hoisted(() => ({
  ok: true, motivo: null as string | null, restauraOk: false,
  anual: { produto: "core_anual_97_direto", preco: "R$ 97,90", valor: 97.9, precoMes: "R$ 8,16", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  mensal: { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
  presente: { produto: "core_anual_69_direto", preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,83", offering: "sem_teste", pacote: true } as null | Record<string, unknown>,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  initRevenueCat: vi.fn(async () => "pronto"),
  prefetchSemTeste: vi.fn(async () => undefined),
  dadosSemTeste: (p: "anual" | "mensal" | "presente") => loja[p],
  comprarSemTeste: vi.fn(async () => loja.ok),
  motivoUltimaCompra: () => loja.motivo,
  restaurar: vi.fn(async () => loja.restauraOk),
  compraAssinaturaLocal: vi.fn(async () => false),
  identificarRevenueCat: vi.fn(async () => undefined),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/notificacoes", () => ({ cancelarResgateDoPlano: vi.fn(async () => undefined) }));

import { trackEvent } from "@/lib/analytics";
import { comprarSemTeste } from "@/lib/revenuecat";
import { lerPacotesSemTeste } from "@/lib/revenuecat";
import {
  CHAVE_FORCA_PAYWALL_TESTE, CHAVE_PAYWALL_TESTE_APARELHO, PRODUTOS_SEM_TESTE, _zerarChavePaywallTeste,
  guardarForcaPaywallTeste, lerChaveRemotaPaywallTeste, modoPaywallTeste, paywallComTeste, registrarPaywallTesteRemoto,
} from "@/lib/paywall-teste";
import { CHAVES_DO_APARELHO } from "@/lib/chaves-do-aparelho";
import { PaywallSemTeste, economiaDoAnual, itensIncluidos, linhaDoQueVocePaga } from "@/components/paywall/PaywallSemTeste";

const TEXTO_DE_TESTE = /teste|gr[aá]tis|3 dias|R\$ ?0,00|nada [eé] cobrado hoje/i;
const ios = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; };
const android = () => { (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => "android" }; };
const espera = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const montar = (o: { onPago?: () => void; onVoltar?: () => void; modo?: "funil" | "gate" | "planos" } = {}) => {
  const onPago = o.onPago ?? vi.fn();
  render(<MemoryRouter><PaywallSemTeste area="dinheiro" answers={{}} onPagoSemConta={onPago} onVoltar={o.onVoltar} modo={o.modo} /></MemoryRouter>);
  return onPago;
};
const esperarLoja = () => waitFor(() => expect(screen.getByTestId("sem-teste-anual").textContent).toContain("R$ 97,90"));

beforeEach(() => {
  delete (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__; // o padrão de verdade (o setup fixa "on")
  localStorage.clear(); // conta VAZIA, aparelho novo: nenhum seed
  _zerarChavePaywallTeste();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarSemTeste).mockClear();
  loja.ok = true; loja.motivo = null; loja.restauraOk = false;
  loja.anual = { produto: "core_anual_97_direto", preco: "R$ 97,90", valor: 97.9, precoMes: "R$ 8,16", offering: "sem_teste", pacote: true };
  loja.mensal = { produto: "core_mensal_34", preco: "R$ 34,90", valor: 34.9, precoMes: null, offering: "sem_teste", pacote: true };
  loja.presente = { produto: "core_anual_69_direto", preco: "R$ 69,90", valor: 69.9, precoMes: "R$ 5,83", offering: "sem_teste", pacote: true };
  ios();
});
afterEach(() => { cleanup(); delete (window as { Capacitor?: unknown }).Capacitor; (globalThis as { __PAYWALL_TESTE__?: string }).__PAYWALL_TESTE__ = "on"; });

/* ─────────────────────────────── a chave ─────────────────────────────── */
describe("a chave `paywall_teste` (lib/paywall-teste)", () => {
  it("padrão = off (sem teste): sem RevenueCat, sem resposta guardada", () => {
    expect(modoPaywallTeste()).toBe("off");
    expect(paywallComTeste()).toBe(false);
  });
  it("metadata do RevenueCat: on/off em qualquer offering, a `current` vence; ausente = off", () => {
    expect(lerChaveRemotaPaywallTeste({ current: { metadata: {} }, all: { x: { metadata: { paywall_teste: "on" } } } })).toBe("on");
    const atual = { metadata: { paywall_teste: "off" } };
    expect(lerChaveRemotaPaywallTeste({ current: atual, all: { d: atual, x: { metadata: { paywall_teste: "on" } } } })).toBe("off");
    expect(lerChaveRemotaPaywallTeste({ current: { metadata: { paywall_teste: "talvez" } }, all: {} })).toBeNull();
    registrarPaywallTesteRemoto({ current: { metadata: {} }, all: {} });
    expect(modoPaywallTeste()).toBe("off");
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_teste: "on" } }, all: {} });
    expect(paywallComTeste()).toBe(true);
  });
  it("FECHAR E REABRIR: a última resposta fica no aparelho (o paywall não troca antes de a loja responder)", () => {
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_teste: "on" } }, all: {} });
    _zerarChavePaywallTeste(); // o app morreu: a memória some, o aparelho fica
    expect(localStorage.getItem(CHAVE_PAYWALL_TESTE_APARELHO)).toBe("on");
    expect(paywallComTeste()).toBe(true);
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_teste: "off" } }, all: {} });
    _zerarChavePaywallTeste();
    expect(paywallComTeste()).toBe(false);
  });
  it("a chave do aparelho sobrevive às vassouras do cache (lista única)", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_PAYWALL_TESTE_APARELHO)).toBe(true);
  });
  it("força de QA `?paywall-teste=on|off|auto` vence o RevenueCat", () => {
    registrarPaywallTesteRemoto({ current: { metadata: { paywall_teste: "off" } }, all: {} });
    guardarForcaPaywallTeste("?paywall-teste=on");
    expect(paywallComTeste()).toBe(true);
    guardarForcaPaywallTeste("?paywall-teste=auto");
    expect(localStorage.getItem(CHAVE_FORCA_PAYWALL_TESTE)).toBeNull();
    expect(paywallComTeste()).toBe(false);
  });
});

/* ─────────────────────────────── as offerings ─────────────────────────────── */
describe("os produtos novos nas offerings (lerPacotesSemTeste)", () => {
  const pac = (id: string) => ({ identifier: id, product: { identifier: id, priceString: "x" } });
  it("um lugar só pros ids", () => {
    expect(PRODUTOS_SEM_TESTE).toEqual({ anual: "core_anual_97_direto", mensal: "core_mensal_34", presente: "core_anual_69_direto", vitalicio: "core_vitalicio_97" });
  });
  it("lê a offering `sem_teste` (que NÃO é a atual) — iPhone", () => {
    const r = lerPacotesSemTeste({
      current: { identifier: "default", availablePackages: [pac("core_anual_97"), pac("core_mensal")] },
      all: {
        default: { identifier: "default", availablePackages: [pac("core_anual_97"), pac("core_mensal")] },
        anual_69: { identifier: "anual_69", availablePackages: [pac("core_anual_69")] },
        sem_teste: { identifier: "sem_teste", availablePackages: [pac("core_anual_97_direto"), pac("core_mensal_34"), pac("core_anual_69_direto")] },
      },
    });
    expect(r.anual?.pacote.product.identifier).toBe("core_anual_97_direto");
    expect(r.mensal?.pacote.product.identifier).toBe("core_mensal_34");
    expect(r.presente?.pacote.product.identifier).toBe("core_anual_69_direto");
    expect(r.presente?.offering).toBe("sem_teste");
  });
  it("Android: produto:plano_base", () => {
    const r = lerPacotesSemTeste({ current: null, all: { sem_teste: { identifier: "sem_teste", availablePackages: [
      pac("core_anual_97_direto:coreanual97direto"), pac("core_mensal_34:coremensal34"), pac("core_anual_69_direto:coreanual69direto"),
    ] } } });
    expect(r.anual?.pacote.product.identifier).toBe("core_anual_97_direto:coreanual97direto");
    expect(r.mensal?.pacote.product.identifier).toBe("core_mensal_34:coremensal34");
    expect(r.presente?.pacote.product.identifier).toBe("core_anual_69_direto:coreanual69direto");
  });
  it("o 69,90 de hoje (com teste) nunca vira o presente sem teste; nada da loja = nada (sem botão morto)", () => {
    const r = lerPacotesSemTeste({ current: null, all: { anual_69: { identifier: "anual_69", availablePackages: [pac("core_anual_69"), pac("core_mensal")] } } });
    expect(r).toEqual({});
  });
});

/* ─────────────────────────────── a tela ─────────────────────────────── */
describe("a tela (PaywallSemTeste) — conta vazia, chave off", () => {
  it("contas puras: economia 77%, 4 itens, a linha do que se paga", () => {
    expect(economiaDoAnual(97.9, 34.9)).toBe(77);
    expect(itensIncluidos("dinheiro")).toHaveLength(4);
    expect(linhaDoQueVocePaga("anual", "R$ 97,90")).toBe("Você paga R$ 97,90 hoje. Renovação anual automática. Cancele quando quiser.");
    expect(linhaDoQueVocePaga("mensal", "R$ 34,90")).toBe("Você paga R$ 34,90 hoje. Renovação mensal automática. Cancele quando quiser.");
  });

  it("a estrutura da Enxovaly, o anual marcado, os preços da loja e NENHUM texto de teste", async () => {
    montar();
    await esperarLoja();
    const tela = screen.getByTestId("paywall-sem-teste");
    expect(tela.dataset.plano).toBe("anual");
    expect(screen.getByTestId("sem-teste-titulo").textContent).toBe("Libere o CORE completo");
    expect(screen.getByTestId("sem-teste-itens").querySelectorAll("li")).toHaveLength(4);
    expect(screen.getByTestId("sem-teste-selo").textContent).toBe("ECONOMIZE 77%. MELHOR VALOR");
    expect(screen.getByTestId("sem-teste-anual").textContent).toContain("R$ 8,16/mês");
    expect(screen.getByTestId("sem-teste-mensal").textContent).toContain("R$ 34,90/mês");
    expect(screen.getByTestId("sem-teste-cta").textContent).toBe("Assinar plano anual");
    expect(screen.getByTestId("sem-teste-legal").textContent).toBe("Você paga R$ 97,90 hoje. Renovação anual automática. Cancele quando quiser.");
    expect(screen.getByTestId("sem-teste-rodape").textContent).toMatch(/Restaurar compras.*Termos.*Privacidade/);
    expect(tela.textContent).not.toMatch(TEXTO_DE_TESTE);
    expect(eventos("paywall_oferta_vista")[0]).toMatchObject({ produto: "core_anual_97_direto", trial: false, paywall_teste: "off" });
  });

  it("loja calada: a reserva de texto (97,90 / 34,90), sem texto de teste", async () => {
    loja.anual = null; loja.mensal = null;
    montar();
    await espera();
    expect(screen.getByTestId("sem-teste-anual").textContent).toContain("R$ 97,90");
    expect(screen.getByTestId("sem-teste-mensal").textContent).toContain("R$ 34,90");
    expect(screen.getByTestId("paywall-sem-teste").textContent).not.toMatch(TEXTO_DE_TESTE);
  });

  it("mensal marcado troca o botão e a linha; compra o core_mensal_34", async () => {
    const onPago = montar();
    await esperarLoja();
    fireEvent.click(screen.getByTestId("sem-teste-mensal"));
    expect(screen.getByTestId("sem-teste-cta").textContent).toBe("Assinar plano mensal");
    expect(screen.getByTestId("sem-teste-legal").textContent).toBe("Você paga R$ 34,90 hoje. Renovação mensal automática. Cancele quando quiser.");
    await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenCalledWith("mensal", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_mensal_34", trial: false });
  });

  it("anual: compra o core_anual_97_direto e segue (cadastro)", async () => {
    const onPago = montar();
    await esperarLoja();
    await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalledTimes(1));
    expect(comprarSemTeste).toHaveBeenCalledWith("anual", "ios");
  });

  it("CANCELOU A FOLHA → presente 69,90 SEM teste (core_anual_69_direto); comprar entra", async () => {
    loja.ok = false; loja.motivo = "cancelou";
    const onPago = montar();
    await esperarLoja();
    await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-cta")); });
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    const p = screen.getByTestId("presente-direto");
    expect(p.textContent).toContain("R$ 69,90");
    expect(p.textContent).toContain("Você paga R$ 69,90 hoje.");
    expect(p.textContent).not.toMatch(TEXTO_DE_TESTE);
    loja.ok = true; loja.motivo = null;
    // a caixa abre em ~0,4 s (o botão só vale aberto, como no presente de hoje)
    await waitFor(() => expect((screen.getByTestId("presente-direto-cta") as HTMLButtonElement).disabled).toBe(false));
    await act(async () => { fireEvent.click(screen.getByTestId("presente-direto-cta")); });
    await waitFor(() => expect(onPago).toHaveBeenCalled());
    expect(comprarSemTeste).toHaveBeenLastCalledWith("presente", "ios");
    expect(eventos("app_sheet_success")[0]).toMatchObject({ produto: "core_anual_69_direto", oferta: "presente69_direto", trial: false });
  });

  it("VOLTAR → presente (sem recuar); Agora não → o paywall; o próximo Voltar recua e o presente não volta", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const onVoltar = vi.fn();
      montar({ onVoltar });
      await esperarLoja();
      await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-voltar")); });
      await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(onVoltar).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("presente-direto-agora-nao"));
      expect(screen.queryByTestId("presente-direto")).toBeNull();
      await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-voltar")); });
      await act(async () => { vi.advanceTimersByTime(600); });
      expect(onVoltar).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("presente-direto")).toBeNull();
    } finally { vi.useRealTimers(); }
  });

  it("o evento `core:voltar` do ComecarW também abre o presente", async () => {
    montar();
    await esperarLoja();
    await act(async () => { window.dispatchEvent(new CustomEvent("core:voltar")); });
    await waitFor(() => expect(screen.getByTestId("presente-direto")).toBeTruthy());
    expect(screen.getByTestId("presente-direto").textContent).toContain("App Store");
    expect(screen.getByTestId("presente-direto").textContent).not.toMatch(TEXTO_DE_TESTE);
  });

  it("sem o produto do presente na loja: nada abre (nunca botão morto)", async () => {
    loja.presente = null; loja.ok = false; loja.motivo = "cancelou";
    montar();
    await esperarLoja();
    await act(async () => { fireEvent.click(screen.getByTestId("sem-teste-cta")); });
    await espera(60);
    expect(screen.queryByTestId("presente-direto")).toBeNull();
  });

  it("gate: sem Voltar, com Entrar com outra conta e Excluir conta", async () => {
    montar({ modo: "gate" });
    await esperarLoja();
    expect(screen.queryByTestId("sem-teste-voltar")).toBeNull();
    expect(screen.getByText("Entrar com outra conta")).toBeTruthy();
    expect(screen.getByText("Excluir conta")).toBeTruthy();
    expect(screen.getByTestId("paywall-sem-teste").textContent).not.toMatch(TEXTO_DE_TESTE);
  });
});
