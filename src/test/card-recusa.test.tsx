/**
 * CARD DA RECUSA (1.0.18, dono 22/10): tela inteira 1x por recusa com "Atualizar meu cartão" + (só iPhone, só com a
 * offering `mensal_19`) "Mudar pro mensal de R$ 19,90". Chave remota `card_recusa`, padrão OFF.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, act, waitFor } from "@testing-library/react";

const estado = vi.hoisted(() => ({
  problema: { temProblema: true, comAcesso: true, url: "https://play.google.com/store/account/subscriptions", detectadoEm: "2026-10-20T10:00:00Z" } as {
    temProblema: boolean; comAcesso: boolean; url: string | null; detectadoEm?: string | null; produto?: string | null;
  },
  oferta: { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9, precoDe: "R$ 24,90", fimMs: null } as null | Record<string, unknown>,
  compraOk: true,
  motivo: null as string | null,
}));
vi.mock("@/lib/revenuecat", async (original) => ({
  ...(await original<typeof import("@/lib/revenuecat")>()),
  problemaDeCobranca: vi.fn(async () => estado.problema),
  comprarMensal19: vi.fn(async () => estado.compraOk),
  motivoUltimaCompra: vi.fn(() => estado.motivo),
  marcarToqueDeCompra: vi.fn(),
}));
vi.mock("@/components/paywall/OfertaMensal19", async (original) => ({
  ...(await original<typeof import("@/components/paywall/OfertaMensal19")>()),
  carregarOfertaMensal19: vi.fn(async () => estado.oferta),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn(), getAttributionParams: () => ({}) }));
vi.mock("@/lib/conta-ja-tinha-acesso", async (original) => ({
  ...(await original<typeof import("@/lib/conta-ja-tinha-acesso")>()),
  acessoAnteriorDaSessao: vi.fn(async () => null),
}));
vi.mock("@/lib/cobranca-nativa", async (original) => ({
  ...(await original<typeof import("@/lib/cobranca-nativa")>()),
  segurarFolhaNativa: vi.fn(async () => {}),
}));

import { trackEvent } from "@/lib/analytics";
import { comprarMensal19 } from "@/lib/revenuecat";
import { carregarOfertaMensal19 } from "@/components/paywall/OfertaMensal19";
import { AvisoCobrancaRecusada } from "@/components/app/AvisoCobrancaRecusada";
import { URL_PAGAMENTO_APPLE, zerarAvisoDaAbertura } from "@/lib/cobranca-recusada";
import {
  CARD_RECUSA, CHAVE_CARD_RECUSA_APARELHO, CHAVE_CARD_RECUSA_VISTO, CHAVE_FORCA_CARD_RECUSA, _zerarCardRecusaRemoto,
  cardRecusaJaVisto, guardarForcaCardRecusa, lerCardRecusaRemoto, modoCardRecusa, registrarCardRecusaRemoto,
} from "@/lib/card-recusa";

const plataforma = (p: "ios" | "android" | null) => {
  if (!p) delete (window as { Capacitor?: unknown }).Capacitor;
  else (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => p };
};
const ligarPelaMetadata = (v: "on" | "off" = "on") =>
  registrarCardRecusaRemoto({ current: { identifier: "default", metadata: { card_recusa: v } }, all: {} });
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome);
/** Uma abertura do app: memória do processo zerada (o localStorage fica). */
const abrirOApp = async () => {
  cleanup();
  zerarAvisoDaAbertura();
  render(<AvisoCobrancaRecusada />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};

beforeEach(() => {
  localStorage.clear();
  _zerarCardRecusaRemoto();
  zerarAvisoDaAbertura();
  vi.mocked(trackEvent).mockClear();
  vi.mocked(comprarMensal19).mockClear();
  vi.mocked(carregarOfertaMensal19).mockClear();
  estado.problema = { temProblema: true, comAcesso: true, url: "https://play.google.com/store/account/subscriptions", detectadoEm: "2026-10-20T10:00:00Z" };
  estado.oferta = { preco: "R$ 19,90", produto: "core_mensal_19", valor: 19.9, precoDe: "R$ 24,90", fimMs: null };
  estado.compraOk = true;
  estado.motivo = null;
  plataforma("ios");
});
afterEach(() => { cleanup(); plataforma(null); });

describe("card da recusa — a chave", () => {
  it("padrão OFF (constante, sem metadata, sem força)", () => {
    expect(CARD_RECUSA).toBe("off");
    expect(modoCardRecusa()).toBe("off");
  });

  it("metadata: a `current` vence as outras; ausente = null; valor estranho ignorado", () => {
    expect(lerCardRecusaRemoto({ current: { metadata: { card_recusa: "off" } }, all: { x: { metadata: { card_recusa: "on" } } } })).toBe("off");
    expect(lerCardRecusaRemoto({ current: { metadata: {} }, all: { mensal_19: { metadata: { card_recusa: "ON" } } } })).toBe("on");
    expect(lerCardRecusaRemoto({ current: { metadata: { card_recusa: "talvez" } } })).toBeNull();
    expect(lerCardRecusaRemoto(null)).toBeNull();
  });

  it("a resposta remota fica no aparelho; tirar a chave da metadata volta pro off", () => {
    ligarPelaMetadata("on");
    expect(localStorage.getItem(CHAVE_CARD_RECUSA_APARELHO)).toBe("on");
    _zerarCardRecusaRemoto(); // nova abertura, antes do getOfferings responder
    expect(modoCardRecusa()).toBe("on");
    registrarCardRecusaRemoto({ current: { metadata: {} }, all: {} });
    expect(modoCardRecusa()).toBe("off");
    expect(localStorage.getItem(CHAVE_CARD_RECUSA_APARELHO)).toBeNull();
  });

  it("força de QA `?card-recusa=on|off|auto[,recomecar]` vence a metadata", () => {
    ligarPelaMetadata("on");
    guardarForcaCardRecusa("?card-recusa=off");
    expect(modoCardRecusa()).toBe("off");
    guardarForcaCardRecusa("?card-recusa=auto");
    expect(localStorage.getItem(CHAVE_FORCA_CARD_RECUSA)).toBeNull();
    expect(modoCardRecusa()).toBe("on");
    localStorage.setItem(CHAVE_CARD_RECUSA_VISTO, "2026-10-20T10:00:00Z");
    guardarForcaCardRecusa("?card-recusa=on,recomecar");
    expect(localStorage.getItem(CHAVE_FORCA_CARD_RECUSA)).toBe("on");
    expect(cardRecusaJaVisto("2026-10-20T10:00:00Z")).toBe(false);
  });
});

describe("card da recusa — na tela", () => {
  it("chave OFF: nada muda — a faixa de sempre, sem card e sem carregar oferta", async () => {
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
    expect(carregarOfertaMensal19).not.toHaveBeenCalled();
    expect(eventos("card_recusa_view")).toHaveLength(0);
    expect(localStorage.getItem(CHAVE_CARD_RECUSA_VISTO)).toBeNull();
  });

  it("iPhone com a offering mensal_19: os 2 caminhos + 'Agora não'; view com com_mensal19; marca gravada na hora", async () => {
    ligarPelaMetadata();
    await abrirOApp();
    const card = await screen.findByTestId("card-recusa");
    expect(card).toHaveAttribute("data-com-mensal19", "1");
    expect(screen.getByText("Seu cartão não passou")).toBeInTheDocument();
    expect(screen.getByTestId("card-recusa-cartao")).toHaveAttribute("href", URL_PAGAMENTO_APPLE);
    expect(screen.getByTestId("card-recusa-cartao")).toHaveTextContent("Atualizar meu cartão");
    expect(screen.getByTestId("card-recusa-mensal19")).toHaveTextContent("Mudar pro mensal de R$ 19,90");
    expect(screen.getByTestId("card-recusa-regra").textContent).toMatch(/Você segue usando enquanto a App Store tenta cobrar o valor menor/);
    expect(screen.getByTestId("card-recusa-agora-nao")).toBeInTheDocument();
    // a faixa não aparece por baixo
    expect(screen.queryByRole("alert")).toBeNull();
    expect(eventos("card_recusa_view")).toEqual([["card_recusa_view", { com_acesso: true, dias_restantes: expect.any(Number), com_mensal19: true }]]);
    expect(eventos("aviso_cobranca_view")).toHaveLength(0);
    expect(localStorage.getItem(CHAVE_CARD_RECUSA_VISTO)).toBe("2026-10-20T10:00:00Z");
    // copy: títulos sem ponto final, nada de "24 h", Pix ou site
    expect(screen.getByText("Seu cartão não passou").textContent).not.toMatch(/\.$/);
    expect(card.textContent).not.toMatch(/24 ?h|Pix|site|antes/i);
  });

  it("SEM a offering mensal_19 (hoje): só 'Atualizar meu cartão', sem 19,90 e sem erro", async () => {
    estado.oferta = null;
    ligarPelaMetadata();
    await abrirOApp();
    const card = await screen.findByTestId("card-recusa");
    expect(card).toHaveAttribute("data-com-mensal19", "0");
    expect(screen.getByTestId("card-recusa-cartao")).toBeInTheDocument();
    expect(screen.queryByTestId("card-recusa-mensal19")).toBeNull();
    expect(card.textContent).not.toMatch(/19,90|mensal/);
    expect(screen.queryByRole("alert", { name: /erro/i })).toBeNull();
    expect(eventos("card_recusa_view")[0][1]).toMatchObject({ com_mensal19: false });
  });

  it("1x por recusa: reabrir o app não repete (volta o de sempre); recusa NOVA mostra de novo", async () => {
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    // fechou o app com o card na tela (sem tocar em nada) e reabriu
    await abrirOApp();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
    await abrirOApp();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
    expect(eventos("card_recusa_view")).toHaveLength(1);
    // um mês depois, outra recusa (outro billingIssueDetectedAt)
    estado.problema = { ...estado.problema, detectadoEm: "2026-11-20T10:00:00Z" };
    await abrirOApp();
    expect(await screen.findByTestId("card-recusa")).toBeInTheDocument();
    expect(eventos("card_recusa_view")).toHaveLength(2);
  });

  it("'Agora não': o card sai e, nesta abertura, fica a faixa de sempre", async () => {
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-agora-nao")); });
    expect(screen.queryByTestId("card-recusa")).toBeNull();
    expect(await screen.findByText("Seu pagamento não passou")).toBeInTheDocument();
    expect(eventos("card_recusa_agora_nao")).toEqual([["card_recusa_agora_nao", { com_acesso: true, dias_restantes: expect.any(Number), com_mensal19: true }]]);
  });

  it("'Atualizar meu cartão': evento e o card sai", async () => {
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-cartao")); });
    expect(eventos("card_recusa_cartao")).toHaveLength(1);
    expect(screen.queryByTestId("card-recusa")).toBeNull();
  });

  it("'Mudar pro mensal' com sucesso: compra o mensal 19 (lugar recusa) e mostra 'Plano trocado' sem prometer acesso na hora", async () => {
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-mensal19")); });
    await waitFor(() => expect(screen.getByTestId("card-recusa-trocou")).toBeInTheDocument());
    expect(comprarMensal19).toHaveBeenCalledWith("recusa");
    expect(screen.getByText("Plano trocado")).toBeInTheDocument();
    expect(screen.getByTestId("card-recusa-trocou").textContent).toMatch(/A App Store cobra o valor novo na próxima tentativa\./);
    expect(eventos("card_recusa_mensal19")).toHaveLength(1);
    expect(eventos("card_recusa_compra")[0][1]).toMatchObject({ resultado: "sucesso", preco: "R$ 19,90" });
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-entendi")); });
    expect(screen.queryByTestId("card-recusa")).toBeNull();
  });

  it("folha da Apple cancelada: resultado 'cancelou', o card fica, sem mensagem de erro", async () => {
    estado.compraOk = false; estado.motivo = "cancelou";
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-mensal19")); });
    await waitFor(() => expect(eventos("card_recusa_compra")).toHaveLength(1));
    expect(eventos("card_recusa_compra")[0][1]).toMatchObject({ resultado: "cancelou", motivo: "cancelou" });
    expect(screen.getByTestId("card-recusa")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erro da loja: resultado 'falhou' e a mensagem de sempre", async () => {
    estado.compraOk = false; estado.motivo = "billing_erro";
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    await act(async () => { fireEvent.click(screen.getByTestId("card-recusa-mensal19")); });
    await waitFor(() => expect(eventos("card_recusa_compra")[0]?.[1]).toMatchObject({ resultado: "falhou", motivo: "billing_erro" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("quem já está no core_mensal_19 não recebe a oferta dele mesmo", async () => {
    estado.problema = { ...estado.problema, produto: "core_mensal_19" };
    ligarPelaMetadata();
    await abrirOApp();
    expect(await screen.findByTestId("card-recusa")).toHaveAttribute("data-com-mensal19", "0");
    expect(carregarOfertaMensal19).not.toHaveBeenCalled();
  });

  it("sem acesso (carência acabou): o texto do 19,90 não promete acesso na hora", async () => {
    estado.problema = { ...estado.problema, comAcesso: false };
    ligarPelaMetadata();
    await abrirOApp();
    await screen.findByTestId("card-recusa");
    expect(screen.getByTestId("card-recusa-regra").textContent).toMatch(/O acesso volta quando a App Store conseguir cobrar o valor menor/);
  });

  it("Android: só 'Atualizar meu cartão' (na Play), sem tentar o 19,90", async () => {
    plataforma("android");
    ligarPelaMetadata();
    await abrirOApp();
    const card = await screen.findByTestId("card-recusa");
    expect(card).toHaveAttribute("data-com-mensal19", "0");
    expect(screen.getByTestId("card-recusa-cartao")).toHaveAttribute("href", "https://play.google.com/store/account/subscriptions");
    expect(card.textContent).toMatch(/Atualize o cartão na Google Play pra continuar com o CORE\./);
    expect(carregarOfertaMensal19).not.toHaveBeenCalled();
  });

  it("web: nada, mesmo com a chave", async () => {
    plataforma(null);
    guardarForcaCardRecusa("?card-recusa=on");
    await abrirOApp();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
  });

  it("sem cartão recusado: nada", async () => {
    estado.problema = { temProblema: false, comAcesso: false, url: null };
    ligarPelaMetadata();
    await abrirOApp();
    expect(screen.queryByTestId("card-recusa")).toBeNull();
    expect(eventos("card_recusa_view")).toHaveLength(0);
  });
});
